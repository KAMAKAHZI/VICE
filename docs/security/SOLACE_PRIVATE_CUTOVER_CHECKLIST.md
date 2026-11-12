# Private SOLACE cutover checklist

The current public browser asset `vice-solace-system.js` remains exposed. The new Netlify function is a **gateway scaffold only**, not a deployed private engine.

## Blocking prerequisites
1. Move calculation implementation into a private repository or protected service artifact. Do not copy the algorithm into a publicly readable repository or Netlify static bundle.
2. Configure the private engine with a service-to-service credential stored in a secrets manager. Rotate it on a schedule.
3. Implement independent authorization and bounded per-user quotas. The gateway's authentication alone does not enforce membership, entitlement, or rate limits.
4. Require the private engine to authenticate the calling service. Treat `X-Vice-User-Id` and `user_id` as untrusted until the gateway identity is verified.
5. Add authenticated frontend API calls and asynchronous chart-state updates. Verify the current `ViceSolaceSystem.run`, `options`, `at`, and `rayStart` integration paths.
6. Verify historical snapshot parity for F0/F100, structural modes, CHoCH, internal pivots, trade geometry, and market-feed behavior.
7. Remove the public algorithm asset only after full cutover; check generated `dist/site`, caches, source maps, and deployment history.
8. Run staging acceptance tests, verify rollback, then release.

## Required security tests
- Signed-out requests fail with 401.
- Non-member requests fail with 403.
- Cross-origin and oversized requests fail.
- Engine credentials never appear in browser assets or error responses.
- Replay and excessive compute requests are bounded.
- Browser cannot retrieve the engine implementation.
- Production charts retain functional and numerical parity.

**Release status: BLOCKED until all gates are satisfied.**
