# VICE OS OUV — Production release gate and correction (2026-10-26)

## Non-negotiable correction
The current governance path is **off-chain**. Do not require on-chain quorum or fabricate on-chain evidence. Current database has CEO SUPABASE_TOTP APPROVE and CFO attestation, but **no CFO SUPABASE_TOTP APPROVE** for proposal PROP-20261019-548A9057-34F. An attestation cannot silently be promoted to a verified TOTP receipt.

## Staging work actually performed
- Isolated exact NUMERIC(30,8) OUV transaction fixture and replay-safe receipt.
- Isolated off-chain TOTP dual-role readiness, review and timelock.
- Replaced test-only boolean flags with restricted `trusted_mfa_receipts` registry in staging readiness.
- Negative test: nonexistent proposal returns can_apply=false.
- Synthetic execution and replay tests run inside rollback transactions.
**None of this is production schema parity, production authentication, or production publication.**

## Production hard blockers (verified)
1. `vice_sovereign_proposals` CHECK forbids non-NULL quorum_verified_at/execute_after.
2. Status CHECK forbids EXECUTED.
3. `vice_ouv_activation_readiness` unconditionally returns can_apply=false, cites on-chain quorum.
4. Production executor currently does not atomically synchronize `vice_dao_config` with `ouv_versions`, and does not bind the incoming request_id.
5. CFO TOTP approval absent; existing CFO attestation requires independent method/identity verification.
6. Netlify execution flag is off by design pending audited migration.

## Safe production completion sequence
1. Implement trusted server-side Supabase MFA verify challenge flow: authenticated current user, verified factor, challenge, proposal/action/payload hash binding, one-time nonce, short expiry, replay prevention, and server-only issuance of immutable receipts. Do not accept client-supplied verified flags. Require independent CEO and CFO identities registered in vice_exec_signers.
2. Explicitly approve the off-chain governance policy and its execution delay. Preserve any existing 60-minute executive delay and review deadline unless governance formally changes them; no silent 72-hour waiver.
3. Rebuild production readiness to require both verified TOTP receipts, review completion, unchanged baseline, exact ratio, reconciled ledger, and valid timelock; fail closed on any missing evidence.
4. Add schema migration to support off-chain approvals and EXECUTED status, keeping restrictions appropriate to other proposal classes. Create unique request_id/receipt constraints.
5. Implement atomic NUMERIC transaction: lock proposal and authoritative config; verify approval, payload, baseline and supply; publish config+version+receipt+status together; no holder-unit changes; reject mismatched replay request IDs.
6. Stage with production-equivalent synthetic schema; run adversarial, concurrency, rollback, duplicate, expired-MFA, revoked-signer, stale-baseline and certificate propagation tests.
7. Independently review, back up, obtain explicit executive authorization, deploy and verify production receipts/values.

## Current value states
Official: VICE 2, V4X 320. Proposed: VICE 2.82645403, V4X 452.23264480. Both are **management references**, not FMV.

No live OUV execution has occurred. Do not claim complete until production transaction and independent reconciliation pass.
