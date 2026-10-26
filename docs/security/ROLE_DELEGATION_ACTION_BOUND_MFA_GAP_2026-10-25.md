# Action-bound executive MFA gap — 2026-10-25
Live production read-only audit of public.vice_exec_mfa_begin/get/finish and public.vice_assign_member_role.

## Finding: missing role-delegation action in MFA protocol
- vice_exec_mfa_begin supports only APPROVE, RECOVERY_APPROVE, RECOVERY_ACTIVATE. It binds proposal hash/recovery fingerprint, role, actor and expiry to a challenge.
- vice_exec_mfa_finish is service-role-only and consumes a request; direct authenticated EXECUTE=false. Verification of TOTP must occur in trusted server code (not assessed here).
- vice_assign_member_role is SUPER_ADMIN-gated but has no action-bound MFA challenge or authorization consumption.
- Therefore the existing executive MFA protocol cannot be reused unchanged for ROLE_ASSIGN: extending the allowlist alone would be insufficient.

## Required change design
1. Introduce ROLE_ASSIGN action with target member ID, exact normalized target role, request ID, reason hash and 3-minute expiry in an immutable server-issued challenge. Restrict initiation to active SUPER_ADMIN.
2. Verify fresh MFA on trusted server against the initiating actor and exact challenge. Do not accept client claims of MFA success. Bind the authorization to the exact role assignment payload.
3. Consume the one-time authorization atomically in vice_assign_member_role after row locks and before mutation; reject mismatched actor, payload, expiry, replay and revoked sessions. No fallback to login-time MFA or remembered 24-hour factor.
4. Write immutable audit event containing actor, target, former/new role, challenge ID and reason digest; enforce rate limits and failure logging.
5. Test negative matrix on staging: member caller, no factor, stale/replayed challenge, target substitution, role substitution, role downgrade, suspended actor, compromised session without fresh factor.
6. Review service-role verifier implementation, existing MFA tables constraints and migration parity before any production change.

No production mutation made. This is a verified integration gap, not proof of exploitation. The existing MFA system does protect its supported governance/recovery actions subject to independent verifier audit.
