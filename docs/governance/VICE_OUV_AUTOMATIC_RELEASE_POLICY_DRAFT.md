# VICE Capital — Fixed-Supply Automatic OUV Distribution Policy (DRAFT)

**Status: MODEL ONLY. Not authorized to update official OUV, holder holdings, certificates or collateral values.** 

## Governing distinction

The mathematically verifiable part is the **internal issuance-activity/reference index**. Releasing already-authorized tokens from a reserve **does not itself add business assets, cash, earning power, fair market value, or lender-accepted collateral**. The index is an issuer-designed administrative reference *policy*, not independent economic valuation. An approved objective asset/NAV-based valuation is a separate prerequisite for representing economic appreciation.

Until a CEO/CFO amendment explicitly authorizes a rule, all records show the official baseline unchanged. The current sovereign governance executor remains locked pending the required external quorum proof and timelock. There is no automatic structural execution or price-changing permission added by this release.

## Immutable supply and pools

| Source | VICE | V4X | Combined |
| --- | ---: | ---: | ---: |
| Authorized supply | 10,000,000 | 10,000,000 | 20,000,000 |
| Strategic holder pool | 2,500,000 | 2,500,000 | 5,000,000 |
| Estate/Admin reserve | 7,500,000 | 7,500,000 | 15,000,000 |

**Counters at model-baseline creation:** VICE strategic released **733,499**; V4X strategic released **730,999**; Estate transferred **0** for each class. The model's base management references are **VICE $2.00000000** and **V4X $320.00000000**. Past issuance already captured in these balances is **not** treated as new appreciation.

## Exact deterministic model

Define `S=20,000,000` as the fixed aggregate authorized supply. Count only **net new strategic issuance delivered to holders** plus **new estate reserve distributions to holders**, minus recorded corrections and retirements. Do not count reservations, approvals that are not executed, cash payments, secondary holder-to-holder transfers, redundant retries or repeated event processing.

- `QV = current strategic VICE issued + current estate VICE transferred`
- `QX = current strategic V4X issued + current estate V4X transferred`
- `Q0 = 733499 + 730999 = 1464498` at this policy baseline
- `N = QV + QX - Q0` (net new released units)
- `index_change_fraction = N / 20000000`
- `index_change_percent = 100 * N / 20000000`
- `modeled_VICE = round8(base_VICE * (1 + N / 20000000))`
- `modeled_V4X = round8(160 * modeled_VICE)`
- `modeled_holder_value = holder_vice_units * modeled_VICE + holder_v4x_units * modeled_V4X` **for a clearly identified model view only**.

Rounding is **at 8 decimal places** with PostgreSQL numeric exact decimal arithmetic; client-side binary floating points are not authoritative for commits. The 1:160 ratio holds exactly at the stored OUV precision. Both reference classes move at the *same modeled percentage* to maintain that peg. The release count is anchored to current **net** ledger balances, so fragmenting one issuance across holders or retrying it cannot multiply the index change. Reversals recalculate the net count; values are not forever ratcheted up by undone issuances.

This is a **bounded, linear, path-independent policy formula**, *not* an inverse-remaining-supply formula, which explodes near reserve exhaustion. It is not a claim that allocating 1% of all units increases fair market value 1%.

## Verified calculation examples

| New VICE | New V4X | Total new units | Model % since baseline | Modeled VICE | Modeled V4X |
| ---: | ---: | ---: | ---: | ---: | ---: |
| 0 | 0 | 0 | 0.000000% | $2.00000000 | $320.00000000 |
| 50,000 | 50,000 | 100,000 | +0.500000% | $2.01000000 | $321.60000000 |
| 100,000 | 100,000 | 200,000 | +1.000000% | $2.02000000 | $323.20000000 |
| 200,000 | 0 | 200,000 | +1.000000% | $2.02000000 | $323.20000000 |

