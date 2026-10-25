-- VICE OS | OUV proposal execution staging migration (NOT FOR PRODUCTION APPLY)
-- Prerequisite: formally approved governance amendment and independent quorum evidence.
-- This file is intentionally a dry-run assertion suite. It never removes structural locks.
BEGIN READ ONLY;
DO $gate$
DECLARE
 p public.vice_sovereign_proposals%ROWTYPE;
 c public.vice_dao_config%ROWTYPE;
 roles_count integer;
 receipt_count integer;
 v numeric; x numeric;
BEGIN
 SELECT * INTO STRICT p FROM public.vice_sovereign_proposals
  WHERE id='PROP-20261019-548A9057-34F';
 SELECT * INTO STRICT c FROM public.vice_dao_config WHERE id=1;
 SELECT count(*) INTO roles_count FROM (
  SELECT role FROM public.vice_exec_attestations
   WHERE proposal_id=p.id AND payload_hash=p.payload_hash AND verified_at IS NOT NULL AND role IN ('CEO','CFO')
  UNION
  SELECT role FROM public.vice_exec_mfa_authorizations
   WHERE proposal_id=p.id AND payload_hash=p.payload_hash AND verified_at IS NOT NULL AND action='APPROVE' AND role IN ('CEO','CFO')
 ) r;
 SELECT count(*) INTO receipt_count FROM public.vice_ouv_execution_receipts WHERE proposal_id=p.id;
 v:=(p.payload#>>'{parameters,target_scaled_tier,vice_ouv}')::numeric;
 x:=(p.payload#>>'{parameters,target_scaled_tier,v4x_ouv}')::numeric;
 IF p.payload_hash<>'3f108d0483466f24b62efce207086110a3b76e70d8198dc7135ec0f2068742ae' THEN
  RAISE EXCEPTION 'OUV_GATE: unexpected proposal payload hash'; END IF;
 IF roles_count<>2 THEN RAISE EXCEPTION 'OUV_GATE: missing executive role'; END IF;
 IF p.status<>'REVIEW' OR now()<p.validation_until OR p.validation_issues<>'[]'::jsonb THEN
  RAISE EXCEPTION 'OUV_GATE: proposal review not complete'; END IF;
 IF c.vice_price<>2 OR c.v4x_price<>320 OR c.total_vice<>10000000 OR c.total_v4x<>10000000 THEN
  RAISE EXCEPTION 'OUV_GATE: official baseline/supply drift'; END IF;
 -- Decimal representation is independently rounded to 8 and 7 places respectively.
 IF v<>2.82645403 OR x<>452.2326448 OR abs(x-v*160)>0.000001 THEN
  RAISE EXCEPTION 'OUV_GATE: proposal target or rounding mismatch'; END IF;
 IF receipt_count<>0 THEN RAISE EXCEPTION 'OUV_GATE: proposal already executed'; END IF;
 IF p.quorum_verified_at IS NULL OR p.execute_after IS NULL OR now()<p.execute_after THEN
  RAISE NOTICE 'BLOCKED: quorum or timelock not satisfied; do not remove database protections';
 ELSE RAISE NOTICE 'Read-only preliminary evidence passes; independently verify governance policy and signatures'; END IF;
 RAISE NOTICE 'STAGING CHECK ONLY: no proposal, official value, holder units or receipt modified';
END $gate$;
ROLLBACK;
