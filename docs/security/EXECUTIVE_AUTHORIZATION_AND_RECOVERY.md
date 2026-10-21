# VICE4X · Executive authorization and recovery

Policy: **VICE-EXEC-AUTH-2**. Adopted for the internal governance workflow through the founder's October 21, 2026 repair directive. The database records the effective time when this migration is applied. This is an internal authorization policy; it does not assert external legal recognition, on-chain attestation, or lender acceptance.

## Approve a proposal

1. Sign in to your own CEO or CFO account. Open **Sovereign Governance** and review the exact proposal, reference pair, payload hash and remaining execution gates.
2. Choose **Authorize proposal with 2FA**, or **Sign with verified device key** on a browser holding your registered key. Both methods count equally toward internal CEO/CFO authorization.
3. For 2FA, select your own verified authenticator, enter its current six-digit code, and confirm the exact action. Wait for server confirmation. An incorrect code or failed server commit is an error, not an approval.
4. Each role counts once. Existing approvals remain valid, including approvals recorded before this release. “Your executive approval is verified” means no re-signing is needed.

**Reject proposal with 2FA** closes the reviewed proposal after fresh authentication. Earlier approvals remain in history. **Authorize halt with 2FA** locks structural transitions. Neither action changes unit quantities or official reference values.

Two executive approvals do not execute a reference revision. Public review, independently verified quorum, the subsequent 72-hour timelock and a configured executor remain separate requirements. The current deployment does not contain a functioning on-chain quorum verifier or structural executor.

## Authenticator setup

Open **Security Center → Manage authenticator MFA**. Scan the setup QR in your own authenticator or use the manual key inside that authenticated screen. Verify the code before setup is considered complete. Closing the setup clears its secret from the rendered dialog.

Keep a secure backup authenticator. Adding a backup requires an existing authenticator code. Supabase enforces higher assurance when enrolling another factor after a verified factor exists. Codes are sent directly to Supabase Auth, never to the institutional Edge Function. The application does not log or persist them.

Do not send passwords, authenticator setup keys, one-time codes, session tokens, private keys or recovery phrases to support or chat.

## Inspect a device key

**Security Center → Check identity, key & MFA** shows your designated role, public-coordinate fingerprint, local candidates, registered-key match and authenticator availability. Governance and recovery use the same resolver. It searches the original governance store and historical recovery stores, promotes only a public-key match to the current identity-scoped entry, and preserves the original copies.

Private CryptoKeys remain nonextractable. A missing or wrong key is never replaced merely by pressing Sign. Use 2FA for current approvals; use controlled recovery to replace a lost key.

## Replace a CEO or CFO signing key

1. The affected executive opens **Recover my signing key**. A nonextractable replacement key is saved separately on that browser. Its public key is bound to a resumable request.
2. The requester verifies fresh 2FA. The request becomes pending for the other executive.
3. The other executive opens **Refresh recovery status**, checks the request and replacement fingerprint, and approves with their registered key or fresh 2FA. Self-approval is rejected server-side.
4. After the server-enforced 60-second cooldown, the requester refreshes status and chooses **Verify 2FA & activate replacement** on the browser holding the replacement key.
5. Activation requires fresh requester MFA and a signature by the replacement key. The server archives the old public key, replaces the active key atomically, and invalidates outstanding old-key challenges. Historical approvals remain intact.

Do not clear browser storage while a request is pending. If the bound replacement key is unavailable, cancel the request and start a new one. An expired request cannot activate. The requester can cancel; the independent executive can reject. These decisions retain the history.

## Loss of all authenticators / both signing devices

A working authenticator is sufficient for approval even when both device keys are lost. Each executive can then follow the independent recovery procedure above. Loss of every authenticator is a separate identity-recovery dependency: this release deliberately provides no email-only or founder-only factor reset.

For complete factor loss, the authorized Supabase project security administrator must verify identity through an established independent channel, document an incident, obtain distinct executive/authorized trustee review, apply a documented waiting period, notify affected executives through known channels, and retain the evidence before a provider-side factor reset. Keep governance operations restricted during review. If independent identity evidence or the required reviewers are unavailable, recovery remains blocked. No provider reset or independent identity service was executed or certified by these tests. Passkeys and recovery-code issuance are not implemented by this release.

## Receipts and operational controls

**Export authorization receipts** includes the policy, approval method, bound challenge/hash, timestamps, relevant client build, available public-key snapshots, legacy TOTP receipts, key history and hash-chain audit events. TOTP records contain no fabricated device signature. Public governance exposes role/method/status, never private keys, factor secrets, raw signatures or executive identities.

Fresh action proof expires after five minutes. The same Auth challenge cannot authorize two actions. Server checks require the same user/session, a verified owned TOTP factor, a fresh Auth verification, current executive role, matching proposal/recovery context and an unused nonce. The UI limits attempts and preserves retry of server confirmation when Auth verification already succeeded. Supabase provides the underlying authenticator rate limits.

Historical approvals without a safely identifiable public-key snapshot are preserved as historical records; the application does not claim a later replacement key made the earlier signature. New key-based approvals capture the registered public key. Audit hashes demonstrate database-chain consistency, not independent external anchoring.

## Certificate exports

The IRU certificate SVG uses native SVG text and inline artwork, avoiding the HTML foreignObject that caused canvas export SecurityError. PNG, SVG and Print/Save PDF use the same issuance data. If the browser blocks PNG, an explicit notice accompanies an SVG fallback. Status and verification references remain present, including revoked status. Academy exports retain their separate eligibility and simulation checks.

Automated Chromium checks cover desktop and mobile widths. Physical iPhone Safari/PWA, Firefox and Edge execution was not available in this environment; use the SVG or Print/Save PDF path if that browser restricts image export.

## Release and recovery procedure

The additive migration is `20261021115000_vice_executive_mfa_authorization.sql`. Apply it after existing governance and recovery schema. Deploy `vice-institutional` with JWT verification enabled, then the matching frontend build. The old raw-code endpoint instructs clients to refresh; legacy authorization receipts are retained and counted. Newly versioned RPC names avoid ambiguous old overloads.

Schema snapshots under `docs/production-repair/2026-10-21-executive-auth-*.sql` are diagnostic backups, not automatic rollback scripts. During an incident, retain all new records and keys. Roll forward with corrected functions; never restore the old recovery code wholesale or drop new tables after new approvals have been recorded. A frontend rollback alone cannot safely restore the retired endpoint.

Primary implementation references: [Supabase MFA guide](https://supabase.com/docs/guides/auth/auth-mfa), [Supabase Auth MFA implementation](https://github.com/supabase/auth/blob/master/internal/api/mfa.go).
