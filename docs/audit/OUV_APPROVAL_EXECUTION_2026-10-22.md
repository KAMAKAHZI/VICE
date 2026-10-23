# VICE OS — October 22 OUV proposal: verified approvals vs. execution

**Evidence captured:** 2026-10-22 around 13:40–13:49 UTC (09:40–09:49 EDT).  
**Source:** Read-only queries of connected Supabase project `sdsaewumabzjjvsmqqsl`, inspection of live `pg_get_functiondef` for activation, pricing, and governance checks.  
**Proposal:** `PROP-20261019-548A9057-34F`.  
**Decision:** APPROVALS VERIFIED; OFFICIAL REVISION **NOT EXECUTED**; DO NOT SUBSTITUTE PROPOSED VALUES IN OFFICIAL CERTIFICATES OR PORTFOLIOS.

## Actual live values and verified approvals

| Observation | Read-only finding |
| --- | --- |
| CEO approval | Present, verified authenticator/2FA authorization recorded 2026-10-21 02:24:48 UTC |
| CFO approval | Present, verified device signature recorded 2026-10-19 23:33:18 UTC |
| Proposal hash | Both role authorizations matched the proposal's current payload hash; no stale-hash authorizations found |
| Status | `REVIEW` |
| Validation issues | Empty list |
| Review window | Published 2026-10-19 21:47:27 UTC; ends **2026-10-22 21:47:27 UTC = 5:47:27 PM EDT October 22** |
| Independent on-chain quorum | `quorum_verified_at = NULL` |
| Execution timelock | `execute_after = NULL` |
| Official VICE / V4X | **$2.00000000 / $320.00000000** management references, unchanged since 2026-10-12 |
| Proposal VICE / V4X | **$2.82645403 / $452.23264480**, review-only, maintaining 1:160 ratio |
| Ledger reconciliation | Read-only `vice_private.ouv_release_reconciliation()` reports `ledger_reconciled=true`, event validity true, official 1:160 and baseline match true |
| Fixed supply | 10,000,000 VICE and 10,000,000 V4X; finite-supply check is not independent valuation |

**The calendar date October 22 is not the activation timestamp.** Public review is open until precisely 5:47:27 PM EDT. Two executives have authorized the proposal; no further duplicate signature should be requested.

## Root cause: controlled backend is intentionally fail-closed

- The deployed `public.vice_ouv_activation_readiness(text)` counts CEO and CFO device signatures **plus** properly scoped MFA approvals by proposal payload hash. Two valid authorizations are present, so an absent vote is **not** the cause.
- That same function **always** includes `ONCHAIN_QUORUM_VERIFIER_NOT_CONFIGURED` and `ATOMIC_GOVERNANCE_EXECUTOR_NOT_CONFIGURED`; it returns `can_apply=false` and `official_ouv_changed=false`. A completed review window alone cannot change the price.
- The deployed `public.vice_sovereign_check(text)` logs a blocked attempt, unconditionally includes `STRUCTURAL_EXECUTOR_LOCKED`, and reports `prices_changed=false`. **Do not call it to try to force a price update** or fabricate quorum.
- The deployed `public.vice_set_dao_prices` explicitly rejects VICE amounts other than $2 and V4X amounts other than $320 until a separate governance-approved reference-policy migration is reviewed.
- `public.ouv_versions` was empty at inspection; the canonical `public.vice_dao_config` is the live source and remains $2/$320.
- The governing distribution model remains `MODEL_ONLY`. Distributions and a vote by themselves do not establish appraised fair market value, realizable collateral or a market-clearing reference price.

## User interface repair in PR #10

- `vice4x-institutional.js` now obtains the read-only `vice_ouv_activation_readiness` result for the latest active proposal as part of normal 45-second governance refresh, displays CEO/CFO 2-of-2 approval without asking for duplicate votes, the review close time in **America/New_York**, and the actual remaining *server* gates. Backend verification failures show as unverified rather than silently claiming execution.
- `index.html` member governance shows the same exact review time and clearly separates canonical **current issuer OUV** (when verified), historical proposal baseline and **proposed, not effective** target.
- Neither frontend can mint units, set official values, create approval records or reissue historical certificates. This improves truthful synchronization and visibility; it does **not** itself execute the financial amendment.
- Regression fixture `tests/vice-institutional-browser.mjs` verifies that 2/2 executive approvals appear in the UI while actual official OUV remains unchanged and the read-only backend is consulted.

## Required for a legitimate activation release

1. Obtain and preserve formal governance requirements, source-of-value rationale, independent on-chain quorum verification and relevant holder protection/legal reviews. Existing executive approvals should remain intact and be reused *only if still applicable* to the immutable proposal payload.
2. Deploy, audit and verify an independent on-chain quorum verifier tied to the specific approved proposal hash and a distinct timelock commencement event. A publication date or executive signature is not an invented on-chain attestation.
3. Build an atomic server-side execution transaction that rechecks proposal status, public-review expiry, verified quorum, completed 72-hour timelock, proposal-hash-bound CEO/CFO approvals, ledger reconciliation, latest canonical baseline and signed value policy before modifying a reference. Record the exact before/after values, actor, event and effective timestamp in an immutable audit trail. Reject stale, repeated and partially effective executions.
4. Include a separately authorized policy migration replacing the $2/$320 setter restriction where strictly warranted. Preserve 20M unit supply; changing reference metadata must not change issued unit counts. Reissue any value-bearing current certificates through a separate auditable process rather than modifying signed historical PDFs.
5. Test staging rollback, cross-role denials, idempotency, ledger reconciliation, independently reviewed calculation and actual desktop/mobile issuer display refresh. Secure written owner approval for production migration/Edge Function deployment/execution.

**No live Supabase write, pricing change, issuance, governance vote, or Netlify production deploy was performed during this investigation.** This is not independent valuation or a certified audit.
