# VICE OS / Deployment and Recovery Guide

Internal engineering • 2026-10-15 UTC • 1.3.8.0-IRU-CERTIFICATES

Run the packaged-public-root build and all regression suites before merging. Review the entire diff. Branch commits carry [skip netlify]; the final reviewed merge is the single native production deployment trigger. Do not concurrently dispatch CLI publishing.

Netlify: Node 22; build bash scripts/vice-publish-netlify.sh; publish dist/site; functions netlify/functions. CLI fallback uses --no-build and a shared concurrency group. Native and CLI execution still require operator coordination.

Production verification compares version plus exact bytes of nine web assets. _headers and _redirects are configuration files, not downloadable acceptance targets. A version-only match cannot identify a repair. Record the Netlify deploy URL/ID, source SHA and UTC publication time from provider evidence.

Recovery: use a known-good existing Netlify deploy, preserving backend compatibility. Never roll back SQL by deleting migrations or financial data. Take a database backup before any destructive work; this repair executes none. Re-test Auth, public access controls and assets after rollback.

Private-repository conversion is deferred until GitHub installation and Netlify private-repository permissions are verified. Do not break deployment access merely to change visibility.
