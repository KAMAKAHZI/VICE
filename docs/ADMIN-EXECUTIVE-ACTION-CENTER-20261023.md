# VICE OS — Executive Action Center: existing authorization reconciliation

Status: IMPLEMENTATION SPECIFICATION; not deployed. This document is not an approval or execution receipt.

## Primary Admin card

Location: Admin > Governance & OUV > Executive Action Center.

**OUV governance verification required** — Proposal PROP-20261019-548A9057-34F.

Display independent fields, never a single misleading approved flag:
- CEO authorization: RECORDED / VERIFIED / FAILED / UNKNOWN.
- CFO authorization: RECORDED / VERIFIED / FAILED / UNKNOWN.
- Scope: ONE-TIME OUV / AUTO-POLICY / BOTH / UNDETERMINED.
- Quorum: VERIFIED / PENDING / FAILED.
- Timelock: SATISFIED / PENDING / EXPIRED / NOT APPLICABLE.
- Executor readiness: READY / BLOCKED.
- Policy: MODEL_ONLY / AUTO_ACTIVE / SUSPENDED.

Buttons: **Recheck existing signatures**, **View evidence & requirements**, **View blockers**. Show **Execute approved OUV** only if the proposal is executable. Show **Activate automatic policy** only if a separate valid amendment covers that action, verified quorum and authorization are present, and executor tests have passed. The UI must never silently request new votes, treat device attestation as verified signature, or claim a previous one-off vote authorizes the automatic policy.

## Verification contract

1. Retrieve immutable authorization events by proposal ID and proposal payload hash; compare the CEO TOTP evidence and CFO attestation to the designated signers, original challenge, expiration and cryptographic verification result.
2. Never rewrite history: preserve recorded approvals; add separately timestamped verification results and reason codes. Do not infer signature verification from a consumed challenge.
3. Determine amendment scope from the *signed* payload, not user-facing descriptions. Evaluate governing instrument, quorum and timelock from the version in effect when the action was taken.
4. Recheck ledger reconciliation, supply invariants and effective OUV immediately before any execution. All privileged writes must be server-side, atomic, idempotent and auditable.
5. Until every condition is proven, leave policy MODEL_ONLY and official OUV $2/$320. Never present modeled $2.004/$320.64 as official.

## Acceptance tests

- Both authorizations recorded but CFO signature unverified -> BLOCKED, no duplicate voting request.
- CEO valid but CFO signature invalid -> BLOCKED with precise reason; preserve evidence.
- Valid one-off signatures without auto-policy amendment -> one-off execution only if quorum/timelock pass; auto activation BLOCKED.
- Invalid or expired challenge -> BLOCKED; no fabricated verification.
- Recheck operation is read-only and cannot modify price, holder units or policy.
- Unauthorized users cannot inspect executive evidence or invoke privileged execution.
- Retry/concurrent requests do not duplicate receipts or versions.

## Operator guidance

Do not ask CEO or CFO to approve again solely because an earlier approval has not been verified. Escalate a new authorization only when independent validation demonstrates that the existing evidence cannot satisfy the actual governing requirements.
