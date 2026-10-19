# VICE4X / Repair ledger

October 17 registry/control repair: see [authority matrix, behavior and regression coverage](registry-controls-20261017.md). Root causes included case-sensitive unlinked-holder lookup, missing administrative status enforcement, issuer-only RPCs conflicting with delegated CFO permissions, and missing own-holdings transfer transactions. Changes preserve the existing reserve workflow and historical records.

| Issue | Root cause | Changed files | Verification |
|---|---|---|---|
| Stale member state on logout/account switch | Collections and pending asynchronous results survived identity change | index.html | Cleanup and delayed-history behavioral tests; authenticated race matrix still open |
| Canceled/failed logout stops sync | Timer cleared before confirmation/result | index.html | Failed-signout behavioral test |
| Academy leaks reading/quiz cache across users | Shared localStorage key | index.html, Academy progress migration | Member-scoped backend receipts, server quiz hydration and stale response guards; authenticated browser workflow unverified |
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

Predictable legacy message keys; private signaling and camera/screenshare require two-party acceptance; missing group SFU; no complete read receipts/edit/delete/search/channel administration; incomplete PDF content editing/versioning and signature requests; incomplete stochastic/MTF and nine-position broker acceptance; controls not fully browser exercised; CSP and dependency scanning incomplete. These remain release acceptance failures until implemented and tested.

## Genuine external dependencies

No authorized real-user staging credentials supplied. Disposable PostgreSQL fixtures provide isolated policy/function tests, not a complete Supabase Auth/Realtime environment. No TURN relay/SFU provider configuration verified. No signing provider credentials/license. No private SMTP worker delivery verification. No authorized broker sandbox credentials or provider feed entitlements verified. Browser binary download failed locally; hosted CI provides browser testing. No production data was fabricated to replace these dependencies.

## Direct issuance correction and recipient policy checkpoint

- Reproduced the private-profile recipient lookup failure in disposable PostgreSQL 17; fixed DM and attachment INSERT policies without broadening profile/message reads. Staging and hosted acceptance run 38729325335 passed. Migration applied to production as 20261015132937. No message or financial records changed by that policy migration.
- Added an exact-source issuance reversal with issuer authorization, a separate restricted database-operator entry point, idempotent source-event handling, atomic balance/counter reconciliation, certificate revocation, and append-only correction/audit records. Existing estate reserves are not modified. Source events and certificates are retained.
- Added frontend ledger replay and admin review for reversal events. Two replay tests and PostgreSQL staging passed before migration 20261015140648 was installed. The separately authorized live correction completed on October 15 with exact counter deltas, holder reconciliation, certificate revocation and audit records verified. Other holder balances and both reserve records were unchanged. Private record identifiers and receipt details remain in the database.

## Certificate privacy and Academy checkpoint

- Public IRU verification exposed identity, full holdings snapshots and internal revocation notes. The verification RPC now returns a strict status/integrity allowlist. Holder detail access remains behind the existing authenticated certificate-table RLS. PostgreSQL privacy fixtures passed before live migration 20261015190802.
- Academy chapter marks were browser-only and new awards did not enforce reading completion. Added owner-scoped backend receipts, validated module/chapter RPC, confirmed frontend marks, stale-response guards, duplicate-submit prevention, 21-core-chapter issuance gate, matching profile identity, canonical course title and idempotent active awards. Existing certificates are retained. Four client tests and isolated PostgreSQL acceptance passed before live migration 20261015193846. Prior local-only marks are retained locally but must be reconfirmed through Mark read to become backend receipts.

## Chart interaction and market outage repair

- Canvas had no mouse-drag path, no vertical price viewport, and touch drags treated a null latest-candle index as zero. Replaced separate mouse/touch handlers with pointer capture, frame-throttled body/axis dragging, cursor-anchored wheel zoom, pinch zoom and keyboard controls. Manual price range resets when instrument/timeframe changes; chart count preference persists.
- Live-feed errors generated fallback candles. Failed live feeds now clear the chart and show an unavailable state. Explicit practice mode remains labeled simulation. Request IDs/session checks reject stale instrument responses. Four behavioral tests pass; real browser chart drag checks are included in hosted acceptance.
- Mobile browser testing identified the floating O.I. button intercepting price-axis drags. Chart Support and O.I. actions now live in the toolbar; global floating controls are hidden while the chart view is active. Browser tests assert that the price-axis hit target is the canvas and that dragging does not activate navigation or O.I.
- Fractal rendering used a truncated last-200 pivot list. The engine now retains full-history confirmed fractals with confirmation indices; rendering follows the current time/price viewport. Two deterministic tests cover causal confirmation and historical stability.
- Newer main-branch desktop clock/refresh-storm and local signout fixes were merged into this repair without overwriting them. Hosted browser navigation waits for DOM/login readiness rather than all third-party network activity to settle.

- Optional wallet readiness previously rerendered whichever page was active, detaching charts and document forms. Wallet refreshes now target only wallet-related views; the regression test and hosted desktop/mobile browser acceptance pass.


## Installed mobile app — October 19 UTC

- Status bar intercepted navigation because fixed header ignored safe-area padding on the root. Shared inset-aware header/banner/sidebar/content offsets, 44-pixel menu targets, inert closed navigation and dismiss/focus/rotation cleanup correct the behavior. Changed `index.html` and `vice4x-comms.css`. Ten browser-emulated viewport regressions pass; old source reproduces the header-height failure.
- Home icon used a generic V and referenced unpublished PNGs. Manifests now share one identity; SVG, Apple 180px and maskable 192/512px icons use the official metallic logo. Added generation script, public whitelist entries, two asset tests and exact-production asset comparisons.
- See [mobile release record](2026-10-19-mobile-release.md) for scope, verification and production identity.
