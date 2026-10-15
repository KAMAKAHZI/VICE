# VICE OS / Release Verification Report

Internal engineering • 2026-10-15 UTC • 1.3.8.0-IRU-CERTIFICATES

The original application is preserved. This is a production repair release; the complete institutional specification has not passed acceptance. See the criterion-by-criterion acceptance matrix.

## Release source

Baseline main: `9b681f00b0a593d7b47de2498af32ddf0a939fc5`. Verified implementation checkpoint: `d38a26916a71f098c6922e115d5f81e0d1fbf1df`. The final merge SHA, Netlify deployment identifier, timestamp and public-asset verification must be recorded from production evidence after publishing. A matching version string alone is insufficient.

## Repairs and root causes

- Authentication: duplicate initialization and stale asynchronous responses could reuse another session's data. Epoch checks, coalesced setup, cache/media/wallet cleanup and preservation of synchronization on failed logout address those paths. The page mount remains intact during logout.
- Profiles: UI updates could imply success before storage/database confirmation. Editable-field allowlisting, confirmed updates, avatar MIME/size checks and stale-upload guards now precede local success.
- Messaging: history selected the oldest window; encoded text could exceed backend limits; private profile RLS made recipient existence checks fail. Latest-200 chronological history, deduplication, stale-session rejection, size checks and staged private membership lookup address these failures.
- Calls: global broadcast signaling did not provide recipient privacy. SDP/ICE now uses recipient-scoped DM storage, database-bound identities, replay expiry and call-ID checks. Camera/screen sender replacement, cancellation, bounded ICE and media cleanup are covered by tests.
- Markets: browser Yahoo access bypassed the deployed proxy and accepted malformed OHLC. Same-origin proxy routing and finite/range validation reject unusable provider data.
- PDFs: AcroForm text/date, checkbox, choice editing, profile autofill, PDF export and private new-copy save are implemented using pinned pdf-lib with SRI. Originals and signed/read-only content are protected.
- IRU correction: exact-source reversals now run atomically with explicit issuer/database-operator identity, idempotency, balance/counter reconciliation, original-event preservation, certificate revocation and audit records. Reserve tables are not changed.
- Deployment: manual fallback avoids rebuilding; native Netlify integration remains the primary production path. Smoke checks compare nine asset bodies byte-for-byte and test the published desktop/mobile public UI.

Changed subsystem files are identified in repair-ledger.md and the GitHub diff. No secrets are included in the public artifact.

## Verification evidence

GitHub acceptance run [38744956550](https://github.com/KAMAKAHZI/VICE/actions/runs/38744956550) passed on the implementation checkpoint:

| Verification | Result |
|---|---|
| New behavioral, PDF, call and IRU replay tests | 23 passed, 0 failed, 0 skipped |
| Pre-existing contract/static suites | 7 passed; includes 6 mocked TURN outcomes |
| PostgreSQL 17 staging | DM/attachment ACL and exact-source reversal assertions passed; migrations applied twice |
| Browser | Desktop 1440×900 and mobile 390×844 public UI; every navigation view rendered with explicit SIM fixtures |
| Read-only production backend | 17/17 passed |
| Build and package privacy | Passed; 11 whitelisted public assets |

No real-user password, invitation, two-party media, broker order or production financial test allocation was used. SIM navigation checks do not certify live workflows. Unit counts are separate from static suites and SQL assertions.

## Database and security

Live project sdsaewumabzjjvsmqqsl has 50 public tables, all with RLS, two private Storage buckets and 40 applied migrations. Two new migrations were staged before installation: recipient membership ACL (20261015132937) and audited issuance reversal (20261015140648). Authenticated role-matrix and independent security acceptance remain open. Legacy encryption is not E2EE; leaked-password protection was reported disabled by Supabase advisors.

## Remaining work and external dependencies

External configuration/testing remains necessary for TURN relay and separate-network media, MetaApi/broker connection, transactional email receipts, an SFU for group conferencing, and a full signing provider if selected. No paid provider or infrastructure was purchased.

Independent implementation gaps remain: durable message receipts/editing/deletion/search/channel administration; backend chapter-reading persistence; complete device selection; full SOLACE input/signal acceptance; linked document versions and multi-signer request/sequence/reminder workflows. These are incomplete features, not credential blockers. Full institutional production readiness is not claimed.

Production deployment evidence and the authorized real-record correction will be appended after verification without publishing private holder identifiers.
