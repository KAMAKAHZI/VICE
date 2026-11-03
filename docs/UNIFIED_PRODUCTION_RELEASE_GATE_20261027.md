# VICE OS — Unified Production Release Gate (2026-10-27)
This is a release blocker, not an authorization to execute OUV changes.

## Verified production facts
- Governance proposal execution milestone constraint requires quorum + >=5 minutes.
- `vice_ouv_execute_approved` separately enforces 60 minutes after final executive approval; harmonize only after documented governance approval.
- `vice_ouv_activation_readiness` unconditionally returns `can_apply=false`, citing absent quorum verifier and atomic executor.
- `vice_ouv_release_snapshot` returns `automatic_official_update_enabled=false`.
- `vice_private.ouv_release_math` is model-only, using `1 + net_released_units/20,000,000` and exact 1:160, NOT independently appraised market value.
- Intended proposal CEO and CFO attestations are not both verified against its exact payload.

## Mandatory release gates
1. Signed governance policy explicitly adopts the routine-distribution management reference formula, threshold, effective date, and five-minute execution policy; distinguish model from FMV and collateral valuation.
2. Independent, testable on-chain/off-chain quorum evidence verified server-side, including replay protection.
3. Dual executive authorizations bound to the exact proposal hash, with server-verified MFA/passkey challenge, expiry, signer role, and non-reuse.
4. Database-enforced timelock; no client clock or browser-only approvals.
5. Generic, transactionally atomic OUV executor: proposal row lock, unique receipt, checked baseline, exact numeric ratio, fixed supply invariants, authorization, quorum, timelock; reject repeated/altered execution.
6. For routine distributions: only finalized, eligible ledger events; immutable event ID; transactional idempotent processing; reconciliation; exact decimal math; major-event routing to governance; no assumed value appreciation from finite supply alone.
7. Verify authoritative source of truth for `vice_dao_config`, `ouv_versions`, portfolios and certificates; publish via committed versions, not optimistic UI.
8. RLS/privilege review, penetration tests, rollback drill, concurrency/replay tests, browser/desktop auth tests, Netlify deploy health, and external audit.
9. No production financial mutation until all gates pass; no fabricated CEO/CFO attestation or quorum timestamp.

## Acceptance tests
- No duplicate version or receipt after 100 concurrent retries.
- Wrong proposal hash, signer role, expired challenge, absent quorum, incomplete timelock => deny.
- Zero, duplicate, reversed, overflow, and out-of-order distributions => no unauthorized reference change.
- Supply invariant 10,000,000 each; 75% reserve/25% holder allocation; ratio exactly 160.
- Major threshold routes to governance; minor only auto-applies if policy explicitly effective.
- UI reflects backend status and never labels proposed OUV as effective.
