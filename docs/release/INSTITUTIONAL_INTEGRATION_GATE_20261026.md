# VICE OS — Consolidated Institutional Release Gate
Date: 2026-10-26
Base: main @ e725102ab4dd7786e1a71c1f771aa22ef00f404e
Status: INTEGRATION PLANNING ONLY — NOT RELEASE APPROVAL

## Source PRs
- #42 24h MFA and passkeys: draft; backend trust/attestation missing.
- #41 SOC PostgreSQL ingress: draft; production privileged RPC remains a blocker.
- #38 Ed25519 governance evidence: read-only verifier; trusted key registry and integration missing.
- #19 chart market-data integrity: draft; live-feed/UI integration missing.
- #18 SOLACE IP isolation: draft; browser logic remains exposed.
- #11 OUV conditional execution: draft; migrations, signatures and staged authorization unverified.
- #8 executive 2FA and certificate export: draft; device-level and production validation outstanding.

## Integration order and release acceptance
1. Rebase each source change onto current main in a separate temporary branch. Do not blindly combine outdated HTML, SQL migrations, or authorization handlers.
2. Authentication: trusted-device server-side expiry <=24h, passkey assertion validation with challenge binding, step-up for high-risk actions, recovery revocation, anti-replay, physical iOS/Android/desktop acceptance.
3. Privilege: remove/replace privileged role assignment paths lacking action-bound MFA; enforce RLS, least privilege, audit trail, negative authorization tests.
4. Governance: trusted public-key registry, 2-of-N verification with key rotation/revocation, proposal binding, nonce/timelock/quorum, transactional idempotency and rollback.
5. OUV: independent finite-supply calculations, reconciliation to ledger and holder certificates; reference values must not be represented as independent fair-market value. No automatic financial execution without independently authorized policy and tested migrations.
6. Market data: validated provider candles, stale-data blocking, reconnect/replay, timezone and symbol integrity, chart UX tests.
7. SOLACE: relocate proprietary compute away from browser, server authorization, parity and latency tests.
8. Staging: production-equivalent schema-only parity, security advisors, restore rehearsal, end-to-end login, certificate and communications tests.
9. CI: require green checks on exact final integration SHA; no skipped required tests; release artifact integrity and rollback evidence.
10. Deployment: require designated human approval; compare Netlify deployed commit with tested SHA and run smoke tests. No production deployment from this document.

## Non-negotiable release blockers
- Unreviewed SQL or auth migration
- Production/staging schema divergence
- Incomplete physical-device MFA/passkey acceptance
- Unverified governance signature or OUV transaction
- Exposed privileged API or proprietary algorithm
- Failed or missing required checks

## Evidence log (fill with actual URLs and timestamps)
| Gate | Result | Evidence |
|---|---|---|
| Staging parity | NOT VERIFIED | |
| Auth/passkeys | NOT VERIFIED | |
| Privileged RPC | NOT VERIFIED | |
| Governance evidence | NOT VERIFIED | |
| OUV atomicity | NOT VERIFIED | |
| SOLACE isolation | NOT VERIFIED | |
| Live market data | NOT VERIFIED | |
| Final CI at integration SHA | NOT VERIFIED | |
| Netlify production commit | NOT VERIFIED | |
| Rollback rehearsal | NOT VERIFIED | |

This document is an engineering integration checklist, not proof that any source PR has been merged, deployed or certified.
