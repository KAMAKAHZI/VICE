# Production profile privilege-escalation review — 2026-10-25
Project: sdsaewumabzjjvsmqqsl
Read-only catalog inspection; no member data accessed or changed.

## Confirmed SQL role grants
- authenticated has no table-wide UPDATE on public.profiles.
- authenticated has no UPDATE on profiles.role or profiles.account_revoked.
- authenticated has UPDATE on profiles.name and a limited set of presentation/contact fields.
- profiles_self_update policy restricts row id to auth.uid() in USING and WITH CHECK.
- profiles_self_read limits row id to auth.uid().
- vice_active_account_guard applies account_allowed() to ALL actions. Postgres policy permissiveness/combination and column-level privileges both matter.

## Assessment
Direct authenticated table updates cannot set profiles.role or profiles.account_revoked through the checked grants. This closes the specific *direct column-update* escalation concern, but does NOT establish absence of privileged RPC, trigger, view or indirect escalation paths. The all-actions account guard is not a substitute for column grants or a complete row authorization policy.

## Follow-up gates
- Inspect all routines/triggers capable of updating profiles.role, account_suspended, account_revoked or vip_access.
- Inspect role elevation workflow and service-role access.
- Verify policies and grants in staging using real anon/member/executive JWT role matrix, not forged auth.uid() claims.
- Check whether email/username changes can affect account linking and member identity.
- Re-run advisors and CI on exact merge SHA.

No production DDL, privilege changes, governance actions or OUV updates performed.
