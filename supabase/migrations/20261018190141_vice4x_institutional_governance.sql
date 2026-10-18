-- Additive institutional administration. No allocations, prices, custody or trades change.
CREATE TABLE IF NOT EXISTS public.vice_exec_audit (
 seq bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, created_at timestamptz NOT NULL DEFAULT now(),
 actor uuid, event text NOT NULL, object_id text NOT NULL, details jsonb NOT NULL DEFAULT '{}',
 previous_hash text NOT NULL, event_hash text NOT NULL
);
CREATE TABLE IF NOT EXISTS public.vice_omega_leads (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), source text NOT NULL CHECK(source IN ('MANUAL','APOLLO')),
 source_id text, full_name text NOT NULL, company text NOT NULL, title text NOT NULL DEFAULT '',
 email text, email_status text NOT NULL DEFAULT 'UNVERIFIED' CHECK(email_status IN ('UNVERIFIED','PROVIDER_VERIFIED','REVIEWED')),
 phone text, hq_address text, linkedin text, asset_tier text, tier text NOT NULL CHECK(tier IN ('A','B','C')),
 contact_basis text NOT NULL DEFAULT '', suppressed boolean NOT NULL DEFAULT false,
 stage text NOT NULL DEFAULT 'NEW' CHECK(stage IN ('NEW','REVIEW','QUALIFIED','CLOSED')),
 evidence jsonb NOT NULL DEFAULT '{}', created_by uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(source,source_id), CHECK(email IS NULL OR (email=lower(email) AND email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'))
);
CREATE UNIQUE INDEX IF NOT EXISTS vice_omega_email_unique ON public.vice_omega_leads(lower(email)) WHERE email IS NOT NULL;
CREATE TABLE IF NOT EXISTS public.vice_omega_outreach (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), lead_id uuid NOT NULL REFERENCES public.vice_omega_leads(id),
 campaign text NOT NULL DEFAULT 'OMEGA-INTRO-v1', subject text NOT NULL, body text NOT NULL,
 status text NOT NULL DEFAULT 'DRAFT' CHECK(status IN ('DRAFT','QUEUED','SENDING','SENT','FAILED','UNKNOWN','CANCELLED')),
 approved_by uuid, approved_at timestamptz, provider_id text, last_error text, created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(lead_id,campaign)
);
CREATE INDEX IF NOT EXISTS vice_omega_outreach_lead ON public.vice_omega_outreach(lead_id);
CREATE TABLE IF NOT EXISTS public.vice_omega_financings (
 id uuid PRIMARY KEY, lead_id uuid NOT NULL REFERENCES public.vice_omega_leads(id),
 principal numeric(24,2) NOT NULL CHECK(principal>0 AND principal<=1000000000000), months integer NOT NULL CHECK(months BETWEEN 1 AND 12),
 gross_profit numeric(24,2) NOT NULL, costs numeric(24,2) NOT NULL CHECK(costs>=0), loss_carry numeric(24,2) NOT NULL CHECK(loss_carry>=0),
 baseline_due numeric(24,2) NOT NULL, net_alpha numeric(24,2) NOT NULL, partner_upside numeric(24,2) NOT NULL, vice_upside numeric(24,2) NOT NULL,
 evidence jsonb NOT NULL, status text NOT NULL DEFAULT 'DRAFT' CHECK(status='DRAFT'), created_by uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS vice_omega_financing_lead ON public.vice_omega_financings(lead_id);
CREATE TABLE IF NOT EXISTS public.vice_sovereign_proposals (
 id text PRIMARY KEY, payload jsonb NOT NULL, payload_hash text NOT NULL, validation_issues jsonb NOT NULL,
 status text NOT NULL DEFAULT 'REVIEW' CHECK(status IN ('REVIEW','LOCKED','REJECTED')),
 created_by uuid NOT NULL, published_at timestamptz NOT NULL DEFAULT now(), validation_until timestamptz NOT NULL DEFAULT now()+interval '72 hours',
 quorum_verified_at timestamptz, execute_after timestamptz,
 CHECK(quorum_verified_at IS NULL AND execute_after IS NULL)
);
CREATE TABLE IF NOT EXISTS public.vice_exec_signers (
 role text PRIMARY KEY CHECK(role IN ('CEO','CFO')), user_id uuid UNIQUE NOT NULL,
 public_key jsonb, enrolled_at timestamptz, CHECK(public_key IS NULL OR NOT public_key ? 'd')
);
-- Resolve designated existing executives, never appoint an arbitrary new account.
INSERT INTO public.vice_exec_signers(role,user_id)
 SELECT CASE h.client_id WHEN 'VC-000001' THEN 'CEO' ELSE 'CFO' END,p.id
 FROM public.holders h JOIN public.profiles p ON p.id=coalesce(h.user_id,h.profile_id)
 WHERE (h.client_id='VC-000001' AND p.role='SUPER_ADMIN') OR (h.client_id='VC-000006' AND p.role='FINANCE_OFFICER')
 ON CONFLICT(role) DO NOTHING;
CREATE TABLE IF NOT EXISTS public.vice_exec_challenges (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL, role text NOT NULL,
 action text NOT NULL CHECK(action IN ('ENROLL','APPROVE','HALT')), proposal_id text REFERENCES public.vice_sovereign_proposals(id),
 public_key jsonb, message text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), expires_at timestamptz NOT NULL DEFAULT now()+interval '10 minutes', used_at timestamptz
);
CREATE INDEX IF NOT EXISTS vice_exec_challenge_owner ON public.vice_exec_challenges(user_id,created_at);
CREATE TABLE IF NOT EXISTS public.vice_exec_attestations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), proposal_id text NOT NULL REFERENCES public.vice_sovereign_proposals(id), role text NOT NULL,
 signer_id uuid NOT NULL, signature text NOT NULL, challenge_id uuid UNIQUE NOT NULL REFERENCES public.vice_exec_challenges(id),
 payload_hash text NOT NULL, verified_at timestamptz NOT NULL DEFAULT now(), UNIQUE(proposal_id,role)
);
CREATE TABLE IF NOT EXISTS public.vice_sovereign_control (
 id boolean PRIMARY KEY DEFAULT true CHECK(id), locked boolean NOT NULL DEFAULT true CHECK(locked),
 reason text NOT NULL DEFAULT 'On-chain quorum verifier and atomic executor are not configured', changed_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.vice_sovereign_control(id) VALUES(true) ON CONFLICT DO NOTHING;
CREATE OR REPLACE FUNCTION public.vice_institutional_access() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT vice_private.account_allowed() AND EXISTS(SELECT 1 FROM public.profiles WHERE id=auth.uid() AND role IN ('SUPER_ADMIN','FINANCE_OFFICER'));
$$;
REVOKE ALL ON FUNCTION public.vice_institutional_access() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.vice_institutional_access() TO authenticated;
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['vice_exec_audit','vice_omega_leads','vice_omega_outreach','vice_omega_financings','vice_sovereign_proposals','vice_exec_signers','vice_exec_challenges','vice_exec_attestations','vice_sovereign_control'] LOOP
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('REVOKE ALL ON public.%I FROM anon,authenticated',t);
  EXECUTE format('GRANT SELECT ON public.%I TO authenticated',t);
  IF NOT EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename=t AND policyname='institutional_read') THEN
   EXECUTE format('CREATE POLICY institutional_read ON public.%I FOR SELECT TO authenticated USING ((SELECT public.vice_institutional_access()))',t);
  END IF;
 END LOOP;
