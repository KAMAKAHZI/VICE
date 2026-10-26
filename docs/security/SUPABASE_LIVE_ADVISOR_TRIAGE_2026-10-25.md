# Live Supabase Security Advisor Triage — 2026-10-25
Project: sdsaewumabzjjvsmqqsl
Source: connected Supabase get_advisors(type=security), read-only
Status: UNREMEDIATED; advisor findings are potential exposure, not demonstrated exploits.

## High-priority results
- 5 anonymous-callable SECURITY DEFINER functions: lookup_email_for_login(text), validate_invite(text,text), verify_certificate(text), verify_token_certificate(text), vice_sovereign_feed().
- 74 authenticated-callable SECURITY DEFINER functions. Examples requiring privilege/body audit: advance_iru_allocation, append_iru_event, create_iru_allocation, distribute_iru_allocation, issue_certificate, issue_holdings_consolidation. Execute privilege alone does not establish exploitable authorization bypass.
- 9 RLS-enabled/no-policy tables (intentional deny-all is possible): vice_exec_mfa_authorizations, vice_exec_mfa_requests, vice_ouv_auto_execution_receipts, vice_ouv_execution_receipts, vice_ouv_release_policy, vice_passkey_challenges, vice_passkey_credentials, vice_trusted_auth_sessions, vice_private.registry_requests.

## Mandatory validation before changes
1. Capture function definitions, ownership, search_path, grants and caller dependencies; distinguish intentionally public verifiers from unintended exposure.
2. Check anonymous username lookup for enumeration; stage email-only sign-in, invite and recovery first. Revoke lookup only after compatibility tests.
3. Inspect all authenticated SECURITY DEFINER functions for server-side role/ownership checks and safe search_path. Prioritize financial write functions.
4. Verify RLS/no-policy tables are intentional server-only deny-all. Never add permissive policies to clear advisory counts.
5. Validate staging schema parity, test anon/member/CEO/CFO role matrix and regression suites; record current-head CI and restore rehearsal.
6. Re-run advisors and record each finding disposition and approved remediation.

## Release rule
No production SQL, privilege changes, OUV execution, holder updates or release authorization is implied by this report. P0 issues block certification until resolved or independently reviewed.
