# VICE OS — OUV integration status (2026-10-22)

## Implemented in PR #11
- Authenticated Netlify endpoint `/.netlify/functions/ouv-final-deploy` validates executive session and registered CEO/CFO identity.
- The endpoint requests authoritative database readiness; it cannot fabricate quorum or timelock completion.
- An explicit `EXECUTE APPROVED OUV` server route exists, but is **disabled by default**. Enabling it requires `VICE_OUV_EXECUTION_ENABLED=true` **after** formal governance authorization, a security-audited migration, staging tests, and approved production release.
- Any enabled execution uses the caller's JWT to invoke `vice_ouv_execute_approved` and independently checks the permanent receipt, version, authoritative `vice_dao_config` prices and proposal status.
- The Admin control shows a verify button, and only enables the executive execute button when the database returns `can_apply=true` with no unmet gates.
- `tests/ouv-final-deploy.test.cjs` exercises authentication, fail-closed gate checks, explicit execution flag, and mock reconciliation. No production write is part of those tests.

## Latest production database inspection
- Proposal `PROP-20261019-548A9057-34F` remains `REVIEW`; public review expired on 2026-10-22 21:47:27 UTC.
- CEO MFA + CFO signed attestation matching proposal hash exist.
- `quorum_verified_at` and `execute_after` remain null; `vice_sovereign_check` unconditionally returns `STRUCTURAL_EXECUTOR_LOCKED`.
- Constraint `vice_sovereign_proposals_check` explicitly forces quorum and execution deadlines to null; `vice_sovereign_proposals_status_check` expressly prohibits `EXECUTED`.
- `vice_private.guard_structural_state` rejects `ouv_versions` inserts and changes to `vice_dao_config` official values.
- The installed executor cannot successfully publish under these guards.
- The official OUV read model (`vice_dao_config`) still reports VICE 2, V4X 320; `ouv_versions` and execution receipts have not been populated for this proposal.

## Automatic distribution model
- Both strategic allocations and Estate Reserve transfers already have an AFTER INSERT trigger that records finite-supply **model-only** appreciation events for qualifying new allocations.
- The existing `vice_private.ouv_release_math` implements bounded `LINEAR_NET_RELEASE_FULL_20M_V1` using fixed 20 million-unit combined supply, with exact 1:160 reference ratio.
- `vice_ouv_release_policy.status` has an enforced `MODEL_ONLY` constraint. Official automated appreciation is **not activated**.
- Historical cash `distributions` (`PAID` rows) are *not* the same as IRU unit distributions and cannot safely be treated as unit-release events.
- All reference values from distribution counts are internal formula indicators, not independent evidence of fair market appreciation.

## Mandatory, unresolved production gates
1. Verify and preserve formal company-approved executive-only governance amendment, including the former 72-hour/on-chain quorum policy and authorization effective date.
2. Test signed approval identity binding, 2FA/passkey parity, the exact payload hash, and tamper-proof audit history.
3. Review and apply a single atomic SQL migration to align proposal constraints, structural write protections, executive-checker functions, the official valuation update, immutable receipt and future distribution model.
4. Make the read models and holder-facing certificates consistently use the authoritative effective OUV, with management-reference disclosures.
5. Run integration/concurrency tests and validate the deployed Netlify build/production environment before enabling execution.

**Do not imply the OUV was published or automatically appreciated in production; it has not been verified.**
