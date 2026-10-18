-- VICE4X member operations. No existing balances are changed by this migration.
-- Lending records document agreements; they do not originate a loan or execute foreclosure.
CREATE TABLE IF NOT EXISTS public.vice4x_settings (
 id boolean PRIMARY KEY DEFAULT true CHECK(id),
 estate_entity text CHECK(estate_entity IN ('VICE CAPITAL INC','ADKINS ESTATE TRUST')),
 marketplace_urls jsonb NOT NULL DEFAULT '{"svc-001":"https://www.inspirato.com/"}',
 estate_booking_url text,
 updated_at timestamptz NOT NULL DEFAULT now(), updated_by uuid
);
INSERT INTO public.vice4x_settings(id) VALUES(true) ON CONFLICT DO NOTHING;
ALTER TABLE public.vice4x_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.vice4x_settings FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.vice4x_settings TO authenticated;
DROP POLICY IF EXISTS vice4x_settings_read ON public.vice4x_settings;
CREATE POLICY vice4x_settings_read ON public.vice4x_settings FOR SELECT TO authenticated
 USING((SELECT vice_private.account_allowed()));

CREATE OR REPLACE FUNCTION public.vice4x_save_services(p_urls jsonb,p_booking_url text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE item record; booking text:=nullif(btrim(p_booking_url),'');
BEGIN
 PERFORM vice_private.require_active_account();
 IF NOT public.is_super() THEN RAISE EXCEPTION 'Reserve administrator required' USING ERRCODE='42501'; END IF;
 IF jsonb_typeof(p_urls) IS DISTINCT FROM 'object' OR pg_column_size(p_urls)>6000 THEN RAISE EXCEPTION 'Invalid service directory'; END IF;
 FOR item IN SELECT * FROM jsonb_each_text(p_urls) LOOP
  IF item.key NOT IN ('svc-001','svc-002','svc-003','svc-004') OR item.value !~ '^https://[A-Za-z0-9][A-Za-z0-9.-]+(:443)?(/[^[:space:]<>]*)?$'
   OR length(item.value)>1000 THEN RAISE EXCEPTION 'Provider links must be HTTPS websites'; END IF;
 END LOOP;
 IF booking IS NOT NULL AND (length(booking)>1000 OR booking !~ '^https://(calendar\.google\.com/calendar/(u/[0-9]+/)?appointments/schedules/|calendar\.app\.google/)[A-Za-z0-9_/?=&%-]+$')
 THEN RAISE EXCEPTION 'Use the Google Calendar appointment schedule booking link'; END IF;
 UPDATE public.vice4x_settings SET marketplace_urls=p_urls,estate_booking_url=booking,updated_at=now(),updated_by=auth.uid() WHERE id;
 INSERT INTO public.audit_log(event_type,action,object_type,object_id,actor_id,actor_role,outcome)
 VALUES('SERVICES_CONFIGURED','UPDATE','vice4x_settings','true',auth.uid()::text,'SUPER_ADMIN','SUCCESS');
 RETURN jsonb_build_object('saved',true);
END $$;
REVOKE ALL ON FUNCTION public.vice4x_save_services(jsonb,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.vice4x_save_services(jsonb,text) TO authenticated;

-- One active reserve certificate across both possible entity designations.
ALTER TABLE public.token_certificates DROP CONSTRAINT IF EXISTS token_certificates_kind_check;
ALTER TABLE public.token_certificates ADD CONSTRAINT token_certificates_kind_check CHECK
 (kind IN ('ISSUANCE','ALLOCATION','DISTRIBUTION','CONSOLIDATION','RETIREMENT','RESERVE'));
CREATE UNIQUE INDEX IF NOT EXISTS vice4x_one_active_reserve_certificate ON public.token_certificates((kind))
 WHERE kind='RESERVE' AND NOT revoked;
CREATE OR REPLACE FUNCTION public.vice_issue_reserve_certificate(p_entity text,p_request_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE h public.holders%ROWTYPE;c public.token_certificates%ROWTYPE; old_req vice_private.registry_requests%ROWTYPE;
 vu numeric; xu numeric; vp numeric; xp numeric; random_id text; snapshot jsonb; result jsonb;
BEGIN
 PERFORM vice_private.require_active_account();
 IF NOT public.is_super() THEN RAISE EXCEPTION 'Reserve administrator required' USING ERRCODE='42501'; END IF;
 IF p_entity IS NULL OR p_entity NOT IN ('VICE CAPITAL INC','ADKINS ESTATE TRUST') OR p_request_id IS NULL
 THEN RAISE EXCEPTION 'Choose exactly one authorized certificate entity'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('vice4x-reserve-certificate',0));
 SELECT * INTO old_req FROM vice_private.registry_requests WHERE correlation_id=p_request_id;
 IF FOUND THEN
  IF old_req.actor_id<>auth.uid() OR old_req.operation<>'RESERVE_CERT' OR old_req.request<>jsonb_build_object('entity',p_entity)
  THEN RAISE EXCEPTION 'Request already belongs to a different operation'; END IF;
  RETURN old_req.result;
 END IF;
 SELECT * INTO h FROM public.holders WHERE (profile_id=auth.uid() OR user_id=auth.uid()) AND closed_at IS NULL FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Linked reserve controller holder record required'; END IF;
 -- Lock authoritative reserve rows while snapshotting; own distributed estate units
 -- are added once, while units transferred to another holder are excluded.
 PERFORM 1 FROM public.vice_estate_reserve_accounts ORDER BY program FOR UPDATE;
 SELECT unassigned_units+coalesce((SELECT units FROM public.vice_estate_holder_balances WHERE holder_id=h.id AND program='VICE'),0)
 INTO vu FROM public.vice_estate_reserve_accounts WHERE program='VICE';
 SELECT unassigned_units+coalesce((SELECT units FROM public.vice_estate_holder_balances WHERE holder_id=h.id AND program='V4X'),0)
 INTO xu FROM public.vice_estate_reserve_accounts WHERE program='V4X';
 SELECT vice_price,v4x_price INTO vp,xp FROM public.vice_dao_config WHERE id=1;
 IF vu IS NULL OR xu IS NULL OR vp IS NULL OR xp IS NULL THEN RAISE EXCEPTION 'Authoritative reserve or price policy missing'; END IF;
 snapshot:=jsonb_build_object('entity',p_entity,'controller_id',auth.uid(),'controller_name',h.name,
 'record_type','ESTATE_RESERVE_CONTROL','vice_units',vu,'v4x_units',xu,
 'vice_reference_cents',round(vp*100),'v4x_reference_cents',round(xp*100),
 'combined_reference_cents',round((vu*vp+xu*xp)*100),'as_of',now(),
 'basis','Issuer-recorded reserve control; designation does not itself transfer legal title.');
 SELECT * INTO c FROM public.token_certificates WHERE kind='RESERVE' AND NOT revoked;
 IF FOUND AND c.holdings_snapshot->>'entity'=p_entity AND (c.holdings_snapshot->>'vice_units')::numeric=vu
 AND (c.holdings_snapshot->>'v4x_units')::numeric=xu AND (c.holdings_snapshot->>'combined_reference_cents')::numeric=round((vu*vp+xu*xp)*100)
 THEN result:=jsonb_build_object('cert_id',c.cert_id,'status','ISSUED','already_issued',true);
 ELSE
  UPDATE public.token_certificates SET revoked=true,revoked_at=now(),revoked_reason='Superseded reserve designation or snapshot'
   WHERE kind='RESERVE' AND NOT revoked;
  c:=NULL;random_id:=upper(encode(extensions.gen_random_bytes(8),'hex'));
  c.id:=gen_random_uuid();c.cert_id:='VCT-'||substr(random_id,1,4)||'-'||substr(random_id,5,4)||'-'||substr(random_id,9,4)||'-'||substr(random_id,13,4);
  c.kind:='RESERVE';c.holder_id:=h.id;c.profile_id:=auth.uid();c.holder_client_id:=h.client_id;c.holder_name:=p_entity;
  c.program:='BOTH';c.units:=vu+xu;c.units_held_before:=c.units;c.units_held_after:=c.units;
  c.holdings_snapshot:=snapshot;c.value_basis:='RESERVE_CONTROL_REFERENCE';c.reference_value_cents:=round((vu*vp+xu*xp)*100);
  c.issued_at:=now();c.created_at:=now();c.salt:=encode(extensions.gen_random_bytes(16),'hex');c.issued_by:=auth.uid();c.revoked:=false;
  c.digest:=public.token_cert_digest(c);
  INSERT INTO public.token_certificates SELECT (c).*;
  result:=jsonb_build_object('cert_id',c.cert_id,'status','ISSUED');
 END IF;
 UPDATE public.vice4x_settings SET estate_entity=p_entity,updated_at=now(),updated_by=auth.uid() WHERE id;
 INSERT INTO vice_private.registry_requests(correlation_id,actor_id,operation,request,result)
 VALUES(p_request_id,auth.uid(),'RESERVE_CERT',jsonb_build_object('entity',p_entity),result);
 INSERT INTO public.audit_log(event_type,action,object_type,object_id,actor_id,actor_role,outcome,correlation_id)
 VALUES('RESERVE_CERTIFICATE','ISSUE','token_certificates',result->>'cert_id',auth.uid()::text,'SUPER_ADMIN','SUCCESS',p_request_id::text);
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.vice_issue_reserve_certificate(text,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.vice_issue_reserve_certificate(text,uuid) TO authenticated;

-- Administrator status is derived from recorded chapter receipts, server grading,
-- and unrevoked/unexpired certificates; never from a browser completion flag.
CREATE OR REPLACE FUNCTION public.vice_academy_member_status()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE result jsonb;
BEGIN
 PERFORM vice_private.require_active_account();
 IF NOT vice_private.is_registry_operator() THEN RAISE EXCEPTION 'Registry administrator required' USING ERRCODE='42501'; END IF;
 SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.name),'[]') INTO result FROM (
 SELECT p.id,p.name,p.role,h.client_id,
 (SELECT count(*) FROM public.academy_progress a WHERE a.profile_id=p.id AND a.module IN ('I','II','III','IV','V','VI','VII')) chapters_completed,
 (SELECT count(DISTINCT a.module) FROM public.academy_attempts a WHERE a.profile_id=p.id AND a.passed AND a.score>=75 AND a.module IN ('I','II','III','IV','V','VI','VII')) exams_passed,
 (SELECT coalesce(jsonb_object_agg(z.module,z.score),'{}') FROM (SELECT module,max(score) score FROM public.academy_attempts WHERE profile_id=p.id GROUP BY module) z) scores,
 (SELECT cert_id FROM public.certificates WHERE profile_id=p.id AND NOT revoked AND (expires_at IS NULL OR expires_at>now()) ORDER BY issued_at DESC LIMIT 1) certificate_id
 FROM public.profiles p LEFT JOIN public.holders h ON h.profile_id=p.id AND h.closed_at IS NULL
 WHERE NOT p.account_revoked
 ) x;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.vice_academy_member_status() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.vice_academy_member_status() TO authenticated;

CREATE TABLE IF NOT EXISTS public.vice_lending_records (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),request_id uuid NOT NULL UNIQUE,
 holder_id uuid NOT NULL REFERENCES public.holders(id),owner_id uuid NOT NULL REFERENCES public.profiles(id),
 program text NOT NULL CHECK(program IN ('VICE','V4X')), units numeric(20,0) NOT NULL CHECK(units>0 AND units<=7500000),
 pool text NOT NULL DEFAULT 'STRATEGIC' CHECK(pool IN ('STRATEGIC','ESTATE')),
 lender_name text NOT NULL CHECK(length(lender_name) BETWEEN 2 AND 200),
 lender_type text NOT NULL CHECK(lender_type IN ('FINANCIAL_INSTITUTION','PRIVATE_LENDER')),
 lender_contact text, loan_reference text NOT NULL CHECK(length(loan_reference) BETWEEN 2 AND 100),
 currency text NOT NULL CHECK(currency ~ '^[A-Z]{3}$'),principal numeric(20,2) NOT NULL CHECK(principal>0 AND principal<1e15),
 annual_rate numeric(8,4) NOT NULL CHECK(annual_rate>=0 AND annual_rate<=1000),
 appraisal_value numeric(20,2) NOT NULL CHECK(appraisal_value>0 AND appraisal_value<1e15),
 ltv numeric GENERATED ALWAYS AS (round(principal/appraisal_value*100,4)) STORED,
 appraiser text NOT NULL CHECK(length(appraiser) BETWEEN 2 AND 200),appraisal_date date NOT NULL,
 maturity_date date NOT NULL, agreement_document_id uuid NOT NULL REFERENCES public.documents(id),
 agreement_sha256 text NOT NULL,terms text NOT NULL CHECK(length(terms) BETWEEN 8 AND 5000),
 status text NOT NULL DEFAULT 'SUBMITTED' CHECK(status IN ('SUBMITTED','ACTIVE','DEFAULT_NOTICE','DISPUTED','ENFORCEMENT_REVIEW','RELEASED','REJECTED','CANCELLED')),
 cure_until date,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS vice_lending_owner_idx ON public.vice_lending_records(owner_id,created_at DESC);
CREATE INDEX IF NOT EXISTS vice_lending_encumbrance_idx ON public.vice_lending_records(holder_id,program,pool,status);
CREATE TABLE IF NOT EXISTS public.vice_lending_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),record_id uuid NOT NULL REFERENCES public.vice_lending_records(id),
 actor_id uuid NOT NULL,action text NOT NULL,reason text NOT NULL,evidence_document_id uuid REFERENCES public.documents(id),
 evidence_sha256 text,request_id uuid NOT NULL UNIQUE,created_at timestamptz NOT NULL DEFAULT now(),details jsonb NOT NULL DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS vice_lending_event_record_idx ON public.vice_lending_events(record_id,created_at);
