# VICE OS Security Workstream — Isolation and Release Gates
Date: 2026-10-25
Branch: security/isolated-audit-20261025
Baseline: 3aea7ef795774f736e73bcb008c5c33eb79f1c36

## Scope and noninterference
This branch is dedicated to defensive security investigation and verified fixes. Do not merge, deploy, alter production Supabase data, execute governance, change IRU supply/balances, rotate credentials, or enable mail delivery without separate reviewed authorization. Other workstreams may change main; rebase and retest against current main before any merge.

## Priority 0 — identity
- Inspect Supabase session initialization, refresh handling, onAuthStateChange listeners and sign-out paths; establish reproducible desktop loop/rate-limit tests.
- Verify user enumeration protections and replace anonymous username-to-email lookup only after staging sign-in/recovery acceptance.
- Require independently verified CEO/CFO action-bound signatures, MFA freshness and fail-closed authorization; never infer approvals from UI flags.
- Treat passkey functionality as unavailable until full server-side WebAuthn challenge, origin, RP ID, counter and attestation/assertion verification are tested.

## Priority 0 — database
- Rebuild production-equivalent staging from sanitized schema only; confirm all tables, migrations, grants, RLS, functions and triggers before running migrations.
- Inventory SECURITY DEFINER functions and anonymous/authenticated execute grants. Remove excessive privileges only with role-positive and role-negative tests.
- Verify certificate public endpoints minimize personal data; test legacy digests and revocation behavior.

## Priority 0 — proprietary code
- Treat browser-delivered SOLACE logic as public. Design server-side calculation boundary, authentication/authorization, request throttling and parity tests before migration. Never claim minification or client-side encryption protects source.

## Priority 1 — release
- Run dependency and secret scans, security regression suite, staging parity, real device login/MFA/recovery tests, backup/restore rehearsal, and independent review.
- Preserve release integrity: source SHA, artifact byte identity, live asset checks and rollback record.
- No security-complete claim without current-head evidence and explicit release sign-off.

## Exit criteria
Each finding requires severity, affected component, reproduction, minimal patch, regression test, staging result, deployment approval and postdeploy evidence. Open P0/P1 items block certification.
