-- VICE OS automatic OUV: independent execution guard.
-- Defense in depth; never activates policy, modifies reference values, or issues approvals.
-- Run in a reviewed migration after confirming policy table structure.
BEGIN;
CREATE OR REPLACE FUNCTION vice_private.ouv_auto_execution_guard()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path=pg_catalog
AS $$
DECLARE p record; c record;
BEGIN
  SELECT status,activation_proposal_id,activation_evidence_hash,activated_at
    INTO STRICT p FROM public.vice_ouv_release_policy WHERE id=1;
  SELECT vice_price,v4x_price,total_vice,total_v4x
    INTO STRICT c FROM public.vice_dao_config WHERE id=1;
  IF c.total_vice<>10000000 OR c.total_v4x<>10000000 THEN
    RAISE EXCEPTION 'OUV_BLOCK_SUPPLY';
  END IF;
  IF c.vice_price<=0 OR c.v4x_price<>c.vice_price*160 THEN
    RAISE EXCEPTION 'OUV_BLOCK_REFERENCE_INTEGRITY';
  END IF;
  IF p.status<>'AUTO_ACTIVE' THEN
    RETURN jsonb_build_object('executable',false,'reason','POLICY_NOT_ACTIVE',
      'policy_status',p.status,'official_vice',c.vice_price,'official_v4x',c.v4x_price);
  END IF;
  IF p.activation_proposal_id IS NULL OR p.activated_at IS NULL OR
     p.activation_evidence_hash IS NULL OR
     p.activation_evidence_hash !~ '^[0-9a-f]{64}$' THEN
    RETURN jsonb_build_object('executable',false,'reason','ACTIVATION_EVIDENCE_MISSING');
  END IF;
  -- This guard intentionally cannot establish cryptographic signature validity.
  -- A separate, independently audited authorization verifier must attest the
  -- signed amendment scope, signers, quorum, expiry and timelock before execution.
  RETURN jsonb_build_object('executable',false,'reason','INDEPENDENT_GOVERNANCE_VERIFICATION_REQUIRED',
    'policy_status',p.status,'activation_proposal_id',p.activation_proposal_id);
END $$;
REVOKE ALL ON FUNCTION vice_private.ouv_auto_execution_guard() FROM PUBLIC,anon,authenticated;
-- Internal inspection only: never grant execution to browser roles.
COMMIT;
