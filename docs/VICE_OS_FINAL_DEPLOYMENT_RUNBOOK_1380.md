# VICE OS 1.3.8.0 · One-Publish Final Operator Runbook

**Prepared October 13, 2026.** This document accompanies the signed-off source and static Netlify site packages. It distinguishes validated source and applied Supabase migrations from live acceptance. It is not a claim that the public website has already published this revision.

## 1 · What is already done

The existing VICE OS 1.3.6.11 full source and secure Netlify site are retained. The index now additionally supports issuer-triggered IRU certificates, QR + Code39 identifiers, full historical two-program holdings snapshots, PNG/PDF export, issuer revocation, period consolidation, certificate lists in My IRU and Documents, and status tags on recorded distributions. The standalone verification page calls `verify_certificate` for VCA and `verify_token_certificate` for VCT records. User-provided names and record values are escaped before insertion into HTML or SVG.

Supabase project `sdsaewumabzjjvsmqqsl` is ACTIVE_HEALTHY. Migrations `vice_1380_verified_portfolio_token_certificates`, `vice_1381_bind_all_certified_portfolio_fields`, `vice_1382_transactional_mail_outbox`, and `vice_1383_distribution_certificate_on_issuer_paid` have been applied successfully. New tables `token_certificates` and `email_outbox` have row level security enabled. The outbox is **private**; authenticated clients cannot read it. Certificate records are readable by their linked holders or SUPER_ADMIN; public verification uses a restricted single-ID RPC, not unrestricted table access.

**The ledger writes unit balances only once.** The existing `append_iru_event` RPC updates holder and pool counters; its after-insert certificate trigger only snapshots and signs the result. A distribution certificate records the issuer's PAID status without asserting independent payment settlement.

## 2 · What has NOT yet been confirmed

- The exact `1.3.8.0-IRU-CERTIFICATES` source has **not** been deployed and verified at `https://vice4x.netlify.app/` from this package.
- An authorized real member issuance that results in an actual readable VCT certificate and correct RLS visibility has **not** yet been performed. Synthetic preview and static tests are not equivalent to this live test.
- The SMTP outbox migration is applied but **no SMTP worker / mail provider credentials have been configured or tested**. Email delivery, within five seconds or otherwise, is not guaranteed.
- Cross-network calls with TURN, MetaApi live real-account authentication, live orders and every role boundary require independent operator tests. Backtesting/recorded portfolio numbers are not evidence of real funds.
- The standalone Node link service is a hardened read-only export consumer, not a direct MT5 login library or trade execution adapter. Terminal export integration must be built, supplied and validated by the operator.
- A full formal multi-jurisdictional regulatory, penetration, financial, accessibility, and browser-matrix audit is outside automated source checks.

## 3 · Verify locally without using Netlify credits

Unzip the **FULL_SOURCE** archive to one directory (not the Netlify ZIP). On a PC with Node.js 22+:

```bash
node tests/vice-release-safety.cjs
node tests/vice-1367-contracts.cjs
node tests/vice-1369-integrity.cjs
node tests/vice-1378-audit-turn.cjs
node tests/vice-1379-membership-signature.cjs
node tests/vice-token-certificates.cjs
bash scripts/vice-publish-netlify.sh
node tests/vice-deploy-privacy.cjs
```

All the source/static checks above must pass before spending a deploy. The synthetic QR was independently scanned and resolved to the correct `verify.html?id=VCT-...` link in offline validation. Open local `dist/site/index.html` from a small static HTTP server for visual smoke; signed-in workflows require the real domain and authorized Supabase redirect settings.

## 4 · Publish **once** to Netlify

**Preferred: GitHub source sync and a single authorized production workflow**, after all code and docs have been committed to `KAMAKAHZI/VICE` main. If this is already connected to continuous GitHub builds, do **not** deploy a second time using Netlify Drop. Check GitHub Actions for a single successful `VICE OS secure Netlify publish` workflow, then inspect Netlify Deploys and its exact commit SHA. The repository workflow expects GitHub Actions secrets `NETLIFY_AUTH_TOKEN` and `NETLIFY_SITE_ID`. Set these privately within GitHub; do not paste them in chat or source.

**Alternative: one local CLI deploy** of the checked full source (for existing Netlify Functions support):

```bash
# After installing/authorizing Netlify CLI on your own machine:
bash scripts/vice-publish-netlify.sh
netlify deploy --prod --dir=dist/site --functions=netlify/functions --site="$NETLIFY_SITE_ID"
```

Use `netlify login` interactively if needed. **Netlify Drop of the STATIC ZIP only uploads frontend assets** and does not guarantee deployment of TURN/Yahoo serverless functions. Prefer the workflow/CLI option to preserve functions. Do not put `server/`, `supabase/`, `.github/`, or secret files into the site's publish directory.

