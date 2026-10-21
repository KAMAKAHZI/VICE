-- Read-only schema snapshot before VICE-EXEC-AUTH-2. Reference only; not an automatic rollback.
CREATE OR REPLACE FUNCTION public.vice_exec_finish(p_challenge uuid, p_actor uuid, p_signature text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
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
END $function$
;

CREATE OR REPLACE FUNCTION public.vice_exec_challenge(p_action text, p_proposal text DEFAULT NULL::text, p_public_key jsonb DEFAULT NULL::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
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
END $function$
;

CREATE OR REPLACE FUNCTION public.vice_sovereign_feed()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
 SELECT coalesce(jsonb_agg(x ORDER BY x.published_at DESC),'[]'::jsonb) FROM (
 SELECT p.id,
 jsonb_build_object(
 'previous_baseline',jsonb_build_object('vice_ouv',(p.payload#>>'{parameters,previous_baseline,vice_ouv}')::numeric,'v4x_ouv',(p.payload#>>'{parameters,previous_baseline,v4x_ouv}')::numeric),
 'target_scaled_tier',jsonb_build_object('vice_ouv',(p.payload#>>'{parameters,target_scaled_tier,vice_ouv}')::numeric,'v4x_ouv',(p.payload#>>'{parameters,target_scaled_tier,v4x_ouv}')::numeric),
 'structural_ratio',160) AS parameters,
 p.payload_hash,p.validation_issues,p.status,p.published_at,p.validation_until,p.quorum_verified_at,p.execute_after,
 (SELECT count(*) FROM public.vice_exec_attestations a WHERE a.proposal_id=p.id AND a.payload_hash=p.payload_hash)
  AS verified_executive_signatures,
 (SELECT count(*) FROM (SELECT a.role FROM public.vice_exec_attestations a
    WHERE a.proposal_id=p.id AND a.payload_hash=p.payload_hash
    UNION SELECT a.role FROM public.vice_exec_mfa_authorizations a
    WHERE a.proposal_id=p.id AND a.payload_hash=p.payload_hash AND a.action='APPROVE') roles)
  AS verified_executive_authorizations,
 (EXISTS(SELECT 1 FROM public.vice_exec_attestations a WHERE a.proposal_id=p.id AND a.role='CEO' AND a.payload_hash=p.payload_hash)
  OR EXISTS(SELECT 1 FROM public.vice_exec_mfa_authorizations a WHERE a.proposal_id=p.id AND a.role='CEO' AND a.action='APPROVE' AND a.payload_hash=p.payload_hash)) AS ceo_signed,
 (EXISTS(SELECT 1 FROM public.vice_exec_attestations a WHERE a.proposal_id=p.id AND a.role='CFO' AND a.payload_hash=p.payload_hash)
  OR EXISTS(SELECT 1 FROM public.vice_exec_mfa_authorizations a WHERE a.proposal_id=p.id AND a.role='CFO' AND a.action='APPROVE' AND a.payload_hash=p.payload_hash)) AS cfo_signed,
 (CASE WHEN EXISTS(SELECT 1 FROM public.vice_exec_attestations a WHERE a.proposal_id=p.id AND a.role='CEO' AND a.payload_hash=p.payload_hash) THEN 'CRYPTOGRAPHIC'
       WHEN EXISTS(SELECT 1 FROM public.vice_exec_mfa_authorizations a WHERE a.proposal_id=p.id AND a.role='CEO' AND a.action='APPROVE' AND a.payload_hash=p.payload_hash) THEN 'MFA_TOTP' ELSE NULL END) AS ceo_authorization_method,
 (CASE WHEN EXISTS(SELECT 1 FROM public.vice_exec_attestations a WHERE a.proposal_id=p.id AND a.role='CFO' AND a.payload_hash=p.payload_hash) THEN 'CRYPTOGRAPHIC'
       WHEN EXISTS(SELECT 1 FROM public.vice_exec_mfa_authorizations a WHERE a.proposal_id=p.id AND a.role='CFO' AND a.action='APPROVE' AND a.payload_hash=p.payload_hash) THEN 'MFA_TOTP' ELSE NULL END) AS cfo_authorization_method
 FROM public.vice_sovereign_proposals p ORDER BY p.published_at DESC LIMIT 100
 ) x;
$function$
;

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
 WHERE a.proposal_id=p_id AND a.payload_hash=p.payload_hash;
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

CREATE OR REPLACE FUNCTION public.vice_exec_request_recovery()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
DECLARE
  v_role text;
  v_id uuid;
BEGIN
  SELECT role INTO v_role FROM public.vice_exec_signers WHERE user_id=auth.uid();
  IF v_role IS DISTINCT FROM 'CEO' THEN
    RAISE EXCEPTION 'Designated CEO authentication required' USING ERRCODE='42501';
  END IF;
  IF NOT public.vice_institutional_access() THEN
    RAISE EXCEPTION 'Executive access required' USING ERRCODE='42501';
  END IF;

  -- Expired unapproved requests must not block new recovery attempts.
  UPDATE public.vice_exec_recovery_requests
  SET status='EXPIRED'
  WHERE ceo_user_id=auth.uid()
    AND status='PENDING_CFO'
    AND expires_at<=now();

  SELECT id INTO v_id
  FROM public.vice_exec_recovery_requests
  WHERE ceo_user_id=auth.uid()
    AND status='PENDING_CFO'
    AND expires_at>now()
  ORDER BY requested_at DESC
  LIMIT 1
  FOR UPDATE;

  IF v_id IS NULL THEN
    INSERT INTO public.vice_exec_recovery_requests(ceo_user_id)
    VALUES (auth.uid()) RETURNING id INTO v_id;
  END IF;

  RETURN jsonb_build_object(
    'id',v_id,'status','PENDING_CFO',
    'notice','Active recovery request ready for device key binding and independent CFO authorization.'
  );
END $function$
;

CREATE OR REPLACE FUNCTION public.vice_exec_recovery_pending()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',r.id,'status',r.status,'requested_at',r.requested_at,'expires_at',r.expires_at,'approved_at',r.approved_at,'ready_at',r.approved_at+interval '60 seconds','replacement_public_key',r.replacement_public_key) ORDER BY r.requested_at DESC),'[]'::jsonb)
 FROM public.vice_exec_recovery_requests r
 WHERE public.vice_institutional_access() AND r.expires_at>now()
 AND (r.ceo_user_id=auth.uid() OR EXISTS(SELECT 1 FROM public.vice_exec_signers s WHERE s.role='CFO' AND s.user_id=auth.uid()));
$function$
;

CREATE OR REPLACE FUNCTION public.vice_exec_recovery_bind(p_request uuid, p_key jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
DECLARE r public.vice_exec_recovery_requests; fp text;
BEGIN
 IF NOT public.vice_institutional_access() OR NOT EXISTS(SELECT 1 FROM public.vice_exec_signers WHERE role='CEO' AND user_id=auth.uid()) THEN RAISE EXCEPTION 'CEO access required'; END IF;
 IF p_key->>'kty' IS DISTINCT FROM 'EC' OR p_key->>'crv' IS DISTINCT FROM 'P-256' OR p_key ? 'd' OR coalesce(p_key->>'x','') !~ '^[A-Za-z0-9_-]{43}$' OR coalesce(p_key->>'y','') !~ '^[A-Za-z0-9_-]{43}$' THEN RAISE EXCEPTION 'Invalid replacement public key';END IF;
 SELECT * INTO r FROM public.vice_exec_recovery_requests WHERE id=p_request AND ceo_user_id=auth.uid() AND status='PENDING_CFO' AND expires_at>now() FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Pending CEO request not found';END IF;
 fp:=encode(extensions.digest(convert_to(p_key::text,'UTF8'),'sha256'),'hex');
 IF r.replacement_public_key IS NOT NULL AND r.replacement_public_key IS DISTINCT FROM p_key THEN RAISE EXCEPTION 'Recovery key already bound; cancel and restart';END IF;
 UPDATE public.vice_exec_recovery_requests SET replacement_public_key=p_key,replacement_key_fingerprint=fp WHERE id=r.id;
 RETURN jsonb_build_object('id',r.id,'fingerprint',fp,'status','PENDING_CFO');
END $function$
;

CREATE OR REPLACE FUNCTION public.vice_exec_recovery_challenge(p_request uuid, p_action text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
DECLARE r public.vice_exec_recovery_requests; v_id uuid:=gen_random_uuid(); msg text; v_role text; v_key jsonb;
BEGIN
 IF NOT public.vice_institutional_access() THEN RAISE EXCEPTION 'Executive access required';END IF;
 SELECT * INTO r FROM public.vice_exec_recovery_requests WHERE id=p_request AND expires_at>now() FOR UPDATE;
 IF NOT FOUND OR r.replacement_public_key IS NULL THEN RAISE EXCEPTION 'Recovery request or bound key unavailable';END IF;
 SELECT role,public_key INTO v_role,v_key FROM public.vice_exec_signers WHERE user_id=auth.uid();
 IF p_action='RECOVERY_APPROVE' THEN
  IF v_role IS DISTINCT FROM 'CFO' OR v_key IS NULL OR r.status<>'PENDING_CFO' THEN RAISE EXCEPTION 'CFO approval unavailable';END IF;
 ELSIF p_action='RECOVERY_ACTIVATE' THEN
  IF v_role IS DISTINCT FROM 'CEO' OR r.ceo_user_id<>auth.uid() OR r.status<>'APPROVED' OR r.approved_at+interval '60 seconds'>now() THEN RAISE EXCEPTION 'CEO activation unavailable or cooldown active';END IF;
 ELSE RAISE EXCEPTION 'Invalid recovery action';END IF;
 IF (SELECT count(*) FROM public.vice_exec_challenges WHERE user_id=auth.uid() AND created_at>now()-interval '1 minute')>=10 THEN RAISE EXCEPTION 'Rate limit';END IF;
 msg:='VICE4X-RECOVERY-v1|'||p_action||'|'||r.id::text||'|'||r.ceo_user_id::text||'|'||r.replacement_key_fingerprint||'|'||v_id::text;
 INSERT INTO public.vice_exec_challenges(id,user_id,role,action,public_key,message) VALUES(v_id,auth.uid(),v_role,p_action,CASE WHEN p_action='RECOVERY_ACTIVATE' THEN r.replacement_public_key ELSE NULL END,msg);
 IF p_action='RECOVERY_ACTIVATE' THEN UPDATE public.vice_exec_recovery_requests SET activation_challenge=v_id WHERE id=r.id;END IF;
 RETURN jsonb_build_object('id',v_id,'message',msg,'expires_in',600,'fingerprint',r.replacement_key_fingerprint);
END $function$
;

CREATE OR REPLACE FUNCTION public.vice_exec_recovery_finish(p_challenge uuid, p_actor uuid, p_signature text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
DECLARE c public.vice_exec_challenges; r public.vice_exec_recovery_requests; v_id uuid; old_key jsonb;
BEGIN
 PERFORM set_config('request.jwt.claim.sub',p_actor::text,true);
 PERFORM vice_private.require_active_account();
 SELECT * INTO c FROM public.vice_exec_challenges WHERE id=p_challenge AND user_id=p_actor AND used_at IS NULL AND expires_at>now() AND action IN ('RECOVERY_APPROVE','RECOVERY_ACTIVATE') FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Recovery challenge unavailable';END IF;
 SELECT id INTO v_id FROM public.vice_exec_recovery_requests WHERE replacement_key_fingerprint=split_part(c.message,'|',5) AND id::text=split_part(c.message,'|',3);
 SELECT * INTO r FROM public.vice_exec_recovery_requests WHERE id=v_id FOR UPDATE;
 IF NOT FOUND OR r.expires_at<=now() THEN RAISE EXCEPTION 'Recovery expired';END IF;
 IF c.action='RECOVERY_APPROVE' THEN
  IF c.role<>'CFO' OR r.status<>'PENDING_CFO' OR NOT EXISTS(SELECT 1 FROM public.vice_exec_signers WHERE role='CFO' AND user_id=p_actor AND public_key IS NOT NULL) THEN RAISE EXCEPTION 'CFO authorization denied';END IF;
  UPDATE public.vice_exec_recovery_requests SET status='APPROVED',approved_at=now(),approval_challenge=c.id,approval_signature=p_signature WHERE id=r.id;
 ELSE
  IF c.role<>'CEO' OR r.ceo_user_id<>p_actor OR r.status<>'APPROVED' OR r.approved_at+interval '60 seconds'>now() OR r.activation_challenge IS DISTINCT FROM c.id OR c.public_key IS DISTINCT FROM r.replacement_public_key THEN RAISE EXCEPTION 'Activation denied';END IF;
  UPDATE public.vice_exec_signers SET public_key=r.replacement_public_key,enrolled_at=now() WHERE role='CEO' AND user_id=p_actor;
  UPDATE public.vice_exec_recovery_requests SET status='COMPLETED',activated_at=now() WHERE id=r.id;
 END IF;
 UPDATE public.vice_exec_challenges SET used_at=now() WHERE id=c.id;
 PERFORM vice_private.exec_log(c.action,r.id::text,jsonb_build_object('role',c.role,'challenge',c.id,'fingerprint',r.replacement_key_fingerprint));
 RETURN jsonb_build_object('verified',true,'action',c.action,'request_id',r.id,'status',CASE WHEN c.action='RECOVERY_APPROVE' THEN 'APPROVED' ELSE 'COMPLETED' END,'ready_at',r.approved_at+interval '60 seconds');
END $function$
;

CREATE OR REPLACE FUNCTION public.vice_exec_mfa_begin(p_action text, p_proposal text DEFAULT NULL::text, p_recovery uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
DECLARE
 v_actor uuid:=auth.uid();
 v_role text; v_id uuid:=gen_random_uuid(); v_hash text;
 v_r public.vice_exec_recovery_requests;
 v_fingerprint text;
 v_msg text;
BEGIN
 IF v_actor IS NULL OR NOT public.vice_institutional_access() THEN
  RAISE EXCEPTION 'Active executive authentication required' USING ERRCODE='42501';
 END IF;
 SELECT s.role INTO v_role FROM public.vice_exec_signers s WHERE s.user_id=v_actor;
 IF v_role NOT IN ('CEO','CFO') OR NOT EXISTS (
  SELECT 1 FROM public.profiles p WHERE p.id=v_actor AND p.account_suspended=false AND p.account_revoked=false
   AND p.role=CASE v_role WHEN 'CEO' THEN 'SUPER_ADMIN' ELSE 'FINANCE_OFFICER' END
 ) THEN RAISE EXCEPTION 'Designated active CEO/CFO required' USING ERRCODE='42501'; END IF;
 IF (SELECT count(*) FROM public.vice_exec_mfa_requests WHERE user_id=v_actor AND created_at>now()-interval '10 minutes') >= 8 THEN
  RAISE EXCEPTION 'Too many MFA requests. Wait 10 minutes before retrying.';
 END IF;
 IF p_action='APPROVE' THEN
  IF p_proposal IS NULL OR p_recovery IS NOT NULL THEN RAISE EXCEPTION 'Proposal required'; END IF;
  SELECT p.payload_hash INTO v_hash FROM public.vice_sovereign_proposals p
  WHERE p.id=p_proposal AND p.status='REVIEW' AND p.validation_issues='[]'::jsonb;
  IF v_hash IS NULL THEN RAISE EXCEPTION 'Proposal unavailable, blocked or not in review'; END IF;
  IF EXISTS(SELECT 1 FROM public.vice_exec_attestations a WHERE a.proposal_id=p_proposal AND a.role=v_role)
   OR EXISTS(SELECT 1 FROM public.vice_exec_mfa_authorizations a WHERE a.proposal_id=p_proposal AND a.role=v_role AND a.action='APPROVE')
  THEN RAISE EXCEPTION 'Executive role already authorized this proposal'; END IF;
 ELSIF p_action IN ('RECOVERY_APPROVE','RECOVERY_ACTIVATE') THEN
  IF p_recovery IS NULL OR p_proposal IS NOT NULL THEN RAISE EXCEPTION 'Recovery request required'; END IF;
  SELECT * INTO v_r FROM public.vice_exec_recovery_requests WHERE id=p_recovery AND expires_at>now();
  IF NOT FOUND OR v_r.replacement_public_key IS NULL OR v_r.replacement_key_fingerprint IS NULL THEN
   RAISE EXCEPTION 'Active recovery request with replacement key required';
  END IF;
  v_fingerprint:=v_r.replacement_key_fingerprint;
  IF p_action='RECOVERY_APPROVE' THEN
   IF v_role<>'CFO' OR v_r.status<>'PENDING_CFO' THEN RAISE EXCEPTION 'CFO authorization unavailable'; END IF;
  ELSE
   IF v_role<>'CEO' OR v_r.ceo_user_id<>v_actor OR v_r.status<>'APPROVED'
     OR v_r.approved_at IS NULL OR v_r.approved_at+interval '60 seconds'>now()
   THEN RAISE EXCEPTION 'CEO activation unavailable or cooldown active'; END IF;
  END IF;
 ELSE RAISE EXCEPTION 'Unsupported MFA action'; END IF;
 v_msg:='VICE4X-EXEC-MFA-v1|'||v_id::text||'|'||v_role||'|'||p_action||'|'||
 coalesce(p_proposal,'')||'|'||coalesce(v_hash,'')||'|'||coalesce(p_recovery::text,'')||'|'||coalesce(v_fingerprint,'');
 INSERT INTO public.vice_exec_mfa_requests
 (id,user_id,role,action,proposal_id,payload_hash,recovery_request_id,replacement_key_fingerprint,message)
 VALUES(v_id,v_actor,v_role,p_action,p_proposal,v_hash,p_recovery,v_fingerprint,v_msg);
 RETURN jsonb_build_object('id',v_id,'action',p_action,'role',v_role,'message',v_msg,
  'payload_hash',v_hash,'expires_in',180,
  'proof_required',(p_action='RECOVERY_ACTIVATE'));
END $function$
;

CREATE OR REPLACE FUNCTION public.vice_exec_mfa_finish(p_request uuid, p_actor uuid, p_factor text, p_proof text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
DECLARE
 v public.vice_exec_mfa_requests;
 r public.vice_exec_recovery_requests;
 v_role text; v_hash text;
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN
  RAISE EXCEPTION 'Server verification required' USING ERRCODE='42501';
 END IF;
 IF p_actor IS NULL OR p_factor IS NULL OR length(p_factor)<1 OR length(p_factor)>100 THEN
  RAISE EXCEPTION 'Verified identity and MFA factor required';
 END IF;
 SELECT * INTO v FROM public.vice_exec_mfa_requests
 WHERE id=p_request AND user_id=p_actor AND used_at IS NULL AND expires_at>now()
 FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'MFA request expired, already used or not owned'; END IF;
 SELECT s.role INTO v_role FROM public.vice_exec_signers s WHERE s.user_id=p_actor;
 IF v_role IS DISTINCT FROM v.role OR NOT EXISTS(
  SELECT 1 FROM public.profiles p
  WHERE p.id=p_actor AND p.account_suspended=false AND p.account_revoked=false
   AND p.role=CASE v.role WHEN 'CEO' THEN 'SUPER_ADMIN' ELSE 'FINANCE_OFFICER' END
 ) THEN RAISE EXCEPTION 'Executive role no longer authorized'; END IF;
 IF v.action='APPROVE' THEN
  SELECT payload_hash INTO v_hash FROM public.vice_sovereign_proposals
  WHERE id=v.proposal_id AND status='REVIEW' AND validation_issues='[]'::jsonb FOR UPDATE;
  IF v_hash IS NULL OR v_hash IS DISTINCT FROM v.payload_hash THEN
   RAISE EXCEPTION 'Proposal changed or is no longer available'; END IF;
  IF EXISTS(SELECT 1 FROM public.vice_exec_attestations a WHERE a.proposal_id=v.proposal_id AND a.role=v.role)
    OR EXISTS(SELECT 1 FROM public.vice_exec_mfa_authorizations a WHERE a.proposal_id=v.proposal_id AND a.role=v.role AND a.action='APPROVE')
  THEN RAISE EXCEPTION 'Executive role already authorized'; END IF;
 ELSE
  SELECT * INTO r FROM public.vice_exec_recovery_requests WHERE id=v.recovery_request_id AND expires_at>now() FOR UPDATE;
  IF NOT FOUND OR r.replacement_key_fingerprint IS DISTINCT FROM v.replacement_key_fingerprint
    OR r.replacement_public_key IS NULL THEN
    RAISE EXCEPTION 'Recovery request changed or expired'; END IF;
  IF v.action='RECOVERY_APPROVE' THEN
    IF v.role<>'CFO' OR r.status<>'PENDING_CFO' THEN RAISE EXCEPTION 'CFO recovery approval unavailable'; END IF;
    UPDATE public.vice_exec_recovery_requests SET status='APPROVED',approved_at=now() WHERE id=r.id;
  ELSIF v.action='RECOVERY_ACTIVATE' THEN
    IF v.role<>'CEO' OR r.ceo_user_id<>p_actor OR r.status<>'APPROVED'
      OR r.approved_at+interval '60 seconds'>now()
      OR p_proof IS NULL OR length(p_proof) NOT BETWEEN 80 AND 120
    THEN RAISE EXCEPTION 'CEO recovery activation requires approved cooldown and verified replacement-key possession'; END IF;
    UPDATE public.vice_exec_signers SET public_key=r.replacement_public_key,enrolled_at=now()
      WHERE role='CEO' AND user_id=p_actor;
    UPDATE public.vice_exec_recovery_requests SET status='COMPLETED',activated_at=now() WHERE id=r.id;
  END IF;
 END IF;
 INSERT INTO public.vice_exec_mfa_authorizations
 (request_id,user_id,role,action,proposal_id,payload_hash,recovery_request_id,factor_id,replacement_key_proof)
 VALUES(v.id,p_actor,v.role,v.action,v.proposal_id,v.payload_hash,v.recovery_request_id,p_factor,p_proof);
 UPDATE public.vice_exec_mfa_requests SET used_at=now() WHERE id=v.id;
 PERFORM vice_private.exec_log('MFA_'||v.action,coalesce(v.proposal_id,v.recovery_request_id::text),
  jsonb_build_object('actor',p_actor,'role',v.role,'method','SUPABASE_TOTP',
   'request',v.id,'proposal_hash',v.payload_hash,'recovery_fingerprint',v.replacement_key_fingerprint));
 RETURN jsonb_build_object('verified',true,'method','SUPABASE_TOTP','action',v.action,
  'role',v.role,'proposal_id',v.proposal_id,'recovery_request_id',v.recovery_request_id,
  'status',CASE WHEN v.action='RECOVERY_APPROVE' THEN 'APPROVED'
   WHEN v.action='RECOVERY_ACTIVATE' THEN 'COMPLETED' ELSE 'AUTHORIZED' END,
  'execution_enabled',false);
END $function$
;

CREATE OR REPLACE FUNCTION public.vice_exec_mfa_get(p_request uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
DECLARE v public.vice_exec_mfa_requests;
BEGIN
 IF auth.uid() IS NULL OR NOT public.vice_institutional_access()
 THEN RAISE EXCEPTION 'Active executive authentication required' USING ERRCODE='42501';END IF;
 SELECT * INTO v FROM public.vice_exec_mfa_requests
 WHERE id=p_request AND user_id=auth.uid() AND used_at IS NULL AND expires_at>now();
 IF NOT FOUND THEN RAISE EXCEPTION 'MFA request unavailable, expired or already consumed';END IF;
 RETURN jsonb_build_object('id',v.id,'action',v.action,'role',v.role,
  'message',v.message,'proposal_id',v.proposal_id,'payload_hash',v.payload_hash,
  'recovery_request_id',v.recovery_request_id,'replacement_key_fingerprint',v.replacement_key_fingerprint);
END $function$
;

CREATE OR REPLACE FUNCTION public.vice_ouv_activation_readiness(p_proposal_id text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
DECLARE
  p public.vice_sovereign_proposals%ROWTYPE;
  gate jsonb:='[]'::jsonb;
  auth_count integer:=0;
  sig_count integer:=0;
  official_v numeric;
  official_x numeric;
  from_v numeric;
  from_x numeric;
  to_v numeric;
  to_x numeric;
  evidence jsonb;
  review_over boolean;
BEGIN
  IF auth.uid() IS NULL OR NOT public.vice_institutional_access() THEN
    RAISE EXCEPTION 'Designated CEO or CFO session required'
    USING ERRCODE='42501';
  END IF;
  SELECT * INTO p FROM public.vice_sovereign_proposals
  WHERE id=p_proposal_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Governance proposal not found';
  END IF;
  SELECT count(*) INTO auth_count FROM (
    SELECT a.role FROM public.vice_exec_attestations a
    WHERE a.proposal_id=p.id AND a.payload_hash=p.payload_hash AND a.role IN ('CEO','CFO')
    UNION
    SELECT m.role FROM public.vice_exec_mfa_authorizations m
    WHERE m.proposal_id=p.id AND m.payload_hash=p.payload_hash
      AND m.action='APPROVE' AND m.role IN ('CEO','CFO')
  ) verified;
  SELECT count(DISTINCT a.role) INTO sig_count
    FROM public.vice_exec_attestations a
    WHERE a.proposal_id=p.id AND a.payload_hash=p.payload_hash
      AND a.role IN ('CEO','CFO');
  SELECT c.vice_price,c.v4x_price
  INTO official_v,official_x
  FROM public.vice_dao_config c WHERE c.id=1;
  from_v:=CASE WHEN (p.payload#>>'{parameters,previous_baseline,vice_ouv}') ~ '^[0-9]{1,15}([.][0-9]{1,8})?$'
     THEN (p.payload#>>'{parameters,previous_baseline,vice_ouv}')::numeric ELSE NULL END;
  from_x:=CASE WHEN (p.payload#>>'{parameters,previous_baseline,v4x_ouv}') ~ '^[0-9]{1,15}([.][0-9]{1,8})?$'
     THEN (p.payload#>>'{parameters,previous_baseline,v4x_ouv}')::numeric ELSE NULL END;
  to_v:=CASE WHEN (p.payload#>>'{parameters,target_scaled_tier,vice_ouv}') ~ '^[0-9]{1,15}([.][0-9]{1,8})?$'
     THEN (p.payload#>>'{parameters,target_scaled_tier,vice_ouv}')::numeric ELSE NULL END;
  to_x:=CASE WHEN (p.payload#>>'{parameters,target_scaled_tier,v4x_ouv}') ~ '^[0-9]{1,15}([.][0-9]{1,8})?$'
     THEN (p.payload#>>'{parameters,target_scaled_tier,v4x_ouv}')::numeric ELSE NULL END;
  evidence:=vice_private.ouv_release_reconciliation();
  review_over:=p.validation_until IS NOT NULL AND now()>=p.validation_until;
  IF p.status<>'REVIEW' THEN gate:=gate||'"NOT_IN_ACTIVE_REVIEW"'::jsonb; END IF;
  IF jsonb_typeof(p.validation_issues) IS DISTINCT FROM 'array' THEN
    gate:=gate||'"PROPOSAL_VALIDATION_ISSUES"'::jsonb;
  ELSIF jsonb_array_length(p.validation_issues)>0 THEN
    gate:=gate||'"PROPOSAL_VALIDATION_ISSUES"'::jsonb;
  END IF;
  IF auth_count<>2 THEN gate:=gate||'"CEO_AND_CFO_AUTHORIZATIONS_REQUIRED"'::jsonb; END IF;
  IF NOT review_over THEN gate:=gate||'"PUBLIC_REVIEW_WINDOW_OPEN"'::jsonb; END IF;
  IF official_v IS NULL OR official_x IS NULL OR
      from_v IS DISTINCT FROM official_v OR from_x IS DISTINCT FROM official_x
  THEN gate:=gate||'"PROPOSAL_BASELINE_DOES_NOT_MATCH_OFFICIAL_REFERENCE"'::jsonb; END IF;
  IF to_v IS NULL OR to_v<=0 OR to_x IS NULL OR to_x<=0
      OR to_x IS DISTINCT FROM to_v*160
  THEN gate:=gate||'"PROPOSED_OUV_RATIO_OR_VALUES_INVALID"'::jsonb; END IF;
  IF NOT COALESCE((evidence->>'ledger_reconciled')::boolean,false)
  THEN gate:=gate||'"ISSUER_LEDGER_RECONCILIATION_FAILED"'::jsonb; END IF;
  IF p.quorum_verified_at IS NULL
  THEN gate:=gate||'"INDEPENDENT_ONCHAIN_QUORUM_NOT_VERIFIED"'::jsonb; END IF;
  IF p.execute_after IS NULL OR now()<p.execute_after
  THEN gate:=gate||'"72_HOUR_TIMELOCK_NOT_COMPLETED"'::jsonb; END IF;
  -- Permanent infrastructure blockers until separately deployed, tested and verified.
  -- Existing proposal constraint requires quorum_verified_at and execute_after to be NULL.
  gate:=gate||'"ONCHAIN_QUORUM_VERIFIER_NOT_CONFIGURED"'::jsonb
            ||'"ATOMIC_GOVERNANCE_EXECUTOR_NOT_CONFIGURED"'::jsonb;
  RETURN jsonb_build_object(
    'proposal_id',p.id,'proposal_status',p.status,
    'review_deadline',p.validation_until,
    'review_complete',review_over,
    'executive_authorizations',auth_count,
    'verified_device_signatures',sig_count,
    'authorization_goal',2,
    'current_official_ouv',jsonb_build_object('VICE',official_v,'V4X',official_x),
    'proposed_ouv',jsonb_build_object('VICE',to_v,'V4X',to_x),
    'baseline_compatible',official_v=from_v AND official_x=from_x,
    'ledger_reconciled',(evidence->>'ledger_reconciled')::boolean,
    'model_policy_status','MODEL_ONLY',
    'next_unmet_gates',gate,
    'can_apply',false,
    'holder_units_changed',false,
    'official_ouv_changed',false,
    'computed_at',now(),
    'explanation','Executive sign-off does not activate OUV. On-chain quorum verification, 72-hour timelock and a separately audited structural executor are not yet configured. No official prices were changed.'
  );
END;
$function$
;