END $$;
-- Challenges are additionally owner-scoped; private signatures are never accepted from a client as verified.
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_policies WHERE tablename='vice_exec_challenges' AND policyname='challenge_owner') THEN
  CREATE POLICY challenge_owner ON public.vice_exec_challenges AS RESTRICTIVE FOR SELECT TO authenticated USING(user_id=(SELECT auth.uid()));
 END IF;
END $$;
CREATE OR REPLACE FUNCTION vice_private.exec_log(p_event text,p_object text,p_details jsonb DEFAULT '{}') RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE v_prev text;v_seq bigint;v_hash text;
BEGIN
 PERFORM pg_advisory_xact_lock(818104001);
 SELECT event_hash INTO v_prev FROM public.vice_exec_audit ORDER BY seq DESC LIMIT 1;v_prev:=coalesce(v_prev,repeat('0',64));
 INSERT INTO public.vice_exec_audit(actor,event,object_id,details,previous_hash,event_hash) VALUES(auth.uid(),p_event,p_object,p_details,v_prev,'PENDING') RETURNING seq INTO v_seq;
 v_hash:=encode(extensions.digest(convert_to(v_prev||'|'||v_seq::text||'|'||coalesce(auth.uid()::text,'SYSTEM')||'|'||p_event||'|'||p_object||'|'||p_details::text,'UTF8'),'sha256'),'hex');
 UPDATE public.vice_exec_audit SET event_hash=v_hash WHERE seq=v_seq;