Open **exactly** these pages after one deployment:

- `https://vice4x.netlify.app/version.json` → release string `1.3.8.0-IRU-CERTIFICATES`.
- `https://vice4x.netlify.app/` → login screen without stale cached legacy shell.
- `https://vice4x.netlify.app/verify.html` → form accepts both VCA and VCT prefixes.
- `https://vice4x.netlify.app/guide.html` → section `Certificate barcodes`.

If the version is old, inspect Netlify's deployed commit instead of applying query-string cache tricks, rebuilding repeatedly, or deleting working authentication records. Existing worker unregister logic retires the stale service worker; a normal refresh after confirmed publication should show the new version.

## 5 · Issuer acceptance (non-destructive first)

Sign in as a provisioned SUPER_ADMIN, not as a SIM user. Open Diagnostics; confirm profile, holder, reference policy, Supabase connectivity, and no missing RLS permissions. In a separate browser/private session, sign in as a permitted HOLDER using that holder's own actual account. Confirm no cross-account registry or private documents can be queried.

For a real authorized small test-unit issuance (only after confirming the ledger's economic/legal effect), select a fully identified holder; record quantity, program and reason; approve the **actual** server operation. Backend should create exactly one `iru_events` row and exactly one linked VCT certificate with `source_event_seq`, showing both program balances and internal reference prices as of issuance. There must be **no second holder balance increment**. Confirm the member can see but cannot alter the certificate. Scan the printed QR, verify ID, digests and before/after balances. Confirm another member cannot list the certificate through the Data API even with a known ID; note that the public verification link intentionally exposes its historical snapshot to link holders.

Revoke a test certificate with a proper reason. Public verification must return REVOKED. Existing IDs must not silently become valid again. Exercise one issuer-approved period consolidation, only once for the active period; check no duplicate. For distributions: moving from DRAFT → AUDITED → PAID creates a VCT distribution record labelled issuer-reported, **not** independently settled; only do this against a real approved payable. A falsely reported payment is a business/legal risk.

## 6 · SMTP (NO Netlify paid build required)

The four new Supabase migrations have been applied. In a controlled always-on Windows/Linux computer or a private server, install Node.js 22+, unzip the source and open `server/`:

```bash
cd server
npm install
```

Set environment variables **locally in an OS secret store**, not a public `config.json`: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM`, and `VICE_LINK_TOKEN` (a random 32+-character secret). Set the optional `VICE_LINK_BIND` and `VICE_LINK_PORT`; default bind is loopback `127.0.0.1:9000`. Start the private worker with `npm start`. HTTP `/health` reports `email: SMTP_CONFIGURED` only when all required variables are present. The worker polls the private `email_outbox` every five seconds, uses 14 full dark/gold HTML templates and retries up to three times. Once SMTP is online, perform a real test with an authorized test mailbox and verify both the mailbox receipt and `email_outbox.status = SENT`. Outbox means **queued**, not guaranteed delivery.

**Security:** never place the service-role key in browser HTML, QR codes, Netlify public site files, logs, or share messages. The Node link bridge is not an access-control substitute for Supabase. Expose it remotely only behind TLS/WSS plus firewall authentication. TURN and MetaApi remain separate provider integrations.

## 7 · Member guide

1. Open the HTTPS VICE OS site, use your assigned invite email and login method, and complete confirmation where required.
2. Select **My IRU & Units**; open **My Verified IRU Certificates**.
3. Filter by certificate kind or VICE/V4X program; select **Preview**, **PNG**, **Print / PDF**, **Copy Link**, or **Verify**.
4. A mobile camera scans the QR into `/verify.html?id=VCT-…`; a 1D Code 39 scanner yields the VCT ID to paste into the same verification form.
5. The result displays **both** VICE and V4X unit holdings, event quantity, program before/after, internal reference values and signed timestamp **as of issuance**. The most recent certificate is not automatically proof of current balances.
6. My Documents has a Token Certificates section for registered, permitted records.
7. Contact the issuer before sharing barcodes externally; the public verification URL intentionally reveals the historical issuer snapshot to recipients of that URL.

## 8 · Release decision

**Green**: Full build source and static validation, Supabase migration registration and syntax checks, QR render-and-scan of a test certificate.

**Amber**: Live Netlify publication, a legitimate issuer VCT transaction, two-role verification, working SMTP provider, TURN phone-to-phone calls, real MetaApi/terminal provider, complete external penetration review.

**Red**: Any issuer unit double-count, member reading another member's raw token table, malformed/redigested certificate accepted, non-SUPER_ADMIN certificate mutation, recovered SIM record treated as official, or reference value represented as an independent market appraisal. Do not go live if any Red check fails.
