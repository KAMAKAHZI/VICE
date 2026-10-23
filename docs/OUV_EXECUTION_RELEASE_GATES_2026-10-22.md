# OUV execution gate — verified production snapshot (2026-10-22)

Proposal: `PROP-20261019-548A9057-34F`
Payload SHA-256: `3f108d0483466f24b62efce207086110a3b76e70d8198dc7135ec0f2068742ae`
Baseline: VICE 2.00; V4X 320.00.
Proposed: VICE 2.82645403; V4X 452.2326448 (1:160).
These are internal management reference values, **not independent fair market values**.

## Read-only verification

The database query on 2026-10-22 confirmed `status=REVIEW`, `validation_issues=[]`, `validation_until=2026-10-22T21:47:27.619334Z`, `execute_after=NULL`, `quorum_verified_at=NULL`. Earlier inspection confirmed `ouv_versions` empty. No OUV has been executed.

## Mandatory release gates

1. Validate exact proposal payload hash and 2 distinct authorized executive roles (CEO and CFO) with verified approvals matching the hash; no second signatures required.
2. Enforce **60 minutes after final verified executive approval** only if the governing policy has validly adopted this duration for this proposal. Do not silently rewrite historical approvals or retroactively override an existing policy.
3. Respect the existing public review window. Do not execute before `validation_until`.
4. Resolve the on-chain quorum requirement according to the governing policy: verify quorum or document an authorized governance amendment; do **not** fabricate `quorum_verified_at`.
5. Replace the unconditional `STRUCTURAL_EXECUTOR_LOCKED` gate only after an atomic, authorized executor is reviewed and tested.
6. Execute in one database transaction: lock proposal; recheck gates, hash, expected baseline and 1:160 ratio; write exactly one version and immutable execution receipt; mark executed; rollback on any failure.
7. Never modify holder unit quantities or token supply. Portfolio value = VICE units × 2.82645403 + V4X units × 452.2326448.
8. After commit, invalidate caches and refresh holdings, dashboard, ticker, certificates and registry from the same effective OUV record. Show the effective date and distinguish management references from independent valuations.
9. Test unauthorized callers, premature review, mismatched hash, duplicate execution, concurrent execution, baseline drift, and full rollback.
10. Deploy only after staging tests and evidence. The existing Netlify function is fail-closed and **not** an executor.

## Critical precision note

`452.2326448 / 2.82645403` is approximately 160, not necessarily **exactly** 160 at arbitrary precision because values are rounded independently. Define a documented rounding tolerance or derive one from the other; do not require exact numeric equality without accounting for rounding.
