# VICE OS 1.3.6.1 — Cloud MT5 connection

The existing VICE OS website can offer a MetaApi-hosted MT5 connection without requiring a user's Windows computer. This is **not** the same as authenticating via an arbitrary broker website. Users may alternatively open their official broker's HTTPS web terminal in a new tab (no automatic portfolio sync) or use the optional WSS-based VICE Link terminal bridge.

## Activate the provider
1. Create or access an operator-owned MetaApi account at https://app.metaapi.cloud/ and review supported MT5 brokers, hosting charges, and account limits.
2. Generate a minimum-privilege provider API token and set it **inside Supabase Edge Function Secrets** under the exact name `METAAPI_TOKEN`. Never commit it to GitHub, put it into Netlify JavaScript, paste it into chat, or store it in SQL.
3. The existing `vice-mt5-cloud` Supabase Edge Function is deployed with JWT verification and reads/writes the owner-scoped `vice_mt5_cloud_accounts` registry. It exposes read-only portfolio endpoints, account preparation, provider-hosted configuration link, deploy and explicit removal; it **does not offer trading endpoints**.
4. After setting the secret, sign into VICE OS → **MT5 Accounts → Refresh connections**. The Cloud option becomes available when the provider token is detected.
5. Use a **DEMO** MT5 account first: enter its exact broker server and label; confirm provider charges; open the generated `https://app.metaapi.cloud/` account configuration link and supply the broker **investor/read-only** password on the provider's site; start the hosted terminal; refresh to confirm verified account status, actual USD equity, and open positions.
6. Browser sessions must not re-use the previous user's account data. The UI includes sign-out reset, JWT-only requests and stale-response guards; no MT5 broker password field is present.

## Portfolio accounting and limitations
Only verified, recent, nonduplicated USD account equity is added to VICE's consolidated personal portfolio; non-USD accounts need an externally verified FX conversion before aggregation. Internal founder-attributed reserve reference values are shown in the same portfolio with separate hidden accounting and are *not* cash, proof of on-chain custody, FMV, or available lending collateral. The broker site shortcut is **not** a broker API authorization.

## Deployment
The website is GitHub-connected. Netlify should build new commits to `main` and publish from the root directory configured by `netlify.toml`. Verify the Netlify deploy status, log in as an actual VICE member, test a demo broker, then confirm live data. Provider setup and broker tests remain external steps; source and unit tests alone do not prove a successful broker login.

Official reference: https://metaapi.cloud/docs/provisioning/api/account/createConfigurationLink/
