-- Authenticator approvals have the same executive authority as device-key approvals.
-- This adds a second authenticated path; it never changes quorum, timelock, units or OUV.
ALTER TABLE public.vice_exec_challenges ADD COLUMN IF NOT EXISTS authorization_method text NOT NULL DEFAULT 'DEVICE_KEY';
ALTER TABLE public.vice_exec_challenges ADD COLUMN IF NOT EXISTS expected_key_fingerprint text;
ALTER TABLE public.vice_exec_attestations ADD COLUMN IF NOT EXISTS authorization_method text NOT NULL DEFAULT 'DEVICE_KEY';
ALTER TABLE public.vice_exec_attestations ADD COLUMN IF NOT EXISTS public_key_snapshot jsonb;
ALTER TABLE public.vice_exec_attestations ALTER COLUMN signature DROP NOT NULL;
ALTER TABLE public.vice_exec_challenges DROP CONSTRAINT IF EXISTS vice_exec_challenges_action_check;
ALTER TABLE public.vice_exec_challenges ADD CONSTRAINT vice_exec_challenges_action_check CHECK(action IN ('ENROLL','APPROVE','REJECT','HALT','RECOVERY_APPROVE','RECOVERY_ACTIVATE','RECOVERY_REQUEST'));

-- Make the already-deployed recovery schema reproducible in an empty staging database.
CREATE TABLE IF NOT EXISTS public.vice_exec_recovery_requests(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),ceo_user_id uuid NOT NULL REFERENCES auth.users(id),
 requested_at timestamptz NOT NULL DEFAULT now(),status text NOT NULL DEFAULT 'PENDING_CFO' CHECK(status IN ('PENDING_CFO','APPROVED','CANCELLED','EXPIRED','COMPLETED')),
 expires_at timestamptz NOT NULL DEFAULT now()+interval '24 hours',approved_at timestamptz,
 replacement_public_key jsonb,approval_challenge uuid,approval_signature text,activation_challenge uuid,activated_at timestamptz,replacement_key_fingerprint text
);
ALTER TABLE public.vice_exec_recovery_requests ADD COLUMN IF NOT EXISTS approval_method text;
ALTER TABLE public.vice_exec_recovery_requests ADD COLUMN IF NOT EXISTS requester_role text NOT NULL DEFAULT 'CEO' CHECK(requester_role IN ('CEO','CFO'));
ALTER TABLE public.vice_exec_recovery_requests ADD COLUMN IF NOT EXISTS initiation_proof uuid;
ALTER TABLE public.vice_exec_recovery_requests ADD COLUMN IF NOT EXISTS activation_proof uuid;
-- ceo_user_id is the historical column name; requester_role disambiguates new CFO requests.
DO $$ DECLARE c record;BEGIN
 FOR c IN SELECT conname FROM pg_constraint WHERE conrelid='public.vice_exec_recovery_requests'::regclass AND contype='c' AND pg_get_constraintdef(oid) LIKE '%status%' LOOP EXECUTE format('ALTER TABLE public.vice_exec_recovery_requests DROP CONSTRAINT %I',c.conname);END LOOP;
END $$;
ALTER TABLE public.vice_exec_recovery_requests ADD CONSTRAINT vice_exec_recovery_state CHECK(status IN ('INITIATED','PENDING_CFO','PENDING_CEO','APPROVED','CANCELLED','REJECTED','EXPIRED','COMPLETED'));
ALTER TABLE public.vice_exec_recovery_requests ALTER COLUMN status SET DEFAULT 'INITIATED';
ALTER TABLE public.vice_exec_challenges ADD COLUMN IF NOT EXISTS context_hash text;
ALTER TABLE public.vice_exec_challenges ADD COLUMN IF NOT EXISTS client_build text;
ALTER TABLE public.vice_exec_challenges ADD COLUMN IF NOT EXISTS policy_version text;
ALTER TABLE public.vice_exec_attestations ADD COLUMN IF NOT EXISTS policy_version text;
CREATE TABLE IF NOT EXISTS public.vice_exec_authorization_policy(
 version text PRIMARY KEY,effective_at timestamptz NOT NULL DEFAULT now(),methods jsonb NOT NULL,required_roles jsonb NOT NULL,
 fresh_seconds integer NOT NULL,cooldown_seconds integer NOT NULL,scope text NOT NULL
);
INSERT INTO public.vice_exec_authorization_policy(version,methods,required_roles,fresh_seconds,cooldown_seconds,scope)
 VALUES('VICE-EXEC-AUTH-2','["DEVICE_KEY","TOTP"]','["CEO","CFO"]',300,60,'Internal governance only; quorum and execution gates remain unchanged') ON CONFLICT DO NOTHING;
ALTER TABLE public.vice_exec_authorization_policy ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.vice_exec_authorization_policy FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.vice_exec_authorization_policy TO authenticated;
DROP POLICY IF EXISTS exec_policy_read ON public.vice_exec_authorization_policy;
CREATE POLICY exec_policy_read ON public.vice_exec_authorization_policy FOR SELECT TO authenticated USING(true);

ALTER TABLE public.vice_exec_recovery_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.vice_exec_recovery_requests FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.vice_exec_recovery_requests TO authenticated;
DROP POLICY IF EXISTS vice_exec_recovery_read ON public.vice_exec_recovery_requests;
CREATE POLICY vice_exec_recovery_read ON public.vice_exec_recovery_requests FOR SELECT TO authenticated USING(public.vice_institutional_access());

