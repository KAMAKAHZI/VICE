# OUV staging parity — execution plan
Date: 2026-10-26
Status: NOT DEPLOYABLE / NOT AUTHORIZED FOR LIVE EXECUTION

## Read-only verification
The connected VICE-STAGING database has only six public tables: certificates, profiles, invites, email_outbox, vice_soc_incidents, vice_soc_webhook_nonces. It has no OUV proposal, OUV version, executive authorization, OUV receipt or DAO configuration tables. Both OUV RPCs are absent. This is not an OUV-capable staging environment.

## Required ordered implementation
1. Export production schema and migration manifest without customer data or secrets. Inventory dependencies: proposal, signature, signer registry, receipt, versions, config, ledger, governance functions and grants.
2. Prepare a reviewed, reproducible migration series that creates only required schema and policies in staging. Do not copy real customer/holder data. Seed synthetic proposal, synthetic key registry and synthetic ledger.
3. Write a verifier for authenticated CEO/CFO identities, independent signatures, payload binding, quorum and confirmed on-chain evidence; require real verifiable chain receipts. Implement 72-hour timelock from independently verified quorum time.
4. Replace the unconditional `can_apply=false` only when *all* independently verified gates pass. Maintain fail-closed defaults.
5. Refactor the executor to require exact-decimal NUMERIC, row/advisory locking, transactionally consistent DAO config + version + receipt + status writes, unique idempotency key, and immutable audit history. Never change holder units as a side effect.
6. Test malicious/expired/missing evidence, duplicate signatures, key rotation, mismatched hashes, premature timelock, conflicting baseline, double-execution, concurrent requests, rollback and stale cache.
7. Obtain reviewed approvals and backup/restore evidence. Do not enable production execution until staged evidence and independent sign-off exist.

## Existing production blockers
- Production CHECK forces `quorum_verified_at IS NULL AND execute_after IS NULL`.
- Production status CHECK rejects `EXECUTED`.
- Production readiness RPC permanently reports on-chain verifier and executor unconfigured.
- OUV gateway currently relies on a database crypto-verified flag, not direct independent verifier execution.
- Production proposed target values are management reference values only.

## Acceptance evidence
For every gate record SQL migration hash, staging environment, test run SHA, approval receipts, ledger totals, exact NUMERIC fixtures, rollback transcript and release reviewer.

No production migration or financial execution is authorized by this plan.
