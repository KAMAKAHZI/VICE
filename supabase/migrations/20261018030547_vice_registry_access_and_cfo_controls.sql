-- Registry controls are database-authoritative. This migration contains no
-- member identities, live allocation changes, or account removals.
CREATE SCHEMA IF NOT EXISTS vice_private;
REVOKE ALL ON SCHEMA vice_private FROM PUBLIC,anon;
GRANT USAGE ON SCHEMA vice_private TO authenticated;

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS account_suspended boolean NOT NULL DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS account_revoked boolean NOT NULL DEFAULT false;
ALTER TABLE public.holders ADD COLUMN IF NOT EXISTS holdings_locked boolean NOT NULL DEFAULT false;
ALTER TABLE public.holders ADD COLUMN IF NOT EXISTS account_suspended boolean NOT NULL DEFAULT false;
ALTER TABLE public.holders ADD COLUMN IF NOT EXISTS account_revoked boolean NOT NULL DEFAULT false;
ALTER TABLE public.holders ADD COLUMN IF NOT EXISTS closed_at timestamptz;
CREATE INDEX IF NOT EXISTS vice_holder_email_normalized ON public.holders(lower(btrim(email))) WHERE closed_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS vice_username_normalized ON public.profiles(lower(btrim(username))) WHERE nullif(btrim(username),'') IS NOT NULL;
REVOKE INSERT,UPDATE,DELETE ON public.holders FROM anon,authenticated;
REVOKE UPDATE(account_suspended,account_revoked) ON public.profiles FROM anon,authenticated;

CREATE OR REPLACE FUNCTION vice_private.account_allowed()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT auth.uid() IS NOT NULL
 AND EXISTS(SELECT 1 FROM auth.users u WHERE u.id=auth.uid() AND u.deleted_at IS NULL
   AND (u.banned_until IS NULL OR u.banned_until<=now()))
 AND NOT EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=auth.uid()
   AND (p.account_suspended OR p.account_revoked))
 AND NOT EXISTS(SELECT 1 FROM public.holders h WHERE (h.user_id=auth.uid() OR h.profile_id=auth.uid()
   OR (h.user_id IS NULL AND h.profile_id IS NULL AND nullif(lower(btrim(h.email)),'')=
      (SELECT lower(btrim(u.email)) FROM auth.users u WHERE u.id=auth.uid())))
   AND (h.account_suspended OR h.account_revoked OR h.closed_at IS NOT NULL))
 AND (nullif(auth.jwt()->>'session_id','') IS NULL OR EXISTS(
   SELECT 1 FROM auth.sessions s WHERE s.user_id=auth.uid() AND s.id::text=auth.jwt()->>'session_id'));
$$;
REVOKE ALL ON FUNCTION vice_private.account_allowed() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION vice_private.account_allowed() TO authenticated;

CREATE OR REPLACE FUNCTION vice_private.require_active_account()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 IF NOT vice_private.account_allowed() THEN
  RAISE EXCEPTION 'Account access is suspended, revoked, or expired. Contact an administrator.' USING ERRCODE='42501';
 END IF;
END $$;
REVOKE ALL ON FUNCTION vice_private.require_active_account() FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.is_super()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT vice_private.account_allowed() AND EXISTS(SELECT 1 FROM public.profiles WHERE id=auth.uid() AND role='SUPER_ADMIN');
$$;
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT vice_private.account_allowed() AND EXISTS(SELECT 1 FROM public.profiles WHERE id=auth.uid()
 AND role IN ('SUPER_ADMIN','EXECUTIVE','COMPLIANCE_OFFICER','FINANCE_OFFICER','LEGAL_OFFICER','TREASURY_OPERATOR','AUDITOR'));
$$;

CREATE OR REPLACE FUNCTION vice_private.is_registry_operator()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT vice_private.account_allowed() AND EXISTS(SELECT 1 FROM public.profiles WHERE id=auth.uid()
 AND role IN ('SUPER_ADMIN','FINANCE_OFFICER'));
