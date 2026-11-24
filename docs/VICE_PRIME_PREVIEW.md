# VICE PRIME — Executive Preview

Status: functional front-end paper simulation; no live connection or trading. This branch does not include proprietary VICEBOT source or customer information. The corporate site and main branch are unchanged.

## Review and preview

Download executive-prime.html from this branch and open it as a local file to inspect the sample interface. It is intentionally a synthetic demo. For a hosted preview, use a Netlify branch deploy and sign in to VICE OS on the same origin, complete MFA, then visit /executive/prime. The static shell is public by design, unlisted, and contains only synthetic information; it is not a confidentiality boundary. Actual authorization is checked by the read-only server gate, which never returns account data or places trades.

Set SUPABASE_URL and SUPABASE_ANON_KEY in the Netlify server environment for the intended project. Set VICE_PRIME_EXECUTIVE_IDS to an explicit comma-separated list of approved executive Auth user UUIDs. Do not commit the list or any service/broker keys. Verify that the existing client uses the expected Supabase session storage key and that AAL2 is present after MFA. Missing config denies access. All access tests must pass before publication; this implementation has not been validated against real executive accounts. Do not use this sample gate as the sole security boundary for a live financial service.

Run node --test tests/vice-prime-preview.cjs and the existing release safety suite; then bash scripts/vice-publish-netlify.sh. Verify a non-executive and AAL1 user are denied, executive AAL2 is accepted, sign-out/revocation and expiry are handled, and the route is absent from member navigation and sitemap. Use existing server-side role controls and current session revocation verification before exposing real financial data.

## Production integration milestones

1. Client VICE INVEST: client-specific accounts, read-only brokerage connections, mandates, identity verification and consent. Separate linked accounts from custody-partner funded accounts.
2. Provider adapter registry: capabilities (read, trade, transfer), account authorization, encrypted token vault, rate limits, idempotency, provider-confirmed reconciliation. No unsupported or screen-scraped execution.
3. VICEBOT V31.40 / SOLACE: preserve original EA, test native compilation, keep strategy state on worker/terminal, emit signed versioned signal intents. Do not infer successful executions from signal messages. Validate symbol mapping, quote freshness, contract size and venue-specific margin.
4. Central risk: independent pre-trade mandate validation, per-account and aggregate exposure limits, stale data rejection, loss halt, order idempotency and broker acknowledgments. Separate strategy from execution. Durable queue and recovery reconciliation; no live orders until signed acceptance. Browser pause in preview is not a live kill switch.
5. Treasury: partner custody and bank settlement, segregated customer assets, verified funding and withdrawal flows, double-entry ledger, reconciliation, and permissions. Never route customer money through corporate treasury. No seed phrases or withdrawal keys in browser.
6. Executive roles: CEO/CFO/authorized staff, least privilege, MFA, dual approvals for sensitive changes, immutable server-side audit, incident controls, and immediate revocation. Client records remain tenant-scoped. Do not expose private financial data in a static asset or service-worker cache.
7. Compliance: establish applicable investment adviser, brokerage, custody, derivatives, and money transmission permissions with qualified counsel and regulated partners before offering live discretionary management or deposits. Keep paper preview separate.

Cival Systems is a reference for orchestration, not a code dependency; no third-party source has been imported. VICEBOT package is not embedded, executed, compiled or uploaded by this change.
