# VICE OS — Supabase Security and Performance Advisor Evidence

**Observation date:** 2026-10-22 (read-only connected Supabase advisor and catalog queries)
**Project:** `sdsaewumabzjjvsmqqsl`
**Assurance:** Triage evidence only. Findings are linter signals, **not** an external security assessment, confirmed exploits, or an authorization to modify production.

## Findings recorded (119 advisory instances)

| Source | Advisory | Level | Count | Disposition |
| --- | --- | --- | ---: | --- |
| Security | RLS enabled, no policy | INFO | 7 | REVIEW: may intentionally deny browser access |
| Security | `anon` may execute `SECURITY DEFINER` | WARN | 5 | P0 review of expected public RPCs and privacy |
| Security | `authenticated` may execute `SECURITY DEFINER` | WARN | 72 | P0 inspect per-function authorization and permissions |
| Security | Leaked-password protection disabled | WARN | 1 | P0 configuration review/enablement |
| Performance | Foreign keys without covering indexes | INFO | 7 | Query-plan review before index migrations |
| Performance | Indexes with no recorded usage | INFO | 27 | No removal without representative workload evidence |

**Total:** 85 security instances + 34 performance instances = 119 advisor instances. This is **not** 119 confirmed vulnerabilities.

## Five anonymously executable privileged functions (confirmed with read-only `pg_proc` ACL checks)

1. `public.lookup_email_for_login(p_identifier text)` — privileged SQL returns an email for an existing eligible username. **Potential account enumeration and privacy issue:** review rate limits, anti-enumeration policy, and whether revealing an email before login is required.
2. `public.validate_invite(p_code text, p_email text)` — checks matching invite code and email, then returns a validity indicator and name. May be required for onboarding; test brute-force throttling and minimal response data.
3. `public.verify_certificate(p_cert_id text)` — publicly returns certificate validity and, when valid, holder name, course, `scores` and `overall_score`. **Privacy review required:** confirm those personal attributes are deliberately public and consent/data-minimization requirements are satisfied.
4. `public.verify_token_certificate(p_cert_id text)` — validates structured certificate IDs and a digest, returning only selected public attributes. Appears designed as a public verifier; test guessability and scope.
5. `public.vice_sovereign_feed()` — exposes selected governance proposal/reference details and CEO/CFO authorization statuses. Review which fields are intended for public release and whether any pending items should be restricted.

All five are marked `SECURITY DEFINER` and callable by `anon`. **Do not revoke all five blindly**: login, invitation validation, certificate verification, and transparent public governance may intentionally depend on them.

## Sample of authenticated privileged financial functions

Read-only `pg_get_functiondef` inspection found server-side checks in the following `SECURITY DEFINER` functions:

- `advance_iru_allocation(uuid,text)`
- `append_iru_event(jsonb,uuid)`
- `create_iru_allocation(uuid,text,numeric,numeric)`
- `distribute_iru_allocation(uuid,uuid)`

Each inspected implementation calls `vice_private.require_active_account()` and rejects users without `auth.uid()` and `vice_private.is_registry_operator()`. The examined code also contains supply, state-transition or transaction-lock safeguards. **This narrows risk for those four functions but does not certify their helpers, nested calls, ownership changes, concurrency or every one of the 72 exposed functions.** Preserve these access checks through future migrations and test as unauthorized users in disposable databases.

`vice_exec_finish(uuid,uuid,text)` was confirmed **not executable** by `anon` or `authenticated` in the queried live database; this is a separate service-only signing boundary.

## Seven RLS-enabled tables lacking policies

`public.vice_exec_mfa_authorizations`, `public.vice_exec_mfa_requests`, `public.vice_ouv_release_policy`, `public.vice_passkey_challenges`, `public.vice_passkey_credentials`, `public.vice_trusted_auth_sessions`, and `vice_private.registry_requests`.

These may correctly enforce deny-by-default access and be operated only through vetted server functions. Do **not** add permissive policies simply to silence the advisory. Confirm required access and explicit `GRANT`s in a disposable staging environment before any migration.

## Priority remediation gates

1. **P0:** Review public email lookup and certificate verification against privacy, throttling, public disclosure, and exact response-minimization requirements; preserve intentional public UX.
2. **P0:** Review leaked-password protection configuration with the Auth owner and enable only following change approval and login regression testing.
3. **P0:** Catalog all 72 authenticated privileged functions, their call graph, role checks, search paths, `EXECUTE` grants, and service-only boundaries. Do not interpret the count as automatically unsafe.
4. **P1:** Test anonymous and signed-in denial pathways against production-equivalent disposable PostgreSQL, checking returned data and side effects.
5. **P1:** Review seven foreign-key index gaps against actual query plans and workloads; treat unused-index metrics as observational only.
6. **P1:** Rerun advisors after approved remediations and record before/after snapshots.

## Vendor remediation references

- Anonymous `SECURITY DEFINER`: https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable
- Authenticated `SECURITY DEFINER`: https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable
- RLS with no policy: https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy
- Leaked-password protection: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection
- Foreign-key indexing: https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys

**Write boundary:** No Supabase migrations, grants, functions, Auth settings, holder units, valuations, or production deployments were changed during this evidence collection.
