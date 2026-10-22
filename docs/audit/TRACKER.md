# VICE OS Phase 0 / Institutional Readiness Tracker
Updated: 2026-10-22
Branch: fix/phase0-hardening
Policy: OPEN/BLOCKED/UNVERIFIED are not PASS. Production operations require Caasi's fresh MFA approval.

| ID | Workstream | Package | Priority | Status | Depends on | Owner | Evidence | Score criterion |
|---|---|---|---|---|---|---|---|---|
| FIX-0 | Directive persistence | Phase 0 | P0 | IN-PROGRESS | Exact v2.1 directive text | agent | User directive in conversation; AGENTS.md pending | testing/evidence |
| FIX-1 | Review PR #9 test expectations | Phase 0 | P0 | OPEN | FIX-0 | agent | PR #9 | testing/evidence |
| FIX-2 | Edge function provenance and drift | Phase 0 | P0 | IN-PROGRESS | Configure read-only GitHub secret and verify scheduled run after merge | agent/Caasi | Read-only live-source byte match 2026-10-22; 3cc6ec8 baseline, 782a3e0 drift guard, 232d125 tests, 377f839 scheduled workflow. Real WebAuthn verifier remains 501/unavailable | deployment |
| FIX-3 | Browser diagnostics and readiness | Phase 0 | P0 | IN-PROGRESS | FIX-1 | agent | 39725893463: full acceptance PASS at 1440/390, including real ECDSA signature verified by synthetic Node test server; independent production WebAuthn verifier not certified | testing/evidence |
| FIX-4 | IndexedDB and enrollment | Phase 0 | P0 | IN-PROGRESS | FIX-3 | agent | 013b255, af3cf2a, 423cecb, 8b038ec; institutional browser passed run 39679133289; direct application abort tests still needed | auth/session |
| FIX-5 | Accessible persistent error toasts | Phase 0 | P1 | PASS | FIX-3 | agent | e2931a5; acceptance runs 39722328663 and 39722324140 PASS (desktop/mobile alert keyboard + pointer dismissal) | frontend |
| FIX-6 | Strict test section markers | Phase 0 | P1 | PASS | FIX-1 | agent | 7152dad: regression tests; release integrity run 39677635671 passed | testing/evidence |
| FIX-7 | CI and supply chain | Phase 0 | P0 | IN-PROGRESS | FIX-6 | agent | All 9 GitHub Action workflows SHA-pinned (checkout/setup-node/artifact/SLSA); 7365839 invariant across all workflows, 5852f32 guard-trigger; release integrity 39778801925 PASS. Dependency lockfile, container digest pinning and broader SCA remain OPEN | testing/evidence |
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
- FIX-2: Read-only drift guard is implemented but requires a scoped `SUPABASE_ACCESS_TOKEN` repository secret and a successful post-merge scheduled/live run. **Do not** treat the deployed HTTP-501 passkey placeholder as a functioning WebAuthn verifier.
- No production writes, merge, deploy, secrets or financial corrections are authorized by this tracker.

## 2026-10-22 acceptance evidence
- Head `e2931a5f76a1a3815ef0ec6c5ac5851274b1bc31`: release integrity `39722328653` PASS, Jekyll `39722328665` PASS, full PostgreSQL/browser/backend acceptance `39722328663` PASS.
- Institutional UI browser passes both 1440px and 390px; communications tests confirm two RTCPeerConnections, screen-capture stop and call cleanup using a synthetic display source; backend suite reports 20/20 PASS on the checks executed.
- These checks do **not** establish production authentication, live passkey verification, independent financial valuation, an external security certification, or readiness of all product modules. Existing SKIPs and BLOCKED items remain unchanged.

## 2026-10-22 subsequent evidence and limitations
- Institutional acceptance run `39725893463` passed with source at `e92c48f`, including the source-committed passkey boundary and the synthetic enrollment WebCrypto verification (not a live WebAuthn verification).
- `tests/vice-passkey-edge.cjs` adds executable authentication/capability/failure-mode tests on the retrieved deployed function source. Full acceptance for that latest test addition is pending at this tracker update; do not claim it PASS yet.
- Critical CI workflows are SHA-pinned and dependency lifecycle scripts are disabled in acceptance. Transitive dependency resolution remains unlocked until a reviewed `package-lock.json` is generated and CI uses `npm ci`.
- Source provenance is captured in `docs/audit/PASSKEY_PROVENANCE.md`; no live function was changed and no external assurance has been issued.

## Phase 0 latest branch checkpoint
- Full acceptance for baseline `1b4cbbba788c53562ff50c38143cf4479055f4c3` PASS: runs `39726285540` and `39726289977`; latest changes require their own fresh runs.
- All 9 workflow action references are now SHA-pinned. The integrity guard covers changes across `.github/workflows/**`; source-checked passkey deployment metadata now has a prepared Monday read-only drift workflow with fail-closed tests.
- GitHub cannot establish a functioning WebAuthn/passkey registration from these safeguards. Any independent-security certification, financial statement valuation, and complete production-readiness score remain **UNVERIFIED**.
