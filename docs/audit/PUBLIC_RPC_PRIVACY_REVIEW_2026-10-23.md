# Public privileged RPC assessment — verified against live function definitions

**Scope:** Read-only inspection. This document contains no user data or credentials.

| RPC | Public use | Observed behavior | Disposition |
| --- | --- | --- | --- |
| `lookup_email_for_login(text)` | Username login | Returns the matching unsuspended profile email. | **High privacy risk:** username-to-email enumeration. Replace with non-enumerating login mechanism, test username login, then revoke anonymous execution. Do not revoke prematurely. |
| `validate_invite(text,text)` | Invite onboarding | Validates code and email and returns invitee name. | Keep temporarily; add gateway throttling and review code entropy and response minimization. |
| `verify_certificate(text)` | Public credential verification | Returns holder name, course, dates, scores, digest and revocation reason. | Proposed response-minimization migration in this PR; verify legal basis for publicly exposing name/course. |
| `verify_token_certificate(text)` | Public IRU certificate verification | Validates structured ID and digest, returns limited metadata. | Retain after negative tests and authorization review. |
| `vice_sovereign_feed()` | Public governance feed | Returns proposal status, hashes, dates and CEO/CFO authorization status. | Review publication policy; distinguish historical attestation from independently verified signatures. |

## Security acceptance tests (required before production DDL)

1. With a disposable staging database, execute each RPC as `anon`, ordinary `authenticated`, suspended user, CEO and CFO. Compare permitted results with the product's published privacy policy.
2. Test malformed, null, overlong and brute-forced inputs; measure throttling at API gateway and RPC boundary. Never store raw secrets in test reports.
3. Verify no private email, scores, digests, revocation narrative, authentication challenge, or raw signing evidence reaches an unauthorized caller.
4. Test login by username before removing `lookup_email_for_login`. Replacing username lookup with an unverified frontend transformation will break existing users.
5. Verify that the public governance feed does not treat unverified CFO device attestation as cryptographically verified authorization.
6. Run negative authorization tests for all authenticated privileged financial RPCs and inspect nested calls, `search_path`, default PUBLIC grants and effective `auth.uid()` checks.
7. Rerun Supabase security advisors; linter counts are signals, not the sole acceptance criterion.

**Release gate:** This PR is a remediation candidate, not a deployable authorization to change production. CEO/CFO governance execution remains fail-closed.
