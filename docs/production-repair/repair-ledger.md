# VICE OS / Repair ledger

| Issue | Root cause | Changed files | Verification |
|---|---|---|---|
| Stale member state on logout/account switch | Collections and pending asynchronous results survived identity change | index.html | Cleanup and delayed-history behavioral tests; authenticated race matrix still open |
| Canceled/failed logout stops sync | Timer cleared before confirmation/result | index.html | Failed-signout behavioral test |
| Academy leaks reading/quiz cache across users | Shared localStorage key | index.html | Reading key scoped; server hydrates quizzes; browser workflow unverified |
| Profiles falsely report save success | Supabase errors returned as values were ignored | index.html | Denial/confirmed update and field allowlist tests |
| Old conversation window | Ascending query limited to earliest 200 | index.html | Newest query/chronological display/dedup test |
| Encoded message rejected unexpectedly | Plaintext limit ignored envelope expansion | index.html | Encoded overflow rejected before insert |
| Duplicate send | Disabled input not checked by click handler | index.html | Guard added; real reconnect idempotency remains open |
| Local chat bypasses subscription ACL | BroadcastChannel directly delivered chat | index.html | Removed local chat consumption; RLS stream retained |
| Call resources survive signout | disconnect did not clean WebRTC media | index.html | cleanup integrated; two-device teardown unverified |
| Yahoo CORS and malformed candles | Browser called provider directly; high/low not validated | index.html, netlify/functions/yahoo.js | Proxy URL and invalid OHLC behavior tests |
| Version-only smoke falsely identifies repair | All repairs share same version | tests/vice-production-smoke.mjs | Nine asset byte comparisons with propagation retry |
| Duplicate CLI builds/cancel races | Missing --no-build, cancel-in-progress true | workflow | Configuration reviewed; native deployment used once |

## Open implementation defects, not credential excuses

Predictable legacy message keys; private signaling and camera/screenshare require two-party acceptance; missing group SFU; no complete read receipts/edit/delete/search/channel administration; incomplete PDF editing/versioning and signature requests; no backend reading-progress sync; incomplete stochastic/MTF/marker and nine-position broker acceptance; controls not fully browser exercised; CSP and dependency scanning incomplete. These remain release acceptance failures until implemented and tested.

## Genuine external dependencies

No authorized staging user accounts/isolated database supplied or provisioned. No TURN relay/SFU provider configuration verified. No signing provider credentials/license. No private SMTP worker delivery verification. No authorized broker sandbox credentials or provider feed entitlements verified. Browser binary download failed locally; hosted CI is the alternative. No production data was fabricated to replace these dependencies.

## Direct issuance correction and recipient policy checkpoint

- Reproduced the private-profile recipient lookup failure in disposable PostgreSQL 17; fixed DM and attachment INSERT policies without broadening profile/message reads. Staging and hosted acceptance run 38729325335 passed. Migration applied to production as 20261015132937. No message or financial records changed by that policy migration.
- Added an exact-source issuance reversal with issuer authorization, a separate restricted database-operator entry point, idempotent source-event handling, atomic balance/counter reconciliation, certificate revocation, and append-only correction/audit records. Existing estate reserves are not modified. Source events and certificates are retained.
- Added frontend ledger replay and admin review for reversal events. Two replay tests pass. PostgreSQL staging tests must pass before installing or invoking the correction function in production. No actual financial correction is claimed at this checkpoint.

## Certificate privacy and Academy checkpoint

- Public IRU verification exposed identity, full holdings snapshots and internal revocation notes. The verification RPC now returns a strict status/integrity allowlist. Holder detail access remains behind the existing authenticated certificate-table RLS. PostgreSQL privacy fixtures passed before live migration 20261015190802.
- Academy chapter marks were browser-only and new awards did not enforce reading completion. Added owner-scoped backend receipts, validated module/chapter RPC, confirmed frontend marks, stale-response guards, duplicate-submit prevention, 21-core-chapter issuance gate, matching profile identity, canonical course title and idempotent active awards. Existing certificates are retained. Four new client tests pass; isolated PostgreSQL acceptance is required before live installation. Prior local-only marks are retained locally but must be reconfirmed through Mark read to become backend receipts.
