# CEO Root — Phase 3 Implementation Decision Record
Status: REVIEW-ONLY; do not run production migrations.

## Newly confirmed in repository
- A fail-closed migration ALREADY exists: `supabase/migrations/20261025_phase3_role_delegation_fail_closed.sql`. It replaces `public.vice_assign_member_role(uuid,text,text)` with permission-denied and revokes PUBLIC/anon/authenticated EXECUTE.
- A static contract test ALREADY exists: `tests/vice-phase3-role-gate.mjs`. It checks signature preservation, permission denial, revocation and nonmutation.
- A previous production read-only audit documents that the executive MFA challenge protocol supports APPROVE, RECOVERY_APPROVE and RECOVERY_ACTIVATE, but not ROLE_ASSIGN. Its service-only finish step is not sufficient to authorize role assignment.

## Engineering decision
Do not introduce another conflicting fail-closed migration or claim the existing candidate has been applied to production. Keep root-role enrollment and delegated FINANCE_OFFICER assignment blocked from expansion pending a complete server-verified ROLE_ASSIGN protocol.

## Implementation acceptance
1. Inventory current staging schema and migrations; prove parity with MFA tables before any SQL apply.
2. Add server-issued 3-minute ROLE_ASSIGN challenge bound to actor UUID, target UUID, normalized role, reason hash, session and one-time nonce.
3. Verify fresh phishing-resistant or policy-approved step-up on trusted server; 24-hour routine MFA trust alone is insufficient.
4. Consume authorization atomically under transaction locks with role mutation and append-only audit; reject replay and payload substitution.
5. Test missing, expired, revoked, swapped actor/target/role/reason, simultaneous reuse and delegated admin attempting CEO-root mutation.
6. Independently review SQL SECURITY DEFINER search paths, grants, and privileged API/service key custody.
7. Keep CEO root protected from subordinate revocation, while preserving independent CFO/board governance and OUV atomic execution.

## Evidence
- `supabase/migrations/20261025_phase3_role_delegation_fail_closed.sql`
- `tests/vice-phase3-role-gate.mjs`
- `docs/security/ROLE_DELEGATION_ACTION_BOUND_MFA_GAP_2026-10-25.md`
