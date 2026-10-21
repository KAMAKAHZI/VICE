# VICE OS — Institutional Readiness Evidence Register
**Audit date:** 2026-10-21 UTC  
**Status:** OPEN — NOT CERTIFIED  
**Change-control branch:** audit/institutional-readiness-20261021

## Scope and non-negotiable controls
Protect the 10,000,000 VICE + 10,000,000 V4X finite-supply architecture; separate strategic and estate/administrative pools; preserve issuer-only ledger authorization, holder privacy, immutable audit evidence and established governance. $2/VICE and $320/V4X are **internal management reference values**, not independent FMV or realizable collateral. Distribution alone does not establish appreciation. Never bypass RLS, MFA, issuance controls or proposal execution rules to pass tests.

## Verified evidence (not inferred completion)
- GitHub main was accessible; latest observed commit bf5b8d7f7045ae558821ddc75d4024cf3b52bd94. Recheck head before merge.
- Supabase project sdsaewumabzjjvsmqqsl reachable; 71 public tables observed at 2026-10-21 14:53 UTC.
- Four ACTIVE Supabase Edge Functions observed: vice-mt5-cloud v10, vice-trading-source v1, vice-institutional v5, vice-passkey v1.
- RLS enabled on inspected public allocations, certificates, distributions, holders, iru_events and the three passkey/trusted-session tables; no RLS policies on the three latter tables (default-deny client access may be intentional).
- Supabase security advisor flagged 5 anonymous and 72 authenticated SECURITY DEFINER executable-function findings, requiring individual review. These are **findings, not proven exploits**.
- vice-passkey v1 source authenticates bearer JWT and returns capabilities with registration/authentication/transaction authorization disabled; unsupported operations return HTTP 501. No verified WebAuthn attestation/assertion implementation.
- README explicitly says production publication and real signed-in acceptance unverified. netlify.toml publishes dist/site using scripts/vice-publish-netlify.sh; _headers sets no-store and baseline security headers.

## Defect and verification register
| ID | Priority | Finding / gate | Required evidence | Status |
|---|---|---|---|---|
| AUTH-001 | P0 | No cryptographic WebAuthn verifier | Server-side challenge/origin/RP ID/signature/counter/replay/expiry tests, negative tests, independent review | OPEN |
| AUTH-002 | P0 | 24h trusted-device policy not proven | New-device, revoked-device, 24h expiry, AAL2 step-up and recovery acceptance | OPEN |
| DB-001 | P0 | 5 anon-executable SECURITY DEFINER functions | Source review, caller/permission tests, explicit allowlist or least-privilege remediation | OPEN |
| DB-002 | P0 | 72 authenticated SECURITY DEFINER advisor findings | Triage financial/governance RPCs first; adversarial authorization tests | OPEN |
| IRU-001 | P0 | Supply and holder-specific balances not reconciled | Independently reproducible immutable ledger vs counter vs reserve vs certificate reconciliation | OPEN |
| GOV-001 | P0 | Vote-to-execution and issuer authority not certified | Role, quorum, replay, idempotency, approval and rejection tests | OPEN |
| OUV-001 | P0 | Reference publication economics unverified | Provenance, source events, baseline, independent review, no unsupported appreciation | OPEN |
| PROD-001 | P0 | Exact production release/commit not attested | Production version, deploy ID, checksum, rollback, two-device signed-in test | OPEN |
| COMM-001 | P1 | Realtime messaging and calls unverified | Two-user messaging, media permissions, cross-network WebRTC | OPEN |
| UI-001 | P1 | Desktop login, chart controls, certificates and accessibility unverified | Browser/device acceptance recordings and reproducible test results | OPEN |

## Safe repair protocol
1. Record a failing test and the precise source/function/role.
2. Review caller dependencies before changing permissions; avoid revoking an intended public certificate verifier without an equivalent safe route.
3. Make minimal changes on this branch; retain migration and rollback instructions.
4. Run tests including authenticated, anonymous, cross-holder, stale-token, MFA bypass, concurrent issuance, duplicate replay and negative permissions.
5. Check security/performance advisors again, verify release identity, review deployment diff.
6. Require issuer-signed financial actions and any necessary governance approvals; an audit branch is **not** authorization to move units or publish valuations.
7. Promote only after CI, independent review, production acceptance and recovery tests. Do not describe any score as 100/100 until every gate has linked evidence.

## Blocked observations
Requests to retrieve database function definitions and selected financial schemas were blocked by tool safety checks. Do not mark them audited. No ledger mutations, production deploy, or passkey feature enablement occurred in this phase.

## Acceptance scoreboard
Score categories only with objective artifacts: frontend 10, auth 15, database 15, IRU 15, governance 10, OUV/portfolio 10, certificates 5, comms/trading 5, deployment/recovery 10, tests/evidence 5. **Current verified score: NOT ASSESSED**; do not interpolate from counts of deployed resources.