A holder with 10,000 VICE and 10,000 V4X would have a *modeled* internal reference of $3,220,000 before the example and $3,252,200 after +1%, with **exactly the same holdings**. There is **no automatic change to official reported portfolio value** until a duly authorized policy and executor take effect. Certificates already issued are historical snapshots and must **not** be silently rewritten. Future official valuation certificates must display the policy ID/effective date and distinguish the calculation from an appraisal.

## Governance proposal to activate in future (NOT YET APPROVED)

1. Obtain independent CEO and CFO authorization of the complete formula, eligible event types, approved valuation-evidence requirements, cumulative band and activation date.
2. Suggested **major-event threshold is 5% of the 20M supply**, measured as cumulative net new distribution since the last approved baseline. **This number is provisional, not yet ratified.** Once the threshold is crossed, require an independently reviewed new valuation authorization before further official auto-changes; do not prevent lawful unit distributions.
3. Reconcile `iru_program_counters`, holder unit balances, estate reserve counters, transfers, and audit events. Fail closed for any discrepancy before altering official OUV.
4. Check existing externally verified on-chain quorum requirement and public review/timelock. Do **not** bypass these with a client button, a service-role RPC, a blank governance vote or a direct SQL price edit.
5. When approved, establish a dedicated, idempotent atomic **official OUV execution** transaction with source-event proof, expected previous version, synchronized price policy history and `ouv_versions`, and exact decimals. Verify 1:160 and no supply/unit changes. Holders should read the **same canonical effective OUV** for their accounts; member RLS must isolate private holdings. The current implementation deliberately does **not** include that activation executor.
6. If a separate major OUV proposal (e.g. `PROP-20261019-548A9057-34F`) first takes effect, **rebase this model to those actually effective OUVs and the new net release counts** through governance before activation. Never compound a stale baseline.
7. Distinguish formula-generated internal management reference from external fair market value, market cap, independently appraised collateral, cash or realizable returns on all screens/documents. Do not describe a payout as investment performance without separately verified evidence.

## Completion update — automated model and server reconciliation

The implementation now includes two independent layers:

1. **Working read-only distribution model:** committed issuance and estate-reserve distribution events are detected automatically; each event has an idempotent model audit entry. The arithmetic updates from current net released quantities, so ordinary activity never requires repetitive approval *for the model*. Authorized executives can preview source-limited distributions. Members receive an authenticated, account-scoped `My IRU` model preview that refreshes while that page is open. This does not rewrite official totals.
2. **Still locked official OUV:** the production `vice_dao_config` references remain the official source and are unchanged until approved on-chain verification and an audited structural executor implement the full governance procedure. The proposed automatic index may not be described or deployed as genuine asset appreciation without independent valuation support.

The model is now paired with `vice_private.ouv_release_reconciliation()`, an independent check of strategic holder balances versus program counters, estate-holder balances versus transferred reserve balances, the 7.5M-per-class estate book, the 2.5M-per-class strategic cap, and the exact 1:160 ratio. Failure to reconcile, or changing the official OUV without a governed rebase, stops the executive quoting interface instead of silently reporting obsolete projected references. The optional model preview is isolated from app sign-in and the remaining institutional modules.

The signed-in holder-specific RPC `vice_ouv_my_reference_snapshot()` discloses only that account's verified holder and estate-transfer quantities, server-computed official reference, and an explicitly labeled *model* total. It does not provide a mechanism to list another holder's balances. Member-facing `My IRU` cards also now derive official references from the live canonical issuer price rather than a stale journal-only reference.

### Final controlled activation checklist

- **Governance:** CEO/CFO approve an exact distribution-index policy, permitted event types, evidence criteria and numeric "major appreciation" threshold. **Five percent is currently only a proposal**, not an active rule.
- **Economic basis:** independent accounting or valuation review establishes whether an allocation-based internal reference adjustment is appropriate. An internal formula alone cannot substantiate fair market appreciation.
- **Execution controls:** configure verified on-chain quorum (with explicit proof/replay protections), complete the required public review and 72-hour timelock, and deploy/test an atomic, idempotent official OUV executor that publishes an effective policy record without touching IRU unit counts.
- **Rebase:** before activating automatic official values, synchronize this model with any intervening independently approved major OUV event. Pending `PROP-20261019-548A9057-34F` must not be treated as executed merely because it has both executive attestations.
- **Acceptance:** run both mathematical tests and issuer/member live-session tests, verify 250-holder RLS and confidentiality, historical signed certificates, portfolio banner and total values, and publish Netlify from the final GitHub main SHA once to avoid unnecessary credits.

