# Production role authorization chain review — 2026-10-25

Project: sdsaewumabzjjvsmqqsl
Method: read-only introspection of vice_private.is_registry_operator(), require_active_account(), and account_allowed(). No profile or holder rows retrieved.

## Observed controls
- is_registry_operator(): SECURITY DEFINER, fixed search_path=pg_catalog, not executable by anon/authenticated directly. Requires account_allowed() and a profiles row whose id equals auth.uid() with role SUPER_ADMIN or FINANCE_OFFICER.
- require_active_account(): SECURITY DEFINER, fixed search_path=pg_catalog, no direct anon/authenticated EXECUTE; denies if account_allowed() is false.
- account_allowed(): checks non-null auth.uid(), existing nondeleted/unbanned auth.users record, profile and linked-holder suspension/revocation/closure flags; validates session_id against auth.sessions IF the JWT supplies a nonempty session_id.

## Unresolved authorization questions / risks
1. Confirm profiles.role cannot be updated by a normal authenticated user through table policies, views, triggers or other RPCs. This is a critical dependency; role checks are only secure when role assignment is controlled.
2. Verify trusted profile creation and role elevation require independent privileged authorization, never user_metadata.
3. Confirm whether legacy tokens without session_id are accepted by design: account_allowed currently skips session existence validation when session_id is absent. Evaluate strict session binding after real-client compatibility testing.
4. Review holder-email fallback association against verified email and controlled enrollment; confirm no identity confusion.
5. Test account_allowed negative matrix in staging: suspended, revoked, banned, deleted, expired session, missing profile, and ordinary member.
6. Inspect nested functions and grants for any alternate privilege path.

## Operational note
An attempt to inspect profile policies via connected read-only SQL was blocked by tool safety controls; no conclusions about profile role-update permissions can be drawn from that missing evidence. Do not claim full authorization verification.

## Release
No SQL mutation, user data access, OUV execution or production deployment authorized. Treat profile role-update protection and session binding as outstanding P0 review gates.
