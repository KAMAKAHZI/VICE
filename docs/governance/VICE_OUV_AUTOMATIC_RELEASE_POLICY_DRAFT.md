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
