# VICE OS / Security Operations Guide

Internal engineering • 2026-10-16 UTC • 1.3.8.0-IRU-CERTIFICATES

Keep NETLIFY_AUTH_TOKEN and NETLIFY_SITE_ID in GitHub repository secrets. Service-role, TURN shared secrets, SMTP and broker provider credentials belong only in server-side environments. Revoke and replace exposed credentials; inspect deployment logs without printing secret values.

This repair retains RLS and financial write gates. It adds stale-response checks, member cache cleanup, confirmed profile saves, avatar MIME allowlisting, encoded-message size checks and removal of cross-tab chat delivery that bypassed database subscription ACLs.

Public IRU verification now returns a strict status/integrity allowlist. Holder identity, balances, snapshots and internal revocation notes are excluded. Academy chapter receipts have owner-only reads and RPC-only writes; new awards require backend progress and grades. Strategic issuance reversal validates exact source identity/quantity, issuer authority and idempotency in one audited transaction. A separate database-operator path records its actual operator role, without impersonating an authenticated member.

Known security limitations: predictable legacy chat keys; new private call signaling still requires authenticated two-party acceptance; incomplete authenticated role-matrix testing; no complete dependency vulnerability certification; no newly enforced CSP. Existing inline scripts/styles require a reviewed CSP migration rather than a breaking blanket policy. Current headers include nosniff, frame denial, HSTS and no-store.

For an incident: suspend the affected integration, revoke affected sessions/secrets, preserve audit evidence, identify impacted records and reconcile through authorized correction procedures. Never delete financial history. Enable leaked-password protection in Supabase Auth if the account plan permits. Confirm settings and recovery delivery with staging accounts.

Advisor findings at the October 15 audit: [16 RLS tables without policies](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy), [four anonymous definer functions](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable), [38 authenticated definer functions](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable), and [disabled leaked-password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection). Some tables deliberately permit only RPC/service access. Definer-function exposure is not by itself proof of unauthorized access; each callable body requires authorization review. Do not broaden grants merely to clear a warning.
