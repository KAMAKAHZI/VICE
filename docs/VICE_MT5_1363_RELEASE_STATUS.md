# VICE OS 1.3.6.3 — MT5 Cloud and Portfolio Integrity

## Deployment scope
This release preserves the existing VICE OS website, Supabase project and Netlify-connected GitHub repository. Cloud MT5 runs through an authenticated Supabase Edge Function `vice-mt5-cloud` (deployed v9 with JWT verification) and the existing owner-scoped `vice_mt5_cloud_accounts` table. The optional Windows VICE Link remains supported; official broker website links are **shortcuts only**, not authenticated portfolio sync.

## Security and portfolio rules
- The VICE website does not accept MT5 trading/investor passwords. The broker credential handoff is to MetaApi's official HTTPS-hosted page. The MetaApi API token must be kept in Supabase Edge Function Secrets as `METAAPI_TOKEN`, never GitHub or browser JavaScript.
- Authenticated backend requests are user-scoped; browser cloud and WSS sessions clear on logout/user switch. Unauthenticated responses or stale responses cannot populate the next user's portfolio.
- Only fresh, verified **REAL LIVE USD** broker equity is included in personal portfolio. Provider-supplied terminal mode is mandatory; a user's form selection is insufficient. Saved login metadata, demo accounts, stale snapshots, unsupported currencies, and duplicate cloud/bridge accounts add $0. The service does not expose live trade execution.
- Founder-attributed Estate Reserve and Administrative Reserve is presented as an **internal management IRU reference** in the portfolio header with administrative accounting hidden; it is not independent FMV, cash, custody, corporate stock, or accepted collateral. Do not double-count transferred units.

## Activation still required
1. Create a MetaApi operator account, review provider costs and broker support.
2. Add the provider token to Supabase Edge Functions → Secrets, key `METAAPI_TOKEN`; do not share it in chat or source code.
3. In VICE OS → MT5 Accounts, initiate MetaApi cloud connection. Enter investor credentials on MetaApi, not on VICE.
4. Test a DEMO account (confirmed zero contribution to personal total), then a real LIVE USD account. Check broker confirmation, freshness, positions, and exact equity against the broker.
5. Confirm the GitHub commit appears as the production deploy for vice4x.netlify.app.

## Verification
Automated local/mocked tests cover browser controls, role/session separation, broker mode filtering, fresh equity, duplicates, CORS/JWT failures, and fail-closed behavior. They are not proof of an activated MetaApi account or an end-to-end broker login. No broker credentials or live trades were used.