ALTER TABLE public.vice_lending_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vice_lending_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.vice_lending_records,public.vice_lending_events FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.vice_lending_records,public.vice_lending_events TO authenticated;
DROP POLICY IF EXISTS lending_read ON public.vice_lending_records;
CREATE POLICY lending_read ON public.vice_lending_records FOR SELECT TO authenticated USING(
 (SELECT vice_private.account_allowed()) AND (owner_id=(SELECT auth.uid()) OR (SELECT public.is_admin())));
DROP POLICY IF EXISTS lending_event_read ON public.vice_lending_events;
CREATE POLICY lending_event_read ON public.vice_lending_events FOR SELECT TO authenticated USING(
 (SELECT vice_private.account_allowed()) AND EXISTS(SELECT 1 FROM public.vice_lending_records r WHERE r.id=record_id));

CREATE OR REPLACE FUNCTION vice_private.lending_encumbered(p_holder uuid,p_program text,p_pool text)
RETURNS numeric LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT coalesce(sum(units),0) FROM public.vice_lending_records WHERE holder_id=p_holder AND program=p_program AND pool=p_pool
 AND status IN ('SUBMITTED','ACTIVE','DEFAULT_NOTICE','DISPUTED','ENFORCEMENT_REVIEW');
$$;
REVOKE ALL ON FUNCTION vice_private.lending_encumbered(uuid,text,text) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.vice_submit_lending_record(p_record jsonb,p_request_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE h public.holders%ROWTYPE;r public.vice_lending_records%ROWTYPE;d public.documents%ROWTYPE;
 req vice_private.registry_requests%ROWTYPE;balance numeric;v_program text:=p_record->>'program';v_pool text:=p_record->>'pool';n numeric;
BEGIN
 PERFORM vice_private.require_active_account();
 IF p_request_id IS NULL OR jsonb_typeof(p_record)<>'object' OR pg_column_size(p_record)>12000 THEN RAISE EXCEPTION 'Invalid loan record'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('vice-lending:'||auth.uid()::text,0));
 SELECT * INTO req FROM vice_private.registry_requests WHERE correlation_id=p_request_id;
 IF FOUND THEN
  IF req.actor_id<>auth.uid() OR req.operation<>'LOAN_SUBMIT' OR req.request<>p_record THEN RAISE EXCEPTION 'Request belongs to a different operation'; END IF;
  RETURN req.result;
 END IF;
 SELECT * INTO h FROM public.holders WHERE (profile_id=auth.uid() OR user_id=auth.uid()) AND closed_at IS NULL FOR UPDATE;
 IF NOT FOUND OR h.account_suspended OR h.account_revoked OR h.holdings_locked THEN RAISE EXCEPTION 'Active unlocked holder required'; END IF;
 IF v_program IS NULL OR v_program NOT IN ('VICE','V4X') OR v_pool IS NULL OR v_pool NOT IN ('STRATEGIC','ESTATE') THEN RAISE EXCEPTION 'Select a valid program and pool'; END IF;
 n:=(p_record->>'units')::numeric;
 IF n IS NULL OR n<=0 OR n<>trunc(n) OR n>7500000 THEN RAISE EXCEPTION 'Positive whole units required'; END IF;
 IF v_pool='STRATEGIC' THEN balance:=CASE WHEN v_program='VICE' THEN h.vice_units ELSE h.v4x_units END;
 ELSE
  -- Estate pledges require a completed transfer into the holder's own estate ledger.
  -- A controller cannot encumber another holder's units or the unallocated reserve.
  PERFORM 1 FROM public.vice_estate_holder_balances b WHERE b.holder_id=h.id AND b.program=v_program FOR UPDATE;
  SELECT b.units INTO balance FROM public.vice_estate_holder_balances b WHERE b.holder_id=h.id AND b.program=v_program;
 END IF;
 IF n>coalesce(balance,0)-vice_private.lending_encumbered(h.id,v_program,v_pool) THEN RAISE EXCEPTION 'Pledged quantity exceeds available recorded holdings'; END IF;
 SELECT * INTO d FROM public.documents WHERE id=(p_record->>'agreement_document_id')::uuid;
 IF NOT FOUND OR d.uploaded_by IS DISTINCT FROM auth.uid()::text OR d.sha256 IS NULL OR d.sha256!~'^[a-fA-F0-9]{64}$'
 THEN RAISE EXCEPTION 'Upload your agreement to Documents first; a stored SHA-256 is required'; END IF;
 IF (p_record->>'appraisal_date')::date>current_date OR (p_record->>'maturity_date')::date<current_date THEN RAISE EXCEPTION 'Check appraisal and maturity dates'; END IF;
 INSERT INTO public.vice_lending_records(request_id,holder_id,owner_id,program,pool,units,lender_name,lender_type,lender_contact,loan_reference,
 currency,principal,annual_rate,appraisal_value,appraiser,appraisal_date,maturity_date,agreement_document_id,agreement_sha256,terms)
 VALUES(p_request_id,h.id,auth.uid(),v_program,v_pool,n,btrim(p_record->>'lender_name'),p_record->>'lender_type',left(p_record->>'lender_contact',300),btrim(p_record->>'loan_reference'),
 upper(p_record->>'currency'),(p_record->>'principal')::numeric,(p_record->>'annual_rate')::numeric,(p_record->>'appraisal_value')::numeric,btrim(p_record->>'appraiser'),
 (p_record->>'appraisal_date')::date,(p_record->>'maturity_date')::date,d.id,d.sha256,btrim(p_record->>'terms')) RETURNING * INTO r;
 INSERT INTO public.vice_lending_events(record_id,actor_id,action,reason,evidence_document_id,evidence_sha256,request_id)
 VALUES(r.id,auth.uid(),'SUBMITTED','Holder submitted agreement for review; units reserved against duplicate pledging.',d.id,d.sha256,p_request_id);
 INSERT INTO vice_private.registry_requests(correlation_id,actor_id,operation,request,result)
 VALUES(p_request_id,auth.uid(),'LOAN_SUBMIT',p_record,to_jsonb(r));
 RETURN to_jsonb(r);
