-- Read-only capture before VICE-EXEC-AUTH-2. Reference backup, not an automatic rollback script.
-- Do not remove new audit/key history or restore weaker recovery gates after authorization records exist.
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
END $function$;

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
END $function$;

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
 (SELECT count(*) FROM public.vice_exec_attestations a WHERE a.proposal_id=p.id) AS verified_executive_signatures,
 EXISTS(SELECT 1 FROM public.vice_exec_attestations a WHERE a.proposal_id=p.id AND a.role='CEO') AS ceo_signed,
 EXISTS(SELECT 1 FROM public.vice_exec_attestations a WHERE a.proposal_id=p.id AND a.role='CFO') AS cfo_signed
 FROM public.vice_sovereign_proposals p ORDER BY p.published_at DESC LIMIT 100
 ) x;
$function$;

CREATE OR REPLACE FUNCTION public.vice_exec_request_recovery()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
DECLARE v_role text; v_id uuid;
BEGIN
 SELECT role INTO v_role FROM public.vice_exec_signers WHERE user_id=auth.uid();
 IF v_role IS DISTINCT FROM 'CEO' THEN RAISE EXCEPTION 'Designated CEO authentication required' USING ERRCODE='42501';END IF;
 IF NOT public.vice_institutional_access() THEN RAISE EXCEPTION 'Executive access required' USING ERRCODE='42501';END IF;
 SELECT id INTO v_id FROM public.vice_exec_recovery_requests WHERE ceo_user_id=auth.uid() AND status='PENDING_CFO' LIMIT 1;
 IF v_id IS NULL THEN
  INSERT INTO public.vice_exec_recovery_requests(ceo_user_id) VALUES(auth.uid()) RETURNING id INTO v_id;
 END IF;
 RETURN jsonb_build_object('id',v_id,'status','PENDING_CFO','notice','Request recorded. CFO cryptographic approval and CEO device key binding are not yet available. No key has been changed.');
END $function$;

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
$function$;

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
END $function$;

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
END $function$;

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
END $function$;
