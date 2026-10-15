# VICE OS / Communications Guide

Internal engineering • 2026-10-15 UTC • 1.3.8.0-IRU-CERTIFICATES

Channels and DMs persist through Supabase before the UI reports success. History loads newest 200 records and sorts them for display. Repeated clicks on a disabled composer are ignored. Failed sends preserve the draft. Oversized encoded text is rejected with an actionable error.

Private media uses signed playback URLs. Local channel messages no longer bypass server ACLs through BroadcastChannel. On successful signout, call media and subscriptions are cleaned up and conversation caches are cleared.

Current call implementation is one-to-one audio using SDP/ICE and STUN with an authenticated TURN credential function. TURN needs TURN_URLS and TURN_SHARED_SECRET plus a reachable relay. Successful endpoint authentication does not demonstrate a cross-network call.

Group SFU, video, screen sharing, device selection, durable read receipts, message edits/deletion, mentions, search and channel administration remain incomplete. Legacy AES-GCM keys derive from public thread identifiers and provide no independently secure E2EE. Do not describe this as equivalent to a mature conferencing service.
