# OUV execution hardening findings — 2026-10-26

Status: BLOCKED FOR PRODUCTION EXECUTION. Review-only evidence; no financial state changes.

## Verified source observations
- `netlify/functions/ouv-final-deploy.js` still embeds proposal `PROP-20261019-548A9057-34F`, payload hash, and target reference values as JavaScript Number literals. The `sameNumber` comparator uses floating-point tolerance `1e-8`. Financial authority must use database NUMERIC / integer fixed-point comparisons and canonical decimal serialization instead.
- The endpoint calls `vice_ouv_activation_readiness` and `vice_ouv_execute_approved`; the database implementation, permissions, atomicity, idempotency and deployment state require independent staging verification.
- The standalone `scripts/ouv-governance-evidence-verifier.cjs` verifies Ed25519 signatures against a supplied trusted-key map, but it is **not called** by the OUV endpoint. The endpoint trusts the database's `cryptographic_signatures_verified` field. Confirm database verifier binds trusted keys, proposal ID, exact canonical payload hash, threshold, and revocation before enabling writes.
- The handler checks `VICE_OUV_EXECUTION_ENABLED` before execution and requires explicit confirmation. Preserve this fail-closed default.
- Reconciliation checks the latest published OUV against config, but its float comparison and hard-coded baseline should be replaced by versioned methodology and exact-decimal validation. Do not infer appreciation from transfers or finite supply alone.
- The gateway accepts a request ID for execution but does not pass it to the RPC. Confirm server-side idempotency and request-to-receipt binding, especially concurrent execution.
- Never change authoritative balances, methodology or enable production execution from this review.

## Mandatory release gates
1. Document and approve versioned OUV methodology and canonical decimal precision, signed proposal payload and signer registry.
2. Verify production and staging schema, RLS, EXECUTE grants, CEO/CFO MFA evidence, independent signatures and key rotation/revocation.
3. Implement exact-decimal ledger and reference arithmetic, supply invariants, double-entry transaction and replay protection.
4. Bind request_id to an atomic receipt in the database and verify concurrency, rollback, duplicate requests, and partial publication.
5. Verify that automatic reference adjustments only follow approved methodology and supporting economic inputs, not scarcity assertions.
6. Prove independent publication reconciliation, cache invalidation, holder reporting and certificate synchronization.
7. Complete full negative tests, staging restoration rehearsal, security approval and release sign-off.
8. Only after documented authorization and successful production checks may the server execution flag be considered for enablement.

## Evidence needed
Record migration SHAs, deployment SHA, policy version, approved key fingerprints, exact calculation fixtures, test logs, reconciled ledger totals, rollback proof, and independent reviewer sign-off.
