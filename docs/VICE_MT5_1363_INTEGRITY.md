# VICE OS 1.3.6.3 — MT5 portfolio integrity and session isolation

This source-preserving release integrates with the existing GitHub/Netlify VICE OS site and Supabase Edge function.

- Founder-controlled Estate Reserve and Administrative Reserve remains consolidated in the founder-attributed internal IRU reference, with actual reserve transfer bookkeeping private behind the scenes. Internal references are **not** audited FMV, collateral, actual trading-account equity, custody or corporate shares.
- Add only **fresh, authenticated LIVE USD MT5 broker equity** to the combined personal portfolio. Saved account metadata, expired snapshots, DEMO accounts, unsupported currencies, and duplicate cloud/bridge accounts must not inflate the total.
- Cloud MT5 requires provider-returned `terminalMode` and `realEquityVerified`, not merely user-selected `LIVE` in the VICE form. The server must confirm `ACCOUNT_TRADE_MODE_REAL`. Read-only portfolio connection is not authorization to execute trades.
- Keep per-member WSS bridge settings and local metadata separate. Do not load global browser-stored bridge tokens or account details at anonymous startup. Disconnect and purge in-memory equity on signout/user switch. User must reconfigure previously unscoped WSS settings once.
- Cloud MT5 still uses a MetaApi-hosted broker credential page. The broker website shortcut simply opens an external browser tab; it does not synchronize balances by itself.
- Cloud connection remains **not broker-verified end-to-end** until the VICE operator adds `METAAPI_TOKEN` in Supabase secrets and tests a real account. Do not expose MetaApi tokens or trading passwords to chat, GitHub, the web page, or the Supabase database.
- No live trade execution added.

## Tests

Browser: `python tests/test_ui_browser_136.py`, `python tests/test_portfolio_integrity_1362.py`, `python tests/test_regression_135.py`. Backend: `node tests/test_edge_136.cjs`, `node tests/test_edge_136_owner_and_portfolio.cjs`. These are automated offline/mocked tests, not evidence of MetaApi subscription or broker verification.

## Activation

MetaApi token belongs in Supabase Edge Functions → Secrets → `METAAPI_TOKEN`. Use a DEMO account to validate the sign-in and positions first; its simulated equity should **not** increase the personal total. Next use an authorized REAL account and verify actual LIVE USD equity matches the broker, with the provider reporting real account mode. Netlify production publication must be independently checked against the GitHub commit.
