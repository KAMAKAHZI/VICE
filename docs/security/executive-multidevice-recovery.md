# Executive multi-device signing and controlled recovery — implementation contract

Status: SECURITY REVIEW REQUIRED — NOT DEPLOYED.

## Existing production constraints
- Current signing flow uses `vice_exec_signers(role,user_id,public_key)`, `vice_exec_challenges`, `vice_exec_finish`, and Edge Function `vice-institutional`.
- The current one-key-per-role implementation cannot safely be converted by overwriting `public_key`. Existing approvals and signatures must remain verifiable.
- The executive's account session and signing-device identity are separate. Incognito Safari may discard browser-local private keys.
- No recovery action may approve a pending proposal, reset quorum, change governance parameters, or release a treasury lock.

## Required migration (additive, not destructive)
1. Create `vice_exec_devices` with immutable device ID, executive user ID, role, public JWK (P-256, no private `d`), fingerprint, created/activated/revoked timestamps, enrollment authorization reference and audit event ID. Unique active public-key fingerprint; never overwrite enrolled public keys.
2. Bind every new challenge to one device ID and to an immutable action, executive ID, proposal hash, nonce, origin, expiry and challenge ID. Verify signatures server-side using the stored active device public key. Consume challenges atomically; reject replay and expired challenges.
3. Support `ADD_DEVICE` only when signed by an already-active device plus recent executive reauthentication. Activation must not occur from a password-only session.
4. Support `REVOKE_DEVICE` through an active different device or independently authorized emergency recovery. Revocation does not delete signature history.
5. For no surviving device, implement a separate recovery case with identity proofing, independent reviewer approval, cooling-off period, out-of-band notices and immutable audit trail. No self-approval, unilateral admin SQL key replacement, email-only reset or service-role bypass.
6. Migrate the current `vice_exec_signers.public_key` into a legacy device record without changing its meaning. Preserve old signature verification paths and bind new signatures to device IDs.
7. Require explicit recovery completion before enrollment of replacement keys. Expire old sessions/challenges and notify all enrolled contact methods after recovery.
8. Keep `vice_sovereign_control.locked` and on-chain verifier/executor gates unchanged.

## UI acceptance
- Executive Security > Signing Devices: list active/revoked devices, fingerprint, last-used time, Add device, Revoke, Start controlled recovery, Recovery status.
- Explain that private browsing and browser resets may lose locally stored signing keys. Recommend platform passkeys/WebAuthn or hardware-backed keys for new devices; WebAuthn attestation and assertion verification must be implemented on the server before advertising support.
- Never generate a new browser key merely because the existing key is missing; prompt for enrolled-device approval or recovery.
- Error must distinguish device missing, different key, revoked device, expired challenge, and recovery pending.
- A recovery-pending state must never sign a proposal.

## Required tests before merge/deploy
- Existing signer remains able to sign; second device is added only after signature from first.
- Two devices independently sign; removing one immediately blocks its new signatures.
- New device cannot be enrolled by authenticated session alone, even with SUPER_ADMIN.
- Recovery with no surviving key requires independent approval and cooling-off; no approval by same account.
- Challenge replay, cross-role signing, wrong proposal hash, expired challenge, altered origin, forged JWK and revoked device fail closed.
- Existing signatures and historical audits remain verifiable.
- Safari standard/private, desktop, PWA, interrupted recovery, and lost-device scenarios.
- Database RLS, Edge verifier, migrations, audit immutability and production smoke tests pass.

This document is a repair plan, not an assertion that the functionality is deployed.