**Exact model examples from live Supabase:** 10,000 total newly allocated IRUs gives +0.05% (VICE $2.00100000 / V4X $320.16000000); 10,000 in each program gives +0.10% (VICE $2.00200000 / V4X $320.32000000). These remain only provisional management-reference model outputs.

## Installed additive backend and frontend

- Database `public.vice_ouv_release_policy`: fixed baseline, supply and `MODEL_ONLY` status.
- `vice_private.ouv_release_math`: canonical server-side quote with 2.5M strategic / 7.5M estate caps, total 10M each and 1:160 exact pricing.
- `public.vice_ouv_release_snapshot()`: live authenticated member's read-only model summary, separate from official OUV.
- `public.vice_ouv_release_quote(vice_units,v4x_units,pool)`: authorized CEO/CFO planning preview, **no mutation**.
- `public.vice_ouv_release_model_events`: one model audit per source event (unique source table/sequence) for strategic issuance, retirement, correction or estate distribution.
- Database triggers capture accepted distribution events atomically; previous historical events are not replayed or rebooked.
- Sovereign Governance view shows **MODEL ONLY**, official values, modeled values, net distribution index and a source-capped planning quote. Failure to load this optional preview cannot block other institutional modules.
- `tests/vice-ouv-fixed-supply-distribution.cjs`: fixed-precision, finite-supply, no-compounding, ratio, split, correction, and duplicate-cash-event test vectors. Run: `node --test tests/vice-ouv-fixed-supply-distribution.cjs`.

**No IRUs, legal ownership records, existing signatures or official OUVs were changed by installation of the draft model.**

## Final implementation and acceptance snapshot (October 21, 2026)

**Implemented in production Supabase and committed to GitHub:**
- Fixed 20,000,000-unit total supply in the model; 10M each class, of which 2.5M each strategic and 7.5M each estate reserve.
- Live exact-decimal database model with 1:160 ratio. A 10K total new-unit distribution changes the mathematical *model* index by 0.05%; 10K of each changes it by 0.10%; 100K of each changes it by 1.00%.
- One event record per committed issuance/correction/estate distribution, with no non-executed proposals, cash dividends or secondary transfers added to release counts.
- Reconciliation RPC compares reserve, holder, and strategic-counter amounts and fails closed for stale policy baselines.
- All holders' LIVE My IRU views show the model only as a separate non-effective reference, while official values remain from issuer policy. Aggregate official cents now round both program lines together and reconcile to the SQL sum, avoiding a 1-cent double-rounding error.
- Founder LIVE reserve accounting now **omits an unverified reserve** rather than falling back to the static 7.5M ceiling and potentially double-counting transfers. Holder quantities and issuer reserve move in opposite directions during real transfers; no authorized unit quantity increases.
- 45-second background polling synchronizes canonical OUV plus estate ledger and refreshes holder journal only if server unit balances change.
- Institutional **Check execution gates** is now backed by the read-only `vice_ouv_activation_readiness` RPC with 2FA/key signature counts, review window and outstanding infrastructure requirements. Rejected/invalid proposal payloads fail safely without applying OUV.
- Source release workflow checks `node --test tests/vice-ouv-fixed-supply-distribution.cjs`; 20 model, security and integration-source checks plus JavaScript syntax checks pass in tool-based acceptance, and an independent read-only SQL sweep verifies the exact 1:160 ratio across 101 supply increments. Live browser and Netlify acceptance remain separate.

