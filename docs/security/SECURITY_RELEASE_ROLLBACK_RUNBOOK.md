# VICE OS — Security release / rollback runbook

**Status:** Draft PR #17. Do not apply production database DDL before release approval.

## Preconditions
- All PR checks pass, including browser acceptance, release integrity, security regression tests and the production-safe publication check.
- Inventory every frontend/backend reference to `lookup_email_for_login`; communicate email-only sign-in and confirm executive and member access in staging.
- Validate certificate public response against privacy policy and certificate display expectations; assess if exposing holder names is appropriate.
- Test staged migration with anonymous, authenticated and privileged identities; record effective EXECUTE grants.
- Verify database backups and restore in a separate environment; document restoration evidence and incident contact.
- Independent CEO/CFO authorization is required for governance or financial operations. This security PR does not grant it.

## Safe rollout sequence
1. Publish and verify the email-only login frontend with representative test users; ensure access recovery and support process works.
2. Apply the certificate response-minimization migration in staging; verify positive/negative test vectors, no sensitive fields and frontend compatibility.
3. Apply the username-lookup REVOKE migration in staging; verify anonymous and authenticated callers cannot invoke it.
4. Obtain reviewed release approval and an operational rollback window.
5. Deploy the tested frontend, then apply the reviewed migrations to production; re-run grant checks and smoke tests.
6. Monitor authentication failure rate, 429 responses, certificate validation, security audit logs and executive account access.
7. Do not change OUV, unit balances, supply or executive governance gates as part of this release.

## Rollback
- Frontend: revert to a known-good build only if compatible with the database permission state.
- Database: revert certificate response only after privacy/legal approval; restoring sensitive fields is **not** an automatic rollback.
- Username lookup: do **not** automatically re-grant anonymous access, since doing so reopens enumeration. Prefer support-assisted email recovery.
- Preserve logs and forensic evidence. Escalate to a security incident if unexpected privilege changes or data disclosures occur.

## Exit criteria
All required CI checks pass, staging security tests pass, release approval recorded, production deployment verified, Supabase advisors reviewed and no new high-risk disclosure introduced.
