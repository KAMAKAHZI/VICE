# VICE OS 1.3.6.4 — Login recovery hotfix

## Reported incident
A LIVE sign-in could show `Access not provisioned: CloudMT5.reset is not a function`. The optional MT5 integration error was incorrectly caught as an account-authorization failure, causing sign-out.

## Changes
- Add `safeResetCloudMt5Session()` with guarded reset plus fail-closed compatibility clearing for older cloud modules without `reset`.
- Use the safe helper in authenticated setup, explicit logout, and Supabase SIGNED_OUT events.
- Guard asynchronous MT5 refresh so cloud-provider errors cannot abort user authentication.
- Invalidate previous account request epochs, clear member/account data, and preserve sign-out isolation.
- Version bump to 1.3.6.4. No modifications to ledger supply, estate reserves, wallet keys, or live trading.

## Tests
Offline browser tests pass for intentionally missing `CloudMT5.reset` during a simulated valid sign-in and during logout; portfolio data belonging to the previous member is cleared. UI layout/chart regressions, verified-equity deduplication, and mocked read-only cloud connector tests pass. These tests do not certify a real production account login.

## Remaining owner/provider acceptance
- Netlify production publish of the GitHub `main` commit and a real sign-in from the operator's browser (do not share credentials).
- Configure `METAAPI_TOKEN` in Supabase Edge Function secrets without sharing it publicly.
- Validate MetaApi hosted DEMO account and read-only balances; validate verified LIVE USD broker equity and fresh positions later.
- External broker website handoff is not a broker API connection and cannot automatically synchronize accounts.