END $$;
REVOKE ALL ON FUNCTION vice_private.exec_log(text,text,jsonb) FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION public.vice_omega_save_lead(p_record jsonb,p_id uuid DEFAULT NULL) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE v_id uuid;v_email text;v_source text;v_source_id text;
BEGIN
 IF NOT public.vice_institutional_access() THEN RAISE EXCEPTION 'Executive access required' USING ERRCODE='42501';END IF;
 IF octet_length(p_record::text)>20000 OR length(trim(coalesce(p_record->>'full_name','')))=0 OR length(trim(coalesce(p_record->>'company','')))=0 THEN RAISE EXCEPTION 'Name and company required';END IF;
 v_email:=nullif(lower(trim(p_record->>'email')),'');v_source:=coalesce(p_record->>'source','MANUAL');v_source_id:=nullif(p_record->>'source_id','');
 PERFORM pg_advisory_xact_lock(818104002);
 SELECT id INTO v_id FROM public.vice_omega_leads WHERE id=p_id OR (v_email IS NOT NULL AND email=v_email) OR (v_source_id IS NOT NULL AND source=v_source AND source_id=v_source_id) ORDER BY created_at LIMIT 1;
 IF p_id IS NOT NULL AND v_id IS DISTINCT FROM p_id THEN RAISE EXCEPTION 'Record conflict or missing lead';END IF;
 IF v_id IS NOT NULL AND p_id IS NULL THEN RETURN v_id;END IF;
 IF v_id IS NULL THEN
  INSERT INTO public.vice_omega_leads(source,source_id,full_name,company,title,email,email_status,phone,hq_address,linkedin,asset_tier,tier,contact_basis,created_by)
  VALUES(v_source,v_source_id,left(p_record->>'full_name',200),left(p_record->>'company',200),left(coalesce(p_record->>'title',''),200),v_email,coalesce(p_record->>'email_status','UNVERIFIED'),left(p_record->>'phone',60),left(p_record->>'hq_address',500),left(p_record->>'linkedin',500),left(p_record->>'asset_tier',100),coalesce(p_record->>'tier','A'),left(coalesce(p_record->>'contact_basis',''),1000),auth.uid()) RETURNING id INTO v_id;
 ELSE
  UPDATE public.vice_omega_leads SET full_name=left(p_record->>'full_name',200),company=left(p_record->>'company',200),title=left(coalesce(p_record->>'title',''),200),email=v_email,
   email_status=coalesce(p_record->>'email_status',email_status),phone=left(p_record->>'phone',60),hq_address=left(p_record->>'hq_address',500),linkedin=left(p_record->>'linkedin',500),asset_tier=left(p_record->>'asset_tier',100),
   tier=coalesce(p_record->>'tier',tier),contact_basis=left(coalesce(p_record->>'contact_basis',''),1000),suppressed=coalesce((p_record->>'suppressed')::boolean,suppressed),stage=coalesce(p_record->>'stage',stage),evidence=coalesce(p_record->'evidence',evidence),updated_at=now() WHERE id=v_id;
  UPDATE public.vice_omega_outreach SET status='CANCELLED',last_error='Lead suppressed or edited; review a new campaign' WHERE lead_id=v_id AND status IN ('DRAFT','QUEUED');
 END IF;
 PERFORM vice_private.exec_log('OMEGA_LEAD_SAVED',v_id::text,jsonb_build_object('source',v_source));RETURN v_id;
END $$;
CREATE OR REPLACE FUNCTION public.vice_omega_draft(p_lead uuid,p_subject text,p_body text,p_campaign text DEFAULT 'OMEGA-INTRO-v1') RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE v_id uuid;
BEGIN
 IF NOT public.vice_institutional_access() THEN RAISE EXCEPTION 'Executive access required' USING ERRCODE='42501';END IF;
 IF length(p_subject) NOT BETWEEN 5 AND 300 OR length(p_body) NOT BETWEEN 50 AND 12000 OR length(p_campaign) NOT BETWEEN 3 AND 100 THEN RAISE EXCEPTION 'Invalid outreach draft';END IF;
 IF NOT EXISTS(SELECT 1 FROM public.vice_omega_leads WHERE id=p_lead AND NOT suppressed) THEN RAISE EXCEPTION 'Lead unavailable or suppressed';END IF;
 INSERT INTO public.vice_omega_outreach(lead_id,subject,body,campaign) VALUES(p_lead,p_subject,p_body,p_campaign) ON CONFLICT(lead_id,campaign) DO NOTHING RETURNING id INTO v_id;
 IF v_id IS NULL THEN SELECT id INTO v_id FROM public.vice_omega_outreach WHERE lead_id=p_lead AND campaign=p_campaign;END IF;
 PERFORM vice_private.exec_log('OMEGA_DRAFT',v_id::text);RETURN v_id;
