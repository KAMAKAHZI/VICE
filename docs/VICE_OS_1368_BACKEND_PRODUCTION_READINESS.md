# VICE OS 1.3.6.8 | Backend acceptance and go-live boundary

**Read-only acceptance:** 2026-10-13 UTC. [GitHub Actions verified evidence](https://github.com/KAMAKAHZI/VICE/actions/runs/38343511186). Six of six isolated, anonymous, real Supabase API checks passed. This is **not** an authenticated-user or full third-party service certification.

| Gate | Result |
|---|---|
| Supabase Auth API health (with public project key) | PASS, HTTP 200 |
| Unknown Academy certificate returns invalid | PASS, HTTP 200 |
| Unknown invite remains invalid/private | PASS, HTTP 200 |
| Anonymous profile query leaks zero rows | PASS, HTTP 200, 0 rows |
| Anonymous cloud MT5 account query denied | PASS, HTTP 401 |
| MT5 Edge Function does not allow unowned anon session | PASS, HTTP 401 |
| Supabase project status | ACTIVE_HEALTHY at test time |
| Public tables protected by RLS | 35/35 from prior DB integrity result |
| Canonical issuer reference ledger | $2 VICE / $320 V4X, internal reference only |
| Real signed-in browser login / existing account | NOT TESTED |
| Netlify public production version | NOT UPDATED: external smoke observed 1.3.6.1 |
| MetaApi account connection and live order execution | NOT TESTED |
| Multi-user live WebRTC calling | NOT TESTED |
| Chat E2EE/custody/financial market value audit | NOT VERIFIED |

**Backend RPC coverage:** Frontend calls 19 named Supabase RPCs, all of which exist as deployed PostgreSQL functions; `vice_operational_health` adds a guarded issuer diagnostic. Owner read-only health function returned PASS under an explicit test transaction impersonating an existing super-admin identity; that test **does not** authenticate the real user in a browser. The actual login issue will persist on public Netlify until the deployment step below.

## Release operator action

The exact source and public-only site ZIPs are reproducibly built in GitHub Actions. The Netlify deployment workflow cannot execute without private repository secrets `NETLIFY_AUTH_TOKEN` and `NETLIFY_SITE_ID`. Configure them within GitHub repository **Settings → Secrets and variables → Actions**, then run [VICE OS secure Netlify publish](https://github.com/KAMAKAHZI/VICE/actions/workflows/vice-netlify-production.yml). The deploy checks HTML, scripts and assets and then compares the published site against the GitHub release. Do not share either secret in chat.

**Owner acceptance afterward:** Test existing email/password login and username login, password recovery, private browsing, authorized holder sidebar, holders/distributions, Academy certificate flow, invites, governance voting, ownership boundaries, external financial links, signed document download, calls across two distinct networks, source-provider market data and deliberate sign-out. Confirm no other user's financial information is returned.

## Remaining platform hardening

Supabase Security Advisor still flags three **intentionally public** `SECURITY DEFINER` operations for username login, invite validation, and certificate lookup; treat username/email enumeration and rate limiting as open items. Public function exposure must be reviewed against abuse prevention; use CAPTCHA and rate limits before public marketing. Enable leaked password protection in Supabase Auth settings. Security Advisor's authenticated-definer notices reflect privileged RPCs with internal role checks and still require a formal audit. No verified E2EE or liquid valuation claim is made.

The owner reference values ($2/$320) are **not** exchange prices, independently appraised fair market value, available credit, guarantees or proof of Ethereum mainnet custody. Do not market unit reference values as cash.

**Engineering principle:** Passing schema, static, anonymous API and packaged ZIP tests establishes a sound release candidate. Nothing short of successful authenticated production transactions across intended modules establishes verified end-to-end functionality.
