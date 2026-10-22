# VICE OS Phase 0 / Institutional Readiness Tracker
Updated: 2026-10-22
Branch: fix/phase0-hardening
Policy: OPEN/BLOCKED/UNVERIFIED are not PASS. Production operations require Caasi's fresh MFA approval.

| ID | Workstream | Package | Priority | Status | Depends on | Owner | Evidence | Score criterion |
|---|---|---|---|---|---|---|---|---|
| FIX-0 | Directive persistence | Phase 0 | P0 | IN-PROGRESS | Exact v2.1 directive text | agent | User directive in conversation; AGENTS.md pending | testing/evidence |
| FIX-1 | Review PR #9 test expectations | Phase 0 | P0 | OPEN | FIX-0 | agent | PR #9 | testing/evidence |
| FIX-2 | Edge function provenance and drift | Phase 0 | P0 | IN-PROGRESS | Automated deployed-source drift comparison | agent/Caasi | Deployed vice-passkey v1 retrieved read-only and committed unchanged as 29a8e5b; docs/audit/PASSKEY_PROVENANCE.md; verifier intentionally returns 501, no real WebAuthn activation | deployment |
| FIX-3 | Browser diagnostics and readiness | Phase 0 | P0 | IN-PROGRESS | FIX-1 | agent | 39725893463: full acceptance PASS at 1440/390, including real ECDSA signature verified by synthetic Node test server; independent production WebAuthn verifier not certified | testing/evidence |
| FIX-4 | IndexedDB and enrollment | Phase 0 | P0 | IN-PROGRESS | FIX-3 | agent | 013b255, af3cf2a, 423cecb, 8b038ec; institutional browser passed run 39679133289; direct application abort tests still needed | auth/session |
| FIX-5 | Accessible persistent error toasts | Phase 0 | P1 | PASS | FIX-3 | agent | e2931a5; acceptance runs 39722328663 and 39722324140 PASS (desktop/mobile alert keyboard + pointer dismissal) | frontend |
| FIX-6 | Strict test section markers | Phase 0 | P1 | PASS | FIX-1 | agent | 7152dad: regression tests; release integrity run 39677635671 passed | testing/evidence |
| FIX-7 | CI and supply chain | Phase 0 | P0 | IN-PROGRESS | FIX-6 | agent | b9f859b/ba32d84: immutable action SHA pins in critical workflows, lifecycle scripts disabled in acceptance; 2186aded: guard test. Lockfile, all-workflow pinning and broader SCA remain OPEN | testing/evidence |
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
- FIX-2: The deployed passkey source is now committed and its fail-closed boundary can be tested; **do not** treat the 501 placeholder as a functioning verifier. Automated deployed-source drift detection and the WebAuthn verifier are still outstanding.
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