END $$;
CREATE OR REPLACE FUNCTION public.vice_omega_queue(p_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE v_lead public.vice_omega_leads;
BEGIN
 IF NOT public.vice_institutional_access() THEN RAISE EXCEPTION 'Executive access required' USING ERRCODE='42501';END IF;
 SELECT l.* INTO v_lead FROM public.vice_omega_leads l JOIN public.vice_omega_outreach o ON o.lead_id=l.id WHERE o.id=p_id AND o.status='DRAFT' FOR UPDATE OF l,o;
 IF NOT FOUND OR v_lead.suppressed OR v_lead.email IS NULL OR v_lead.email_status='UNVERIFIED' OR length(v_lead.contact_basis)<8 OR length(coalesce(v_lead.evidence->>'offering_basis',''))<8 OR length(coalesce(v_lead.evidence->>'counsel_reference',''))<8 THEN RAISE EXCEPTION 'Verified recipient, contact basis and documented offering review are required';END IF;
 UPDATE public.vice_omega_outreach SET status='QUEUED',approved_by=auth.uid(),approved_at=now() WHERE id=p_id;
 PERFORM vice_private.exec_log('OMEGA_QUEUE',p_id::text);
END $$;
CREATE OR REPLACE FUNCTION public.vice_omega_save_financing(p_id uuid,p_record jsonb) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE p numeric;m integer;g numeric;c numeric;l numeric;b numeric;a numeric;partner numeric;
BEGIN
 IF NOT public.vice_institutional_access() THEN RAISE EXCEPTION 'Executive access required' USING ERRCODE='42501';END IF;
 p:=(p_record->>'principal')::numeric;m:=(p_record->>'months')::integer;g:=(p_record->>'grossProfit')::numeric;c:=(p_record->>'costs')::numeric;l:=(p_record->>'lossCarry')::numeric;
 IF p IS NULL OR m IS NULL OR g IS NULL OR c IS NULL OR l IS NULL OR p<=0 OR p>1e12 OR m NOT BETWEEN 1 AND 12 OR c<0 OR l<0 OR p::text IN ('NaN','Infinity','-Infinity') OR g::text IN ('NaN','Infinity','-Infinity') OR c::text IN ('NaN','Infinity','-Infinity') OR l::text IN ('NaN','Infinity','-Infinity') THEN RAISE EXCEPTION 'Invalid model inputs';END IF;
 b:=round(p*.15*m/12,2);a:=round(greatest(0,g-c-l-b),2);partner:=round(a*.65,2);
 INSERT INTO public.vice_omega_financings(id,lead_id,principal,months,gross_profit,costs,loss_carry,baseline_due,net_alpha,partner_upside,vice_upside,evidence,created_by)
 VALUES(p_id,(p_record->>'lead_id')::uuid,p,m,g,c,l,b,a,partner,a-partner,coalesce(p_record->'evidence','{}'),auth.uid()) ON CONFLICT(id) DO NOTHING;
 PERFORM vice_private.exec_log('OMEGA_FINANCING_DRAFT',p_id::text,jsonb_build_object('status','DRAFT'));RETURN p_id;
END $$;
CREATE OR REPLACE FUNCTION public.vice_sovereign_submit(p_payload jsonb) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE p jsonb;v_vice numeric;v_v4x numeric;o numeric;ov numeric;n numeric;nv numeric;issues jsonb:='[]';v_id text;v_hash text;
BEGIN
 IF NOT public.vice_institutional_access() THEN RAISE EXCEPTION 'Executive access required' USING ERRCODE='42501';END IF;
 IF octet_length(p_payload::text)>20000 THEN RAISE EXCEPTION 'Proposal too large';END IF;
 v_id:=p_payload->>'proposal_id';IF v_id IS NULL OR v_id !~ '^PROP-[A-Z0-9-]{8,100}$' THEN RAISE EXCEPTION 'Invalid proposal ID';END IF;
 p:=p_payload->'parameters';o:=(p#>>'{previous_baseline,vice_ouv}')::numeric;ov:=(p#>>'{previous_baseline,v4x_ouv}')::numeric;n:=(p#>>'{target_scaled_tier,vice_ouv}')::numeric;nv:=(p#>>'{target_scaled_tier,v4x_ouv}')::numeric;
 IF o IS NULL OR ov IS NULL OR n IS NULL OR nv IS NULL OR least(o,ov,n,nv)<=0 OR greatest(o,ov,n,nv)>1e12 OR greatest(o,ov,n,nv)::text='NaN' THEN RAISE EXCEPTION 'Invalid reference values';END IF;
 IF ov<>o*160 OR nv<>n*160 OR (p->>'structural_ratio') IS DISTINCT FROM '160' THEN issues:=issues||'"RATIO_MUST_EQUAL_160"'::jsonb;END IF;
 SELECT vice_price,v4x_price INTO v_vice,v_v4x FROM public.vice_dao_config WHERE id=1;
 IF o IS DISTINCT FROM v_vice OR ov IS DISTINCT FROM v_v4x THEN issues:=issues||'"BASELINE_MISMATCH"'::jsonb;END IF;
 v_hash:=encode(extensions.digest(convert_to(p_payload::text,'UTF8'),'sha256'),'hex');
 IF EXISTS(SELECT 1 FROM public.vice_sovereign_proposals WHERE id=v_id AND payload_hash<>v_hash) THEN RAISE EXCEPTION 'Proposal IDs are immutable; use a new revision ID';END IF;
 INSERT INTO public.vice_sovereign_proposals(id,payload,payload_hash,validation_issues,created_by) VALUES(v_id,p_payload,v_hash,issues,auth.uid()) ON CONFLICT DO NOTHING;
 PERFORM vice_private.exec_log('SOVEREIGN_PROPOSAL',v_id,jsonb_build_object('payload_hash',v_hash,'issues',issues));RETURN v_id;
END $$;
CREATE OR REPLACE FUNCTION public.vice_sovereign_feed() RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT coalesce(jsonb_agg(x ORDER BY x.published_at DESC),'[]') FROM (SELECT id,jsonb_build_object('previous_baseline',jsonb_build_object('vice_ouv',(payload#>>'{parameters,previous_baseline,vice_ouv}')::numeric,'v4x_ouv',(payload#>>'{parameters,previous_baseline,v4x_ouv}')::numeric),'target_scaled_tier',jsonb_build_object('vice_ouv',(payload#>>'{parameters,target_scaled_tier,vice_ouv}')::numeric,'v4x_ouv',(payload#>>'{parameters,target_scaled_tier,v4x_ouv}')::numeric),'structural_ratio',160) AS parameters,payload_hash,validation_issues,status,published_at,validation_until,quorum_verified_at,execute_after,(SELECT count(*) FROM public.vice_exec_attestations a WHERE a.proposal_id=p.id) AS verified_executive_signatures FROM public.vice_sovereign_proposals p ORDER BY published_at DESC LIMIT 100)x;
$$;
CREATE OR REPLACE FUNCTION public.vice_exec_challenge(p_action text,p_proposal text DEFAULT NULL,p_public_key jsonb DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE r text;v_id uuid:=gen_random_uuid();v_hash text;msg text;
BEGIN
 IF NOT public.vice_institutional_access() THEN RAISE EXCEPTION 'Executive access required' USING ERRCODE='42501';END IF;
 SELECT role INTO r FROM public.vice_exec_signers WHERE user_id=auth.uid();IF r IS NULL THEN RAISE EXCEPTION 'Designated CEO or CFO signer required';END IF;
 IF (SELECT count(*) FROM public.vice_exec_challenges WHERE user_id=auth.uid() AND created_at>now()-interval '1 minute')>=10 THEN RAISE EXCEPTION 'Challenge rate limit; wait one minute';END IF;
 IF p_action='ENROLL' THEN
  IF EXISTS(SELECT 1 FROM public.vice_exec_signers WHERE role=r AND public_key IS NOT NULL) THEN RAISE EXCEPTION 'Key already enrolled; controlled recovery required';END IF;
  IF p_public_key->>'kty' IS DISTINCT FROM 'EC' OR p_public_key->>'crv' IS DISTINCT FROM 'P-256' OR p_public_key ? 'd' OR coalesce(p_public_key->>'x','') !~ '^[A-Za-z0-9_-]{43}$' OR coalesce(p_public_key->>'y','') !~ '^[A-Za-z0-9_-]{43}$' THEN RAISE EXCEPTION 'Public P-256 verification key required';END IF;
  v_hash:=encode(extensions.digest(convert_to(p_public_key::text,'UTF8'),'sha256'),'hex');
 ELSIF p_action IN ('APPROVE','HALT') THEN
  IF NOT EXISTS(SELECT 1 FROM public.vice_exec_signers WHERE role=r AND public_key IS NOT NULL) THEN RAISE EXCEPTION 'Enroll your signing key first';END IF;
  IF p_action='APPROVE' THEN SELECT payload_hash INTO v_hash FROM public.vice_sovereign_proposals WHERE id=p_proposal AND validation_issues='[]'::jsonb AND status='REVIEW';IF v_hash IS NULL THEN RAISE EXCEPTION 'Proposal missing, blocked or baseline mismatch';END IF;ELSE v_hash:='HALT_STRUCTURAL_TRANSITIONS';END IF;
 ELSE RAISE EXCEPTION 'Unknown signature action';END IF;
 msg:='VICE4X-SOVEREIGN-ELITE-v3.0|'||p_action||'|'||r||'|'||auth.uid()::text||'|'||coalesce(p_proposal,'')||'|'||v_hash||'|'||v_id::text;
 INSERT INTO public.vice_exec_challenges(id,user_id,role,action,proposal_id,public_key,message) VALUES(v_id,auth.uid(),r,p_action,p_proposal,p_public_key,msg);
 RETURN jsonb_build_object('id',v_id,'message',msg,'expires_in',600);
END $$;
-- Only the authenticated Edge verifier can mark a signature cryptographically verified.
CREATE OR REPLACE FUNCTION public.vice_exec_finish(p_challenge uuid,p_actor uuid,p_signature text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE c public.vice_exec_challenges;s public.vice_exec_signers;v_hash text;
BEGIN
 PERFORM set_config('request.jwt.claim.sub',p_actor::text,true);
 PERFORM vice_private.require_active_account();
 SELECT * INTO c FROM public.vice_exec_challenges WHERE id=p_challenge AND user_id=p_actor AND used_at IS NULL AND expires_at>now() FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Challenge expired, missing or already consumed';END IF;
 SELECT * INTO s FROM public.vice_exec_signers WHERE role=c.role AND user_id=c.user_id FOR UPDATE;
 IF NOT FOUND OR NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=c.user_id AND NOT account_suspended AND NOT account_revoked AND role=CASE c.role WHEN 'CEO' THEN 'SUPER_ADMIN' ELSE 'FINANCE_OFFICER' END) THEN RAISE EXCEPTION 'Signer is no longer authorized';END IF;
 IF c.action='ENROLL' THEN
  IF s.public_key IS NOT NULL THEN RAISE EXCEPTION 'Key already enrolled';END IF;
  UPDATE public.vice_exec_signers SET public_key=c.public_key,enrolled_at=now() WHERE role=c.role;
 ELSIF c.action='APPROVE' THEN
  SELECT payload_hash INTO v_hash FROM public.vice_sovereign_proposals WHERE id=c.proposal_id AND validation_issues='[]'::jsonb AND status='REVIEW';IF v_hash IS NULL THEN RAISE EXCEPTION 'Proposal blocked';END IF;
  INSERT INTO public.vice_exec_attestations(proposal_id,role,signer_id,signature,challenge_id,payload_hash) VALUES(c.proposal_id,c.role,c.user_id,p_signature,c.id,v_hash) ON CONFLICT(proposal_id,role) DO NOTHING;
 ELSIF c.action='HALT' THEN
  UPDATE public.vice_sovereign_control SET locked=true,reason='Executive cryptographic halt: '||c.role,changed_at=now() WHERE id;
 END IF;
 UPDATE public.vice_exec_challenges SET used_at=now() WHERE id=c.id;
 PERFORM vice_private.exec_log('SIGNATURE_'||c.action,coalesce(c.proposal_id,c.role),jsonb_build_object('signer',c.user_id,'role',c.role,'challenge',c.id));
 RETURN jsonb_build_object('verified',true,'action',c.action,'role',c.role,'execution_enabled',false);
END $$;
REVOKE ALL ON FUNCTION public.vice_exec_finish(uuid,uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.vice_exec_finish(uuid,uuid,text) TO service_role;
CREATE OR REPLACE FUNCTION vice_private.guard_structural_state() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Structural state deletion is locked';END IF;
 IF TG_TABLE_NAME='vice_dao_config' THEN
  IF TG_OP='INSERT' OR (to_jsonb(NEW)-ARRAY['updated_at','updated_by']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['updated_at','updated_by']) THEN RAISE EXCEPTION 'Structural mutation blocked: verified CEO/CFO signatures, on-chain quorum and 72-hour timelock required';END IF;
 ELSE
  RAISE EXCEPTION 'Reference version writes require the sovereign governance executor';
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION vice_private.guard_structural_state() FROM PUBLIC,anon,authenticated;
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgname='vice_sovereign_config_guard') THEN CREATE TRIGGER vice_sovereign_config_guard BEFORE INSERT OR UPDATE OR DELETE ON public.vice_dao_config FOR EACH ROW EXECUTE FUNCTION vice_private.guard_structural_state();END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgname='vice_sovereign_version_guard') THEN CREATE TRIGGER vice_sovereign_version_guard BEFORE INSERT OR UPDATE OR DELETE ON public.ouv_versions FOR EACH ROW EXECUTE FUNCTION vice_private.guard_structural_state();END IF;
END $$;
CREATE OR REPLACE FUNCTION public.vice_institutional_diagnostics() RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE broken integer;v_config jsonb;v_count bigint;v_last text;
BEGIN
 IF NOT public.vice_institutional_access() THEN RAISE EXCEPTION 'Executive access required' USING ERRCODE='42501';END IF;
 SELECT count(*) INTO broken FROM (SELECT *,coalesce(lag(event_hash) OVER(ORDER BY seq),repeat('0',64)) expected_previous FROM public.vice_exec_audit)x
 WHERE previous_hash<>expected_previous OR event_hash<>encode(extensions.digest(convert_to(previous_hash||'|'||seq::text||'|'||coalesce(actor::text,'SYSTEM')||'|'||event||'|'||object_id||'|'||details::text,'UTF8'),'sha256'),'hex');
 SELECT to_jsonb(c) INTO v_config FROM public.vice_dao_config c WHERE id=1;
 SELECT count(*) INTO v_count FROM public.vice_exec_audit;SELECT event_hash INTO v_last FROM public.vice_exec_audit ORDER BY seq DESC LIMIT 1;
 RETURN jsonb_build_object('checked_at',now(),'reference',v_config,'ratio_ok',(v_config->>'v4x_price')::numeric=(v_config->>'vice_price')::numeric*160,'audit_chain_ok',broken=0,'audit_events',v_count,'audit_head',v_last,
 'structural_writes_locked',true,'onchain_quorum','NOT_CONFIGURED','atomic_executor','NOT_CONFIGURED','air_gap','NOT_APPLICABLE_NETWORKED_PLATFORM','agent_runtime','NOT_CONNECTED','model_weights','NO_MODEL_REGISTERED','zero_leakage','NOT_CERTIFIED','perimeter_scan','NOT_RUN','signers',(SELECT coalesce(jsonb_agg(jsonb_build_object('role',role,'user_id',user_id,'enrolled',public_key IS NOT NULL)),'[]') FROM public.vice_exec_signers));
END $$;
DO $$ DECLARE f record;BEGIN
 FOR f IN SELECT oid::regprocedure AS sig FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname IN ('vice_omega_save_lead','vice_omega_draft','vice_omega_queue','vice_omega_save_financing','vice_sovereign_submit','vice_exec_challenge','vice_institutional_diagnostics') LOOP
  EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon',f.sig);EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated',f.sig);
 END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.vice_sovereign_feed() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.vice_sovereign_feed() TO anon,authenticated;
CREATE OR REPLACE FUNCTION public.vice_omega_provider_limit() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 IF NOT public.vice_institutional_access() THEN RAISE EXCEPTION 'Executive access required' USING ERRCODE='42501';END IF;
 PERFORM pg_advisory_xact_lock(818104003);
 IF EXISTS(SELECT 1 FROM public.vice_exec_audit WHERE event='APOLLO_IMPORT_STARTED' AND created_at>now()-interval '2 minutes') THEN RAISE EXCEPTION 'Import already started; wait two minutes';END IF;
 PERFORM vice_private.exec_log('APOLLO_IMPORT_STARTED','APOLLO');
END $$;
CREATE OR REPLACE FUNCTION public.vice_omega_claim_delivery(p_id uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE o public.vice_omega_outreach;l public.vice_omega_leads;
BEGIN
 IF NOT public.vice_institutional_access() THEN RAISE EXCEPTION 'Executive access required' USING ERRCODE='42501';END IF;
 SELECT * INTO o FROM public.vice_omega_outreach WHERE id=p_id AND status='QUEUED' FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Approved queued outreach required; duplicate send blocked';END IF;
 SELECT * INTO l FROM public.vice_omega_leads WHERE id=o.lead_id FOR UPDATE;
 IF l.suppressed OR l.email IS NULL OR l.email_status='UNVERIFIED' OR length(l.contact_basis)<8 OR length(coalesce(l.evidence->>'offering_basis',''))<8 OR length(coalesce(l.evidence->>'counsel_reference',''))<8 THEN RAISE EXCEPTION 'Recipient eligibility changed';END IF;
 UPDATE public.vice_omega_outreach SET status='SENDING' WHERE id=p_id;PERFORM vice_private.exec_log('OMEGA_SEND_CLAIM',p_id::text);
 RETURN jsonb_build_object('email',l.email,'subject',o.subject,'body',o.body);
END $$;
CREATE OR REPLACE FUNCTION public.vice_omega_finish_delivery(p_id uuid,p_provider_id text,p_error text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 IF NOT public.vice_institutional_access() THEN RAISE EXCEPTION 'Executive access required' USING ERRCODE='42501';END IF;
 UPDATE public.vice_omega_outreach SET status=CASE WHEN p_provider_id IS NOT NULL THEN 'SENT' ELSE 'UNKNOWN' END,provider_id=left(p_provider_id,200),last_error=left(p_error,250) WHERE id=p_id AND status='SENDING';
 IF NOT FOUND THEN RAISE EXCEPTION 'No pending delivery';END IF;
 PERFORM vice_private.exec_log('OMEGA_PROVIDER_RESULT',p_id::text,jsonb_build_object('receipt',p_provider_id,'outcome',CASE WHEN p_provider_id IS NULL THEN 'UNKNOWN' ELSE 'ACCEPTED_BY_PROVIDER' END));
END $$;
REVOKE ALL ON FUNCTION public.vice_omega_provider_limit(),public.vice_omega_claim_delivery(uuid),public.vice_omega_finish_delivery(uuid,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.vice_omega_provider_limit(),public.vice_omega_claim_delivery(uuid),public.vice_omega_finish_delivery(uuid,text,text) TO authenticated;
-- Provider receipts may only be committed by the server, never a browser assertion.
REVOKE ALL ON FUNCTION public.vice_omega_claim_delivery(uuid),public.vice_omega_finish_delivery(uuid,text,text) FROM authenticated;
CREATE OR REPLACE FUNCTION public.vice_omega_delivery(p_id uuid,p_actor uuid,p_action text,p_provider_id text DEFAULT NULL,p_error text DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 PERFORM set_config('request.jwt.claim.sub',p_actor::text,true);
 IF p_action='CLAIM' THEN RETURN public.vice_omega_claim_delivery(p_id);END IF;
 IF p_action<>'FINISH' THEN RAISE EXCEPTION 'Invalid delivery action';END IF;
 PERFORM public.vice_omega_finish_delivery(p_id,p_provider_id,p_error);RETURN jsonb_build_object('recorded',true);
END $$;
REVOKE ALL ON FUNCTION public.vice_omega_delivery(uuid,uuid,text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.vice_omega_delivery(uuid,uuid,text,text,text) TO service_role;
CREATE OR REPLACE FUNCTION public.vice_sovereign_check(p_id text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE p public.vice_sovereign_proposals;blocked jsonb:='[]';signatures integer;
BEGIN
 IF NOT public.vice_institutional_access() THEN RAISE EXCEPTION 'Executive access required' USING ERRCODE='42501';END IF;
 SELECT * INTO p FROM public.vice_sovereign_proposals WHERE id=p_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Proposal not found';END IF;
 SELECT count(DISTINCT role) INTO signatures FROM public.vice_exec_attestations WHERE proposal_id=p_id AND payload_hash=p.payload_hash;
 blocked:=p.validation_issues;
 IF now()<p.validation_until THEN blocked:=blocked||'"PUBLIC_REVIEW_WINDOW_OPEN"'::jsonb;END IF;
 IF signatures<>2 THEN blocked:=blocked||'"CEO_AND_CFO_SIGNATURES_REQUIRED"'::jsonb;END IF;
 IF p.quorum_verified_at IS NULL THEN blocked:=blocked||'"ONCHAIN_QUORUM_NOT_VERIFIED"'::jsonb;END IF;
 IF p.execute_after IS NULL OR now()<p.execute_after THEN blocked:=blocked||'"72_HOUR_TIMELOCK_NOT_EXPIRED"'::jsonb;END IF;
 blocked:=blocked||'"STRUCTURAL_EXECUTOR_LOCKED"'::jsonb;
 PERFORM vice_private.exec_log('STRUCTURAL_COMMIT_BLOCKED',p_id,jsonb_build_object('reasons',blocked));
 RETURN jsonb_build_object('execution_enabled',false,'verified_signatures',signatures,'reasons',blocked,'units_changed',false,'prices_changed',false);
END $$;
REVOKE ALL ON FUNCTION public.vice_sovereign_check(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.vice_sovereign_check(text) TO authenticated;
