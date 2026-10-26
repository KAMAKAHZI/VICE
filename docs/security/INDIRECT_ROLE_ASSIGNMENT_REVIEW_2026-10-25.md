# Production indirect role-escalation review — 2026-10-25
Project: sdsaewumabzjjvsmqqsl
Method: read-only pg_proc inspection. No role changes or test mutations.

## Identified delegated-role endpoint
public.vice_assign_member_role(uuid,text,text) is SECURITY DEFINER with empty search_path. Anonymous EXECUTE=false; authenticated EXECUTE=true. Its body requires vice_private.require_active_account(), auth.uid(), and public.is_super(). It disallows self-role changes and changes to existing SUPER_ADMIN accounts, restricts new roles to HOLDER, EXECUTIVE, COMPLIANCE_OFFICER, FINANCE_OFFICER, TREASURY_OPERATOR, LEGAL_OFFICER, AUDITOR; requires a reason; writes an audit event.

public.is_super() uses vice_private.account_allowed() and public.profiles.role='SUPER_ADMIN' for the current auth.uid(). Ordinary members therefore do not appear able to call the role assignment endpoint successfully based on inspected code.

## Outstanding material risks
- A compromised SUPER_ADMIN session can delegate FINANCE_OFFICER without fresh action-bound MFA or independent approval in this function body. Confirm compensating server-side controls before allowing sensitive role delegation.
- Confirm audit_log immutability and role-change event completeness.
- Audit all alternate role-mutating functions, triggers, and service-role code paths.
- Staging tests required for ordinary-member rejection, self-change rejection, protected-admin rejection, stale/revoked sessions, and authorized executive role delegation.
- Confirm privilege grant consistency and no caller-controlled metadata role decisions.

## Release gate
Do not assert full escalation resistance from source inspection alone. No production SQL mutations, holder changes, OUV updates or deployment performed.
