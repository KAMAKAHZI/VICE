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

## Read-only deployment drift guard (prepared, not yet enabled on main)

- The `supabase/functions/vice-passkey/index.ts` file was compared byte-for-byte against the live Edge Function source retrieved from the connected Supabase project on 2026-10-22: **EXACT MATCH** (1,550 characters).
- Baseline: `docs/audit/passkey-deployment-baseline.json`. It records the locally approved source Git blob SHA-1, Supabase-reported deployed bundle SHA-256, version, status, and JWT enforcement. Source blob and bundled artifact hashes are different checks and must not be equated.
- Checker: `scripts/vice-passkey-drift.cjs` uses only a read-only HTTPS GET to Supabase's Management API. It first confirms the local source matches the approved Git blob, then confirms the deployed function metadata matches the approved bundle/version/security settings. A missing token, unexpected API response, or any mismatch is a **failed check**, never a pass or silent skip.
- Unit tests: `tests/vice-passkey-drift.cjs` cover expected-match, tampered source, unexpected deployed bundle/version, absent JWT verification, missing function, missing token, and Management API errors.
- Prepared workflow: `.github/workflows/vice-passkey-drift.yml`, manual dispatch and Mondays at 13:17 UTC, becomes active only once reviewed and merged into the default branch.
- **Required configuration:** Set a GitHub Actions repository secret named `SUPABASE_ACCESS_TOKEN` to a *fine-grained, read-only* Supabase Management API token with `edge_functions_read` scope for the project. Do not put it in repository files, issue a service-role key for this purpose, or paste it into a chat. If absent, the live drift job intentionally reports **BLOCKED** and fails.
- This guard establishes **deployment-identity consistency against the recorded baseline**, not working WebAuthn, signed attestation, independent code audit, or a live user sign-in test. Legitimate passkey deployments require a separate reviewed baseline update and production authorization.

## Remaining gates

- Compare deployed source and committed source during each production release; do not claim no drift without a fresh, authenticated retrieval.
- Add cryptographic verifier integration tests with wrong origin/RP ID, replayed challenges, revoked credentials, incorrect counters, session change, and MFA enforcement before enabling capabilities.
- Require an explicit production authorization and recorded deployment/rollback evidence for any replacement.
