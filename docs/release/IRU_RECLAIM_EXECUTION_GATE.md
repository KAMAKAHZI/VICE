# IRU holder-pool reclaim — execution acceptance gate

Status: **NOT AUTHORIZED FOR AUTOMATIC LIVE TRANSFER**. Executive approval of the reserve destination does not establish forfeiture rights against any individual holder.

## Canonical destination
Return legally reclaimable VICE or V4X units to the **25% Strategic Holder Pool** (2,500,000 units per class), not the 75% Estate/Admin Reserve. Keep each class's fixed cap at 10,000,000. A suspended account retains its units unless an enforceable agreement or legal process permits a separate reclaim.

## Required per-holder evidence
- Holder identifier, class, live balance, source allocation and certificate identifiers.
- Executed agreement and specific revocation/forfeiture clause, or valid legal order; review of any required notice, cure, appeal, or refund.
- Case/evidence references; independent authorized review and documented executive approval.
- Exact reclaim quantity and target reserve ledger account.
- Confirm no prior reclaim, liens, pledges, active dispute holds or duplicate pending execution.

## Atomic execution requirements
1. Read the authoritative ledger under transaction lock; re-check balance, legal authorization, and idempotency key.
2. Post balanced debit/credit in a single transaction; do not mint, burn or alter total supply.
3. Recalculate available strategic allocation capacity without changing the 2.5M cap.
4. Reconcile affected certificates and holder statements; issue an auditable receipt with before/after balances.
5. Reject on any mismatch and roll back all changes; never use client-only state or a browser-supplied executive flag as authority.
6. Run staging tests for duplicate requests, concurrent requests, partial failure, closed accounts, disputed holdings, and both token classes.
7. Require separate approval before production execution.

The JavaScript `vice-iru-reclaim-policy.js` is **preflight only** and does not satisfy server-side authority, locking, ledger posting, or certificate reconciliation.

## Deployment gate
No production unit transfers until the Supabase schema and real holder records have been inspected, a transaction-safe server-side implementation has passed staging, and specific reclaim authorizations are verified.
