# Executive WebAuthn release gate — PR #46

## Blocking findings (do not deploy)
1. The `vice_passkey_finalize_action` SECURITY DEFINER RPC trusts a caller-provided assertion that a signature was verified. The service-role credential alone is insufficient proof of WebAuthn verification. Do not enable it until a trusted verifier-only invocation boundary and audit proof exist.
2. `authorize_options` stores `action_digest` but not `proposal_id`. A digest collision across distinct proposal IDs or an intentionally reused identical payload can misattribute a receipt. Add a server-owned proposal ID to the challenge and require exact equality on finalization.
3. The authorization challenge is currently an ordinary random WebAuthn challenge, while the proposal digest is only a separate DB column. It must be cryptographically bound to the ceremony (e.g. challenge issued with authenticated server-side context, then exact challenge+proposal+digest checked in a single transaction).
4. Counter CAS and receipt finalization are separate transactions. Ensure concurrent assertions cannot create an accepted receipt without a valid counter advancement; design one atomic transaction or an irreversible verified-assertion ticket.
5. The receipt schema assumes `vice_passkey_challenges.id` is UUID, `action_digest` exists, and `consumed_at` exists. Validate actual schema and migrations before deployment.
6. The locked proposal must not be mutated between digest validation and receipt finalization. Enforce immutable proposal payload/hash after LOCKED, or lock the proposal row during finalization.
7. Do not count CEO/CFO receipts as governance quorum or automatically execute OUV without separate quorum policy, timelock, idempotent execution, and on-chain/off-chain routing.
8. Keep passkey capability flags false until staging E2E tests pass. Keep existing TOTP recovery functional.

## Acceptance tests
- Correct CEO and distinct CFO each approve exact proposal hash once.
- One user cannot approve both roles; revoked credential, expired challenge, replay, altered proposal, incorrect digest, wrong origin/RP ID, absent UV, duplicate role, stale counter all fail.
- Two concurrent finalizations yield at most one receipt.
- Unauthorized browser/RLS caller cannot invoke privileged functions.
- Existing authentication, certificate and OUV values unchanged before approved production rollout.

## Deployment
Staging migrations -> role and RLS tests -> WebAuthn browser integration -> concurrent replay tests -> independent review -> canary -> production. No silent deployment.
