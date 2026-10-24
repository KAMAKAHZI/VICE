# VICE OS — Invitation Email and Outbox Recovery

## Root cause boundaries
- `supabase/email-templates/invite.html` is the branded **Supabase Auth** invitation. It is not installed merely by committing HTML to GitHub.
- `server/mailer.js` handles **email_outbox** transactional events. The worker is started by `server/server.js`, not by Netlify static hosting.
- Production read-only inspection found 75 PENDING messages (67 token certificate, 8 revocation) and no INVITE_EMAIL records. This does **not** establish whether SMTP credentials are valid or whether the worker is deployed.
- Do not replay the 75 messages before reviewing event age, recipient accuracy, revocation supersession and duplicate risk.

## Configure authentication invitation template
1. In the **correct production Supabase project**, open Authentication → Email Templates → Invite user.
2. Paste the full content of `supabase/email-templates/invite.html` as the HTML body. Set subject to `VICE OS | Your Secure Invitation`.
3. Confirm that `{{ .ConfirmationURL }}` remains unmodified and that the Auth redirect URL allowlist includes the intended HTTPS VICE OS callback.
4. Save the template, send a **single invitation to an authorized test inbox**, and inspect the actual received MIME body on iOS Mail and Gmail (dark/light mode). Verify button and fallback link, one-time token expiry, and sign-in landing behavior.
5. If the received email is still blank, inspect the actual sender and provider logs. Supabase Auth's template is distinct from the SMTP outbox worker. Do not claim the Auth template was applied based on a repository commit.

## Restore the transactional mail worker
1. Deploy `server/` as a **persistent Node service** using `npm ci --omit=dev`; Netlify's static site alone does not run its interval worker.
2. Configure server-side-only environment variables: `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`. Never commit or expose their values.
3. Keep VICE LINK bound to loopback behind an authenticated reverse proxy; do not expose service-role credentials or unauthenticated health/metrics externally.
4. Verify the server health output shows `email: SMTP_CONFIGURED`, then inspect worker logs for `mailer_db_error` and `mail_retry`.
5. Test a **single newly created synthetic outbox record to a controlled test inbox**, verify SENT and actual receipt, and confirm no duplicate delivery.
6. Before releasing historical messages, classify them by age and event type; prioritize current revocation notices, suppress superseded certificate notices where legally appropriate, and get an explicit approval for bulk delivery.
7. Monitor pending/failed/sent counts and sender bounce reports. Do not mark messages SENT without SMTP confirmation.

## Acceptance gate
- Auth invite HTML and text body visibly populated in a real delivered email.
- Invite link resolves only to the configured HTTPS application.
- Worker sends one synthetic test successfully and records status correctly.
- Backlog remediation approved separately; no blind bulk sending.
