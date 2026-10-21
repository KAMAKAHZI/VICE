# VICE OS Phase 0 / Institutional Readiness Tracker
Updated: 2026-10-21
Branch: fix/phase0-hardening
Policy: OPEN/BLOCKED/UNVERIFIED are not PASS. Production operations require Caasi's fresh MFA approval.

| ID | Workstream | Package | Priority | Status | Depends on | Owner | Evidence | Score criterion |
|---|---|---|---|---|---|---|---|---|
| FIX-0 | Directive persistence | Phase 0 | P0 | IN-PROGRESS | Exact v2.1 directive text | agent | User directive in conversation; AGENTS.md pending | testing/evidence |
| FIX-1 | Review PR #9 test expectations | Phase 0 | P0 | OPEN | FIX-0 | agent | PR #9 | testing/evidence |
| FIX-2 | Edge function provenance and drift | Phase 0 | P0 | BLOCKED | Supabase CLI access for vice-passkey source | agent/Caasi | Source absent from git; fail-closed function | deployment |
| FIX-3 | Browser diagnostics and readiness | Phase 0 | P0 | OPEN | FIX-1 | agent | tests/vice-institutional-browser.mjs | testing/evidence |
| FIX-4 | IndexedDB and enrollment | Phase 0 | P0 | IN-PROGRESS | FIX-3 | agent | 013b255, af3cf2a, 423cecb, 8b038ec; institutional browser passed run 39679133289; direct application abort tests still needed | auth/session |
| FIX-5 | Accessible persistent error toasts | Phase 0 | P1 | OPEN | FIX-3 | agent | index.html | frontend |
| FIX-6 | Strict test section markers | Phase 0 | P1 | PASS | FIX-1 | agent | 7152dad: regression tests; release integrity run 39677635671 passed | testing/evidence |
| FIX-7 | CI and supply chain | Phase 0 | P0 | IN-PROGRESS | FIX-6 | agent | 14aab81, 6d906d9, 62a3ee3: expanded CI triggers; acceptance run 39679133289 PASS; supply-chain pinning pending | testing/evidence |
| FIX-8 | Evidence registers and score | Phase 0 | P0 | OPEN | FIX-7 | agent | docs/audit/ | testing/evidence |
| FIX-9 | Phase 0 review and handoff | Phase 0 | P0 | OPEN | FIX-0 through FIX-8 | agent/Caasi | Pending | deployment |
| PKG-01 | Baseline code audit | Post-Phase 0 | P0 | OPEN | Phase 0 complete | agent/Caasi/counsel/auditor | Pending | evidence-linked category |
| PKG-02 | Auth and sessions | Post-Phase 0 | P0 | OPEN | Phase 0 complete | agent/Caasi/counsel/auditor | Pending | evidence-linked category |
| PKG-03 | Passkeys and 24-hour trust | Post-Phase 0 | P0 | OPEN | Phase 0 complete | agent/Caasi/counsel/auditor | Pending | evidence-linked category |
| PKG-04 | Database authorization | Post-Phase 0 | P0 | OPEN | Phase 0 complete | agent/Caasi/counsel/auditor | Pending | evidence-linked category |
| PKG-05 | IRU ledger and holder corrections | Post-Phase 0 | P0 | OPEN | Phase 0 complete | agent/Caasi/counsel/auditor | Pending | evidence-linked category |
| PKG-06 | Reconciliation and certificates | Post-Phase 0 | P0 | OPEN | Phase 0 complete | agent/Caasi/counsel/auditor | Pending | evidence-linked category |
| PKG-07 | Governance | Post-Phase 0 | P0 | OPEN | Phase 0 complete | agent/Caasi/counsel/auditor | Pending | evidence-linked category |
| PKG-08 | OUV and distributions | Post-Phase 0 | P0 | OPEN | Phase 0 complete | agent/Caasi/counsel/auditor | Pending | evidence-linked category |
| PKG-09 | Documents and e-signatures | Post-Phase 0 | P1 | OPEN | Phase 0 complete | agent/Caasi/counsel/auditor | Pending | evidence-linked category |
| PKG-10 | Realtime comms and trading | Post-Phase 0 | P1 | OPEN | Phase 0 complete | agent/Caasi/counsel/auditor | Pending | evidence-linked category |
| PKG-11 | Academy UI and accessibility | Post-Phase 0 | P1 | OPEN | Phase 0 complete | agent/Caasi/counsel/auditor | Pending | evidence-linked category |
| PKG-12 | Performance | Post-Phase 0 | P1 | OPEN | Phase 0 complete | agent/Caasi/counsel/auditor | Pending | evidence-linked category |
| PKG-13 | Security and compliance | Post-Phase 0 | P1 | OPEN | Phase 0 complete | agent/Caasi/counsel/auditor | Pending | evidence-linked category |
| PKG-14 | Business continuity and recovery | Post-Phase 0 | P1 | OPEN | Phase 0 complete | agent/Caasi/counsel/auditor | Pending | evidence-linked category |
| PKG-15 | Release and deployment verification | Post-Phase 0 | P1 | OPEN | Phase 0 complete | agent/Caasi/counsel/auditor | Pending | evidence-linked category |
| PKG-16 | Auditor documentation | Post-Phase 0 | P1 | OPEN | Phase 0 complete | agent/Caasi/counsel/auditor | Pending | evidence-linked category |

## Blockers
- FIX-0: Commit exact directive text unchanged, not a paraphrase. CLAUDE.md must contain exactly `@AGENTS.md`.
- FIX-2: Caasi must provide Supabase CLI authorization or download deployed source using `supabase functions download vice-passkey --project-ref sdsaewumabzjjvsmqqsl`. Keep the boundary test's current SKIP until source is committed.
- No production writes, merge, deploy, secrets or financial corrections are authorized by this tracker.
