# VICE OS 1.3.6.10 — Backend integrity and production handoff
Updated: 2026-10-13. This is a verified engineering handoff, **not** a guarantee of complete production operation.

## What was applied directly to the connected production backend

Supabase project `sdsaewumabzjjvsmqqsl`. Schema migration
`vice_1377_trusted_audit_and_provisioned_dm` was applied successfully,
source-controlled with its exact production statements, and tested in a
ROLLBACK-only session.

- Revoked all direct authenticated/browser INSERT, UPDATE, DELETE, and
  TRUNCATE permissions on `public.audit_log`. Members can no longer
  create arbitrary `SUCCESS`/administrator-role audit records.
- Added `vice_record_client_activity(event_type,action,object_type,object_id)`.
  It requires a provisioned profile; server captures `auth.uid()`, labels
  rows `CLIENT_ACTIVITY / CLIENT_REPORTED / UNVERIFIED_CLIENT_EVENT`,
  and limits each member to twenty entries per minute. Authoritative
  events continue through audited server procedures/triggers.
- Direct-message RLS now requires a provisioned VICE member profile for
  the reader, sender, and recipient. Membership is checked by Postgres,
  not inferred from the UI.
- The Netlify TURN credential handler now requires both a valid Supabase
  Auth bearer token and the matching provisioned `profiles` record,
  verified with the caller's JWT. Failure results in HTTP 401, 403 or
  503; never in a relay credential. Each lookup has a timeout.

## Repeatable evidence

1. `node tests/vice-release-safety.cjs`
2. `node tests/vice-1367-contracts.cjs`
3. `node tests/vice-1369-integrity.cjs`
4. `node tests/vice-1378-audit-turn.cjs`
5. `bash scripts/vice-package-release.sh`

GitHub Actions performs these tests on the exact main-branch commit
and again inside its archived full-source ZIP. An offline TURN test
proves all six outcomes with deterministic mocked upstream responses;
it does **not** confirm a real media connection.

Database check: `has_table_privilege('authenticated',
'public.audit_log','INSERT') = false`, and
`has_function_privilege('anon',
'public.vice_record_client_activity(text,text,text,text)','EXECUTE') = false`.
A rollback-only supervised function call returned
`actor_role=CLIENT_REPORTED`,
`outcome=UNVERIFIED_CLIENT_EVENT` and left no test record behind.

All 35 regular public database tables have row-level security
enabled. Supabase currently reports no performance WARN-level
advisor findings. Supabase's security advisor still flags
exposed SECURITY DEFINER functions requiring continued review and
the Auth leaked-password protection option requiring the console.

## Public production remains a separate gate

Production Netlify was independently observed publishing 1.3.6.1
instead of the current GitHub 1.3.6.10. `/guide.html` failed a
previous production check. Tests and migrations **do not** change
Netlify's published files by themselves.

A secure production deployment workflow already exists:
`.github/workflows/vice-netlify-production.yml`. It is currently
blocked by missing **repository GitHub Actions secrets**
`NETLIFY_AUTH_TOKEN` and `NETLIFY_SITE_ID`.
Only the account owner can create Netlify credentials and store
them in GitHub repository Settings → Secrets and variables → Actions.
Never paste secrets into chat, source code, screenshots or issue comments.
Netlify website build settings must respect `netlify.toml`
(`dist/site` public-only build, `netlify/functions` serverless functions).
A manual `VICE_OS_NETLIFY_SITE.zip` deploy is frontend-only and
cannot install the private serverless functions on its own.

After the owner supplies those two protected secrets, run the secure
Netlify workflow and read its production smoke artifact. Do not
consider the release live unless `https://vice4x.netlify.app/version.json`
returns `1.3.6.10-AUDIT-PROVENANCE`, the guide opens, and two-account
login/mobile/function acceptance passes.

## Remaining independent live conditions

- Confirm actual email/password and OAuth sign-in, signup-invite
  redemption, password recovery email, session logout and iOS incognito.
- If cloud MT5 is desired, install operator-owned `METAAPI_TOKEN`
  as a Supabase Edge secret, then prove read-only DEMO data first;
  broker passwords must not enter the VICE website.
- Configure the TURN relay and Netlify variables
  `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `TURN_HOSTNAME`,
  `TURN_SHARED_SECRET`; test voice/video between consenting users on
  separate networks. Reject unprovisioned Auth accounts.
- Run two-member and admin-vs-holder negative authorization tests.
  Verify rates, custody, payments and appraisals outside the UI.
- Fix remaining security-advisor warnings after reviewing each
  SECURITY DEFINER RPC. Enable leaked-password protection in
  Supabase Auth dashboard. Do not revoke legitimate public invite
  and verification flows without replacing their usage.
- Cryptography is **not verified E2EE**. Internal price references
  VICE $2/V4X $320 do not establish independent fair market value.

**Stop condition:** If any sensitive/private operation fails an access
test or public production remains on the old build, keep the launch
status at `PENDING`, not 100%-certified.