**Current signed major proposal:** `PROP-20261019-548A9057-34F`, two of two executive authorizations (CEO via fresh MFA and CFO via device signature). State: `REVIEW`, review through **2026-10-22 21:47:27 UTC (17:47:27 EDT)**. On-chain quorum timestamp `NULL`, execution timelock `NULL`; present database constraints deliberately prevent either being set until the governance implementation is upgraded. No official OUV change is authorized merely by CEO/CFO sign-off. The old OUV baseline is still **VICE $2 / V4X $320**; proposed **VICE $2.82645403 / V4X $452.23264480** remains non-effective.

**Outstanding deployment requirements to call the full workflow complete:** (1) configure an independently verified on-chain quorum verifier and approved criteria; (2) adopt and enforce the separate 72-hour timelock and an audited, replay-safe atomic official price executor with server-side revision/version history, exact baseline comparison and no holder-unit changes; (3) independently substantiate any actual economic valuation claims with current verified records; (4) obtain executive adoption of this automatic model and its major threshold (the current 5% is only proposed), with any baseline rebased after the pending major proposal legitimately activates; (5) publish and smoke-test the final GitHub revision through the existing Netlify integration once, without duplicating paid builds. No execution workarounds or direct SQL price edits are permitted.

**Settlement/accounting disclosure:** 20M denotes authorized internal units, not that 20M are fully issued on-chain or backed by immediately realizable funds. Distribution-based model appreciation is an issuer policy indicator, not external fair market value or automatic real profits.

## Release-candidate acceptance and manual Netlify publication (October 21, 2026)

The server's live `vice_private.ouv_release_reconciliation()` confirms all strategic holder balances, estate reserve balances, append-only issuance/reversal provenance and the exact 1:160 official ratio currently reconcile. The issuance index remains `MODEL_ONLY`; `automatic_official_update_enabled=false`. No release-index audit rows have been generated because no eligible distribution has occurred since the baseline was recorded. Simulated quotes are not distributions.

**Mathematical CI:** The 24 tests in `tests/vice-ouv-fixed-supply-distribution.cjs` cover the 20M cap, each 10M subcap, the 2.5M strategic/7.5M estate pools, 8dp arithmetic, no split compounding, no doubled supply, correction behavior, cash-transfer exclusion, source migration safety, issuer/member renders, audited provenance, bounded refresh, and deployment identity. Static tests do not substitute for authenticated production end-to-end issuance with CFO/holder sessions.

**Release identity:** The `VICE OS secure Netlify publish` workflow remains **manual only** (`workflow_dispatch`) to avoid duplicate Netlify charges if native Git publishing is already configured. The GitHub build now stamps the checked-out commit SHA and production context before upload; live smoke requires exact source commit identity **and** byte equivalence of all public assets. Because the manual CLI cannot know the future Netlify deployment ID before upload, it records a truthful null `deployment_id` and the smoke accepts that only for an explicitly marked manual production run; the report includes a warning. Native Netlify Git builds still provide their actual deployment ID. Do not invent a deploy ID.

**Publication path for the authorized operator:** First check the existing Netlify project's Deploys panel. If Git integration already published the current main SHA, *do not manually publish again*. Otherwise, confirm the repository's `NETLIFY_AUTH_TOKEN` and `NETLIFY_SITE_ID` GitHub Actions secrets exist, then run the single `VICE OS secure Netlify publish` workflow on **main**. Review its `VICE_OS_NETLIFY_PRODUCTION_ACCEPTANCE` artifact; require zero FAIL entries, commit match and all public byte checks before declaring the frontend production-ready. No production publish has been verified solely by updating GitHub.

**Policy activation is still separate:** CEO/CFO signatures for `PROP-20261019-548A9057-34F` authorize the specific major OUV proposal, not this *different* automatic distribution policy. This model's proposed 5% major-event threshold is not an enacted corporate policy. An exact, separately ratified rule and independent financial support must precede any automatic revision of *official* OUVs. The current sovereign contract lacks an operational verified on-chain quorum and 72-hour timelock, and its atomic executor remains disabled; do not bypass them. A newly effective separately approved OUV must be rebased into this model before further proposals. No code in this release changes authorized supply, holder unit balances, historic certificate snapshots or canonical official prices.
