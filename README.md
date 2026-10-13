# VICE OS — Institutional Member Operating System

**Canonical release:** `1.3.6.10-AUDIT-PROVENANCE`  
**Web app:** https://vice4x.netlify.app/  
**Member guide:** https://vice4x.netlify.app/guide.html  
**Backend:** Supabase project `sdsaewumabzjjvsmqqsl`  
**Production source branch:** `main`

This is the complete VICE OS site source, not a UI mock-up. The application is a static Netlify client with Supabase Auth, a PostgreSQL permission-controlled member/ledger backend, Supabase Realtime, Edge functions, and optional provider-hosted integrations. All external features should be reported as **configured**, **unconfigured**, or **verified** on their own evidence; no README can prove that an operator's external broker or relay service is provisioned.

## Install / update

1. Connect the Netlify site to `KAMAKAHZI/VICE`, branch `main`, with publish directory `dist/site`; Netlify Functions directory is `netlify/functions`, as specified in `netlify.toml`.
2. Deploy from `main`. Never deploy a previous `VICE_OS_1_3_6` upload over the updated source.
3. Inspect `https://vice4x.netlify.app/version.json` and compare to `index.html` `data-build`. Both must report `1.3.6.10-AUDIT-PROVENANCE`. A query such as `?build=1364` is **not** a deployment mechanism.
4. Open **Check Application Connections** on the sign-in screen, then test the founder's real email/password and Google sign-in where configured. Never share passwords, wallet seed phrases or operator API keys in support channels.
5. Invite a separate test HOLDER. Confirm no cross-account access to external accounts, storage, member records or private communication channels.

## Repository map

| Path | Purpose |
|---|---|
| `index.html` | Full VICE OS application, auth and rich member/staff UI |
| `guide.html` | Detailed public user manual, accessible from login and signed-in settings |
| `version.json` | Release identity and candid external-provider/acceptance status |
| `netlify/functions/` | Market proxy and temporary WebRTC TURN credentials |
| `supabase/functions/vice-mt5-cloud/` | JWT-protected, read-only cloud MetaApi bridge |
| `supabase/migrations/` | Applied backend schema/security, index and governance migrations |
| `tests/vice-release-safety.cjs` | Required syntax, auth, equity, credential and governance regression checks |
| `docs/` | Engineering audit and additional integration references |

## Secure operation

The reported error **`CloudMT5.reset is not a function`** was corrected so an optional MT5 integration cannot veto a valid provisioned member login. Session resets now use the actual Supabase auth storage key, and the app provides read-only diagnostics. Founder and member records must continue to be checked on the Supabase server; never bypass an invitation by disabling RLS.

Governance is recorded using the holder-gated `vice_cast_proposal_vote` RPC. Votes are a **one-active-holder / one-vote** application record with proposal opening/closing windows, not automatically on-chain governance. Distributions are member-scoped records; changing the display to **PAID** is not evidence that an institution settled funds. Academy certificates now require seven passing server-graded quizzes. Manually entered external account amounts do **not** contribute to LIVE verified portfolio totals.

Issuer internal reference prices are `VICE = $2` and `V4X = $320` per IRU in the latest canonical policy; neither is an independently appraised fair market price, guaranteed collateral price, realizable valuation or security classification determination. Issuer reserve and strategic pool balances are tracked separately.

## Operator-only provisions / acceptance remaining

- **MetaApi:** `vice-mt5-cloud` is deployed, JWT protected and read-only; operator must configure `METAAPI_TOKEN` in Supabase Edge secrets and complete a real provider-hosted DEMO broker acceptance test. The site must never collect broker login passwords.
- **Calls:** Configure `TURN_HOSTNAME`, strong `TURN_SHARED_SECRET`, `SUPABASE_URL` and `SUPABASE_ANON_KEY` as Netlify server variables, deploy a real TURN server and prove a two-network WebRTC call.
- **Email/OAuth:** Verify actual redirect URL, SMTP/mail delivery and password reset with registered credentials.
- **Authorization:** Perform founder vs HOLDER, simultaneous two-member and negative-permission tests. Review public-security-definer RPCs and enable leaked-password protection.
- **Market feeds & wallets:** Validate third-party provider availability, expected rates, data timeliness, custody proofs, cryptographic design and accurate metadata with independent evidence.

CI currently checks source safety and integrity; it is **not** a real-user production certificate. Continue following the deployment/audit manuals before declaring 100% operability.

## Local static check

```bash
node tests/vice-release-safety.cjs
```

For end-to-end readiness test `python3 tests/check_public_deployment.py` from the separate operator/audit delivery pack and complete every scenario in its acceptance checklist.

## Audit provenance and relay controls (1.3.6.10)

Live client actions are recorded as *unverified* user activity through `vice_record_client_activity`; direct member writes into authoritative `audit_log` are denied. Database triggers and privileged procedures remain the source of record for authorized operations. Realtime DMs require provisioned membership, and the Netlify TURN helper additionally requires the profile of the authenticated user before generating relay credentials. Verification is done in `tests/vice-1378-audit-turn.cjs` and deployment CI. These safeguards do not bypass required Netlify deployment authorization.
