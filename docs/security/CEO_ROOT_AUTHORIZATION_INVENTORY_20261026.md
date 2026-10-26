# CEO Root Authority — Existing Authorization Inventory (2026-10-26)

Status: SOURCE-BASED REVIEW. Historical production catalog findings below are from repository review documents dated 2026-10-25, not a fresh live database inspection.

## Current roles and checks
- `public.profiles.role` supports `SUPER_ADMIN` and `FINANCE_OFFICER` in existing registry operator authorization.
- `vice_private.is_registry_operator()` checks `account_allowed()` and current `auth.uid()` profile role; restricted EXECUTE.
- `vice_private.account_allowed()` checks active user/profile/holder status; validates `session_id` only if JWT supplies it.
- `public.is_super()` checks `account_allowed()` plus `profiles.role='SUPER_ADMIN'`.
- `public.vice_assign_member_role(uuid,text,text)` is authenticated-executable SECURITY DEFINER and uses `public.is_super()`; forbids self-role updates and edits to existing `SUPER_ADMIN` accounts; audits the action.
- Repository's prior catalog review says authenticated lacks UPDATE on `profiles.role` and `profiles.account_revoked`, but has limited contact/profile update privileges.

## P0 findings and next controls
1. **Do not create a second unreviewed superuser role**: map `ceo_root_admin` to existing `SUPER_ADMIN` controls only after proving no privilege regression and confirming root enrollment.
2. **Fresh step-up for role delegation**: existing `vice_assign_member_role` body reportedly does not independently enforce action-bound MFA. A compromised SUPER_ADMIN session may delegate `FINANCE_OFFICER`. Introduce server-validated action-bound step-up and replay prevention before expanding delegation.
3. **Strict session binding**: validate real-client compatibility before requiring `session_id` in every privileged request; fail closed for missing or revoked sessions on sensitive operations.
4. **Definer safety**: inventory all SECURITY DEFINER role writers; replace empty search_path and unqualified dependencies with reviewed fixed schema resolution.
5. **Audit immutability**: prove privileged event append-only policy, independent log custody, and denial of delete/update, including for CEO.
6. **No financial bypass**: CEO root must not satisfy independent CFO/board votes or atomic OUV gates.
7. **Adversarial staging matrix**: ordinary member, revoked account, stale session, super-admin with/without fresh MFA, attempted self-promotion, protected root reassignment, CFO impersonation.

## Evidence references (repository)
- `docs/security/ROLE_AUTHORIZATION_CHAIN_REVIEW_2026-10-25.md`
- `docs/security/PROFILE_PRIVILEGE_ESCALATION_REVIEW_2026-10-25.md`
- `docs/security/INDIRECT_ROLE_ASSIGNMENT_REVIEW_2026-10-25.md`

## Acceptance state
No role migration, privilege grants, live data changes, or deployment in this change. This inventory is a prerequisite to implementing and testing a CEO root model.
