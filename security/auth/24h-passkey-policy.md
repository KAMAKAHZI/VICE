# VICE OS — 24-hour MFA and biometric/passkey policy (implementation gate)

## User experience
- Require a successful MFA code challenge no more frequently than once per 24 hours **on the same trusted device**, provided the risk state is unchanged.
- Subsequent unlocks within the window use device Face ID / Touch ID / Windows Hello through a **server-verified WebAuthn passkey assertion**, never a browser boolean or localStorage marker.
- A 24-hour trust period starts only after server-verified MFA and a cryptographically bound device credential. It is not a blanket exemption from MFA for other devices.
- For privileged operations (role assignment, OUV, IRU distributions, governance), demand a fresh **action-bound WebAuthn assertion** even during the 24-hour period. Bind actor, action, exact payload digest, challenge, credential and expiry. One-time consumption is mandatory.
- Revoke trust on explicit sign-out-all, credential reset, device revocation, suspected compromise, or significant risk changes. Allow emergency TOTP fallback when passkey authentication is unavailable; do not weaken access control to meet a 24-hour UX target.

## Existing system observations
- index.html currently calls `sb.auth.mfa.getAuthenticatorAssuranceLevel()` and `challengeAndVerify()`. Supabase AAL2 is tied to session assurance, **not** a verified 24-hour device trust token.
- Executive `viceExecMfaOpen` currently prompts for TOTP for APPROVE / RECOVERY_APPROVE / RECOVERY_ACTIVATE; changing its prompt alone would create an authorization bypass.
- Existing production `vice_assign_member_role(uuid,text,text)` does not consume a fresh, one-time action-bound MFA proof.

## Required implementation sequence (release-blocking)
1. Design server-side device-trust record with account/credential identifiers, server-verified MFA time, expiry <=24h, revocation and session binding. Store only a hash of any bearer token. No client-controlled timestamps.
2. Implement WebAuthn registration and assertion validation on a trusted backend: verify origin, RP ID, challenge, user verification, credential ownership, signature, replay resistance, and sign counter where applicable.
3. Modify sign-in only after server-side APIs exist. Preserve Supabase session refresh and avoid reinitialization loops. Never skip MFA merely because client-side state claims a recent verification.
4. Add action-bound challenge/authorization for privileged operations, including ROLE_ASSIGN; atomically consume proof in the same transaction as the privileged write.
5. Add positive and negative integration tests: new device, revoked credential, stolen session, replay, expired trust, missing user verification, action payload mismatch, concurrent use, clock skew and recovery.
6. Run staging database migrations and live device tests (iOS Face ID, desktop passkey, recovery), security review and CI before production rollout.

## Release rule
This file is a security contract and rollout plan, **not a claim that passkey authentication is already implemented**. Do not ship a client-only bypass or apply the temporary role-assignment disabling migration without a tested replacement.
