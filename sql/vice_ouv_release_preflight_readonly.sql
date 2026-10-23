-- VICE OS financial release preflight (READ ONLY).
-- Run as a privileged auditor; any failed assertion blocks activation.
-- This script intentionally does not activate, reprice, or change a balance.
BEGIN READ ONLY;
DO $audit$
DECLARE
  p public.vice_ouv_release_policy%ROWTYPE;
  c public.vice_dao_config%ROWTYPE;
  health jsonb;
  model jsonb;
  version_count bigint;
  policy_check text;
  receipt_count bigint;
BEGIN
  SELECT * INTO STRICT p FROM public.vice_ouv_release_policy WHERE id=1;
  SELECT * INTO STRICT c FROM public.vice_dao_config WHERE id=1;
  health := vice_private.ouv_release_reconciliation();
  model := vice_private.ouv_release_math();
  IF p.total_supply_vice<>10000000 OR p.total_supply_v4x<>10000000
    OR c.total_vice<>10000000 OR c.total_v4x<>10000000 THEN
    RAISE EXCEPTION 'OUV PREFLIGHT FAIL: fixed supply mismatch';
  END IF;
  IF coalesce((health->>'ledger_reconciled')::boolean,false) IS DISTINCT FROM true
    OR coalesce((health->>'audit_event_validity')::boolean,false) IS DISTINCT FROM true
    OR coalesce((health->>'baseline_matches_official')::boolean,false) IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'OUV PREFLIGHT FAIL: ledger/events/baseline not reconciled';
  END IF;
  IF c.vice_price<=0 OR c.v4x_price<=0 OR c.v4x_price<>c.vice_price*160 THEN
    RAISE EXCEPTION 'OUV PREFLIGHT FAIL: official references invalid or ratio mismatch';
  END IF;
  IF (model->>'baseline_outdated')::boolean IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'OUV PREFLIGHT FAIL: modeled baseline stale';
  END IF;
  IF (model#>>'{modeled_ouv,V4X}')::numeric <>
     (model#>>'{modeled_ouv,VICE}')::numeric * 160 THEN
    RAISE EXCEPTION 'OUV PREFLIGHT FAIL: modeled ratio mismatch';
  END IF;
  SELECT pg_get_constraintdef(k.oid) INTO policy_check
  FROM pg_constraint k JOIN pg_class t ON t.oid=k.conrelid
  WHERE t.oid='public.vice_ouv_release_policy'::regclass
    AND k.conname='vice_ouv_release_policy_status_check';
  IF policy_check IS NULL THEN
    RAISE EXCEPTION 'OUV PREFLIGHT FAIL: policy status constraint missing';
  END IF;
  IF p.status='AUTO_ACTIVE' AND policy_check NOT LIKE '%AUTO_ACTIVE%' THEN
    RAISE EXCEPTION 'OUV PREFLIGHT FAIL: policy status incompatible with DB constraint';
  END IF;
  SELECT count(*) INTO version_count FROM public.ouv_versions;
  SELECT count(*) INTO receipt_count FROM public.vice_ouv_execution_receipts;
  IF version_count <> receipt_count THEN
    RAISE EXCEPTION 'OUV PREFLIGHT FAIL: version/receipt counts disagree (% vs %)',version_count,receipt_count;
  END IF;
  IF EXISTS(
    SELECT 1 FROM public.vice_ouv_execution_receipts r
    LEFT JOIN public.ouv_versions v ON v.id=r.ouv_version_id
    WHERE v.id IS NULL
  ) THEN
    RAISE EXCEPTION 'OUV PREFLIGHT FAIL: orphan execution receipt';
  END IF;
  RAISE NOTICE 'PASS: supply, ledger, audit events, ratio, baseline, modeled ratio, receipt linkage';
  RAISE NOTICE 'POLICY STATUS CONSTRAINT: %',policy_check;
  RAISE NOTICE 'POLICY STATUS: %, official VICE: %, official V4X: %, versions: %, receipts: %',
    p.status,c.vice_price,c.v4x_price,version_count,receipt_count;
  IF p.status='AUTO_ACTIVE' THEN
    RAISE NOTICE 'WARNING: policy label alone does not prove automatic official execution; audit executor and effective governance evidence separately';
  END IF;
END
$audit$;
ROLLBACK;