CREATE TABLE IF NOT EXISTS vice_private.exec_mfa_proofs(
 challenge_id uuid PRIMARY KEY REFERENCES public.vice_exec_challenges(id),user_id uuid NOT NULL,session_id uuid NOT NULL,
 payload_hash text NOT NULL,recovery_id uuid REFERENCES public.vice_exec_recovery_requests(id),
 auth_challenge_id uuid UNIQUE,factor_id uuid,verified_at timestamptz,created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS vice_private.exec_key_history(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid NOT NULL,role text NOT NULL,public_key jsonb NOT NULL,
 fingerprint text NOT NULL,revoked_at timestamptz NOT NULL DEFAULT now(),recovery_id uuid NOT NULL UNIQUE
);
ALTER TABLE vice_private.exec_mfa_proofs ENABLE ROW LEVEL SECURITY;
ALTER TABLE vice_private.exec_key_history ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON vice_private.exec_mfa_proofs,vice_private.exec_key_history FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION vice_private.exec_assert_role(p_user uuid,p_role text) RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 IF p_role IS NULL OR NOT EXISTS(SELECT 1 FROM public.vice_exec_signers s JOIN public.profiles p ON p.id=s.user_id WHERE s.user_id=p_user AND s.role=p_role AND NOT p.account_suspended AND NOT p.account_revoked AND p.role=CASE s.role WHEN 'CEO' THEN 'SUPER_ADMIN' WHEN 'CFO' THEN 'FINANCE_OFFICER' END) THEN RAISE EXCEPTION 'Designated active executive required' USING ERRCODE='42501';END IF;
END $$;
REVOKE ALL ON FUNCTION vice_private.exec_assert_role(uuid,text) FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION vice_private.exec_recovery_hash(r public.vice_exec_recovery_requests) RETURNS text LANGUAGE sql IMMUTABLE SET search_path=pg_catalog AS $$
 SELECT encode(extensions.digest(convert_to(jsonb_build_object('request_id',r.id,'requester',r.ceo_user_id,'role',r.requester_role,'replacement_fingerprint',r.replacement_key_fingerprint)::text,'UTF8'),'sha256'),'hex');
$$;
REVOKE ALL ON FUNCTION vice_private.exec_recovery_hash(public.vice_exec_recovery_requests) FROM PUBLIC,anon,authenticated;


UPDATE public.vice_exec_attestations a SET public_key_snapshot=s.public_key FROM public.vice_exec_signers s
 WHERE a.signer_id=s.user_id AND a.public_key_snapshot IS NULL AND a.authorization_method='DEVICE_KEY' AND s.public_key IS NOT NULL AND a.verified_at>=s.enrolled_at;
-- Preserve earlier server-verified MFA receipts in their original form.
CREATE TABLE IF NOT EXISTS public.vice_exec_mfa_authorizations(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),request_id uuid NOT NULL,user_id uuid NOT NULL,
 role text NOT NULL,action text NOT NULL,proposal_id text,payload_hash text,recovery_request_id uuid,
 auth_method text NOT NULL DEFAULT 'SUPABASE_TOTP',factor_id text,replacement_key_proof text,verified_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.vice_exec_mfa_authorizations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.vice_exec_mfa_authorizations FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION vice_private.exec_has_approval(p_id text,p_role text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT EXISTS(SELECT 1 FROM public.vice_exec_attestations a JOIN public.vice_sovereign_proposals p ON p.id=a.proposal_id WHERE a.proposal_id=p_id AND a.role=p_role AND a.payload_hash=p.payload_hash)
 OR EXISTS(SELECT 1 FROM public.vice_exec_mfa_authorizations a JOIN public.vice_sovereign_proposals p ON p.id=a.proposal_id WHERE a.proposal_id=p_id AND a.role=p_role AND a.action='APPROVE' AND a.payload_hash=p.payload_hash);
$$;
REVOKE ALL ON FUNCTION vice_private.exec_has_approval(text,text) FROM PUBLIC,anon,authenticated;
-- Restart in-flight legacy requests in the current UI; completed receipts remain valid.
DO $$ DECLARE f record;BEGIN
 FOR f IN SELECT oid::regprocedure sig FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname IN ('vice_exec_mfa_begin','vice_exec_mfa_finish','vice_exec_mfa_get') LOOP
  EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated,service_role',f.sig);
 END LOOP;
END $$;

-- Wrap the deployed key workflow without rewriting its historical attestations.
CREATE OR REPLACE FUNCTION public.vice_exec_mfa_begin(p_action text,p_proposal text DEFAULT NULL,p_recovery uuid DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql SET search_path=pg_catalog AS $$
BEGIN RAISE EXCEPTION 'Refresh VICE4X to use the current authenticator authorization flow. Existing approvals are retained.';END $$;
REVOKE ALL ON FUNCTION public.vice_exec_mfa_begin(text,text,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.vice_exec_mfa_begin(text,text,uuid) TO authenticated;
DO $$ BEGIN
 IF to_regprocedure('vice_private.exec_challenge_device_v1(text,text,jsonb)') IS NULL THEN
  ALTER FUNCTION public.vice_exec_challenge(text,text,jsonb) RENAME TO exec_challenge_device_v1;
  ALTER FUNCTION public.exec_challenge_device_v1(text,text,jsonb) SET SCHEMA vice_private;
 END IF;
 IF to_regprocedure('vice_private.exec_finish_device_v1(uuid,uuid,text)') IS NULL THEN
  ALTER FUNCTION public.vice_exec_finish(uuid,uuid,text) RENAME TO exec_finish_device_v1;
  ALTER FUNCTION public.exec_finish_device_v1(uuid,uuid,text) SET SCHEMA vice_private;
 END IF;
END $$;
REVOKE ALL ON FUNCTION vice_private.exec_challenge_device_v1(text,text,jsonb),vice_private.exec_finish_device_v1(uuid,uuid,text) FROM PUBLIC,anon,authenticated,service_role;
CREATE OR REPLACE FUNCTION public.vice_exec_challenge(p_action text,p_proposal text DEFAULT NULL,p_public_key jsonb DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE r jsonb;k jsonb;
BEGIN
 PERFORM vice_private.require_active_account();
 SELECT public_key INTO k FROM public.vice_exec_signers WHERE user_id=auth.uid();
 IF p_action='APPROVE' AND vice_private.exec_has_approval(p_proposal,(SELECT role FROM public.vice_exec_signers WHERE user_id=auth.uid())) THEN RAISE EXCEPTION 'Your executive approval is already recorded';END IF;
 r:=vice_private.exec_challenge_device_v1(p_action,p_proposal,p_public_key);
 UPDATE public.vice_exec_challenges SET expected_key_fingerprint=CASE WHEN k IS NOT NULL THEN encode(extensions.digest(convert_to(k::text,'UTF8'),'sha256'),'hex') END WHERE id=(r->>'id')::uuid;
 UPDATE public.vice_exec_challenges SET context_hash=split_part(message,'|',6),policy_version='VICE-EXEC-AUTH-2',expires_at=now()+interval '5 minutes',message=message||'|'||now()::text||'|'||(now()+interval '5 minutes')::text||'|VICE-EXEC-AUTH-2' WHERE id=(r->>'id')::uuid;
 SELECT jsonb_build_object('id',id,'message',message,'expires_at',expires_at,'payload_hash',context_hash,'role',role) INTO r FROM public.vice_exec_challenges WHERE id=(r->>'id')::uuid;
 RETURN r;
END $$;
CREATE OR REPLACE FUNCTION public.vice_exec_finish(p_challenge uuid,p_actor uuid,p_signature text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE c public.vice_exec_challenges;k jsonb;r jsonb;
BEGIN
 PERFORM pg_advisory_xact_lock(818104020);
 SELECT * INTO c FROM public.vice_exec_challenges WHERE id=p_challenge AND user_id=p_actor FOR UPDATE;
 IF NOT FOUND OR c.authorization_method<>'DEVICE_KEY' OR c.action NOT IN ('ENROLL','APPROVE','HALT') THEN RAISE EXCEPTION 'Device-key challenge required';END IF;
 SELECT public_key INTO k FROM public.vice_exec_signers WHERE user_id=p_actor AND role=c.role;
 IF c.expected_key_fingerprint IS NOT NULL AND c.expected_key_fingerprint IS DISTINCT FROM encode(extensions.digest(convert_to(k::text,'UTF8'),'sha256'),'hex') THEN RAISE EXCEPTION 'Signing key changed; start a new challenge';END IF;
 IF c.action='APPROVE' THEN
  IF coalesce(c.context_hash,split_part(c.message,'|',6)) IS DISTINCT FROM (SELECT payload_hash FROM public.vice_sovereign_proposals WHERE id=c.proposal_id AND status='REVIEW' AND validation_issues='[]') THEN RAISE EXCEPTION 'Proposal changed or blocked';END IF;
  IF vice_private.exec_has_approval(c.proposal_id,c.role) THEN RAISE EXCEPTION 'Executive approval already recorded';END IF;
 END IF;
 r:=vice_private.exec_finish_device_v1(p_challenge,p_actor,p_signature);
 UPDATE public.vice_exec_attestations SET public_key_snapshot=k,policy_version=c.policy_version WHERE challenge_id=p_challenge AND public_key_snapshot IS NULL;
 RETURN r||jsonb_build_object('authorization_method','DEVICE_KEY','authorization_id',c.id);
END $$;
REVOKE ALL ON FUNCTION public.vice_exec_finish(uuid,uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.vice_exec_finish(uuid,uuid,text) TO service_role;

CREATE OR REPLACE FUNCTION public.vice_exec_auth_begin(p_action text,p_proposal text DEFAULT NULL,p_recovery uuid DEFAULT NULL,p_client_build text DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE v_role text;v_session uuid;v_id uuid:=gen_random_uuid();v_hash text;p public.vice_sovereign_proposals;r public.vice_exec_recovery_requests;
BEGIN
 PERFORM vice_private.require_active_account();
 SELECT role INTO v_role FROM public.vice_exec_signers WHERE user_id=auth.uid();PERFORM vice_private.exec_assert_role(auth.uid(),v_role);
 v_session:=nullif(auth.jwt()->>'session_id','')::uuid;
 IF v_session IS NULL OR NOT EXISTS(SELECT 1 FROM auth.sessions WHERE id=v_session AND user_id=auth.uid()) THEN RAISE EXCEPTION 'Active account session required';END IF;
 IF (SELECT count(*) FROM public.vice_exec_challenges WHERE user_id=auth.uid() AND created_at>now()-interval '1 minute')>=10 THEN RAISE EXCEPTION 'Approval rate limit; wait one minute';END IF;
 IF p_action='APPROVE' AND p_proposal IS NOT NULL AND p_recovery IS NULL THEN
  SELECT * INTO p FROM public.vice_sovereign_proposals WHERE id=p_proposal AND status='REVIEW' AND validation_issues='[]'::jsonb;
  IF NOT FOUND THEN RAISE EXCEPTION 'Proposal missing or blocked';END IF;
  IF vice_private.exec_has_approval(p.id,v_role) THEN RAISE EXCEPTION 'Your executive approval is already recorded';END IF;
  v_hash:=p.payload_hash;
 ELSIF p_action='REJECT' AND p_proposal IS NOT NULL AND p_recovery IS NULL THEN
  SELECT payload_hash INTO v_hash FROM public.vice_sovereign_proposals WHERE id=p_proposal AND status='REVIEW';
  IF v_hash IS NULL THEN RAISE EXCEPTION 'Proposal is not open for rejection';END IF;
 ELSIF p_action='HALT' AND p_proposal IS NULL AND p_recovery IS NULL THEN v_hash:='HALT_STRUCTURAL_TRANSITIONS';
 ELSIF p_action IN ('RECOVERY_APPROVE','RECOVERY_REQUEST','RECOVERY_ACTIVATE') AND p_recovery IS NOT NULL AND p_proposal IS NULL THEN
  SELECT * INTO r FROM public.vice_exec_recovery_requests WHERE id=p_recovery AND expires_at>now();
  IF NOT FOUND OR r.replacement_public_key IS NULL THEN RAISE EXCEPTION 'Bound recovery request required';END IF;
  IF p_action='RECOVERY_APPROVE' AND (r.status NOT IN ('PENDING_CFO','PENDING_CEO') OR r.initiation_proof IS NULL OR r.ceo_user_id=auth.uid() OR v_role=r.requester_role) THEN RAISE EXCEPTION 'Independent executive approval requires requester 2FA and a bound replacement key';END IF;
  IF p_action='RECOVERY_REQUEST' AND (r.ceo_user_id<>auth.uid() OR r.requester_role<>v_role OR r.status NOT IN ('INITIATED','PENDING_CFO','PENDING_CEO') OR r.initiation_proof IS NOT NULL) THEN RAISE EXCEPTION 'Unverified own recovery request required';END IF;
  IF p_action='RECOVERY_ACTIVATE' AND (r.ceo_user_id<>auth.uid() OR r.requester_role<>v_role OR r.status<>'APPROVED' OR r.approved_at+interval '60 seconds'>now()) THEN RAISE EXCEPTION 'Own approved recovery and elapsed cooldown required';END IF;
  v_hash:=vice_private.exec_recovery_hash(r);
 ELSE RAISE EXCEPTION 'Unsupported 2FA action';END IF;
 INSERT INTO public.vice_exec_challenges(id,user_id,role,action,proposal_id,message,authorization_method,expires_at)
 VALUES(v_id,auth.uid(),v_role,p_action,p_proposal,'VICE4X-MFA-v1|'||p_action||'|'||v_role||'|'||auth.uid()::text||'|'||coalesce(p_proposal,p_recovery::text,'')||'|'||v_hash||'|'||v_id::text,'TOTP',now()+interval '5 minutes');
 UPDATE public.vice_exec_challenges SET context_hash=v_hash,client_build=left(p_client_build,100),policy_version='VICE-EXEC-AUTH-2',message=message||'|'||now()::text||'|'||(now()+interval '5 minutes')::text||'|VICE-EXEC-AUTH-2' WHERE id=v_id;
 INSERT INTO vice_private.exec_mfa_proofs(challenge_id,user_id,session_id,payload_hash,recovery_id) VALUES(v_id,auth.uid(),v_session,v_hash,p_recovery);
 RETURN jsonb_build_object('id',v_id,'action',p_action,'role',v_role,'payload_hash',v_hash,'proposal_id',p_proposal,'recovery_id',p_recovery,'expires_at',now()+interval '5 minutes');
END $$;

CREATE OR REPLACE FUNCTION public.vice_exec_auth_bind(p_challenge uuid,p_auth_challenge uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE c public.vice_exec_challenges;p vice_private.exec_mfa_proofs;f uuid;
BEGIN
 PERFORM vice_private.require_active_account();
 SELECT * INTO c FROM public.vice_exec_challenges WHERE id=p_challenge AND user_id=auth.uid() AND authorization_method='TOTP' AND used_at IS NULL AND expires_at>now() FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION '2FA approval challenge expired or unavailable';END IF;
 PERFORM vice_private.exec_assert_role(auth.uid(),c.role);
 SELECT * INTO p FROM vice_private.exec_mfa_proofs WHERE challenge_id=c.id FOR UPDATE;
 IF p.session_id IS DISTINCT FROM nullif(auth.jwt()->>'session_id','')::uuid THEN RAISE EXCEPTION 'Approval belongs to another session';END IF;
 IF p.auth_challenge_id IS NOT NULL THEN
  IF p.auth_challenge_id=p_auth_challenge THEN RETURN jsonb_build_object('bound',true);END IF;
  RAISE EXCEPTION 'Approval is already bound to a different authenticator challenge';
 END IF;
 SELECT a.factor_id INTO f FROM auth.mfa_challenges a JOIN auth.mfa_factors mf ON mf.id=a.factor_id WHERE a.id=p_auth_challenge AND mf.user_id=auth.uid() AND mf.factor_type::text='totp' AND mf.status::text='verified' AND a.verified_at IS NULL AND a.created_at>=c.created_at;
 IF f IS NULL THEN RAISE EXCEPTION 'Fresh unverified challenge for your enrolled authenticator required';END IF;
 UPDATE vice_private.exec_mfa_proofs SET auth_challenge_id=p_auth_challenge,factor_id=f WHERE challenge_id=c.id;
 RETURN jsonb_build_object('bound',true);
END $$;

CREATE OR REPLACE FUNCTION public.vice_exec_auth_finish(p_challenge uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE c public.vice_exec_challenges;proof vice_private.exec_mfa_proofs;p public.vice_sovereign_proposals;r public.vice_exec_recovery_requests;verified timestamptz;
BEGIN
 PERFORM pg_advisory_xact_lock(818104020);PERFORM vice_private.require_active_account();
 SELECT * INTO c FROM public.vice_exec_challenges WHERE id=p_challenge AND user_id=auth.uid() AND authorization_method='TOTP' AND used_at IS NULL AND expires_at>now() FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION '2FA approval expired, unavailable or already used';END IF;
 PERFORM vice_private.exec_assert_role(auth.uid(),c.role);
 SELECT * INTO proof FROM vice_private.exec_mfa_proofs WHERE challenge_id=c.id FOR UPDATE;
 IF auth.jwt()->>'aal' IS DISTINCT FROM 'aal2' OR proof.session_id IS DISTINCT FROM nullif(auth.jwt()->>'session_id','')::uuid THEN RAISE EXCEPTION 'Verify 2FA in the same signed-in session';END IF;
 SELECT a.verified_at INTO verified FROM auth.mfa_challenges a JOIN auth.mfa_factors f ON f.id=a.factor_id JOIN auth.sessions s ON s.id=proof.session_id AND s.user_id=f.user_id WHERE a.id=proof.auth_challenge_id AND a.factor_id=proof.factor_id AND f.user_id=auth.uid() AND f.factor_type::text='totp' AND f.status::text='verified' AND a.created_at>=c.created_at AND a.verified_at>=c.created_at AND a.verified_at>now()-interval '5 minutes' AND s.aal::text='aal2' AND s.factor_id=f.id;
 IF verified IS NULL THEN RAISE EXCEPTION 'Server-verified fresh authenticator proof required';END IF;
 IF c.action='APPROVE' THEN
  SELECT * INTO p FROM public.vice_sovereign_proposals WHERE id=c.proposal_id AND status='REVIEW' AND validation_issues='[]'::jsonb FOR UPDATE;
  IF NOT FOUND OR p.payload_hash IS DISTINCT FROM proof.payload_hash THEN RAISE EXCEPTION 'Proposal changed or blocked; review it again';END IF;
  IF vice_private.exec_has_approval(p.id,c.role) THEN RAISE EXCEPTION 'Executive approval already recorded';END IF;
  INSERT INTO public.vice_exec_attestations(proposal_id,role,signer_id,signature,challenge_id,payload_hash,authorization_method,policy_version) VALUES(p.id,c.role,auth.uid(),NULL,c.id,proof.payload_hash,'TOTP','VICE-EXEC-AUTH-2');
 ELSIF c.action='REJECT' THEN
  SELECT * INTO p FROM public.vice_sovereign_proposals WHERE id=c.proposal_id AND status='REVIEW' FOR UPDATE;
  IF NOT FOUND OR p.payload_hash IS DISTINCT FROM proof.payload_hash THEN RAISE EXCEPTION 'Proposal changed or no longer open';END IF;
  UPDATE public.vice_sovereign_proposals SET status='REJECTED' WHERE id=p.id;
 ELSIF c.action='HALT' THEN
  UPDATE public.vice_sovereign_control SET locked=true,reason='Executive 2FA halt: '||c.role,changed_at=now() WHERE id;
 ELSIF c.action IN ('RECOVERY_APPROVE','RECOVERY_REQUEST','RECOVERY_ACTIVATE') THEN
  SELECT * INTO r FROM public.vice_exec_recovery_requests WHERE id=proof.recovery_id AND expires_at>now() FOR UPDATE;
  IF NOT FOUND OR vice_private.exec_recovery_hash(r) IS DISTINCT FROM proof.payload_hash THEN RAISE EXCEPTION 'Recovery changed or expired';END IF;
  IF c.action='RECOVERY_APPROVE' THEN
   IF r.ceo_user_id=auth.uid() OR r.requester_role=c.role OR r.initiation_proof IS NULL OR r.status NOT IN ('PENDING_CFO','PENDING_CEO') THEN RAISE EXCEPTION 'Independent approval unavailable';END IF;
   UPDATE public.vice_exec_recovery_requests SET status='APPROVED',approved_at=now(),approval_challenge=c.id,approval_signature=NULL,approval_method='TOTP' WHERE id=r.id;
  ELSIF c.action='RECOVERY_REQUEST' THEN
   IF r.ceo_user_id<>auth.uid() OR r.requester_role<>c.role OR r.initiation_proof IS NOT NULL OR r.status NOT IN ('INITIATED','PENDING_CFO','PENDING_CEO') THEN RAISE EXCEPTION 'Own unverified request required';END IF;
   UPDATE public.vice_exec_recovery_requests SET initiation_proof=c.id,status=CASE r.requester_role WHEN 'CEO' THEN 'PENDING_CFO' ELSE 'PENDING_CEO' END WHERE id=r.id;
  ELSE
   IF r.ceo_user_id<>auth.uid() OR r.requester_role<>c.role OR r.status<>'APPROVED' OR r.approved_at+interval '60 seconds'>now() THEN RAISE EXCEPTION 'Own approved request and elapsed cooldown required';END IF;
   UPDATE public.vice_exec_recovery_requests SET activation_proof=c.id WHERE id=r.id;
  END IF;
 ELSE RAISE EXCEPTION 'Unsupported 2FA approval';END IF;
 UPDATE public.vice_exec_challenges SET used_at=now() WHERE id=c.id;
 UPDATE vice_private.exec_mfa_proofs SET verified_at=verified WHERE challenge_id=c.id;
 PERFORM vice_private.exec_log('EXECUTIVE_2FA_'||c.action,coalesce(c.proposal_id,proof.recovery_id::text,c.role),jsonb_build_object('executive',auth.uid(),'role',c.role,'authorization_id',c.id,'method','TOTP','payload_hash',proof.payload_hash,'verified_at',verified,'policy_version','VICE-EXEC-AUTH-2','factor_reference',proof.factor_id,'client_build',c.client_build,'result','VERIFIED'));
 RETURN jsonb_build_object('verified',true,'action',c.action,'role',c.role,'authorization_method','TOTP','authorization_id',c.id,'payload_hash',proof.payload_hash,'execution_enabled',false,'ready_at',CASE WHEN c.action='RECOVERY_APPROVE' THEN now()+interval '60 seconds' END);
END $$;

DO $$ DECLARE f record;BEGIN
 FOR f IN SELECT oid::regprocedure sig FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname IN ('vice_exec_challenge','vice_exec_auth_begin','vice_exec_auth_bind','vice_exec_auth_finish') LOOP EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon',f.sig);EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated',f.sig);END LOOP;
END $$;

-- Both roles use the same recovery state machine. The other executive must approve.
CREATE OR REPLACE FUNCTION public.vice_exec_request_recovery() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE v_id uuid;v_role text;
BEGIN
 PERFORM vice_private.require_active_account();SELECT role INTO v_role FROM public.vice_exec_signers WHERE user_id=auth.uid();PERFORM vice_private.exec_assert_role(auth.uid(),v_role);PERFORM pg_advisory_xact_lock(818104020);
 SELECT id INTO v_id FROM public.vice_exec_recovery_requests WHERE ceo_user_id=auth.uid() AND status IN ('INITIATED','PENDING_CFO','PENDING_CEO','APPROVED') AND expires_at>now() ORDER BY requested_at DESC LIMIT 1;
 IF v_id IS NULL THEN INSERT INTO public.vice_exec_recovery_requests(ceo_user_id,requester_role,status) VALUES(auth.uid(),v_role,'INITIATED') RETURNING id INTO v_id;PERFORM vice_private.exec_log('RECOVERY_INITIATED',v_id::text,jsonb_build_object('role',v_role));END IF;
 RETURN jsonb_build_object('id',v_id,'notice','Bind the replacement key and verify 2FA, obtain the other executive approval, then activate after 60 seconds with fresh 2FA and the replacement key.');
END $$;
CREATE OR REPLACE FUNCTION public.vice_exec_recovery_bind(p_request uuid,p_key jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE r public.vice_exec_recovery_requests;fp text;
BEGIN
 PERFORM vice_private.require_active_account();
 IF p_key->>'kty' IS DISTINCT FROM 'EC' OR p_key->>'crv' IS DISTINCT FROM 'P-256' OR p_key ? 'd' OR coalesce(p_key->>'x','') !~ '^[A-Za-z0-9_-]{43}$' OR coalesce(p_key->>'y','') !~ '^[A-Za-z0-9_-]{43}$' THEN RAISE EXCEPTION 'Invalid replacement public key';END IF;
 SELECT * INTO r FROM public.vice_exec_recovery_requests WHERE id=p_request AND ceo_user_id=auth.uid() AND status IN ('INITIATED','PENDING_CFO','PENDING_CEO') AND expires_at>now() FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Own pending request not found';END IF;
 PERFORM vice_private.exec_assert_role(auth.uid(),r.requester_role);
 -- Store canonical public coordinates only. Legacy full JWKs remain intact when equal.
 p_key:=jsonb_build_object('kty',p_key->>'kty','crv',p_key->>'crv','x',p_key->>'x','y',p_key->>'y');
 IF r.replacement_public_key IS NOT NULL THEN
  IF (r.replacement_public_key->>'x') IS DISTINCT FROM (p_key->>'x') OR (r.replacement_public_key->>'y') IS DISTINCT FROM (p_key->>'y') THEN RAISE EXCEPTION 'Recovery key already bound; use the request device or cancel and restart';END IF;
  RETURN jsonb_build_object('id',r.id,'fingerprint',r.replacement_key_fingerprint,'status',r.status);
 END IF;
 IF r.initiation_proof IS NOT NULL THEN RAISE EXCEPTION 'MFA-bound recovery cannot be changed';END IF;
 IF EXISTS(SELECT 1 FROM public.vice_exec_signers WHERE user_id=auth.uid() AND public_key->>'x'=p_key->>'x' AND public_key->>'y'=p_key->>'y') THEN RAISE EXCEPTION 'Replacement must be a new key';END IF;
 fp:=encode(extensions.digest(convert_to(p_key::text,'UTF8'),'sha256'),'hex');
 UPDATE public.vice_exec_recovery_requests SET replacement_public_key=p_key,replacement_key_fingerprint=fp WHERE id=r.id;
 PERFORM vice_private.exec_log('RECOVERY_BOUND',r.id::text,jsonb_build_object('fingerprint',fp,'role',r.requester_role));
 RETURN jsonb_build_object('id',r.id,'fingerprint',fp,'status',r.status);
END $$;
CREATE OR REPLACE FUNCTION public.vice_exec_recovery_pending() RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',r.id,'requester_role',r.requester_role,'is_requester',r.ceo_user_id=auth.uid(),'status',CASE WHEN r.expires_at<=now() AND r.status NOT IN ('COMPLETED','CANCELLED','REJECTED') THEN 'EXPIRED' ELSE r.status END,'request_mfa_verified',r.initiation_proof IS NOT NULL,'requested_at',r.requested_at,'expires_at',r.expires_at,'approved_at',r.approved_at,'approval_method',r.approval_method,'ready_at',r.approved_at+interval '60 seconds','replacement_public_key',r.replacement_public_key,'replacement_key_fingerprint',r.replacement_key_fingerprint) ORDER BY r.requested_at DESC),'[]'::jsonb) FROM (SELECT * FROM public.vice_exec_recovery_requests ORDER BY requested_at DESC LIMIT 50) r WHERE public.vice_institutional_access();
$$;
CREATE OR REPLACE FUNCTION public.vice_exec_recovery_close(p_request uuid,p_decision text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE r public.vice_exec_recovery_requests;v_role text;
BEGIN
 PERFORM vice_private.require_active_account();SELECT role INTO v_role FROM public.vice_exec_signers WHERE user_id=auth.uid();PERFORM vice_private.exec_assert_role(auth.uid(),v_role);PERFORM pg_advisory_xact_lock(818104020);
 SELECT * INTO r FROM public.vice_exec_recovery_requests WHERE id=p_request AND status IN ('INITIATED','PENDING_CFO','PENDING_CEO','APPROVED') FOR UPDATE;
 IF NOT FOUND OR (p_decision='CANCELLED' AND r.ceo_user_id<>auth.uid()) OR (p_decision='REJECTED' AND r.ceo_user_id=auth.uid()) OR p_decision NOT IN ('CANCELLED','REJECTED') THEN RAISE EXCEPTION 'Recovery closure unavailable';END IF;
 UPDATE public.vice_exec_recovery_requests SET status=p_decision WHERE id=r.id;
 PERFORM vice_private.exec_log('RECOVERY_'||p_decision,r.id::text,jsonb_build_object('role',v_role));
 RETURN jsonb_build_object('id',r.id,'status',p_decision);
END $$;
CREATE OR REPLACE FUNCTION public.vice_exec_recovery_challenge(p_request uuid,p_action text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE r public.vice_exec_recovery_requests;v_id uuid:=gen_random_uuid();msg text;v_role text;v_key jsonb;
BEGIN
 PERFORM vice_private.require_active_account();SELECT role,public_key INTO v_role,v_key FROM public.vice_exec_signers WHERE user_id=auth.uid();PERFORM vice_private.exec_assert_role(auth.uid(),v_role);
 SELECT * INTO r FROM public.vice_exec_recovery_requests WHERE id=p_request AND expires_at>now() FOR UPDATE;
 IF NOT FOUND OR r.replacement_public_key IS NULL OR r.initiation_proof IS NULL THEN RAISE EXCEPTION 'Requester must bind replacement and verify 2FA first';END IF;
 IF p_action='RECOVERY_APPROVE' THEN
  IF v_role=r.requester_role OR r.ceo_user_id=auth.uid() OR v_key IS NULL OR r.status NOT IN ('PENDING_CFO','PENDING_CEO') THEN RAISE EXCEPTION 'Independent executive key required; Authorize with 2FA is also available';END IF;
 ELSIF p_action='RECOVERY_ACTIVATE' THEN
  IF v_role<>r.requester_role OR r.ceo_user_id<>auth.uid() OR r.status<>'APPROVED' OR r.approved_at+interval '60 seconds'>now() THEN RAISE EXCEPTION 'Own activation unavailable or cooldown active';END IF;
  IF NOT EXISTS(SELECT 1 FROM vice_private.exec_mfa_proofs m JOIN public.vice_exec_challenges c ON c.id=m.challenge_id WHERE m.challenge_id=r.activation_proof AND m.user_id=auth.uid() AND m.session_id=nullif(auth.jwt()->>'session_id','')::uuid AND m.verified_at>now()-interval '5 minutes' AND m.payload_hash=vice_private.exec_recovery_hash(r) AND c.used_at IS NOT NULL AND c.action='RECOVERY_ACTIVATE') THEN RAISE EXCEPTION 'Fresh activation 2FA required in this session';END IF;
 ELSE RAISE EXCEPTION 'Invalid recovery action';END IF;
 IF (SELECT count(*) FROM public.vice_exec_challenges WHERE user_id=auth.uid() AND created_at>now()-interval '1 minute')>=10 THEN RAISE EXCEPTION 'Challenge rate limit';END IF;
 msg:='VICE4X-RECOVERY-v2|'||p_action||'|'||r.id::text||'|'||r.ceo_user_id::text||'|'||r.replacement_key_fingerprint||'|'||v_id::text||'|'||v_role||'|'||auth.uid()::text||'|'||now()::text||'|'||(now()+interval '5 minutes')::text;
 INSERT INTO public.vice_exec_challenges(id,user_id,role,action,public_key,message,expected_key_fingerprint,context_hash,policy_version,expires_at) VALUES(v_id,auth.uid(),v_role,p_action,CASE WHEN p_action='RECOVERY_ACTIVATE' THEN r.replacement_public_key ELSE NULL END,msg,CASE WHEN p_action='RECOVERY_APPROVE' THEN encode(extensions.digest(convert_to(v_key::text,'UTF8'),'sha256'),'hex') END,vice_private.exec_recovery_hash(r),'VICE-EXEC-AUTH-2',now()+interval '5 minutes');
 IF p_action='RECOVERY_ACTIVATE' THEN UPDATE public.vice_exec_recovery_requests SET activation_challenge=v_id WHERE id=r.id;END IF;
 RETURN jsonb_build_object('id',v_id,'message',msg,'expires_at',now()+interval '5 minutes','fingerprint',r.replacement_key_fingerprint);
END $$;
CREATE OR REPLACE FUNCTION public.vice_exec_recovery_finish(p_challenge uuid,p_actor uuid,p_signature text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE c public.vice_exec_challenges;r public.vice_exec_recovery_requests;old_key jsonb;opposite_role text;
BEGIN
 PERFORM pg_advisory_xact_lock(818104020);PERFORM set_config('request.jwt.claim.sub',p_actor::text,true);PERFORM vice_private.require_active_account();
 SELECT * INTO c FROM public.vice_exec_challenges WHERE id=p_challenge AND user_id=p_actor AND authorization_method='DEVICE_KEY' AND used_at IS NULL AND expires_at>now() AND action IN ('RECOVERY_APPROVE','RECOVERY_ACTIVATE') FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Recovery device-key challenge unavailable';END IF;
 PERFORM vice_private.exec_assert_role(p_actor,c.role);
 SELECT * INTO r FROM public.vice_exec_recovery_requests WHERE id::text=split_part(c.message,'|',3) FOR UPDATE;
 IF NOT FOUND OR r.expires_at<=now() OR r.initiation_proof IS NULL OR c.context_hash IS DISTINCT FROM vice_private.exec_recovery_hash(r) THEN RAISE EXCEPTION 'Recovery expired or changed; refresh and verify 2FA';END IF;
 opposite_role:=CASE r.requester_role WHEN 'CEO' THEN 'CFO' ELSE 'CEO' END;
 SELECT public_key INTO old_key FROM public.vice_exec_signers WHERE user_id=p_actor AND role=c.role;
 IF c.action='RECOVERY_APPROVE' THEN
  IF c.role<>opposite_role OR r.ceo_user_id=p_actor OR r.status NOT IN ('PENDING_CFO','PENDING_CEO') OR old_key IS NULL OR c.expected_key_fingerprint IS DISTINCT FROM encode(extensions.digest(convert_to(old_key::text,'UTF8'),'sha256'),'hex') THEN RAISE EXCEPTION 'Independent authorization denied';END IF;
  UPDATE public.vice_exec_recovery_requests SET status='APPROVED',approved_at=now(),approval_challenge=c.id,approval_signature=p_signature,approval_method='DEVICE_KEY' WHERE id=r.id;
 ELSE
  IF c.role<>r.requester_role OR r.ceo_user_id<>p_actor OR r.status<>'APPROVED' OR r.approved_at+interval '60 seconds'>now() OR r.activation_challenge IS DISTINCT FROM c.id OR c.public_key IS DISTINCT FROM r.replacement_public_key THEN RAISE EXCEPTION 'Activation denied';END IF;
  IF NOT EXISTS(SELECT 1 FROM vice_private.exec_mfa_proofs m JOIN public.vice_exec_challenges ch ON ch.id=m.challenge_id JOIN auth.mfa_factors f ON f.id=m.factor_id WHERE m.challenge_id=r.activation_proof AND m.user_id=p_actor AND m.verified_at>now()-interval '5 minutes' AND ch.action='RECOVERY_ACTIVATE' AND ch.used_at IS NOT NULL AND f.user_id=p_actor AND f.status::text='verified') THEN RAISE EXCEPTION 'Fresh activation authenticator proof required';END IF;
  PERFORM vice_private.exec_assert_role((SELECT user_id FROM public.vice_exec_challenges WHERE id=r.approval_challenge),opposite_role);
  IF old_key IS NOT NULL THEN
   INSERT INTO vice_private.exec_key_history(user_id,role,public_key,fingerprint,recovery_id) VALUES(p_actor,c.role,old_key,encode(extensions.digest(convert_to(old_key::text,'UTF8'),'sha256'),'hex'),r.id) ON CONFLICT(recovery_id) DO NOTHING;
   UPDATE public.vice_exec_attestations SET public_key_snapshot=old_key WHERE signer_id=p_actor AND public_key_snapshot IS NULL AND authorization_method='DEVICE_KEY' AND verified_at>=(SELECT enrolled_at FROM public.vice_exec_signers WHERE user_id=p_actor);
  END IF;
  UPDATE public.vice_exec_signers SET public_key=r.replacement_public_key,enrolled_at=now() WHERE role=r.requester_role AND user_id=p_actor;
  UPDATE public.vice_exec_recovery_requests SET status='COMPLETED',activated_at=now() WHERE id=r.id;
  UPDATE public.vice_exec_challenges SET expires_at=now() WHERE user_id=p_actor AND used_at IS NULL AND id<>c.id;
 END IF;
 UPDATE public.vice_exec_challenges SET used_at=now() WHERE id=c.id;
 PERFORM vice_private.exec_log(c.action,r.id::text,jsonb_build_object('role',c.role,'challenge',c.id,'method','DEVICE_KEY','fingerprint',r.replacement_key_fingerprint,'policy_version','VICE-EXEC-AUTH-2','replaced_public_key',CASE WHEN c.action='RECOVERY_ACTIVATE' THEN old_key END));
 RETURN jsonb_build_object('verified',true,'action',c.action,'request_id',r.id,'status',CASE WHEN c.action='RECOVERY_APPROVE' THEN 'APPROVED' ELSE 'COMPLETED' END,'ready_at',CASE WHEN c.action='RECOVERY_APPROVE' THEN now() ELSE r.approved_at END+interval '60 seconds');
END $$;
REVOKE ALL ON FUNCTION public.vice_exec_recovery_finish(uuid,uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.vice_exec_recovery_finish(uuid,uuid,text) TO service_role;
DO $$ DECLARE f record;BEGIN
 FOR f IN SELECT oid::regprocedure sig FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname IN ('vice_exec_request_recovery','vice_exec_recovery_bind','vice_exec_recovery_pending','vice_exec_recovery_challenge','vice_exec_recovery_close') LOOP EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon',f.sig);EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated',f.sig);END LOOP;
END $$;

-- Exportable receipts include nonsecret proof references and the existing audit hash chain.
CREATE OR REPLACE FUNCTION public.vice_exec_receipts(p_proposal text DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 IF NOT public.vice_institutional_access() THEN RAISE EXCEPTION 'Executive access required';END IF;
 RETURN jsonb_build_object('policy',(SELECT to_jsonb(p) FROM public.vice_exec_authorization_policy p WHERE version='VICE-EXEC-AUTH-2'),
 'authorizations',(SELECT coalesce(jsonb_agg(to_jsonb(a)||jsonb_build_object('challenge_message',c.message,'policy_version',a.policy_version,'client_build',c.client_build) ORDER BY a.verified_at),'[]') FROM public.vice_exec_attestations a JOIN public.vice_exec_challenges c ON c.id=a.challenge_id WHERE p_proposal IS NULL OR a.proposal_id=p_proposal),
 'legacy_mfa_authorizations',(SELECT coalesce(jsonb_agg(to_jsonb(a) ORDER BY verified_at),'[]') FROM public.vice_exec_mfa_authorizations a WHERE p_proposal IS NULL OR a.proposal_id=p_proposal),
 'key_history',(SELECT coalesce(jsonb_agg(to_jsonb(k) ORDER BY revoked_at),'[]') FROM vice_private.exec_key_history k),
 'audit',(SELECT coalesce(jsonb_agg(to_jsonb(e) ORDER BY seq),'[]') FROM public.vice_exec_audit e WHERE event LIKE 'SIGNATURE_%' OR event LIKE 'EXECUTIVE_2FA_%' OR event LIKE 'RECOVERY_%' OR event LIKE 'MFA_%'));
END $$;
REVOKE ALL ON FUNCTION public.vice_exec_receipts(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.vice_exec_receipts(text) TO authenticated;


-- Public feed counts one authorization per role across both receipt generations.
CREATE OR REPLACE FUNCTION public.vice_sovereign_feed() RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 WITH approvals AS (
 SELECT DISTINCT ON (proposal_id,role,payload_hash) * FROM (
 SELECT proposal_id,role,payload_hash,authorization_method method,verified_at FROM public.vice_exec_attestations
 UNION ALL SELECT proposal_id,role,payload_hash,'TOTP'::text,verified_at FROM public.vice_exec_mfa_authorizations WHERE action='APPROVE'
 ) a ORDER BY proposal_id,role,payload_hash,verified_at
 )
 SELECT coalesce(jsonb_agg(x ORDER BY x.published_at DESC),'[]'::jsonb) FROM (
 SELECT p.id,jsonb_build_object('previous_baseline',p.payload#>'{parameters,previous_baseline}','target_scaled_tier',p.payload#>'{parameters,target_scaled_tier}','structural_ratio',160) parameters,p.payload_hash,p.validation_issues,p.status,p.published_at,p.validation_until,p.quorum_verified_at,p.execute_after,
 (SELECT count(DISTINCT a.role) FROM approvals a WHERE a.proposal_id=p.id AND a.payload_hash=p.payload_hash AND a.method='DEVICE_KEY') verified_executive_signatures,
 (SELECT count(DISTINCT a.role) FROM approvals a WHERE a.proposal_id=p.id AND a.payload_hash=p.payload_hash) verified_executive_authorizations,
 EXISTS(SELECT 1 FROM approvals a WHERE a.proposal_id=p.id AND a.role='CEO' AND a.payload_hash=p.payload_hash) ceo_signed,
 EXISTS(SELECT 1 FROM approvals a WHERE a.proposal_id=p.id AND a.role='CFO' AND a.payload_hash=p.payload_hash) cfo_signed,
 (SELECT CASE a.method WHEN 'TOTP' THEN 'MFA_TOTP' ELSE 'CRYPTOGRAPHIC' END FROM approvals a WHERE a.proposal_id=p.id AND a.role='CEO' AND a.payload_hash=p.payload_hash LIMIT 1) ceo_authorization_method,
 (SELECT CASE a.method WHEN 'TOTP' THEN 'MFA_TOTP' ELSE 'CRYPTOGRAPHIC' END FROM approvals a WHERE a.proposal_id=p.id AND a.role='CFO' AND a.payload_hash=p.payload_hash LIMIT 1) cfo_authorization_method,
 coalesce((SELECT jsonb_agg(jsonb_build_object('role',a.role,'method',a.method,'verified_at',a.verified_at) ORDER BY a.role) FROM approvals a WHERE a.proposal_id=p.id AND a.payload_hash=p.payload_hash),'[]') approval_methods
 FROM public.vice_sovereign_proposals p ORDER BY p.published_at DESC LIMIT 100)x;
$$;
REVOKE ALL ON FUNCTION public.vice_sovereign_feed() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.vice_sovereign_feed() TO anon,authenticated;
-- Keep the existing readiness logic, but label authenticator approvals accurately.
DO $$ DECLARE f text;BEGIN
 IF to_regprocedure('public.vice_ouv_activation_readiness(text)') IS NOT NULL THEN
  SELECT pg_get_functiondef('public.vice_ouv_activation_readiness(text)'::regprocedure) INTO f;
  f:=replace(f,'WHERE a.proposal_id=p.id AND a.payload_hash=p.payload_hash'||chr(10)||'      AND a.role IN', 'WHERE a.proposal_id=p.id AND a.payload_hash=p.payload_hash AND a.authorization_method=''DEVICE_KEY'''||chr(10)||'      AND a.role IN');
  EXECUTE f;
 END IF;
END $$;

CREATE OR REPLACE FUNCTION public.vice_sovereign_check(p_id text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
DECLARE p public.vice_sovereign_proposals;blocked jsonb:='[]'; signatures integer;authorizations integer;
BEGIN
 IF NOT public.vice_institutional_access() THEN RAISE EXCEPTION 'Executive access required' USING ERRCODE='42501';END IF;
 SELECT * INTO p FROM public.vice_sovereign_proposals WHERE id=p_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Proposal not found';END IF;
 SELECT count(DISTINCT a.role) INTO signatures FROM public.vice_exec_attestations a
 WHERE a.proposal_id=p_id AND a.payload_hash=p.payload_hash AND a.authorization_method='DEVICE_KEY';
 SELECT count(*) INTO authorizations FROM (
   SELECT a.role FROM public.vice_exec_attestations a WHERE a.proposal_id=p_id AND a.payload_hash=p.payload_hash
   UNION SELECT a.role FROM public.vice_exec_mfa_authorizations a
    WHERE a.proposal_id=p_id AND a.payload_hash=p.payload_hash AND a.action='APPROVE'
 ) v;
 blocked:=p.validation_issues;
 IF now()<p.validation_until THEN blocked:=blocked||'["PUBLIC_REVIEW_WINDOW_OPEN"]'::jsonb;END IF;
 IF authorizations<>2 THEN blocked:=blocked||'["CEO_AND_CFO_AUTHORIZATIONS_REQUIRED"]'::jsonb;END IF;
 IF p.quorum_verified_at IS NULL THEN blocked:=blocked||'["ONCHAIN_QUORUM_NOT_VERIFIED"]'::jsonb;END IF;
 IF p.execute_after IS NULL OR now()<p.execute_after THEN blocked:=blocked||'["72_HOUR_TIMELOCK_NOT_EXPIRED"]'::jsonb;END IF;
 blocked:=blocked||'["STRUCTURAL_EXECUTOR_LOCKED"]'::jsonb;
 PERFORM vice_private.exec_log('STRUCTURAL_COMMIT_BLOCKED',p_id,jsonb_build_object('reasons',blocked));
 RETURN jsonb_build_object('execution_enabled',false,'verified_signatures',signatures,
 'verified_executive_authorizations',authorizations,'reasons',blocked,
 'units_changed',false,'prices_changed',false);
END $function$
;
