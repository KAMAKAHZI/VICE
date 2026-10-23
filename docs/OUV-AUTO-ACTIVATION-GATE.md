# VICE OUV Automatic Reference Policy — Activation Gate
Status: PROPOSED — NOT EFFECTIVE
Date: 2026-10-23

## Decision requested
The issuer's authorized governance body may adopt a deterministic INTERNAL MANAGEMENT REFERENCE policy for VICE and V4X units. The model is not an appraisal, market quotation, guaranteed appreciation, realized income, or proof of lender-acceptable collateral.

## Preconditions (all mandatory)
1. Verify the operative governing instrument, competent approving parties, independent CEO/CFO authorization, quorum, any review period and timelock. Record authenticated evidence and the policy amendment's cryptographic hash. An operator's override request alone is insufficient.
2. Independently validate the complete reserve/strategic holder ledger and append-only issuance events, including reversals and transfers. Never reprice solely from unverified counts.
3. Approve the formula and its economic interpretation. Current model: factor = 1 + (net eligible released VICE + net eligible released V4X since approved baseline)/20,000,000; VICE = round(base_VICE * factor, 8); V4X = round(VICE * 160, 8). Do not describe the formula as market appreciation. Review 5% major-event threshold, negative net changes, baseline resets and precision.
4. Define whether and when issuer reference adjustments may become authoritative, including explicit independent approval for material valuation changes.

## Atomic executor specification
- Authenticated executive server-side operation only; reject direct client SQL, public RPC writes and service-key leakage.
- Lock policy and relevant ledger rows; verify immutable event identities, reconciled counters, fixed 10m/10m supplies, current official baseline and effective governance evidence.
- Use unique source event identifiers and an idempotency key. Under a single database transaction, calculate the new reference, append an immutable effective version and receipt, update the canonical issuer reference configuration, and mark the source event applied. Any failure rolls back the entire operation.
- Prevent double-counting, concurrent races, retroactive repricing and policy changes without amendment.
- Read-only portfolios, certificate issuance, and home ticker must consume one canonical effective version, expose its timestamp, and preserve unit quantities.
- Audit with tests for duplicate events, partial failures, reversals, non-reconciled ledger, supply overflow, stale baseline, quorum failure, simultaneous executions and cross-user RLS.
- Publish only after CI, migration dry-run, authenticated smoke tests and independent review pass.

## Current production facts (read-only checks 2026-10-23)
- Release policy: MODEL_ONLY; automatic_official_update_enabled=false.
- Release ledger reconciliation=true; baseline_matches_official=true.
- Current model: VICE $2.004; V4X $320.64; incremental 40,000 units.
- Official baseline: VICE $2; V4X $320.
- October 19 proposal: REVIEW, quorum_verified_at=NULL, execute_after=NULL.
- No OUV version or execution receipt was recorded at audit time.

**No database status flip, financial repricing or certificate change is authorized by this document alone.**
