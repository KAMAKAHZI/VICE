# Phase 3 consolidated gate — 2026-10-25

## Read-only live verification
Production project sdsaewumabzjjvsmqqsl has profiles, vice_exec_mfa_requests, vice_exec_mfa_authorizations and vice_exec_signers.
Staging project mzdybvxvmbigaylleqbt has profiles but does NOT have the other three MFA tables. This is a verified environment-parity blocker for realistic role-delegation MFA testing.

## Confirmed safeguards
- Ordinary authenticated callers lack UPDATE grants for profiles.role and profiles.account_revoked; they have limited profile-column UPDATE grants.
- Role assignment function requires active SUPER_ADMIN, prohibits self-elevation and modifying existing SUPER_ADMIN, and audits changes.
- Financial allocation RPCs check account status and registry operator authorization.
- Executive MFA request/finish infrastructure supports governance approval and recovery, with service-role-only finish.

## Confirmed gaps
P0: vice_assign_member_role does not consume fresh action-bound MFA.
P0: staging lacks required executive MFA tables; do not apply isolated fragments of production schema.
P1: anonymous lookup_email_for_login exposes email associated with valid username.
P1: review authenticated-callable SECURITY DEFINER functions, including all financial writers, with negative role tests.
P1: legacy JWT without session_id bypasses the session existence subcheck of account_allowed.
P1: verify role mutation via triggers/other RPCs and server verifier factor validation.
P1: 9 RLS-enabled no-policy tables need intentional deny-all vs missing-policy classification.

## Complete phase 3 release acceptance criteria
1. Reconcile staging from reviewed migrations or an approved scrubbed schema-only production baseline, including functions, grants, triggers, policies and MFA tables.
2. Add ROLE_ASSIGN to challenge creation, server verification and one-time consumption atomically; bind actor, target ID, new role, reason digest and expiry.
3. Test staging as anonymous, holder, suspended member, CFO, SUPER_ADMIN and service-role; include replay, substitution and expiry cases.
4. Replace username-to-email lookup safely and remove anonymous EXECUTE after client compatibility tests.
5. Run regression suite, Supabase security advisors and verified CI on exact reviewed SHA.
6. Independent review and explicit deployment approval before production changes; never automatically publish OUV or alter IRU balances.

## Status
Phase 3 discovery substantially advanced, but NOT remediated or certified. No production DDL, data writes, deployment or governance execution performed.
