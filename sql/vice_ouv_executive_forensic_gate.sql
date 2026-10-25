-- VICE OS | OUV executive release forensic gate (read-only, fail-closed)
-- Does NOT execute a proposal, change governance rules, or reprice holdings.
-- Intended for a privileged staging / production auditor.
BEGIN READ ONLY;
WITH proposal AS (
 SELECT id,status,payload_hash,validation_until,validation_issues,
        quorum_verified_at,execute_after
 FROM public.vice_sovereign_proposals
 WHERE id='PROP-20261019-548A9057-34F'
), approvals AS (
 SELECT role,verified_at,payload_hash
 FROM public.vice_exec_attestations
 WHERE proposal_id='PROP-20261019-548A9057-34F'
 UNION ALL
 SELECT role,verified_at,payload_hash
 FROM public.vice_exec_mfa_authorizations
 WHERE proposal_id='PROP-20261019-548A9057-34F' AND action='APPROVE'
), valid_roles AS (
 SELECT a.role,min(a.verified_at) verified_at
 FROM approvals a JOIN proposal p ON a.payload_hash=p.payload_hash
 WHERE a.role IN ('CEO','CFO') AND a.verified_at IS NOT NULL
 GROUP BY a.role
), official AS (
 SELECT vice_price,v4x_price,total_vice,total_v4x
 FROM public.vice_dao_config WHERE id=1
)
SELECT p.id,p.status,
 (p.payload_hash='3f108d0483466f24b62efce207086110a3b76e70d8198dc7135ec0f2068742ae') AS hash_matches,
 (SELECT count(*) FROM valid_roles) AS approved_roles,
 (SELECT max(verified_at) FROM valid_roles) AS final_approval,
 (p.validation_issues='[]'::jsonb AND now()>=p.validation_until) AS public_review_complete,
 (p.quorum_verified_at IS NOT NULL) AS quorum_verified,
 (p.execute_after IS NOT NULL AND now()>=p.execute_after) AS timelock_complete,
 (SELECT vice_price FROM official) AS official_vice,
 (SELECT v4x_price FROM official) AS official_v4x,
 (SELECT total_vice=10000000 AND total_v4x=10000000
  AND v4x_price=vice_price*160 FROM official) AS fixed_supply_ratio_valid,
 (SELECT count(*) FROM public.ouv_versions) AS published_versions,
 (SELECT count(*) FROM public.vice_ouv_execution_receipts WHERE proposal_id=p.id) AS execution_receipts,
 (SELECT count(*) FROM public.ouv_versions) =
 (SELECT count(*) FROM public.vice_ouv_execution_receipts) AS version_receipt_counts_match,
 (SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conrelid='public.vice_sovereign_proposals'::regclass AND conname='vice_sovereign_proposals_check') AS quorum_constraint,
 (SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conrelid='public.vice_sovereign_proposals'::regclass AND conname='vice_sovereign_proposals_status_check') AS status_constraint,
 false AS executor_activation_authorized
FROM proposal p;
ROLLBACK;
