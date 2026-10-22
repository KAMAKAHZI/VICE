# OUV governance evidence audit — 2026-10-22

This is a read-only finding, not an authorization to execute.

## Verified database observations
- `public.vice_proposal_votes` contains **5** vote rows, all `FOR`, all for UUID proposal `c583c6da-4ea2-4c68-b0bf-a1d89fde909d`.
- That UUID identifies the separate **Distributions & Allocations** proposal, not the OUV sovereign proposal.
- The outstanding sovereign OUV proposal uses text ID `PROP-20261019-548A9057-34F` and remains `REVIEW` in the last verified snapshot.
- `vice_sovereign_proposals` does not expose a linked vote tally or verified signature record in its inspected columns.
- No verified quorum or execution authorization exists in the inspected records for this OUV proposal.

## Critical blocker
Do **not** use the five votes on the unrelated proposal to approve the OUV proposal.
Do **not** derive executive signatures from payload text such as `VERIFIED`.
Do **not** publish OUV values until proposal-specific evidence and required signatures are verified.

## Backend implementation prerequisites
1. Define a proposal-scoped voting ledger for text sovereign proposal IDs, including voter eligibility snapshot and uniqueness constraints.
2. Define quorum and approval thresholds from an authoritative, versioned governance policy.
3. Bind executive approvals to proposal ID + payload hash + signer identity, with cryptographic verification.
4. Add a server-only transactional executor that locks proposal and OUV state, verifies all gates, writes one immutable OUV version, and records an idempotent execution receipt.
5. Add resumable downstream reconciliation jobs and version-based read models.
6. Connect the Admin control only after automated negative and positive tests pass.
7. Never auto-pass because one hour elapsed; only auto-finalize according to the applicable policy.

## Current code safety
The `ouv-final-deploy` endpoint deliberately returns `action_required` until an independently verified authorization and execution path is present. This prevents accidental changes to holder valuations.
