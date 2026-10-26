# VICE OS — Proprietary Isolation Release Gate

Status: **BLOCKED for production rollout pending server-side migration and acceptance tests.**

## Confirmed exposure
- `vice-solace-system.js` contains executable SOLACE calculations and is included in the public Netlify publish allowlist in `scripts/vice-publish-netlify.sh`.
- A public browser application cannot keep delivered JavaScript confidential through encryption or minification.
- Native trading-source files are handled separately by `supabase/functions/vice-trading-source`; do not confuse those with the browser adaptation.

## Required implementation
1. Implement a private, authenticated SOLACE compute service with bounded input, per-user authorization, throttling, and server-held calculation logic.
2. Preserve chart compatibility, data-source behavior, options, and historical replay parity with regression fixtures.
3. Replace browser calls to `vice-solace-system.js` with authenticated API calls; no secret calculation implementation in client bundles.
4. Remove `vice-solace-system.js` from the publish allowlist **only after** verified cutover. Block builds if the private implementation reappears in `dist/site`.
5. Inventory OUV/IRU financial calculations in public assets and isolate only confidential methods, preserving public transparency obligations and auditability.
6. Review each privileged Supabase RPC for purpose, ownership checks, and least privilege. Do not blanket-revoke functions supporting login, certificates, or governance.
7. Apply TLS, encrypted storage, managed keys, scoped service credentials, and non-sensitive audit logs; test backups and key rotation.
8. Audit Git history and public deployments for prior disclosures. Making a repository private does not undo previous public exposure.
9. Verify unauthorized-member, holder, admin, and signed-out behavior; conduct independent penetration testing.

## Release acceptance criteria
- No proprietary algorithms, service-role keys, or private configuration in published assets or source maps.
- Browser receives only authorized calculation results, never implementation source.
- Tests prove tenant isolation, rate limits, access revocation, and unchanged charts/holder workflows.
- Supabase security advisors reviewed and all critical findings resolved or documented with compensating controls.
- Deployment and rollback tested in staging, then approved for production.

This document is a release gate and remediation specification, **not** a claim that encryption or deployment is complete.
