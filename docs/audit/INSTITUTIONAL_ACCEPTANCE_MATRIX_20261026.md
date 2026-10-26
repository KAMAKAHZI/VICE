# VICE OS — Institutional Acceptance Matrix v1 (Evidence-Gated)

Status: BASELINE / NOT PRODUCTION ACCEPTANCE. Scope: directive Sections 5–16, as provided October 26, 2026. Source baseline: `docs/production-repair/acceptance-matrix.md`, `docs/audit/INTEGRATION_GATES_2026-10-23.md`, `docs/release/FULL_APP_CONSOLIDATION_20261025.md`. These are historical repository records, not freshly rerun tests.

**Scoring:** A criterion earns its assigned weight only when the named environment, commit, timestamp, reviewer and test evidence prove acceptance. PARTIAL, code present, historical scoped PASS, or UNVERIFIED earn zero until current acceptance is confirmed. No overall percentage is claimed from this initial inventory.

| ID | Domain | Acceptance criterion | Existing evidence / gap | State | Weight | Next proof required |
|---|---|---|---|---|---:|---|
| FIN-01 | Supply | Both classes reconcile exactly to 10M each; 75/25 pools and disjoint R/H/T/O | Historical scoped holder correction only | UNVERIFIED | 5 | Full read-only ledger and reserve reconciliation |
| FIN-02 | Transfers | Conservation, no negative or double allocation, exact arithmetic, concurrency | Prior correction scoped PASS; global matrix missing | PARTIAL | 5 | Staging concurrent transaction tests |
| FIN-03 | Valuation | $2/$320 management references and 1:160, independently distinct value categories | OUV reference contract tests exist; current-head run not verified | PARTIAL | 4 | Current commit test and UI/report trace |
| FIN-04 | OUV method | Versioned approved inputs; no scarcity-to-FMV inference; evidence and audit | Existing integration gate blocks premature activation | PARTIAL | 5 | Methodology approval and calculation fixtures |
| FIN-05 | OUV execution | Signature, governance, atomicity, replay and certificate sync | Candidate gates exist; staging and production proof outstanding | BLOCKED | 6 | Staging executor and authorization evidence |
| FIN-06 | External assets | Verified source and separate reporting, excluded from IRU certificates | No verified current E2E evidence | UNVERIFIED | 2 | Staging account provenance and report tests |
| SEC-01 | Authentication | Login persistence, logout, recovery, passkeys, 24-hour routine MFA and sensitive step-up | Prior acceptance matrix flags login/recovery UNVERIFIED | UNVERIFIED | 6 | Real browser/device authenticated tests |
| SEC-02 | CEO authorization | CEO root, independent CFO/board boundary, no self-promotion | Policy/inventory drafted; action-bound ROLE_ASSIGN missing | BLOCKED | 5 | MFA-bound staging role matrix |
| SEC-03 | Data security | RLS, storage, realtime, secret isolation and audit integrity | Historical partial RLS; full role matrix missing | PARTIAL | 5 | Staging adversarial matrix and advisors |
| TRA-01 | SOLACE | Exact wick F0/F100, adjustable lookback, sweeps, CHoCH, FVG, causal signals | Historical partial signal/fractal tests | PARTIAL | 5 | Multi-symbol replay and repaint matrix |
| TRA-02 | Data | Genuine OHLC, freshness, timestamp, duplicates, reconnection | Historical one-provider test; other symbols unverified | PARTIAL | 4 | Provider integration and outage tests |
| TRA-03 | IP isolation | Proprietary calculation protected server-side, parity tests | No current production asset proof | UNVERIFIED | 3 | Bundle inspection and algorithm parity |
| DOC-01 | Certificates | Registry-backed issuance, QR, revocation, downloads, versions | Historical scoped QR verification; issuance/download unverified | PARTIAL | 4 | Two-user end-to-end issuance and revoke |
| DOC-02 | Documents | Private library, PDF edit, signature workflow, retention | Signature requests previously NOT IMPLEMENTED | BLOCKED | 3 | Full staging document-signing E2E |
| APP-01 | Frontend | Responsive navigation, home, portfolio, ticker, accessibility | Historical scoped chart drag PASS; many modules unverified | PARTIAL | 4 | Browser/device accessibility and functional tests |
| DB-01 | Database | Migration parity, constraints, RLS, rollback and restoration | Consolidation marked integration incomplete | BLOCKED | 5 | Staging schema diff, backup/restore drill |
| INF-01 | GitHub | Branch protection, CI, scanning, signed/reproducible release | OUV workflow updated; current run unverified | PARTIAL | 4 | Required checks and exact SHA run evidence |
| INF-02 | Netlify | Correct commit, environment, headers, callbacks, assets | No verified current deployment evidence | UNVERIFIED | 4 | Production build and endpoint verification |
| INF-03 | Supabase | Auth, functions, storage, advisors, backup and restore | Historical partial read-only reviews | PARTIAL | 4 | Staging+prod configuration and advisors |
| AUD-01 | Assurance | Control mapping, independent reviewer, evidence index | No external audit established | BLOCKED | 5 | Control-by-control evidence review |
| QA-01 | Tests | Security, finance, application and infra CI; defect tracking | No verified current-head full-suite run | UNVERIFIED | 5 | Exact SHA test logs and defect ledger |
| REL-01 | Release | Staging, review, approved production, smoke and rollback | Historical consolidation NOT APPROVED | BLOCKED | 5 | Signed release acceptance and production checks |
| OPS-01 | Deliverables | All 20 required reports with environment/SHA/time/evidence | Not all reports verified | UNVERIFIED | 2 | Deliverable index and artifact checks |

## Defect register (initial)
| Defect | Priority | Evidence | Closure test |
|---|---|---|---|
| CEO-001: role delegation lacks action-bound MFA | P0 | `docs/security/ROLE_DELEGATION_ACTION_BOUND_MFA_GAP_2026-10-25.md` | Fresh ROLE_ASSIGN proof bound to actor/target/role/reason, consumed once atomically |
| OUV-001: institutional executor acceptance missing | P0 | `docs/audit/INTEGRATION_GATES_2026-10-23.md` | Audited staging atomicity, governance and replay suite |
| AUTH-001: real-client login/session persistence unverified | P0 | `docs/production-repair/acceptance-matrix.md` | Real sign-in, refresh, desktop/mobile, revoke and recovery |
| DB-001: migration parity and restore evidence missing | P0 | `docs/release/FULL_APP_CONSOLIDATION_20261025.md` | Staging diff and restore drill |
| DOC-001: signature request workflow incomplete | P1 | `docs/production-repair/acceptance-matrix.md` | Authenticated request, sign, verify, retention tests |
| DATA-001: live provider multi-symbol integrity unverified | P1 | `docs/production-repair/acceptance-matrix.md` | Freshness, gap, failover, source timestamp tests |

## Release rule
No claim of 100% readiness, security certification, financial appraisal or deployment without exact-commit test evidence and required independent approval. Do not alter existing management references or financial balances in the name of acceptance.
