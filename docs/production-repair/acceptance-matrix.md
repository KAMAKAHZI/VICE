# VICE OS / Acceptance matrix

Every criterion below refers to the supplied release specification. PARTIAL is not acceptance. No real financial test records were created; separately authorized corrections are recorded as operational changes.

| Area | Criterion | Status | Evidence or next verification |
|---|---|---|---|
| Authentication | Valid login works | UNVERIFIED | Requires authenticated staging/browser or provider test; no passing workflow claim. |
| Authentication | Sessions persist | UNVERIFIED | Requires authenticated staging/browser or provider test; no passing workflow claim. |
| Authentication | Logout works | PARTIAL | Behavioral cleanup/failure tests pass; real-token revocation unverified. |
| Authentication | Account recovery works | UNVERIFIED | Requires authenticated staging/browser or provider test; no passing workflow claim. |
| Communications | Messages send | UNVERIFIED | Requires authenticated staging/browser or provider test; no passing workflow claim. |
| Communications | Messages arrive | UNVERIFIED | Requires authenticated staging/browser or provider test; no passing workflow claim. |
| Communications | Histories load | PARTIAL | Mocked latest-200 ordering/deduplication/stale-session tests pass; two-account delivery unverified. |
| Communications | Attachments work | UNVERIFIED | Requires authenticated staging/browser or provider test; no passing workflow claim. |
| Communications | Presence updates | UNVERIFIED | Requires authenticated staging/browser or provider test; no passing workflow claim. |
| Communications | Calls connect | UNVERIFIED | Requires authenticated staging/browser or provider test; no passing workflow claim. |
| Communications | Calls terminate correctly | UNVERIFIED | Requires authenticated staging/browser or provider test; no passing workflow claim. |
| Communications | Screen sharing works where supported | PARTIAL | One-to-one display-media path and stop/permission tests pass; real desktop/mobile/NAT acceptance remains unverified. |
| Trading | Charts load genuine provider data | PARTIAL | OHLC validation tests pass; live EURUSD Yahoo request returned 526 candles on October 15. Other provider/instrument coverage remains unverified. |
| Trading | Zoom works | PARTIAL | Wheel/pinch/keyboard bound tests pass. Physical mobile pinch/trackpad acceptance remains open. |
| Trading | Horizontal dragging works | PASS (scoped) | Desktop and mobile viewport browser drags pass using explicit SIM candles; time-window change asserted. |
| Trading | Vertical dragging works | PASS (scoped) | Desktop and mobile viewport browser body/price-axis drags pass; chart controls no longer covered by floating O.I. button. |
| Trading | SOLACE markers render correctly | PARTIAL | Full-history confirmed fractal rendering uses viewport coordinates; causal/prefix and known-swing tests pass. Complete visual/signal matrix unverified. |
| Trading | Signal calculations pass deterministic tests | PARTIAL | Macro prefix invariance and two confirmed-fractal tests pass; stochastic/MTF/risk qualification matrix remains incomplete. |
| Holder system | Holder records load | UNVERIFIED | Requires authenticated staging/browser or provider test; no passing workflow claim. |
| Holder system | Allocations reconcile | PASS (scoped) | Authorized direct-issuance correction reconciled exact counter deltas and holder totals; other holders/reserves preserved. Not a full historical audit. |
| Holder system | Tier classifications are correct | UNVERIFIED | Requires authenticated staging/browser or provider test; no passing workflow claim. |
| Holder system | Permissions are enforced | PARTIAL | RLS and anonymous denial verified; staged DM recipient and issuer correction authorization pass; complete role matrix untested. |
| Certificates | Verified allocations trigger eligible issuance | UNVERIFIED | Requires authenticated staging/browser or provider test; no passing workflow claim. |
| Certificates | Certificates download | UNVERIFIED | Requires authenticated staging/browser or provider test; no passing workflow claim. |
| Certificates | Verification works | PASS (scoped) | Staged valid/tampered/revoked/missing IRU cases and privacy allowlist pass; live revoked-record rejection verified. Owner download E2E unverified. |
| Certificates | Duplicate issuance is prevented | UNVERIFIED | Requires authenticated staging/browser or provider test; no passing workflow claim. |
| Documents | PDFs load | UNVERIFIED | Requires authenticated staging/browser or provider test; no passing workflow claim. |
| Documents | Supported edits save | PARTIAL | AcroForm PDF roundtrip tests pass; private save-copy path implemented but authenticated storage E2E unverified. |
| Documents | Profile autofill works | PARTIAL | Exact field-name identity/contact mapping implemented from backend profile; authenticated E2E unverified. |
| Documents | Downloads work | UNVERIFIED | Requires authenticated staging/browser or provider test; no passing workflow claim. |
| Documents | Signature requests work | NOT IMPLEMENTED | Typed-name attestation exists; requests/sequence/reminders do not. |
| Documents | Signed documents are retained | UNVERIFIED | Requires authenticated staging/browser or provider test; no passing workflow claim. |
| Academy | Courses load | PARTIAL | All navigation views render with explicit SIM fixtures at desktop/mobile sizes; live enrollment access unverified. |
| Academy | Progress persists | PARTIAL | Backend chapter receipts installed after staging; four client tests cover confirmation, denial and session isolation. Authenticated cross-device E2E unverified. |
| Academy | Assessments function | UNVERIFIED | Requires authenticated staging/browser or provider test; no passing workflow claim. |
| Academy | Eligible completion certificates issue | PARTIAL | Staged 21-chapter/seven-assessment gates and idempotent active award pass; authenticated browser issuance unverified. |
| Backend | Required RPCs exist | UNVERIFIED | Requires authenticated staging/browser or provider test; no passing workflow claim. |
| Backend | RLS tests pass | PARTIAL | 20 live read-only backend checks and four isolated PostgreSQL suites pass; complete role matrix remains untested. |
| Backend | Storage permissions work | UNVERIFIED | Requires authenticated staging/browser or provider test; no passing workflow claim. |
| Backend | Realtime permissions work | UNVERIFIED | Requires authenticated staging/browser or provider test; no passing workflow claim. |
| Backend | Audit logging works | PASS (scoped) | Actual authorized correction retained original events, appended corrections and audit receipts, and revoked associated certificates. Other action audit paths not fully tested. |
| Deployment | Production build succeeds | PASS | Strict public-root packaging and privacy test pass locally. |
| Deployment | All required assets are published | PASS | Final production smoke 38979778664 attempt 2: nine public assets match source 7bad15c; configuration files are not downloadable assets. |
| Deployment | Production version is correct | PASS | Netlify production commit 7bad15c and live 1.3.8.0-IRU-CERTIFICATES verified October 16, 23:11 UTC. |
| Deployment | No critical runtime errors remain | PARTIAL | No page errors in tested public UI and explicit SIM navigation at desktop/mobile widths. Authenticated workflows unverified. |
| Deployment | End-to-end smoke tests pass | PASS (public scope) | Final published public-browser checks pass at 1440 and 390 widths. Full authenticated/provider E2E remains unverified. |
