# VICE OS / Security Operations Guide

Internal engineering • 2026-10-15 UTC • 1.3.8.0-IRU-CERTIFICATES

Keep NETLIFY_AUTH_TOKEN and NETLIFY_SITE_ID in GitHub repository secrets. Service-role, TURN shared secrets, SMTP and broker provider credentials belong only in server-side environments. Revoke and replace exposed credentials; inspect deployment logs without printing secret values.

This repair retains RLS and financial write gates. It adds stale-response checks, member cache cleanup, confirmed profile saves, avatar MIME allowlisting, encoded-message size checks and removal of cross-tab chat delivery that bypassed database subscription ACLs.

Known security limitations: predictable legacy chat keys; new private call signaling still requires authenticated two-party acceptance; incomplete authenticated role-matrix testing; no complete dependency vulnerability certification; no newly enforced CSP. Existing inline scripts/styles require a reviewed CSP migration rather than a breaking blanket policy. Current headers include nosniff, frame denial, HSTS and no-store.

For an incident: suspend the affected integration, revoke affected sessions/secrets, preserve audit evidence, identify impacted records and reconcile through authorized correction procedures. Never delete financial history. Enable leaked-password protection in Supabase Auth if the account plan permits. Confirm settings and recovery delivery with staging accounts.
