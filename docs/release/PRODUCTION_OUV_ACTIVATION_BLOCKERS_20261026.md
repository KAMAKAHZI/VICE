# Production OUV activation — verified blockers and safe remediation (2026-10-26)

## Live production observations
Supabase project `VICE` (`sdsaewumabzjjvsmqqsl`) contains proposal `PROP-20261019-548A9057-34F`, payload hash `3f108d0483466f24b62efce207086110a3b76e70d8198dc7135ec0f2068742ae`, status `REVIEW`, empty validation issues, review deadline 2026-10-22 21:47:27 UTC. Both `quorum_verified_at` and `execute_after` are NULL.

Live schema enforces `CHECK (quorum_verified_at IS NULL AND execute_after IS NULL)` and a status check allowing only REVIEW, LOCKED, REJECTED. Thus a legitimate quorum receipt, 72-hour timelock, and EXECUTED transition are structurally impossible without a reviewed migration. The live readiness function explicitly returns `can_apply=false` and permanent blockers for unconfigured on-chain quorum verifier and atomic executor. Do not spoof approval timestamps or bypass governance.

The existing `vice_ouv_execute_approved` procedure has row locking and a receipt check but does not itself enforce independent cryptographic signer registry verification. It writes an OUV version and receipt and marks status EXECUTED, which the current status constraint prohibits. Independently validate its permissions, baseline, exact numeric arithmetic, unique receipt constraints, and downstream `vice_dao_config` synchronization.

The separate staging project `VICE-STAGING` (`mzdybvxvmbigaylleqbt`) lacks both named public OUV RPCs. No production rollout until staging parity and negative tests are demonstrated.

## Authorized completion sequence
1. Back up production and rehearse restoration; record the migration state and full schema diff.
2. Implement on-chain quorum evidence verification against approved contract/network, block confirmation policy and proposal payload binding; reject replay or forged receipts.
3. Implement approved independent CEO/CFO signature verification, authenticated MFA evidence, signer registry/key revocation, and 72-hour timelock in an authoritative database gate.
4. Introduce reviewed additive migration that permits actual verified quorum/timelock fields and EXECUTED status while preserving existing constraints for unrelated proposal classes.
5. Refactor readiness and executor to use exact PostgreSQL NUMERIC, locked authoritative ledger checks, transaction-scoped locks, idempotency receipts and approved methodology.
6. Ensure the atomic publication transaction updates authoritative reference configuration, version, receipt and proposal state consistently; preserve all IRU unit balances.
7. Stage and run malicious-input, concurrency, duplicate, rollback, baseline mismatch and governance-negative tests.
8. Independently approve staging evidence and production change window; only then enable execution, explicitly invoke approved action, and independently reconcile portfolio and certificate outputs.

**This document is not approval to apply the proposal. No fabricated signatures, quorum or timestamps.**