END $$;
REVOKE ALL ON FUNCTION public.vice_submit_lending_record(jsonb,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.vice_submit_lending_record(jsonb,uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.vice_advance_lending_record(p_id uuid,p_action text,p_reason text,p_evidence uuid,p_cure_until date,p_request_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE r public.vice_lending_records%ROWTYPE;d public.documents%ROWTYPE;event public.vice_lending_events%ROWTYPE;
 allowed boolean;admin boolean;target text:=p_action;
BEGIN
 PERFORM vice_private.require_active_account();
 IF p_request_id IS NULL OR length(btrim(coalesce(p_reason,''))) NOT BETWEEN 8 AND 2000 THEN RAISE EXCEPTION 'Reason must contain 8–2000 characters'; END IF;
 -- Same lock order as submission and balance mutations: holder, then loan.
 PERFORM 1 FROM public.holders WHERE id=(SELECT holder_id FROM public.vice_lending_records WHERE id=p_id) FOR UPDATE;
 SELECT * INTO r FROM public.vice_lending_records WHERE id=p_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Loan record not found'; END IF;
 admin:=vice_private.is_registry_operator() AND (public.is_super() OR NOT vice_private.is_reserve_holder(r.holder_id));
 IF NOT admin AND r.owner_id<>auth.uid() THEN RAISE EXCEPTION 'Access denied' USING ERRCODE='42501'; END IF;
 SELECT * INTO event FROM public.vice_lending_events WHERE request_id=p_request_id;
 IF FOUND THEN
  IF event.record_id<>p_id OR event.actor_id<>auth.uid() OR event.action<>p_action OR event.reason<>btrim(p_reason)
   OR event.evidence_document_id IS DISTINCT FROM p_evidence OR event.details->>'cure_until' IS DISTINCT FROM p_cure_until::text
  THEN RAISE EXCEPTION 'Request belongs to a different operation'; END IF;
  RETURN to_jsonb(r);
 END IF;
 allowed:=(admin AND ((r.status='SUBMITTED' AND target IN ('ACTIVE','REJECTED'))
  OR (r.status='ACTIVE' AND target IN ('DEFAULT_NOTICE','RELEASED'))
  OR (r.status='DEFAULT_NOTICE' AND target IN ('ACTIVE','ENFORCEMENT_REVIEW','RELEASED'))
  OR (r.status='DISPUTED' AND target IN ('ACTIVE','RELEASED'))
  OR (r.status='ENFORCEMENT_REVIEW' AND target IN ('ACTIVE','RELEASED'))))
  OR (r.owner_id=auth.uid() AND ((r.status='SUBMITTED' AND target='CANCELLED')
   OR (r.status IN ('ACTIVE','DEFAULT_NOTICE','ENFORCEMENT_REVIEW') AND target='DISPUTED')));
 IF NOT coalesce(allowed,false) THEN RAISE EXCEPTION 'This status transition is not authorized'; END IF;
 IF target IN ('ACTIVE','DEFAULT_NOTICE','ENFORCEMENT_REVIEW','RELEASED') THEN
  SELECT * INTO d FROM public.documents WHERE id=p_evidence;
  IF NOT FOUND OR d.sha256 IS NULL OR (d.uploaded_by IS DISTINCT FROM auth.uid()::text AND d.holder_id IS DISTINCT FROM r.holder_id)
  THEN RAISE EXCEPTION 'Accessible evidence document with a recorded digest is required'; END IF;
 END IF;
 IF target='DEFAULT_NOTICE' AND (p_cure_until IS NULL OR p_cure_until<current_date) THEN RAISE EXCEPTION 'Record the agreement-specific future cure deadline'; END IF;
 IF target='ENFORCEMENT_REVIEW' AND (r.cure_until IS NULL OR r.cure_until>=current_date)
 THEN RAISE EXCEPTION 'The recorded cure period has not expired'; END IF;
 UPDATE public.vice_lending_records SET status=target,cure_until=CASE WHEN target='DEFAULT_NOTICE' THEN p_cure_until ELSE cure_until END,
 updated_at=now() WHERE id=p_id RETURNING * INTO r;
 INSERT INTO public.vice_lending_events(record_id,actor_id,action,reason,evidence_document_id,evidence_sha256,request_id,details)
 VALUES(r.id,auth.uid(),target,btrim(p_reason),d.id,d.sha256,p_request_id,jsonb_build_object('cure_until',p_cure_until,'asset_transfer',false));
 RETURN to_jsonb(r);
END $$;
REVOKE ALL ON FUNCTION public.vice_advance_lending_record(uuid,text,text,uuid,date,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.vice_advance_lending_record(uuid,text,text,uuid,date,uuid) TO authenticated;

-- Enforce recorded pledge reservations even through existing issuance/transfer RPCs.
CREATE OR REPLACE FUNCTION vice_private.guard_pledged_holdings()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 IF TG_TABLE_NAME='holders' THEN
  IF NEW.vice_units<vice_private.lending_encumbered(NEW.id,'VICE','STRATEGIC') OR NEW.v4x_units<vice_private.lending_encumbered(NEW.id,'V4X','STRATEGIC')
  THEN RAISE EXCEPTION 'Recorded collateral commitment must be released before these units can move'; END IF;
 ELSE
  PERFORM 1 FROM public.holders WHERE id=NEW.holder_id FOR UPDATE;
  IF NEW.units<vice_private.lending_encumbered(NEW.holder_id,NEW.program,'ESTATE')
  THEN RAISE EXCEPTION 'Estate units are reserved under a recorded collateral commitment'; END IF;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION vice_private.guard_pledged_holdings() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS vice4x_pledge_guard ON public.holders;
CREATE TRIGGER vice4x_pledge_guard BEFORE UPDATE OF vice_units,v4x_units ON public.holders FOR EACH ROW EXECUTE FUNCTION vice_private.guard_pledged_holdings();
DROP TRIGGER IF EXISTS vice4x_estate_pledge_guard ON public.vice_estate_holder_balances;
CREATE TRIGGER vice4x_estate_pledge_guard BEFORE UPDATE OF units ON public.vice_estate_holder_balances FOR EACH ROW EXECUTE FUNCTION vice_private.guard_pledged_holdings();

-- Close only unlinked, zero-balance records after reconciliation. Keep the journal
-- and revoked certificates in the audit trail; hide closed records operationally.
CREATE OR REPLACE FUNCTION public.vice_close_erroneous_holder(p_holder uuid,p_reason text,p_request_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE h public.holders%ROWTYPE;s bigint;
BEGIN
 PERFORM vice_private.require_active_account();
 IF NOT public.is_super() THEN RAISE EXCEPTION 'Reserve administrator required' USING ERRCODE='42501'; END IF;
 IF p_request_id IS NULL OR length(btrim(coalesce(p_reason,''))) NOT BETWEEN 8 AND 500 THEN RAISE EXCEPTION 'Recorded reason required'; END IF;
 SELECT * INTO h FROM public.holders WHERE id=p_holder FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Holder missing'; END IF;
 IF h.closed_at IS NOT NULL THEN RETURN jsonb_build_object('closed',true,'already_closed',true); END IF;
 IF h.user_id IS NOT NULL OR h.profile_id IS NOT NULL OR h.vice_units<>0 OR h.v4x_units<>0
 OR EXISTS(SELECT 1 FROM public.vice_estate_holder_balances WHERE holder_id=h.id AND units<>0)
 OR EXISTS(SELECT 1 FROM public.allocations WHERE holder_id=h.id AND status IN ('PENDING','APPROVED','RESERVED'))
 OR EXISTS(SELECT 1 FROM public.vice_estate_allocations WHERE holder_id=h.id AND status IN ('PENDING','APPROVED','RESERVED'))
 OR EXISTS(SELECT 1 FROM public.token_certificates WHERE holder_id=h.id AND NOT revoked)
 OR EXISTS(SELECT 1 FROM public.vice_lending_records WHERE holder_id=h.id)
 THEN RAISE EXCEPTION 'Reconcile links, allocations, certificates and balances before closure'; END IF;
 UPDATE public.holders SET status='CLOSED',closed_at=now(),email=NULL,name='Closed erroneous record',updated_at=now() WHERE id=h.id;
 INSERT INTO public.iru_events(event_type,payload,actor_id,actor_role,correlation_id)
 VALUES('HOLDER_CLOSED',jsonb_build_object('type','HOLDER_CLOSED','holderId',h.id,'clientId',h.client_id,'reason',btrim(p_reason),'at',now()),auth.uid(),'SUPER_ADMIN',p_request_id) RETURNING seq INTO s;
 INSERT INTO public.audit_log(event_type,action,object_type,object_id,actor_id,actor_role,outcome,correlation_id)
 VALUES('HOLDER_CLOSED',btrim(p_reason),'holders',h.id::text,auth.uid()::text,'SUPER_ADMIN','SUCCESS',p_request_id::text);
 RETURN jsonb_build_object('closed',true,'seq',s);
END $$;
REVOKE ALL ON FUNCTION public.vice_close_erroneous_holder(uuid,text,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.vice_close_erroneous_holder(uuid,text,uuid) TO authenticated;

-- Personal VICEBOT access is bound to the verified KAHZI auth UUID, not a
-- mutable display name, client label, or any other SUPER_ADMIN account.
CREATE TABLE IF NOT EXISTS vice_private.personal_bot_settings (
 owner_id uuid PRIMARY KEY REFERENCES auth.users(id),
 enabled boolean NOT NULL DEFAULT false,
 updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK(owner_id='6e83b6bc-e247-41fc-8469-4267987273b7'::uuid)
);
REVOKE ALL ON vice_private.personal_bot_settings FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION public.vice_personal_bot_access()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE ok boolean;
BEGIN
 PERFORM vice_private.require_active_account();
 ok := auth.uid()='6e83b6bc-e247-41fc-8469-4267987273b7'::uuid AND public.is_super();
 RETURN jsonb_build_object('allowed',coalesce(ok,false),'enabled',
  CASE WHEN ok THEN coalesce((SELECT enabled FROM vice_private.personal_bot_settings WHERE owner_id=auth.uid()),false) ELSE false END,
  'mode','PERSONAL_ANALYSIS','broker_execution',false);
END $$;
CREATE OR REPLACE FUNCTION public.vice_set_personal_bot_enabled(p_enabled boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 PERFORM vice_private.require_active_account();
 IF auth.uid()<>'6e83b6bc-e247-41fc-8469-4267987273b7'::uuid OR NOT public.is_super()
 THEN RAISE EXCEPTION 'VICEBOT personal access is restricted to KAHZI' USING ERRCODE='42501'; END IF;
 IF p_enabled IS NULL THEN RAISE EXCEPTION 'Enabled status required'; END IF;
 INSERT INTO vice_private.personal_bot_settings(owner_id,enabled) VALUES(auth.uid(),p_enabled)
 ON CONFLICT(owner_id) DO UPDATE SET enabled=excluded.enabled,updated_at=now();
 INSERT INTO public.audit_log(event_type,action,object_type,object_id,actor_id,actor_role,outcome)
 VALUES('VICEBOT_PERSONAL_ACCESS',CASE WHEN p_enabled THEN 'Enable personal analysis; broker execution remains external' ELSE 'Disable personal analysis' END,
 'personal_bot_settings',auth.uid()::text,auth.uid()::text,'SUPER_ADMIN','SUCCESS');
 RETURN public.vice_personal_bot_access();
END $$;
REVOKE ALL ON FUNCTION public.vice_personal_bot_access(),public.vice_set_personal_bot_enabled(boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.vice_personal_bot_access(),public.vice_set_personal_bot_enabled(boolean) TO authenticated;
