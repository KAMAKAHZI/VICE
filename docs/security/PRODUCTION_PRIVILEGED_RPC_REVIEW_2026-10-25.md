# Production privileged RPC code review — 2026-10-25
Project: sdsaewumabzjjvsmqqsl
Method: read-only pg_proc/pg_get_functiondef inspection; no user data queried or changed.

## Confirmed exposure requiring remediation
public.lookup_email_for_login(p_identifier text): SECURITY DEFINER, anon EXECUTE=true, authenticated EXECUTE=true. It returns an active profile's email when supplied a unique username. This is a concrete account-email disclosure / enumeration surface. Staging migration must remove client dependency and test email-only login, invitations and recovery before revoking anonymous and authenticated EXECUTE in production. Do not silently break existing users.

## Reviewed privileged financial RPCs (not proven vulnerable)
- advance_iru_allocation: anon=false, authenticated=true; requires active account, auth.uid(), registry-operator authorization; validates state transitions and reserve capacity; fixed empty search_path.
- create_iru_allocation: anon=false, authenticated=true; checks operator role, canonical price, program, unit limits, eligible holder; fixed empty search_path.
- distribute_iru_allocation: anon=false, authenticated=true; checks operator, reserved state, recipient, correlation and uses ledger append; fixed empty search_path.
- append_iru_event: anon=false, authenticated=true; active account/operator checks and event allowlist; full body requires dedicated follow-up inspection and adversarial testing.

Authenticated EXECUTE alone does not establish bypass: function-body authorization is material. No production privilege modifications performed.

## Release blockers
1. Replace username lookup UI dependency, prove account recovery and staged migration, then revoke legacy function EXECUTE.
2. Verify vice_private.is_registry_operator and require_active_account definitions, roles and tests against forged metadata.
3. Exercise negative role matrix on isolated staging (anon, ordinary member, CFO, reserve operator) with rollback and financial invariants.
4. Independently review all remaining privileged RPCs and current Supabase advisors.
5. No OUV execution or price publication until independent governance and valuation release gates pass.
