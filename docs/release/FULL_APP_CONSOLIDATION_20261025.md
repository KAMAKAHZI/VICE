# VICE OS full-application production consolidation

Base: main at e13de2601f19d99c635c362dbdaf82b494e1b155
Target: 1.3.8.0-IRU-CERTIFICATES
Status: INTEGRATION IN PROGRESS — NOT APPROVED FOR PRODUCTION

## Candidate changes requiring selective reconciliation
- fix/phase0-hardening: deployment workflows, backend, governance and tests (108 commits ahead, 82 behind).
- fix/ouv-final-deploy-reconciliation: governance execution and reconciliation (35 ahead, 82 behind).
- vice-os-1380-elite-acceptance: certificates, mailer, migrations, guide (30 ahead, 231 behind).
- repair/registry-cfo-20261017: registry, PWA, comms (8 ahead, 194 behind).
- repair/executive-2fa-20261021: authentication, MFA and authorization (1 ahead, 105 behind).
- fix/executive-multidevice-recovery: device sessions (3 ahead, 161 behind).
- audit/institutional-readiness-20261021: regression and browser tests (11 ahead, 82 behind).
- fix/live-chart-market-data-20261025: integrity module only; not connected to UI (2 ahead).
- security branches: deferred final phase, but never disable current controls.

These counts overlap and are not additive. Do not blindly merge old branches.

## Release gates
1. Inventory each changed file and map to the corresponding implementation on main.
2. Cherry-pick or manually port only missing, compatible features.
3. Apply SQL migrations to staging first, with rollback and non-destructive ledger reconciliation.
4. Test auth sign-in persistence, 2FA, passkeys, device recovery, and RLS.
5. Test governance votes, OUV calculation, holder balances, and immutable ledger integrity.
6. Test certificates, QR verification, document downloads, mail outbox and Academy.
7. Test messages, realtime presence, calls, screen sharing, mobile and desktop.
8. Test provider-backed market data with source timestamps and stale status; never label delayed feeds real time.
9. Test chart pan/zoom, SOLACE F0/F100, alerts and closed-candle behavior.
10. Run CI, staging browser acceptance, Supabase advisors, and production smoke tests.
11. Build using scripts/vice-publish-netlify.sh and inspect dist/site allowlist.
12. Deploy from reviewed main, confirm published commit/version and production endpoint health.
13. Perform final security and privacy release gate before claiming institutional production readiness.

Do not represent internal OUV management references as independent FMV or imply legal/regulatory approval.

## Current verified action
Integration branch created from main. This file is a coordination gate, not evidence that features were merged, tests passed, or Netlify deployed.
