# VICE OS / Release Verification Report

Internal engineering • 2026-10-15 UTC • 1.3.8.0-IRU-CERTIFICATES

Target: 1.3.8.0-IRU-CERTIFICATES. Baseline: 9b681f00b0a593d7b47de2498af32ddf0a939fc5. Acceptance is NOT COMPLETE.

Implemented: session cache clearing/stale response rejection; preserved sync on failed/canceled logout; account-scoped Academy reading preferences; profile/avatars require confirmed backend updates; latest message history; encoded size guard; duplicate composer guard; call cleanup; Yahoo proxy routing/OHLC validation; exact-asset production verification; behavioral regression and public-browser test harness.

Local results before release: 11 behavioral tests passed, seven pre-existing static/contract suites passed (including six mocked TURN outcomes), package privacy passed. Initial public-backend probe: 16/17 passed; Auth health timed out locally. Browser installation in this environment failed because the downloaded Chromium archive was invalid; hosted-runner browser results are recorded separately. No authenticated E2E tests were run with real users.

Live read-only metadata: 50 public tables; zero without RLS; 38 migrations; two private storage buckets. No production data/schema mutations. Security warnings and missing features are documented in the other guides and acceptance matrix.

This is a partial production repair, not fulfillment of the ultimate production-ready specification. Missing application features are not mislabeled as credential blockers. No provider subscription or paid infrastructure was purchased. Release SHA, deployment ID/time and hosted test results must be appended from actual evidence after deployment.

## Second implementation checkpoint

Added AcroForm editor using pinned pdf-lib 1.17.1 with SHA-384 subresource integrity. Text/date, checkbox, dropdown/radio inputs; backend profile autofill; PDF export; private edited-copy save; originals retained. Three PDF roundtrip/validation/read-only tests pass. Added wallet locking and stale upload checks.

First hosted acceptance run 38678471312 passed both desktop/mobile public-browser cases and all 17 backend checks. Final-source rerun remains required. No authenticated signing/issuance/provider tests were substituted.

## Third implementation checkpoint

Added recipient-scoped call signaling over existing DM RLS, database-bound sender identity, stale/foreign signal rejection, bounded ICE buffering, camera and screen-share controls with media cleanup, truthful connection states and timer-only DOM updates. Seven additional tests pass (21 new tests total). Browser coverage now includes every existing navigation view using isolated SIM fixtures, never real records. Final hosted results pending.
