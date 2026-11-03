# VICE OS — Identity Engine 2.0 / Institutional Release Contract
Status: IMPLEMENTATION SPECIFICATION — NOT DEPLOYED
Priority: P0. Never report passkey or OUV execution complete until real integration tests pass.

## Group A — Non-negotiable security model
- Passkeys use WebAuthn/FIDO2 and platform user verification (Face ID/Touch ID/PIN). Never collect or store biometric images/templates.
- Trusted-device convenience lasts at most 24 hours and is revocable. Trust is NOT proof of a new transaction authorization.
- CEO and CFO must be distinct active Supabase identities and independent signers. Never infer role from user-editable metadata.
- Fresh user-verifying WebAuthn assertion must bind to the exact canonical action digest (proposal ID, immutable payload hash, action, role, nonce, expiry, relying party). A successful login assertion alone cannot approve a proposal.
- TOTP remains available while migration is underway. Do not silently treat legacy cryptographic attestation as TOTP or WebAuthn approval.
- No bypass for missing passkeys, quorum, timelock, invalid signatures, revoked sessions, or reconciliation failures.
- Deny-by-default; do not grant service-role to browsers. Use constant-time comparisons for secret material.

## Group B — WebAuthn implementation
- Replace production vice-passkey 501 placeholder with a reviewed server-side verifier using a maintained, pinned WebAuthn library and explicit expectedOrigin/expectedRPID.
- Verify registration: authenticated active user, CSRF/origin policy, fresh single-use random challenge, RP ID hash, clientDataJSON type=webauthn.create, attestation/credential public key, UV flag, algorithm allowlist, credential uniqueness, and immutable credential ownership.
- Verify assertion: challenge bound to user and requested action, clientDataJSON type=webauthn.get, origin, RP ID hash, UV flag, credential public key signature, user handle if present, and sign counter semantics appropriate for synced passkeys.
- Persist credential ID, COSE public key, credential type, transports, counter, backup eligibility/state, creation/use/revocation timestamps. Never store a private key or biometric template.
- Challenge: random >=32 bytes, hashed at rest, 3–5 minute TTL, one-time atomic consume, scoped by user, purpose and digest; reject replay, stale and cross-user challenges.
- Rate-limit enrollment/assertion, audit failed attempts without exposing secrets, support multiple credentials and revocation with step-up.
- Avoid unsupported claims of device-bound security for synced passkeys; document assurance differences.
- On success issue short-lived server-side transaction authorization record, not a broad bearer bypass. Idempotent writes and unique constraints per role/proposal/action.

## Group C — Session and executive UX
- Frontend feature detection via PublicKeyCredential and secure-context check; show enrollment in Security Center only when backend capabilities=true.
- Display precise states: Enroll passkey, Verify Face ID/passkey, TOTP alternative, Session expired, Role missing, Already approved, Proposal changed, Timelock pending, Quorum pending.
- Refresh Supabase session safely before calling Edge Functions; verify session server-side and check auth.sessions revocation for privileged actions.
- Do not expose 2FA enrollment/authorization controls to unrelated holders.
- For CEO/CFO, provide role-specific pending authorization action even if a legacy attestation exists; only verified action-specific authorization can hide the button.
- 24-hour trust applies to routine login convenience; require fresh user verification on governance approvals and OUV execution.

## Group D — OUV governance executor
- Current production vice_sovereign_proposals CHECK requires quorum_verified_at IS NULL AND execute_after IS NULL; existing executor requires non-NULL. This is contradictory. Fix only with reviewed migration and explicit state-transition tests.
- Production readiness currently has permanent ONCHAIN_QUORUM_VERIFIER_NOT_CONFIGURED and ATOMIC_GOVERNANCE_EXECUTOR_NOT_CONFIGURED blockers; do not remove until the respective systems exist and are verified.
- Governance model must explicitly choose ONCHAIN verified quorum or documented OFFCHAIN signed quorum with provenance. Never fabricate on-chain proofs. 72-hour timelock (or separately approved constitutional requirement) starts only after verified quorum.
- Validate both independent executive approvals against the same proposal payload hash, review deadline, supply reconciliation, exact baseline, reference-value relationship and official source-of-truth.
- Fixed precision numeric only; preserve VICE:V4X = 1:160 if constitutionally mandated. No automatic creation of IRU units.
- Atomic transaction: lock proposal, verify immutable hash and state, check authorization/quorum/timelock, insert one OUV version and one unique execution receipt, update canonical reference config, mark proposal executed; all or nothing. Retry returns receipt, not a second write.
- Do not hardcode proposal ID or numeric target into generic executor; compare signed proposal values and validate bounds instead.
- Every holder portfolio, gold headline, certificate, ticker, and valuation history must read from the same versioned canonical source; never label internal OUV as independently appraised FMV.
- Preserve all previous versions, audit logs, approvals and units. Add rollback via new compensating governance proposal, never historical rewrite.

## Group E — Tests required before release
1. Registration: valid platform authenticator, invalid origin/RPID, replay, wrong user, duplicate credential, revoked account, missing UV.
2. Assertion: valid signature, tampered signature, counter behavior, expired challenge, cross-proposal challenge, invalid action digest, revoked credential.
3. Session: fresh login, expired/revoked JWT, cross-account token, 24h trust expiry, new-device behavior, no trust-based transaction bypass.
4. Governance: CEO-only, CFO-only, both, duplicated approval, legacy attestation plus CFO TOTP, mutated proposal payload, missing quorum, missing timelock.
5. Database: migration on production-equivalent clone; concurrent execution race; rollback on injected failure; immutable receipts; zero unit delta; 1:160 invariant.
6. Frontend: CFO button visible when legacy-only attestation exists; success/error states; responsive/mobile; accessibility; actual Face ID/passkey device test.
7. Deployment: staging with matching schema, automated tests, security review, branch protection, canary, production deploy, post-deploy read-only verification, signed release notes.

## Group F — Release gates
G0 specification reviewed; G1 WebAuthn server verifier built; G2 database migrations tested; G3 frontend integration; G4 browser/device E2E; G5 independent security review; G6 production deployment; G7 real CEO and CFO acceptance; G8 governance quorum/executor enabled and tested; G9 OUV execution receipt and propagation verified.
All gates default FAIL until independently evidenced. Never mark G6–G9 complete based on source-only tests.

## Current production evidence (2026-10-26)
- vice-passkey Edge Function v1 is an explicit 501 placeholder (no registration, authentication or transaction authorization).
- vice_passkey_credentials and vice_passkey_challenges exist; active credentials = 0.
- CEO and CFO account role mapping checked and active.
- CFO legacy-attestation TOTP begin blocker removed in production; frontend button hotfix merged as PR #45.
- Existing OUV readiness reports quorum verifier/executor unconfigured; proposal constraint contradicts executor prerequisites.
- No new OUV has been activated by this specification.