$$;
CREATE OR REPLACE FUNCTION vice_private.is_reserve_holder(p_holder_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT EXISTS(SELECT 1 FROM public.holders h WHERE h.id=p_holder_id AND (
  h.status='ESTATE_RESERVE' OR upper(coalesce(h.holder_type,''))='ESTATE_RESERVE'
  OR EXISTS(SELECT 1 FROM public.profiles p WHERE p.role='SUPER_ADMIN'
    AND p.id IN (h.id,h.user_id,h.profile_id))));
$$;
REVOKE ALL ON FUNCTION vice_private.is_registry_operator(),vice_private.is_reserve_holder(uuid) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.vice_member_access_status()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT jsonb_build_object('allowed',vice_private.account_allowed(),
   'suspended',coalesce((SELECT account_suspended FROM public.profiles WHERE id=auth.uid()),false),
   'revoked',coalesce((SELECT account_revoked FROM public.profiles WHERE id=auth.uid()),false));
$$;
REVOKE ALL ON FUNCTION public.vice_member_access_status() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.vice_member_access_status() TO authenticated;

-- Column revokes do not override a pre-existing table-level UPDATE grant.
-- Only the authorized SECURITY DEFINER control RPC may write these flags.
CREATE OR REPLACE FUNCTION vice_private.guard_profile_access_flags()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $$
BEGIN
 IF (NEW.account_suspended IS DISTINCT FROM OLD.account_suspended
  OR NEW.account_revoked IS DISTINCT FROM OLD.account_revoked)
  AND current_user NOT IN ('postgres','supabase_admin') THEN
  RAISE EXCEPTION 'Use the authorized registry control workflow' USING ERRCODE='42501';
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION vice_private.guard_profile_access_flags() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS vice_profile_access_flags_guard ON public.profiles;
CREATE TRIGGER vice_profile_access_flags_guard BEFORE UPDATE ON public.profiles
 FOR EACH ROW EXECUTE FUNCTION vice_private.guard_profile_access_flags();

-- Even an unexpired access JWT cannot bypass a suspension or a deleted account.
-- Restrictive policies are ANDed with every existing authorization policy.
DO $$ DECLARE t record; BEGIN
 FOR t IN SELECT n.nspname,c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE c.relkind IN ('r','p') AND c.relrowsecurity
   AND (n.nspname='public' OR (n.nspname='storage' AND c.relname='objects') OR (n.nspname='realtime' AND c.relname='messages'))
 LOOP
  EXECUTE format('DROP POLICY IF EXISTS vice_active_account_guard ON %I.%I',t.nspname,t.relname);
  EXECUTE format('CREATE POLICY vice_active_account_guard ON %I.%I AS RESTRICTIVE FOR ALL TO authenticated USING ((SELECT vice_private.account_allowed())) WITH CHECK ((SELECT vice_private.account_allowed()))',t.nspname,t.relname);
 END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.lookup_email_for_login(p_identifier text)
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE v_email text; matches integer;
BEGIN
 IF length(btrim(coalesce(p_identifier,''))) NOT BETWEEN 3 AND 100 OR position('@' IN p_identifier)>0 THEN RETURN NULL; END IF;
 SELECT min(lower(btrim(p.email))),count(*) INTO v_email,matches FROM public.profiles p
  WHERE lower(btrim(p.username))=lower(btrim(p_identifier)) AND NOT p.account_suspended AND NOT p.account_revoked;
 IF matches<>1 THEN RETURN NULL; END IF;
 RETURN v_email;
END $$;

CREATE OR REPLACE FUNCTION public.get_or_create_holder()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE p public.profiles%ROWTYPE; h public.holders%ROWTYPE; cid text; matches integer;
BEGIN
 PERFORM vice_private.require_active_account();
 PERFORM pg_advisory_xact_lock(793151205);
 SELECT * INTO p FROM public.profiles WHERE id=auth.uid();
 IF NOT FOUND THEN RAISE EXCEPTION 'A valid invitation must be redeemed before creating a holder record'; END IF;
 SELECT * INTO h FROM public.holders WHERE (profile_id=p.id OR user_id=p.id) AND closed_at IS NULL FOR UPDATE;
 IF FOUND THEN RETURN to_jsonb(h); END IF;
 SELECT count(*) INTO matches FROM public.holders WHERE closed_at IS NULL
  AND nullif(lower(btrim(email)),'')=nullif(lower(btrim(p.email)),'');
 IF matches>1 THEN RAISE EXCEPTION 'Duplicate holder records require administrator reconciliation'; END IF;
 SELECT * INTO h FROM public.holders WHERE closed_at IS NULL
  AND nullif(lower(btrim(email)),'')=nullif(lower(btrim(p.email)),'') FOR UPDATE;
 IF FOUND THEN
  IF h.profile_id IS NOT NULL OR h.user_id IS NOT NULL THEN RAISE EXCEPTION 'This holder record is already linked to another account'; END IF;
  IF h.account_suspended OR h.account_revoked THEN RAISE EXCEPTION 'This holder account requires administrator reactivation' USING ERRCODE='42501'; END IF;
  UPDATE public.holders SET profile_id=p.id,user_id=p.id,email=lower(btrim(p.email)),updated_at=now() WHERE id=h.id RETURNING * INTO h;
  UPDATE public.profiles SET client_id=h.client_id WHERE id=p.id;
  INSERT INTO public.audit_log(event_type,action,object_type,object_id,actor_id,actor_role,outcome,correlation_id)
   VALUES('HOLDER_IDENTITY_LINKED','Verified account linked to existing holder by normalized email','holder',h.id::text,p.id::text,p.role,'SUCCESS',gen_random_uuid()::text);
  RETURN to_jsonb(h);
 END IF;
 SELECT count(*) INTO matches FROM public.holders WHERE closed_at IS NULL AND coalesce(status,'ACTIVE')<>'ESTATE_RESERVE';
 IF matches>=250 THEN RAISE EXCEPTION '250-holder issuer capacity reached'; END IF;
 cid:='VC-'||lpad(nextval('public.vice_client_seq')::text,6,'0');
 INSERT INTO public.holders(id,user_id,profile_id,client_id,name,email,status,vice_units,v4x_units)
 VALUES(p.id,p.id,p.id,cid,p.name,lower(btrim(p.email)),'ACTIVE',0,0) RETURNING * INTO h;
 UPDATE public.profiles SET client_id=cid WHERE id=p.id;
 INSERT INTO public.iru_events(event_type,payload,actor_id,actor_role)
 VALUES('HOLDER_ADDED',jsonb_build_object('type','HOLDER_ADDED','holderId',h.id,'clientId',cid,
  'name',h.name,'email',h.email,'holderType','Standard','by','verified-signup','at',now()),p.id,p.role);
 RETURN to_jsonb(h);
END $$;

-- Match journal ownership through the holder link, including records appointed
-- before signup. Authentication IDs and holder IDs need not be identical.
DROP POLICY IF EXISTS vice_read ON public.iru_events;
CREATE POLICY vice_read ON public.iru_events FOR SELECT TO authenticated USING (
 (SELECT public.is_admin()) OR EXISTS(SELECT 1 FROM public.holders h
  WHERE h.id::text=payload->>'holderId' AND (h.user_id=(SELECT auth.uid()) OR h.profile_id=(SELECT auth.uid()))));

CREATE TABLE IF NOT EXISTS vice_private.registry_requests(
 correlation_id uuid PRIMARY KEY, actor_id uuid NOT NULL, operation text NOT NULL,
 request jsonb NOT NULL, result jsonb, created_at timestamptz NOT NULL DEFAULT now());
ALTER TABLE vice_private.registry_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON vice_private.registry_requests FROM PUBLIC,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION public.vice_set_holder_control(
 p_holder_id uuid,p_action text,p_reason text,p_correlation_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE h public.holders%ROWTYPE; a text:=upper(btrim(p_action)); actor_role text;
 req jsonb; prior vice_private.registry_requests%ROWTYPE; ev text; seq_id bigint; v_result jsonb;
BEGIN
 PERFORM vice_private.require_active_account();
 IF NOT vice_private.is_registry_operator() THEN RAISE EXCEPTION 'CFO or reserve administrator required' USING ERRCODE='42501'; END IF;
 SELECT role INTO actor_role FROM public.profiles WHERE id=auth.uid();
 IF p_holder_id IS NULL OR p_correlation_id IS NULL OR a IS NULL OR a NOT IN ('LOCK','UNLOCK','SUSPEND','RESUME','REVOKE','RESTORE')
  OR length(btrim(coalesce(p_reason,''))) NOT BETWEEN 8 AND 500 THEN RAISE EXCEPTION 'Holder, action, request ID and a detailed reason are required'; END IF;
 IF a IN ('REVOKE','RESTORE') AND NOT public.is_super() THEN RAISE EXCEPTION 'Only the reserve administrator can revoke or restore membership' USING ERRCODE='42501'; END IF;
 req:=jsonb_build_object('holder_id',p_holder_id,'action',a,'reason',btrim(p_reason));
 PERFORM pg_advisory_xact_lock(793151205);
 SELECT * INTO prior FROM vice_private.registry_requests WHERE correlation_id=p_correlation_id;
 IF FOUND THEN
  IF prior.actor_id<>auth.uid() OR prior.operation<>'CONTROL' OR prior.request<>req THEN RAISE EXCEPTION 'Request ID already belongs to a different operation'; END IF;
  RETURN prior.result||jsonb_build_object('already_applied',true);
 END IF;
 SELECT * INTO h FROM public.holders WHERE id=p_holder_id AND closed_at IS NULL FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Active registry holder not found'; END IF;
 IF vice_private.is_reserve_holder(h.id) THEN RAISE EXCEPTION 'Estate Reserve and its administrator are protected' USING ERRCODE='42501'; END IF;
 IF auth.uid() IN (h.user_id,h.profile_id) THEN RAISE EXCEPTION 'Another authorized administrator must change your own account controls'; END IF;
 IF h.account_revoked AND a IN ('RESUME','UNLOCK') THEN RAISE EXCEPTION 'Reserve administrator must restore revoked membership first'; END IF;
 IF (a='RESUME' AND NOT h.account_suspended) OR (a='RESTORE' AND NOT h.account_revoked)
 THEN RAISE EXCEPTION 'The account is not in the selected restricted state'; END IF;
 IF h.account_revoked AND a='SUSPEND' THEN RAISE EXCEPTION 'Membership is already revoked'; END IF;
 INSERT INTO vice_private.registry_requests(correlation_id,actor_id,operation,request) VALUES(p_correlation_id,auth.uid(),'CONTROL',req);
 IF a IN ('LOCK','UNLOCK') THEN
  UPDATE public.holders SET holdings_locked=(a='LOCK'),updated_at=now() WHERE id=h.id;
  ev:=CASE WHEN a='LOCK' THEN 'HOLDINGS_LOCKED' ELSE 'HOLDINGS_UNLOCKED' END;
 ELSIF a IN ('SUSPEND','RESUME') THEN
  UPDATE public.holders SET account_suspended=(a='SUSPEND'),status=CASE WHEN a='SUSPEND' THEN 'SUSPENDED' ELSE 'ACTIVE' END,updated_at=now() WHERE id=h.id;
  UPDATE public.profiles SET account_suspended=(a='SUSPEND'),updated_at=now() WHERE id IN (h.user_id,h.profile_id);
  ev:=CASE WHEN a='SUSPEND' THEN 'ACCOUNT_SUSPENDED' ELSE 'ACCOUNT_RESUMED' END;
 ELSE
  UPDATE public.holders SET account_revoked=(a='REVOKE'),account_suspended=false,
   status=CASE WHEN a='REVOKE' THEN 'REVOKED' ELSE 'ACTIVE' END,updated_at=now() WHERE id=h.id;
  UPDATE public.profiles SET account_revoked=(a='REVOKE'),account_suspended=false,updated_at=now() WHERE id IN (h.user_id,h.profile_id);
  ev:=CASE WHEN a='REVOKE' THEN 'ACCOUNT_REVOKED' ELSE 'ACCOUNT_RESTORED' END;
 END IF;
 IF a IN ('SUSPEND','REVOKE') THEN
  UPDATE auth.users SET banned_until=now()+interval '100 years',updated_at=now() WHERE id IN (h.user_id,h.profile_id);
  DELETE FROM auth.refresh_tokens WHERE user_id IN (h.user_id::text,h.profile_id::text);
  DELETE FROM auth.sessions WHERE user_id IN (h.user_id,h.profile_id);
 ELSIF a IN ('RESUME','RESTORE') THEN
  UPDATE auth.users SET banned_until=NULL,updated_at=now() WHERE id IN (h.user_id,h.profile_id);
 END IF;
 INSERT INTO public.iru_events(event_type,payload,actor_id,actor_role,correlation_id)
 VALUES(ev,jsonb_build_object('type',ev,'holderId',h.id,'reason',btrim(p_reason),'by',auth.uid(),'at',now()),auth.uid(),actor_role,p_correlation_id) RETURNING seq INTO seq_id;
 INSERT INTO public.audit_log(event_type,action,object_type,object_id,actor_id,actor_role,outcome,correlation_id)
 VALUES(ev,a||': '||btrim(p_reason),'holder',h.id::text,auth.uid()::text,actor_role,'SUCCESS',p_correlation_id::text);
 v_result:=jsonb_build_object('holder_id',h.id,'action',a,'seq',seq_id,'already_applied',false,'correlation_id',p_correlation_id);
 UPDATE vice_private.registry_requests SET result=v_result WHERE correlation_id=p_correlation_id;
 RETURN v_result;
END $$;
REVOKE ALL ON FUNCTION public.vice_set_holder_control(uuid,text,text,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.vice_set_holder_control(uuid,text,text,uuid) TO authenticated;

CREATE OR REPLACE FUNCTION vice_private.guard_holder_balance_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 IF NEW.vice_units IS DISTINCT FROM OLD.vice_units OR NEW.v4x_units IS DISTINCT FROM OLD.v4x_units THEN
  IF auth.uid() IS NOT NULL AND NOT public.is_super() AND vice_private.is_reserve_holder(OLD.id)
  THEN RAISE EXCEPTION 'Estate Reserve administrator is protected' USING ERRCODE='42501'; END IF;
  IF (OLD.holdings_locked OR OLD.account_suspended OR OLD.account_revoked OR OLD.closed_at IS NOT NULL OR OLD.status='FROZEN')
   AND NOT (session_user='postgres' AND current_user='postgres' AND auth.uid() IS NULL)
  THEN RAISE EXCEPTION 'Holdings are locked or account access is restricted' USING ERRCODE='42501'; END IF;
  IF NEW.vice_units<0 OR NEW.v4x_units<0 THEN RAISE EXCEPTION 'Holdings cannot be negative'; END IF;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION vice_private.guard_holder_balance_change() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS vice_holder_control_balance_guard ON public.holders;
CREATE TRIGGER vice_holder_control_balance_guard BEFORE UPDATE ON public.holders FOR EACH ROW EXECUTE FUNCTION vice_private.guard_holder_balance_change();

CREATE OR REPLACE FUNCTION vice_private.guard_estate_recipient_balance()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE h public.holders%ROWTYPE;
BEGIN
 SELECT * INTO h FROM public.holders WHERE id=NEW.holder_id FOR UPDATE;
 IF h.holdings_locked OR h.account_suspended OR h.account_revoked OR h.closed_at IS NOT NULL OR h.status='FROZEN'
 THEN RAISE EXCEPTION 'Recipient holdings are locked or account access is restricted' USING ERRCODE='42501'; END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION vice_private.guard_estate_recipient_balance() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS vice_estate_recipient_control_guard ON public.vice_estate_holder_balances;
CREATE TRIGGER vice_estate_recipient_control_guard BEFORE INSERT OR UPDATE ON public.vice_estate_holder_balances
 FOR EACH ROW EXECUTE FUNCTION vice_private.guard_estate_recipient_balance();

CREATE OR REPLACE FUNCTION public.vice_transfer_own_iru(
 p_target_holder_id uuid,p_program text,p_units bigint,p_reason text,p_correlation_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE src public.holders%ROWTYPE; dst public.holders%ROWTYPE; held numeric; received numeric;
 actor_role text; pid text:=upper(btrim(p_program)); req jsonb; prior vice_private.registry_requests%ROWTYPE;
 seq_out bigint; seq_in bigint; v_result jsonb;
BEGIN
 PERFORM vice_private.require_active_account();
 IF NOT vice_private.is_registry_operator() THEN RAISE EXCEPTION 'CFO or reserve administrator required' USING ERRCODE='42501'; END IF;
 IF p_target_holder_id IS NULL OR p_correlation_id IS NULL OR pid IS NULL OR pid NOT IN ('VICE','V4X')
  OR p_units IS NULL OR p_units<=0 OR p_units>2500000 OR length(btrim(coalesce(p_reason,''))) NOT BETWEEN 8 AND 500
 THEN RAISE EXCEPTION 'Recipient, program, positive whole units, request ID and detailed reason required'; END IF;
 SELECT role INTO actor_role FROM public.profiles WHERE id=auth.uid();
 req:=jsonb_build_object('target_holder_id',p_target_holder_id,'program',pid,'units',p_units,'reason',btrim(p_reason));
 PERFORM pg_advisory_xact_lock(793151205);
 SELECT * INTO prior FROM vice_private.registry_requests WHERE correlation_id=p_correlation_id;
 IF FOUND THEN
  IF prior.actor_id<>auth.uid() OR prior.operation<>'TRANSFER' OR prior.request<>req THEN RAISE EXCEPTION 'Request ID already belongs to a different operation'; END IF;
  RETURN prior.result||jsonb_build_object('already_applied',true);
 END IF;
 SELECT * INTO src FROM public.holders WHERE (profile_id=auth.uid() OR user_id=auth.uid()) AND closed_at IS NULL FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Your linked holder account was not found'; END IF;
 SELECT * INTO dst FROM public.holders WHERE id=p_target_holder_id AND closed_at IS NULL FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Recipient holder not found'; END IF;
 IF src.id=dst.id THEN RAISE EXCEPTION 'Choose a different recipient'; END IF;
 IF vice_private.is_reserve_holder(src.id) OR vice_private.is_reserve_holder(dst.id) THEN RAISE EXCEPTION 'Reserve holdings require the separate reserve authorization workflow' USING ERRCODE='42501'; END IF;
 IF src.holdings_locked OR dst.holdings_locked OR src.account_suspended OR dst.account_suspended
  OR src.account_revoked OR dst.account_revoked OR src.status<>'ACTIVE' OR dst.status<>'ACTIVE'
 THEN RAISE EXCEPTION 'Both holder accounts must be active with unlocked holdings' USING ERRCODE='42501'; END IF;
 held:=CASE WHEN pid='VICE' THEN src.vice_units ELSE src.v4x_units END;
 received:=CASE WHEN pid='VICE' THEN dst.vice_units ELSE dst.v4x_units END;
 IF held<p_units THEN RAISE EXCEPTION 'Transfer exceeds your available holdings'; END IF;
 INSERT INTO vice_private.registry_requests(correlation_id,actor_id,operation,request) VALUES(p_correlation_id,auth.uid(),'TRANSFER',req);
 IF pid='VICE' THEN
  UPDATE public.holders SET vice_units=vice_units-p_units,updated_at=now() WHERE id=src.id;
  UPDATE public.holders SET vice_units=vice_units+p_units,updated_at=now() WHERE id=dst.id;
 ELSE
  UPDATE public.holders SET v4x_units=v4x_units-p_units,updated_at=now() WHERE id=src.id;
  UPDATE public.holders SET v4x_units=v4x_units+p_units,updated_at=now() WHERE id=dst.id;
 END IF;
 INSERT INTO public.iru_events(event_type,payload,actor_id,actor_role,correlation_id)
 VALUES('UNITS_TRANSFERRED_OUT',jsonb_build_object('type','UNITS_TRANSFERRED_OUT','holderId',src.id,
  'transferId',p_correlation_id,'counterpartyId',dst.id,'program',pid,'units',p_units::text,'reason',btrim(p_reason),'by',auth.uid(),'at',now()),auth.uid(),actor_role,p_correlation_id) RETURNING seq INTO seq_out;
 INSERT INTO public.iru_events(event_type,payload,actor_id,actor_role,correlation_id)
 VALUES('UNITS_TRANSFERRED_IN',jsonb_build_object('type','UNITS_TRANSFERRED_IN','holderId',dst.id,
  'transferId',p_correlation_id,'counterpartyId',src.id,'program',pid,'units',p_units::text,'reason',btrim(p_reason),'by',auth.uid(),'at',now()),auth.uid(),actor_role,gen_random_uuid()) RETURNING seq INTO seq_in;
 INSERT INTO public.audit_log(event_type,action,object_type,object_id,actor_id,actor_role,outcome,correlation_id)
 VALUES('IRU_HOLDER_TRANSFER',p_units::text||' '||pid||' from own holdings: '||btrim(p_reason),'holder',dst.id::text,auth.uid()::text,actor_role,'SUCCESS',p_correlation_id::text);
 v_result:=jsonb_build_object('source_holder_id',src.id,'target_holder_id',dst.id,'program',pid,'units',p_units,
  'source_units_after',held-p_units,'target_units_after',received+p_units,'seq_out',seq_out,'seq_in',seq_in,
  'correlation_id',p_correlation_id,'already_applied',false,'settlement','INTERNAL_REGISTRY');
 UPDATE vice_private.registry_requests SET result=v_result WHERE correlation_id=p_correlation_id;
 RETURN v_result;
END $$;
REVOKE ALL ON FUNCTION public.vice_transfer_own_iru(uuid,text,bigint,text,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.vice_transfer_own_iru(uuid,text,bigint,text,uuid) TO authenticated;

-- Existing issuer mutations stay issuer-only. Appointment cannot create another
-- active record for the same normalized email. Closed records do not use seats.
DO $$ DECLARE definition text; BEGIN
 SELECT pg_get_functiondef('public.append_iru_event(jsonb,uuid)'::regprocedure) INTO definition;
 IF position('vice-normalized-appointment' IN definition)=0 THEN
  definition:=replace(definition,'if et=''HOLDER_ADDED'' then',$appointment$if et='HOLDER_ADDED' then
   -- vice-normalized-appointment
   perform pg_advisory_xact_lock(793151205);
   if upper(coalesce(p_payload->>'holderType',''))='ESTATE_RESERVE' then
    raise exception 'Estate Reserve uses its separate protected ledger';
   end if;
   p_payload:=jsonb_set(p_payload,'{email}',to_jsonb(lower(btrim(coalesce(p_payload->>'email','')))));
   if nullif(p_payload->>'email','') is not null and exists(select 1 from public.holders where closed_at is null and lower(btrim(email))=p_payload->>'email') then
    raise exception 'An active holder already uses this email';
   end if;$appointment$);
  definition:=replace(definition,'where coalesce(status,''ACTIVE'')<>''ESTATE_RESERVE''','where closed_at is null and coalesce(status,''ACTIVE'')<>''ESTATE_RESERVE''');
  EXECUTE definition;
 END IF;
 SELECT pg_get_functiondef('public.append_iru_event(jsonb,uuid)'::regprocedure) INTO definition;
 IF position('vice-idempotent-issuance' IN definition)=0 THEN
  definition:=replace(definition,'if et=''HOLDER_ADDED'' then',$retry$
  -- vice-idempotent-issuance
  if exists(select 1 from public.iru_events where correlation_id=p_correlation_id) then
   if not exists(select 1 from public.iru_events where correlation_id=p_correlation_id
     and actor_id=auth.uid() and payload=p_payload) then
    raise exception 'Request ID already belongs to a different operation';
   end if;
   return (select jsonb_build_object('seq',seq,'event_type',event_type,'correlation_id',correlation_id,'already_applied',true)
     from public.iru_events where correlation_id=p_correlation_id);
  end if;
  if et='HOLDER_ADDED' then$retry$);
  EXECUTE definition;
 END IF;
END $$;

-- SECDEF RPCs bypass RLS, so enforce the same account check inside every
-- KAHZI delegates the 2,500,000 strategic pool to the CFO. Estate reserve,
-- membership revocation and role administration remain SUPER_ADMIN-only.
DO $$ DECLARE f record; definition text; BEGIN
 FOR f IN SELECT p.oid,p.proname,n.nspname FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE (n.nspname='public' AND p.proname IN ('append_iru_event','create_iru_allocation',
  'advance_iru_allocation','distribute_iru_allocation','reverse_strategic_issuance','vice_financial_release_capabilities',
  'trg_vice_token_certificate','vice_token_certificate_snapshot'))
 OR (n.nspname='vice_private' AND p.proname='reverse_strategic_issuance')
 LOOP
  SELECT pg_get_functiondef(f.oid) INTO definition;
  definition:=replace(definition,'public.is_super()','vice_private.is_registry_operator()');
  definition:=replace(definition,'SUPER_ADMIN authorization required','CFO or reserve administrator authorization required');
  definition:=replace(definition,'IRU mutation requires SUPER_ADMIN','Strategic-pool mutation requires CFO or reserve administrator');
  definition:=replace(definition,'SUPER_ADMIN required','CFO or reserve administrator required');
  IF f.proname='append_iru_event' THEN
   definition:=replace(definition,'values(et,p_payload,auth.uid(),''SUPER_ADMIN'',p_correlation_id)',
     'values(et,p_payload,auth.uid(),(select role from public.profiles where id=auth.uid()),p_correlation_id)');
   IF position('vice-protected-issuer' IN definition)=0 THEN
    definition:=replace(definition,'et:=p_payload->>''type'';',$guard$et:=p_payload->>'type';
     -- vice-protected-issuer
     if not exists(select 1 from public.profiles where id=auth.uid() and role='SUPER_ADMIN') and nullif(p_payload->>'holderId','') is not null
       and vice_private.is_reserve_holder((p_payload->>'holderId')::uuid)
     then raise exception 'Estate Reserve administrator is protected'; end if;$guard$);
   END IF;
  ELSIF f.proname='trg_vice_token_certificate' THEN
   definition:=replace(definition,'new.actor_role is distinct from ''SUPER_ADMIN''',
    'new.actor_role is distinct from (select role from public.profiles where id=auth.uid())');
  ELSIF f.nspname='vice_private' AND f.proname='reverse_strategic_issuance' THEN
   definition:=replace(definition,'actor_kind:=''SUPER_ADMIN'';',
    'select role into actor_kind from public.profiles where id=auth.uid();');
  END IF;
  EXECUTE definition;
 END LOOP;
END $$;

-- Enforce account access inside every
-- authenticated PL/pgSQL RPC. Public verification and pre-login lookup remain
-- intentionally accessible through their existing restricted responses.
DO $$ DECLARE f record; definition text; BEGIN
 FOR f IN SELECT p.oid,p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  JOIN pg_language l ON l.oid=p.prolang WHERE n.nspname='public' AND p.prosecdef AND l.lanname='plpgsql'
  AND p.prorettype NOT IN ('trigger'::regtype,'event_trigger'::regtype)
  AND has_function_privilege('authenticated',p.oid,'EXECUTE')
  AND p.proname NOT IN ('lookup_email_for_login','validate_invite','verify_certificate','verify_token_certificate','vice_member_access_status')
 LOOP
  SELECT pg_get_functiondef(f.oid) INTO definition;
  IF position('vice_private.require_active_account()' IN definition)=0 THEN
   definition:=regexp_replace(definition,'\mBEGIN\M',E'BEGIN\n PERFORM vice_private.require_active_account();','i');
   EXECUTE definition;
  END IF;
 END LOOP;
 FOR f IN SELECT p.oid,p.proname,p.prosrc FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  JOIN pg_language l ON l.oid=p.prolang WHERE n.nspname='public' AND p.prosecdef AND l.lanname='sql'
  AND has_function_privilege('authenticated',p.oid,'EXECUTE')
  AND p.proname NOT IN ('is_super','is_admin','vice_member_access_status')
 LOOP
  IF position('vice_private.account_allowed()' IN f.prosrc)=0 THEN
   SELECT pg_get_functiondef(f.oid) INTO definition;
   definition:=replace(definition,f.prosrc,'SELECT * FROM ('||regexp_replace(f.prosrc,'[;[:space:]]+$','')||') AS account_scoped_result WHERE (SELECT vice_private.account_allowed())');
   EXECUTE definition;
  END IF;
 END LOOP;
END $$;
