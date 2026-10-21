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

