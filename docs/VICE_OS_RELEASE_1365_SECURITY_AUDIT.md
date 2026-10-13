# VICE OS 1.3.6.5 — Production Recovery and 1.3.6.6 Security Audit

**Canonical site source:** GitHub `main`. **Identity/backend:** Supabase `sdsaewumabzjjvsmqqsl`. **Release date:** 2026-10-12 (US/Eastern).

## Incident fixed in GitHub source

The reported login toast, `Access not provisioned: CloudMT5.reset is not a function`, came from an optional Cloud MT5 module incorrectly aborting post-authentication setup. Version `1.3.6.4-LOGIN-HOTFIX` added a reset interface and safe fallback. Version `1.3.6.5-AUTH-DIAGNOSTICS` adds diagnostics available from the login screen and account controls, repairs browser session reset storage key, improves the login button and isolates optional module failures from verified membership access.

**A successful GitHub release-integrity action verifies selected source checks; it does not verify an actual Netlify deployment or user login.** Confirm Netlify is linked to `KAMAKAHZI/VICE` `main`, publish path `.`, and that live `/version.json` equals the loaded HTML version. The query `?build=1364` is not a deployment command.

## Back-end migrations applied

1. `vice_1365_foreign_key_performance_indexes`: 14 missing FK supporting indexes added; Supabase performance advisor no longer flags unindexed foreign keys.
2. `vice_1366_high_priority_row_security_hardening`: owner-scoped broker/external accounts; self-service nonprivileged profile edits only; restricted treasury/compliance/holder/allocations/distributions; private document metadata; channel ACLs and protected audit rows. `profiles.role` and `vip_access` cannot be directly rewritten from an ordinary client.
3. `vice_1366_verified_academy_certificate_awards`: issue_certificate validates seven passing **server-graded** modules against recorded attempts; client-supplied scores, hash and salt do not determine awards.

The deployed MetaApi Edge Function `vice-mt5-cloud` is active, version 9 at inspection, and configured to require Supabase JWT. Its provider activation has **not** been confirmed. Operators must provision `METAAPI_TOKEN` in **Supabase Edge Secrets only**. Browser code never collects broker passwords. Hosted cloud MT5 remains read-only; do not claim live trade execution or guaranteed sync.

## Security risks requiring operator attention

- Rate-limit anonymous `lookup_email_for_login`; its response can facilitate membership-email enumeration. Avoid breaking username login when adding anti-abuse controls.
- Enable/configure Supabase leaked-password protection and review MFA/email verification configuration.
- Review SECURITY DEFINER function grants for authorization and abuse limits; some public certificate verification/invite endpoints are intentional.
- Review remaining advisor categories: RLS auth initialization performance, multiple permissive policies, and RPC-only RLS tables. Seven policy-less RPC-only tables are deliberately inaccessible through client grants.
- Verify that message and call encryption meets required threat model before using end-to-end encryption language.
- Do not run historic `supabase-setup.sql` on a deployed database; it is now explicitly marked **legacy unsafe**.

## Operator acceptance checklist

1. **Publish:** Netlify production deploy identifies current GitHub commit; live `version.json` displays `1.3.6.5-AUTH-DIAGNOSTICS`. Test new tab, mobile, Safari and normal (non-incognito) mode.
2. **Auth:** email+password, username+password, Google OAuth, password recovery, logged-out/login repeat, invalid/used/wrong-email invitations. Confirm signed-in navigation no longer shows CloudMT5 reset errors.
3. **Roles:** test actual invited ordinary HOLDER and SUPER_ADMIN accounts; a holder cannot read another person's financial records, staff channels or mutate their own role. Admin actions require correct privileges.
4. **Academy:** seven server-graded passes produce a certificate; fake scores before passing must fail.
5. **MT5:** provision operator token and connect one provider-hosted DEMO investor-password account. Only then verify a real LIVE USD account is independently reported as real, fresh, matching and nonduplicated.
6. **Calls:** TURN endpoint secrets in Netlify, reachable TURN relay and voice/video call from separate networks. Test messaging, read receipts and offline behavior.
7. **Records:** support tickets, documents, private storage (10 MB bucket cap), governance, IRU cap/invariants, ledger reconciliation, reference-price separation, and profile edit.
8. **Feeds/UI:** Yahoo function timeouts/rate limits, chart/chart modal, mobile sidebar, wallet exposure, external connectors and permissions.
9. **Signoff:** document test IDs, deploy SHA, evidence, responsible operator and time. **No 100% production certification** before passing outside-provider/role acceptance.

The user manual, audit document, and operator runbook are also available in the attached VICE OS deliverable package for this remediation session.
