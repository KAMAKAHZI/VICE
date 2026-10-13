# VICE OS 1.3.6 — MT5 Cloud Connection (No PC required)

**LIVE infrastructure installed:** Supabase `public.vice_mt5_cloud_accounts` (owner-scoped, RLS no direct grants) and Edge Function `vice-mt5-cloud` (JWT verification enabled), project `sdsaewumabzjjvsmqqsl`.

**Still requires provider activation:** Obtain a MetaApi API token in an operator-owned MetaApi account and configure it as `METAAPI_TOKEN` **using Supabase Edge Function secrets**, not GitHub, Netlify browser code, SQL rows, or this chat. MetaApi hosting may incur third-party fees. The Cloud MT5 card stays disabled until the Edge Function detects the token.

**How clients use it once activated:** Log in to VICE OS LIVE → MT5 Accounts → Cloud MT5 → enter a label and the exact MT5 broker server (not password or account number) → confirm third-party hosting charges → Prepare secure connection → Open secure MetaApi sign-in → enter MT5 account number and investor/read-only password on **app.metaapi.cloud** → Start cloud terminal (only if provider says it is not deployed) → Refresh. The connection is displayed as verified only when MetaApi's provisioning endpoint reports `CONNECTED` and the signed-in user's account info is returned and matches the broker server. Position reads are read-only. VICE does not receive broker passwords or execute live orders.

**Official broker website:** Separate external HTTPS handoff; credentials stay on broker domain. It does **not** provide broker OAuth or automatic account synchronization unless a broker supplies a separately approved integration.

**Legacy Windows bridge:** Still supported as an optional method. The Add Bridge Account dialog does not collect broker passwords; it is informational until a separately maintained WSS/MT5 exporter verifies the account.

**Accounting:** Only fresh (<= 2 minutes) verified USD cloud equity is included in consolidated portfolio. Verified non-USD accounts display original currency but require a trusted FX quote for USD aggregation. Connected duplicates already represented in existing MT5 records are excluded. Internal IRU reference valuations remain separate from independently observed broker equity.

**Security:** JWT verified at Edge; every registry operation owner-scoped; users cannot query/write registry directly via anon/authenticated table grants; MetaApi token resides in Edge secrets; no password fields in VICE cloud UI; no trading endpoints; request size/rate limits; provider configuration link allowlisted to app.metaapi.cloud. The operator should review broker terms, token permissions and MetaApi fees before provisioning.

**Not yet a certified real login:** Activation and one demo connection remain necessary, followed by end-to-end confirmation of actual MetaApi broker status and account equity. Do not call this an authorized broker API/OAuth login; it is a provider-hosted credential handoff.
