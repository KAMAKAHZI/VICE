# VICE OS / Release Verification Report

Internal engineering • 2026-10-16 UTC • 1.3.8.0-IRU-CERTIFICATES

The preserved application has a published repair release. The complete institutional specification has not passed acceptance. The acceptance matrix identifies each criterion and the limits of its evidence.

## A. Release identity

- Production URL: https://vice4x.netlify.app
- Target version: `1.3.8.0-IRU-CERTIFICATES`.
- Repair baseline: `9b681f00b0a593d7b47de2498af32ddf0a939fc5`.
- Latest main incorporated: `e9833fd6cce11deb5d010c2424e8fd6a5c4dcc57`, including desktop clock/refresh-storm safeguards and local-device logout.
- Verified code checkpoint: `d3db4fa76e4a2418cc8530b37742f654effed47f`.
- Hosted acceptance: [38979407975](https://github.com/KAMAKAHZI/VICE/actions/runs/38979407975).

Production commit: `7bad15c8d0cf7794cf3006d0e0ab0c8fd3f2e3ff`. Netlify deployment: `6ad2ae611060b4c67beb42d5`. Published: `2026-10-16T23:11:11.920Z`. The read-only provider API confirms production/main, ready state, this exact commit and one deployment for this commit. Version text alone does not identify a repair.

## B. Repairs implemented

| Subsystem | Root cause and correction | Principal files |
|---|---|---|
| Authentication | Coalesce duplicate initialization, reject stale hydration, isolate member caches/media/wallet, preserve synchronization on failed logout and retain the view mount. Incorporated newer main clock/refresh-storm protection and local signout. | index.html |
| Profiles | Previously implied success despite returned backend errors. Allowlisted fields, confirmed writes, avatar MIME/size limits and stale-upload rejection now precede success. | index.html |
| Messaging | Oldest history window, envelope overflow and private-profile recipient lookups caused failures. Latest-200 ordered/deduplicated history, confirmed sends, draft preservation, size checks and a private membership helper repair these paths. | index.html; 20261015132937 migration |
| Calls | Global broadcast was unsuitable for private SDP/ICE. Signaling now uses RLS-scoped DM rows, database sender identity, call ID/age validation and bounded ICE. Camera/screen sender replacement and cleanup added. | index.html |
| Market data | Browser Yahoo access bypassed the proxy; invalid prices and outage-generated candles were accepted. Same-origin routing, OHLC validation, request/session guards and a clear unavailable state replace those failures. | index.html; netlify/functions/yahoo.js |
| Charts | Missing mouse/vertical pan and null latest-index handling prevented usable dragging. Pointer capture, body/axis dragging, wheel/pinch/keyboard zoom and persistent candle count added. Floating chart helpers moved to toolbar. | index.html |
| SOLACE fractals | Rendering only the latest 200 pivots lost markers in older history. Confirmed fractals retain pivot/confirmation indices and use viewport coordinates across loaded history. | index.html |
| Wallet initialization | Optional library readiness rerendered unrelated charts/forms. Refresh now targets only affected wallet-related views. | index.html |
| PDF forms | Added real AcroForm text/date, checkbox and choice editing, profile autofill, export and private new-copy save. Original, read-only and signature content protected; XFA refused. | vice-mega.js |
| IRU correction | Added exact-source, issuer-authorized, idempotent transaction with balance/counter reconciliation, append-only correction/audit records and certificate revocation. Restricted database-operator path records actual operator identity. | index.html; 20261015140648 migration |
| Certificate privacy | Public verification exposed identities, holdings snapshots and revocation notes. Strict status/integrity allowlist now excludes those details; authenticated owner/issuer access remains. | verify.html; 20261015190802 migration |
| Academy | Browser-only reading marks and missing completion gates allowed incomplete qualification. Added owner-scoped backend receipts, confirmed UI writes, stale-response and duplicate-submit guards, 21-chapter/seven-assessment checks and idempotent active awards. | index.html; 20261015193846 migration |
| Deployment/docs | Native Netlify remains primary; manual CLI avoids a second build. Exact-asset/public-browser checks and eleven operational guides document actual behavior. | workflows; tests; guide.html; docs/production-repair |

Full changed-file inventory and dependencies are in dependency-inventory.json; issue-level verification is in repair-ledger.md. No private holder identifiers, credentials or real financial receipt details are published here.

## C. Test results

Hosted acceptance at the verified code checkpoint:

| Test category | Passed | Failed | Skipped | Scope |
|---|---:|---:|---:|---|
| Behavioral unit tests | 35 | 0 | 0 | 11 core, 3 PDF, 7 calls, 2 IRU replay, 1 asset matcher, 4 Academy, 4 chart, 2 fractal, 1 wallet |
| Legacy contract/static suites | 7 | 0 | 0 | Includes six mocked TURN outcomes; separate from unit total |
| Live read-only backend checks | 20 | 0 | 0 | Auth availability, anonymous record isolation and denied/unknown RPC cases |
| Isolated PostgreSQL 17 suites | 4 | 0 | 0 | DM/media ACL; issuance reversal; public certificate privacy; Academy receipts/awards |
| Browser viewport runs | 2 | 0 | 0 | 1440×900 and 390×844; public login UI, empty validation, modal/layout, SIM chart gestures and every navigation render |
| Public-root package/build | 1 | 0 | 0 | Exactly 11 whitelisted files; backend/internal sources excluded |

Unit tests and backend checks total 55 individually reported cases. Suite-level SQL assertions, browser scenarios and six TURN subcases are deliberately not added to that count. Required workflows without supplied real-user/provider acceptance are marked UNVERIFIED in the matrix; they are not disguised as skipped passing tests.

The mobile test initially identified O.I. covering the price axis. The next run exposed a wallet-readiness redraw detaching the canvas. Both defects were corrected before the passing run. The production asset matcher permits only the specifically observed Netlify member-guide anchor rewrite; altered JavaScript or other content is rejected.

No real-user password, invitation redemption, two-party call, broker order or production financial test allocation was used. Explicit SIM navigation validates rendering, not live workflows. Actual authorized corrections are operational actions and are not test fixtures.

## D. Database and security assessment

Live metadata verified October 15: 51 public tables, all with RLS; two private Storage buckets; 42 applied migrations. Four repair migrations were tested in disposable PostgreSQL before installation. The historical migration archive is not certified as a fresh Supabase bootstrap.

Member/financial write protections remain enabled. Anonymous privacy checks pass. Correction transactions preserve source events and certificates, revoke mistaken certificates, append audit records and leave estate reserve tables unchanged. The separately authorized live correction was verified on October 15 with exact before/after deltas, total reconciliation and preservation of all other holders. Private details remain in the database.

Complete authenticated role-matrix, real upload/download isolation, independent dependency and CSP reviews remain open. Legacy message keys are predictably derived and are not E2EE. Supabase reports disabled leaked-password protection plus definer-function exposure and RLS/no-direct-policy findings. The [Security Operations Guide](./05-security-operations.md) links each advisor explanation; these findings have not been concealed by weakening policies.

## E. Operational readiness

| Capability | Evidence and limit |
|---|---|
| Database/Auth gateway | Live read-only API checks pass. Real login, recovery, invitation and browser restart remain unverified. |
| Realtime/messages | Private recipient policy staged; client transport tests pass. Actual two-member delivery, attachments and reconnect behavior not accepted. |
| Calls | Seven mocked transport/media cases pass. TURN returned HTTP 503 on prior production smoke; relay configuration and separate-network calls remain open. |
| Market data | Production Yahoo EURUSD hourly request returned 526 genuine provider candles on October 15 at 19:03:33Z. Other instruments, entitlements and ongoing feed availability are separate. |
| IRU certificates | Backend privacy and correction revocation verified. Owner download and automatic issuance from every qualifying event need authenticated E2E. |
| Documents | Three PDF field export/reload cases pass. Private storage-save and signing workflows need real authenticated acceptance. |
| Academy | Progress and award gates passed SQL/client tests and are installed. Existing device-only marks must be reconfirmed; live cross-device E2E remains open. |
| Monitoring | Scheduled public production smoke and backend acceptance workflows exist. They do not replace authenticated/provider monitoring. |

## F. Outstanding dependencies and unfinished implementation

Genuine external dependencies: reachable TURN relay with TURN_URLS/TURN_SHARED_SECRET; SFU infrastructure for multiparty conferencing; configured MetaApi/broker account and authorized sandbox credentials; private transactional email worker/provider receipts; authorized real-user staging accounts for browser acceptance; signing-provider credentials/license if that integration is selected. No paid provider or infrastructure was purchased.

Independent implementation gaps remain: durable message receipts/editing/deletion/search/channel administration/mentions; complete media device selection; full SOLACE stochastic/slowing/MTF/risk qualification and broker/backtesting acceptance; linked document versions, arbitrary PDF content editing and multi-signer request/sequence/reminder workflows; full Academy video/instructor/tier catalog management; comprehensive dependency/CSP and role-matrix security acceptance. These are unfinished features, not credential excuses. The complete original specification is not certified complete.

Repository visibility remains unchanged. Conversion to private requires verification of GitHub administration access and Netlify private-repository access; publication must remain functional.

## G. Production verification

The first repair release was verified at commit `d3131e949784a42ced527f64209f15b29bb4773f`, Netlify deployment `6ad0df4b8bc8ef6d1bdad909`, published 2026-10-15T14:12:39.327Z. Production smoke [38790669788](https://github.com/KAMAKAHZI/VICE/actions/runs/38790669788) passed nine public asset comparisons and desktop/mobile public UI checks after allowing the precisely verified Netlify guide-link serialization. Newer authentication work on main is preserved in the current candidate.

The final native production deployment is `6ad2ae611060b4c67beb42d5`, source `7bad15c8d0cf7794cf3006d0e0ab0c8fd3f2e3ff`, created 2026-10-16T23:08:17.616Z and published 2026-10-16T23:11:11.920Z. The provider reports ready and one deployment for this source. CLI publishing was not dispatched. A first smoke attempt correctly failed exact-asset comparison while the native build was still running; only the read-only smoke job was rerun after publication. No successful build or commit is being treated as complete application acceptance.

A read-only October 16 recheck confirmed that the separately authorized strategic correction remains recorded twice and both Estate/Admin Reserve books remain at their designated 7,500,000 quantities. Original records are retained.

### Final production result — verified

Production smoke [38979778664, attempt 2](https://github.com/KAMAKAHZI/VICE/actions/runs/38979778664/attempts/2) passed on the deployed source. At 2026-10-16T23:11:53Z all nine public assets matched, allowing only the specifically verified Netlify guide-anchor transformation. The application, member guide, verification page, JavaScript and manifest returned HTTP 200. The live version is `1.3.8.0-IRU-CERTIFICATES`.

Published desktop (1440×900) and mobile (390×844) public-browser checks passed at 23:12:20Z and 23:12:23Z, with no page errors in their tested login UI, empty validation, modal and layout scenarios. The backend acceptance workflow on this final source also passed. This is public-browser smoke acceptance, not a successful authenticated member login claim.

The TURN credential route still reports HTTP 503 for missing operator relay configuration. Real-user authentication/recovery, two-member communications, private document workflows and other limitations above remain unverified or incomplete. Production publication is complete; full institutional acceptance is not.

This report update changes documentation only and uses [skip netlify], preserving the single production deployment for the verified release.
