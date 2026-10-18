# VICE4X / Communications Guide

Internal engineering • 2026-10-16 UTC • 1.3.8.0-IRU-CERTIFICATES

Channels and DMs persist through Supabase before the UI reports success. History loads newest 200 records and sorts them for display. Repeated clicks on a disabled composer are ignored. Failed sends preserve the draft. Oversized encoded text is rejected with an actionable error.

Private media uses signed playback URLs. Local channel messages no longer bypass server ACLs through BroadcastChannel. On successful signout, call media and subscriptions are cleaned up and conversation caches are cleared.

Current call implementation is one-to-one audio with optional camera/screen video, using SDP/ICE and STUN with an authenticated TURN credential function. TURN needs TURN_URLS and TURN_SHARED_SECRET plus a reachable relay. Successful endpoint authentication does not demonstrate a cross-network call.

Group SFU and device selection, durable read receipts, message edits/deletion, mentions, search and channel administration remain incomplete. Legacy AES-GCM keys derive from public thread identifiers and provide no independently secure E2EE. Do not describe this as equivalent to a mature conferencing service.

## Camera and screen-sharing repair

After an audio call connects, Camera requests camera permission; Share screen requests the browser screen picker. One video source is sent at a time. Press the active control to stop; browser stop-sharing also detaches the track. Session changes and call termination stop media. These controls are implemented and seven mocked transport/media tests pass; real two-party and restrictive-NAT acceptance is still open.

Signaling now persists VICE_CALL_V1 envelopes in private dm_messages. The recipient trusts database sender/recipient columns, rejects old signals and foreign call IDs, and excludes signaling rows from chat history. Legacy global/local broadcast call messages are ignored. Both parties must refresh to this release; mixed old/new clients cannot call each other. Signaling rows currently remain in the private database; a reviewed retention policy is still needed. No E2EE or group-call claim is made.

The private-profile RLS policy previously hid recipients from the sender-side membership lookup, rejecting legitimate DMs and attachments. A private boolean helper fixes that check while profile reads remain self-only. Isolated PostgreSQL tests verify permitted sends, recipient reads, third-party denial, sender forgery rejection and private attachment-path checks.


## Updated controls

Open Comms → Settings to select click/tap or slide answering, notification preview privacy, device previews, sound, supported haptics, ticker visibility, and screen/camera targets. Select Contacts to search names or roles; profile images appear in the directory, direct messages and calls. Upload a JPEG, PNG, WebP or animated GIF up to 8 MiB under My Profile.

In a direct message, choose Voice call or Video call. Incoming video can be answered with audio only. During a call, the crossed microphone and status label identify mute, and the other participant receives the mute indicator. Start video, Share screen and End call operate on the current connection. Screen sharing pauses camera capture and shows actual capture dimensions. Choose Full HD or 4K in settings; output depends on the device and connection, not the selected label alone.

The floating ticker lists unread messages and missed calls. Hover/focus pauses scrolling; its pause button also stops motion. Tap an entry to open the exact conversation, or tap INBOX for the notification panel. Choose Name only or Private to suppress preview content. Device previews are off by default. Mark all read stores notification identifiers on this device; it does not send a read receipt to the sender. The panel reconstructs up to 100 accessible notices from the previous seven days, including unanswered incoming call offers older than 90 seconds. This is not closed-app push delivery.
