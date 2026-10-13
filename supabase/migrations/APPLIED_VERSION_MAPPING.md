# Live Supabase migration reconciliation — 2026-10-13

Project: `sdsaewumabzjjvsmqqsl` (VICE). This file is an evidence record, not a migration to run.

| Name | Database migration version | Source-package filename version |
|---|---|---|
| vice_1380_verified_portfolio_token_certificates | 20261013052749 | 20261013052749 |
| vice_1381_bind_all_certified_portfolio_fields | 20261013053513 | 20261013053011 |
| vice_1382_transactional_mail_outbox | 20261013053903 | 20261013053500 |
| vice_1383_distribution_certificate_on_issuer_paid | 20261013053953 | 20261013054800 |
| vice_1384_additive_complete_operational_registries | 20261013125523 | 20261013073000 |

The historical source names were preserved on the staging branch for package-test compatibility. **DO NOT blindly run** `supabase db push` against production until the filename/version history is reconciled with `supabase_migrations.schema_migrations`.

Current verified state: 50 public tables, all RLS enabled. Newly added server-only tables have no browser-write grants by design. Source tables are only foundations: their existence is not proof that UIs, external integrations or workflows are live.

**Production publish is blocked pending single-release acceptance**. This staging branch intentionally does not trigger Netlify production.
