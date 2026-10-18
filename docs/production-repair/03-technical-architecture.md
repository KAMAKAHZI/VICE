# VICE4X / Technical Architecture

Internal engineering • 2026-10-16 UTC • 1.3.8.0-IRU-CERTIFICATES

The preserved index.html owns UI state, navigation, authentication, Solace, chart rendering, messaging, WebRTC audio, holder views, documents and Academy. vice-mega.js/css extend the application. No replacement application was introduced.

Flow: browser → Supabase Auth → own profile → RLS-protected tables/RPCs. Database-confirmed writes precede success states for repaired messaging/profile/Academy paths. An auth generation counter rejects stale hydration, conversation and Academy responses. Academy progress uses owner-scoped academy_progress receipts through mark_academy_chapter; clients cannot insert completion records directly. Server-graded attempts and core chapter receipts gate new awards.

Markets: browser → Netlify yahoo function → Yahoo Finance; Binance uses its provider endpoint. Broker records use JWT-protected vice-mt5-cloud and the separately hosted VICE Link service. Broker credentials remain outside the public bundle.

Communications: RLS-scoped Postgres change streams carry channel/DM records; presence uses Realtime broadcast; call signaling now uses recipient-scoped dm_messages with sender identity bound to database columns. Predictable legacy thread keys are not E2EE. No SFU is deployed by this repair.

Documents: private Storage + documents metadata → sign_document RPC → signatures/audit record. PDF form editing uses pinned pdf-lib and saves a new private copy with a content digest. Certificates use allocation and portfolio RPCs, verification pages and browser print/PDF output. Public IRU verification returns only status/integrity metadata; owner/issuer certificate detail remains under authenticated table RLS.

Build: scripts/vice-publish-netlify.sh → exactly 11 approved public files in dist/site; Netlify Functions deploy separately. server/, SQL and internal documentation must never enter the public directory. dependency-inventory.json enumerates source files, client table/RPC dependencies and control identifiers; it is an inventory, not proof that every control works.
