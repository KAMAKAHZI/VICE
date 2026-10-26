# Off-chain OUV dual-executive TOTP staging implementation — 2026-10-26

## Architecture correction
VICE OS currently uses **off-chain Supabase TOTP 2FA**, not blockchain quorum voting. On-chain transaction receipts and on-chain quorum are not required for the current governance pathway. Do not conflate device-login MFA caching (24h) with fresh action-bound approval.

## Live production evidence
- Proposal PROP-20261019-548A9057-34F remains REVIEW.
- Production MFA authorization table has one CEO SUPABASE_TOTP APPROVE record for the proposal.
- Separate executive attestation table has one CFO record. **This is not proof of CFO TOTP verification**; confirm signer identity and authentication method before recognizing as equivalent.
- Production proposal CHECK constraints force quorum_verified_at/execute_after to NULL and prohibit EXECUTED status; readiness hardcodes can_apply=false.
- Production ledger reconciliation passed in read-only inspection.
- No production migration, approval, or OUV publication was performed.

## Staging migration applied
`isolated_ouv_offchain_totp_dual_executive_gate` creates restricted `vice_ouv_test.totp_authorizations` and `vice_ouv_test.review_policy` tables and replaces isolated `vice_ouv_test.governance_readiness` to require exactly two distinct roles/identities with matching proposal hash, action APPROVE, auth method SUPABASE_TOTP, a server verification source marker, unexpired evidence, completed review and authorized execution time. No on-chain fields are referenced. Existing isolated executor calls this readiness function.

## Staging tests
A synthetic proposal was created inside a rolled-back transaction, first without authorizations, then with one, then two synthetic authorization records, and executed through isolated atomic executor. Duplicate request returned already_executed. These fixtures are synthetic and **not genuine Supabase MFA proof**. No test records retained. This validates gate wiring and idempotency only.

## Release blockers
1. Establish server-side trusted TOTP verification ingestion: never accept `verification_source` or `verified_at` from a browser. Verify challenge against Supabase Auth and persist authenticated user/role, proposal hash, action, nonce and expiry from trusted server code. For action binding, a prior generic sign-in TOTP is not sufficient.
2. Verify the CEO and CFO records against the actual signer registry, including role/identity uniqueness and active status.
3. Adopt an explicit off-chain governance policy for review period and timelock; do not silently waive the 60-minute executive delay or previously promised 72-hour period. Confirm authorized policy.
4. Rework production constraints and readiness without introducing PUBLIC-executable privileged mutation; implement an audited atomic transaction updating config, version, receipt and proposal state. Exact NUMERIC, idempotency, concurrency and rollback required.
5. Complete production-equivalent staging, negative tests, backup and rollback verification, approval and deployment.

**No live OUV execution was authorized or performed.**
