# VICE4X private trading source release

The authenticated delivery function grants source download only to the active KAHZI account (verified auth UUID and SUPER_ADMIN role). It verifies the Supabase user, account status and database role on every request. Sources are never published as static assets and no browser orders are placed.

Run `scripts/prepare-private-trading-source.py --source-dir <authorized-local-uploads> --output <private-path>/release.ts`, verify the SHA-256 manifest, and deploy index.ts plus the generated release.ts to `vice-trading-source` with JWT verification enabled. Do not commit release.ts or copy the four proprietary source files into the public repository. The originals remain the founder's supplied source artifacts.

The native targets are MetaTrader 5 and TradingView. Download availability is not native compilation, backtesting or live execution acceptance. Use MetaEditor and Strategy Tester, and Pine Editor, before enabling automated execution. v27.60's supplied `InpAutoExecute=true` setting requires explicit operator review; this website never enables it or places an order. The separate basket file defaults to observe-only with `SOLACE_GOD_MODE=false`.
