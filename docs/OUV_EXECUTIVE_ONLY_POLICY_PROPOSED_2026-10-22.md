# VICE OS — Executive-only OUV governance policy (proposed)

Date: 2026-10-22
Status: **User/CEO-confirmed direction; corporate authorization and applicable governing-document consistency require verification before production enforcement.**

## Intended policy

- OUV management reference value adjustments require authenticated, independently verified approvals from both the CEO and CFO, tied to the same immutable proposal payload hash.
- No holder vote or on-chain holder quorum is required for an OUV-only management reference value adjustment, provided governing instruments permit this.
- A 60-minute timelock starts after the final verified executive approval.
- Any separately applicable public-review period must conclude before execution.
- The executor must reject missing/invalid approvals, changes to proposal payload, premature execution, unauthorized callers, and duplicate execution.
- Execute valuation version publication, immutable receipt creation, and proposal status transition in one database transaction; preserve all holder unit quantities.
- Distinguish management reference values from independent fair market value.

## Existing proposal

- Proposal: `PROP-20261019-548A9057-34F`
- Payload hash: `3f108d0483466f24b62efce207086110a3b76e70d8198dc7135ec0f2068742ae`
- VICE target: 2.82645403; V4X target: 452.2326448; structural ratio 1:160.
- Previously observed: 2 of 2 executive approvals, final approval 2026-10-21 02:24:48.065444+00, requested 60-minute expiry 2026-10-21 03:24:48.065444+00.
- Review deadline: 2026-10-22 21:47:27.619334+00.

## Release gates

1. Confirm the company's governing documents authorize this policy amendment, and record the appropriate corporate resolution. Do not infer this from a chat confirmation alone.
2. Preserve audit evidence of the superseded 72-hour/on-chain-quorum policy and effective date of any valid amendment.
3. Independently verify CEO and CFO signer identity, authorization, authentication, and payload binding.
4. Review and test a migration that updates **both** the execution RPC and governance checker consistently; never merely backfill quorum or deadline fields.
5. Stage and test concurrency, rollback, permissions, idempotency, missing data, and existing baseline behavior.
6. Obtain explicit production approval, deploy through approved migration pipeline, and validate production receipts and read models.

This document is **not** a production migration or proof that the OUV proposal has executed.
