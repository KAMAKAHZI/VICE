# VICE OS — Deployed Passkey Edge Function Provenance

Captured: 2026-10-22
Supabase project ref: `sdsaewumabzjjvsmqqsl`
Function slug: `vice-passkey`
Read-only method: Supabase project Edge Function source retrieval (connected project)
Deployed function version at capture: `1`
Reported status: `ACTIVE`
Reported `verify_jwt`: `true`
Deployed bundle `ezbr_sha256` reported by Supabase: `1f23e2a11f2702b98be9cfc68784b4d4f9d10a83f36204b0beb4ba923d7f702b`

## Source-control provenance

The deployed function's sole returned file, `index.ts`, was retrieved and committed unchanged to `supabase/functions/vice-passkey/index.ts` in the Phase 0 review branch. The bundle hash above identifies Supabase's reported deployed bundle, **not** a cryptographic match of the raw TypeScript file or a local deployment artifact. Verify future drift by retrieving the deployed source again and comparing bytes to the committed file.

## Explicit capability status

The function verifies the bearer token through `auth.getUser()`, then responds to authenticated `operation: "capabilities"` with all WebAuthn capability booleans `false`. Other authenticated operations receive HTTP `501` with `WEBAUTHN_VERIFIER_NOT_CONFIGURED`. It **does not** cryptographically verify WebAuthn registration, authentication, or transaction signatures. Existing TOTP/AAL2 remains mandatory where required.

**This is provenance and fail-closed boundary evidence, not evidence of a working passkey verifier.** No function was deployed or changed in Supabase during source capture. The deployed function should remain fail-closed until a separately reviewed, standards-compliant verifier and server-side challenge/origin/RP ID/session binding are tested and approved.

## Remaining gates

- Compare deployed source and committed source during each production release; do not claim no drift without a fresh, authenticated retrieval.
- Add cryptographic verifier integration tests with wrong origin/RP ID, replayed challenges, revoked credentials, incorrect counters, session change, and MFA enforcement before enabling capabilities.
- Require an explicit production authorization and recorded deployment/rollback evidence for any replacement.
