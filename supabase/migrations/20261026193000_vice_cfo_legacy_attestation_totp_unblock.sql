-- VICE OS — restore CFO TOTP approval when a legacy cryptographic attestation exists.
-- REVIEWED CANDIDATE ONLY: do not apply to production without staging verification.
-- A prior executive attestation remains immutable; it does NOT equal TOTP approval.
-- Do not modify vice_exec_mfa_authorizations, holder units, OUV or signer identities.
DO $migration$
DECLARE
  target regprocedure := to_regprocedure('public.vice_exec_mfa_begin(text,text,uuid)');
  original text;
  previous_condition text := $old$IF EXISTS(SELECT 1 FROM public.vice_exec_attestations a WHERE a.proposal_id=p_proposal AND a.role=v_role)
   OR EXISTS(SELECT 1 FROM public.vice_exec_mfa_authorizations a WHERE a.proposal_id=p_proposal AND a.role=v_role AND a.action='APPROVE')$old$;
  new_condition text := $new$IF EXISTS(SELECT 1 FROM public.vice_exec_mfa_authorizations a WHERE a.proposal_id=p_proposal AND a.role=v_role AND a.action='APPROVE')$new$;
BEGIN
  IF target IS NULL THEN RAISE EXCEPTION 'Missing expected executive MFA begin function'; END IF;
  SELECT pg_get_functiondef(target::oid) INTO original;
  IF position(previous_condition IN original)=0 THEN
    RAISE EXCEPTION 'Expected source condition changed; refuse blind migration';
  END IF;
  IF position(new_condition IN original)>0 THEN
    RAISE EXCEPTION 'Ambiguous source state; refuse blind migration';
  END IF;
  EXECUTE replace(original,previous_condition,new_condition);
END $migration$;
-- Existing role validation, active account checks, rate limits, proposal hash,
-- duplicate TOTP checks, and recovery authorization requirements remain intact.
