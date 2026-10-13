# Exact Supabase migration ledger — 2026-10-13

Exported 38 applied SQL migration definitions directly from the live project's `supabase_migrations.schema_migrations.statements`. Each file uses the exact version in the ledger. No new financial records or issuances were created by synchronizing source control.

**Important:** The existing database has tables and functions predating the first recorded migration. An empty Supabase preview branch may not be reproducible from these migrations alone. Do not add artificial empty bootstrap files, disable the failing check, or apply the intentionally blocked legacy `supabase-setup.sql`. Reconstruct an audited foundation separately before promising new-environment parity. 

Some previous filename timestamps did not match applied migration versions; those versions were moved to the canonical filenames. No migrations were applied to production during this reconciliation.
