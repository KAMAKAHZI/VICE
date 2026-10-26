# VICE IRU — Restricted Account Reconciliation (2026-10-25)

Status: REVIEW ONLY — NO TRANSFER AUTHORIZED.

## Scope
- Four unique accounts flagged suspended, holdings-locked, or membership-revoked in production (overlapping flags).
- Proposed review: 500 VICE per qualifying account, maximum 2,000 VICE total.
- Separately proposed: 2,500 VICE associated with the account described as "Engraved"; identity and ledger entitlement NOT verified.
- Anthony is expressly excluded. Match by immutable holder ID before any action; never infer identity from a name.
- Proposed maximum 4,500 VICE is NOT a verified recoverable balance.
- No V4X changes.
- Any properly recoverable units go to the 25% Strategic Holder Reserve, not Estate/Admin Reserve.

## Production findings
- Four unique restricted accounts; one suspended, four holdings-locked, three revoked.
- Each of four accounts has >= 500 VICE recorded.
- No matching rows in public.allocations for the four restricted holders; that is NOT proof of invalid issuance.
- Engraved holder matching could not be verified.
- Original events, certificates, signed or unsigned terms, consideration and on-chain ownership have not been reconciled.

## Mandatory execution gate
1. Resolve immutable holder IDs, including Engraved; exclude Anthony by verified holder ID.
2. Reconcile source-of-truth issuance and transfers: public.iru_events, certificate registry, any on-chain transfers, payments, communications, and governing terms.
3. Determine whether each entry is an undistributed administrative allocation, an erroneous ledger entry, or an issued entitlement.
4. Obtain documented legal/contractual authority for each reversal. Account restrictions or non-VIP status alone are insufficient.
5. Confirm balances and destination pool limits. Preserve total supply: 10,000,000 VICE and 10,000,000 V4X.
6. Execute only approved, auditable, idempotent correction transactions with before/after snapshots and reconciled certificates.
7. Verify aggregate holder plus reserve balances, event log, and supply invariant after any execution.

Do not mint/burn, retroactively forfeit, or transfer disputed issued holdings without appropriate legal authority. Do not treat this file as approval or as evidence of forfeiture.
