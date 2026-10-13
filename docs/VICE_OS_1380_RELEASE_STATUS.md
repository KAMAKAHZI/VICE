# Release 1.3.8.0 · Acceptance Ledger

| Component | State | Evidence or restriction |
|---|---|---|
| Supabase project | ACTIVE_HEALTHY (checked) | Existing live project `sdsaewumabzjjvsmqqsl` |
| Database migrations 1380-1383 | Applied | Supabase migration results acknowledged success |
| Token certificate registry | Installed, empty | No real issuer VCT event was created during release testing |
| Holder isolation | Server RLS installed; role test pending | Direct certificate SELECT is holder/issuer only; public verify is single-ID RPC |
| Dual-program reference snapshot | Implemented | VICE $2; V4X $320 issuer-managed references (not appraisal) |
| QR + Code39 certificate artwork | Local source tests pass | 2550×3300 print SVG; test QR decoded correctly |
| Public VCA + VCT verification page | Implemented locally | Browser/live network acceptance after deployment needed |
| IRU + Documents user views | Implemented locally | Registered member session test needed |
| Period consolidation | RPC installed | First real issuer execution pending |
| Issuer PAID distribution certificate | Trigger installed | Independent banking settlement is NOT attested |
| Outbox | RLS-installed, persisted | SMTP provider and always-on worker are unconfigured |
| 14 email HTML templates | Source implemented | No real SMTP delivery acceptance |
| Node read-only bridge | Source implemented | Uses fresh MT5 export only; not direct broker authorization |
| Netlify publication | NOT CONFIRMED | Publish once after final local tests |
| Netlify serverless TURN/Yahoo functions | Existing source preserved | Requires CLI or GitHub workflow, not static Drop alone |
| Security advisors | Inspected | Intentional public verification SECURITY DEFINER RPCs + existing project advisories require review |
| Full regulated-production guarantee | NOT CERTIFIED | Requires independent security, legal and business acceptance |
