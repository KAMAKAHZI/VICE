# VICE OS — Institutional acceptance master | 2026-10-26
Status: CONTROLLED GAP REGISTER, NOT A CERTIFICATION. Baseline reviewed: main e725102ab4dd7786e1a71c1f771aa22ef00f404e. No production database, Netlify deploy, authenticated sessions, or independent audit were validated by this document.

## Mandatory invariants (release blocking)
- Supply: VICE 10,000,000; V4X 10,000,000; each class reserve 7,500,000 and strategic pool 2,500,000. For each class S=R+H+T+O, mutually exclusive, exact integer/fixed-point arithmetic. No double counting, negative balances, silent issuance or burn.
- Reference baseline: VICE $2; V4X $320; 1:160 *management reference*, not fair market, appraised, contractual accounting, realizable collateral or independently verified external value. Preserve explicit provenance for each valuation type.
- Transfers: sum of category deltas = 0; every movement uniquely identified, journaled, idempotent, concurrency-safe and reconciled to holder balances.
- Automatic model updates may be computed only under versioned approved methodology. Allocation/supply availability alone does not prove economic appreciation. The current distribution model is MODEL_ONLY and must remain separate from official OUV unless independently approved and evidenced.
- OUV publication: verify governance receipt, review/timelock, independent executive signatures, methodology/version, ledger, simulation, atomic compare-and-swap, replay key, append-only audit. Fail closed on missing evidence; never auto-enable server execution.
- Certificates are snapshots of canonical registry, not authority to create units; no silent rewriting of historical signed certificates.
- External verified accounts can enter *consolidated* reporting with provenance and timestamp; never into IRU-only certificates or without verification.
- Trading: exact-wick F0/F100, adjustable lookback, confirmed break/sweep/CHoCH/FVG/MTF, early arm and invalidation; no simulated quote labeled live or guaranteed performance.
- Browser must not contain privileged secrets, service-role credentials or proprietary algorithms designated server-only.

## Work packages — ordered acceptance matrix
| ID | Work package | Evidence needed to pass | Gate |
|---|---|---|---|
| A01 | Repository reconcile, protected main, review, signed artifacts, dependency/secret scans | PR history, settings export, CI runs, SHA-identified artifacts | BLOCK |
| B01 | Auth email, MFA 24-hour remembered device policy, passkeys, session refresh, desktop rate-limit, recovery | Real browser/device tests, server session logs, abuse tests | BLOCK |
| B02 | Roles, CEO/CFO separation, RLS, edge auth, crypto, key rotation, SOC webhook and incidents | Negative access tests, policy dumps, key inventory, incident drill | BLOCK |
| C01 | Supply, pools, holder allocation, double entry, reclaim, concurrency | SQL reconciliation snapshot, locking/replay tests | BLOCK |
| C02 | OUV methodology, evidence, approval, 1:160, event replay, atomic publication | Policy ID, approvals, transaction trace, rollback/replay test | BLOCK |
| C03 | Portfolio, ticker, appreciation, certificate and report synchronization | Canonical version observed consistently across UI/API/PDF | BLOCK |
| C04 | External account provenance and IRU-only isolation | Source verification, display tests, certificate negative tests | BLOCK |
| D01 | SOLACE structure, settings, repainting, historical/out-of-sample parity | Multi-symbol MTF replay, chart screenshots, parity diffs | BLOCK |
| D02 | OHLC feed, timestamp, gaps, stale data, reconnect, dedup | Provider logs, reconciliation and chaos tests | BLOCK |
| D03 | Proprietary computation isolation | Public bundle scan, server authorization/rate limits, latency tests | BLOCK |
| E01 | Certificates, identity, QR, revocation, version, ACL | Registry-to-certificate reconciliation and access tests | BLOCK |
| E02 | PDF forms, signatures, storage, version, retention, audit | E2E signing and tamper verification | BLOCK |
| E03 | Responsive UI, navigation, controls, accessibility | Desktop/mobile/browser E2E and WCAG checks | BLOCK |
| E04 | Messaging, realtime, calls, attachments | E2E media and ACL tests | BLOCK |
| F01 | Staging/prod schema parity, reversible migrations, RLS, restore | Schema diff, restore drill, migration logs | BLOCK |
| G01 | Netlify SHA parity, env, redirects, headers, callback, rollback | Deploy API ID, deployed commit, smoke and rollback results | BLOCK |
| G02 | Supabase auth, storage, edge, realtime, advisor findings | Project-scoped configuration and security advisor export | BLOCK |
| H01 | NIST CSF/800-53/800-63, OWASP ASVS/API, SOC2, ISO27001 mapping | Requirement→implementation→test→evidence→reviewer→result | BLOCK |
| H02 | Independent security, financial and operational approvals | Named reviewer, date, signed finding disposition | BLOCK |
| I01 | Final 20-report audit package, user/admin guides, release acceptance | Versioned files, evidence index, signed acceptance | BLOCK |

## Evidence rules and scoring
For criterion i, verified_i=1 only when repeatable test evidence is tied to exact commit, environment, timestamp and reviewer; otherwise 0. Score=100×SUM(weight_i×verified_i)/SUM(weight_i). Predeclare weights and applicability. No unverified percentage or certification claim. Any BLOCK row not passed prohibits institutional acceptance, regardless of score. Failures require issue IDs, owner, severity, reproduction, fix SHA and retest evidence.

## Release choreography
A repository reconciliation → B security → C financial → D trading → E staging full-suite → F independent approvals → G controlled production release → H production smoke/rollback readiness → I 20 final reports. Snapshot/backup and test restore before high-risk migrations. Do not run destructive migrations or activate financial execution on the basis of this plan.

## Required final report bundle (20)
Executive completion; architecture; security assessment; authentication; governance; financial reconciliation; OUV methodology/execution; migrations; SOLACE; market-data integrity; certificates; production deployment; backup/recovery; coverage; risk register; independent evidence index; admin manual; end-user guide; release notes; signed production acceptance.

## Existing codebase evidence (presence ≠ verification)
Relevant files: tests/vice-ouv-fixed-supply-distribution.cjs; tests/vice-ouv-atomicity-contract.cjs; tests/vice-market-data-integrity.test.cjs; tests/vice-auth-session-contract.mjs; tests/vice-solace-origin-regression.cjs; tests/vice-solace-origin-integration.cjs; .github/workflows/vice-ouv-checks.yml; .github/workflows/vice-continuous-defensive-security.yml; supabase/migrations/20261021080900_vice_ouv_append_only_ledger_reconciliation.sql; netlify/functions/ouv-final-deploy.js. Execution and environment evidence are still required.
