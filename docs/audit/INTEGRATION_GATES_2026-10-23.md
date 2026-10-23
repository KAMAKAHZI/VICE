# VICE OS — Institutional integration gates (2026-10-23)

Integration branch: `integration/institutional-ouv-20261023`. This document is a preparation checkpoint, not evidence of a merged or deployed release.

## Inputs
- PR #10: institutional hardening, authentication, passkey provenance and acceptance tests.
- PR #11: fail-closed executive OUV verification and conditional execution interface.
- Both branches diverge from main and edit overlapping institutional JS, deployment and tests. Merge requires manual review of both sets of changes.

## Mandatory safeguards
1. Keep production `main` unchanged until CI and manual acceptance pass; never force-push main.
2. Preserve original directive verbatim if available; do not invent missing `AGENTS.md` or `CLAUDE.md` content.
3. Maintain CEO/CFO role separation, cryptographic verification, immutable approval history, and fail-closed executor flags. A recorded device attestation is not automatically a verified digital signature.
4. Do not activate OUV merely because two votes exist. Recheck proposal hash, applicable policy, review window, quorum/amendment, readiness and authorization server-side.
5. The proposed internal reference values are VICE 2.82645403 and V4X 452.23264480; baseline 2 and 320. These are not independent FMV. Explicitly account for rounding in the 1:160 policy.
6. Keep 10,000,000 VICE and 10,000,000 V4X units unchanged. Recalculate display valuations from one authoritative effective OUV record, not from cached values or unit issuance.
7. Stage and test auth, cross-account isolation, SQL/RLS, WebAuthn disabled until verified, comms, portfolio, certificates, duplicate/concurrent execution and rollback.
8. No production database mutation, governance override, credential exposure, or deployment until documented evidence and required approvals exist.

## Acceptance checklist
- [ ] Reconcile PR #10 and #11 changes with code review.
- [ ] Run current-head CI and security checks.
- [ ] Independently verify executive approval provenance and applicable policy.
- [ ] Validate staging DB migrations and transaction atomicity.
- [ ] Verify real user/device acceptance and external integrations.
- [ ] Verify deployment artifacts, production smoke tests and rollback.
- [ ] Record effective OUV version and immutable receipt only if all gates pass.
