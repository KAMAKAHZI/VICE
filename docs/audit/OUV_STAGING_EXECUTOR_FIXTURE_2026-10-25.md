# OUV staging transaction fixture

**Environment:** isolated Supabase staging project `mzdybvxvmbigaylleqbt`. Never run against production `sdsaewumabzjjvsmqqsl`.

The replayable SQL is `sql/staging/vice_ouv_atomic_executor_fixture.sql`. It defines four private fixture tables and a SECURITY INVOKER function. All browser roles are denied access and RLS is enabled. This is not a production executor and uses simulated quorum timestamps, not cryptographic governance verification.

## Observed isolated staging tests (2026-10-25)

- Injected exception after writes: transaction subblock rolled back; original test config and proposal state preserved.
- Successful invocation: proposal `TEST-ATOMIC-001` changed to EXECUTED; exactly one version and one receipt; test price 3.00000000.
- Re-invocation: rejected; exactly one version and receipt remained; price unchanged.
- Schema privilege inspection: `anon` and `authenticated` cannot execute the function.
- RLS inspection: all four tables enabled.
- **Not tested:** independent concurrent database sessions, cryptographic signatures, production triggers/constraints, release governance policy, complete staging migration parity.

## Required before production consideration

1. Build the real executor using actual production schema and independently verified on-chain governance, signatures, and timelock.
2. Test two independent sessions racing the same proposal and different proposals, including the global config row.
3. Run staging rollback/fault injection and full reconciliation against production-equivalent triggers.
4. Obtain security and governance review. Do not enable `VICE_OUV_EXECUTION_ENABLED` based on this fixture.
