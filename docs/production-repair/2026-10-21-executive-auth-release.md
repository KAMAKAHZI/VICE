# VICE4X · Executive authentication release verification

Target: **1.3.8.0-IRU-CERTIFICATES** · Production: https://vice4x.netlify.app

This report describes the coordinated authentication and certificate repair. Exact deployed SHA, build timestamp and Netlify deployment ID are exposed by `/deployment.json`; publication is verified separately from the tests below. The final GitHub release discussion records the production verification result.

## Root causes and corrections

| Subsystem | Observed cause | Implemented correction |
|---|---|---|
| Executive keys | Proposal signing and recovery looked in different IndexedDB databases/entries | One identity-scoped resolver, registered public-key matching, nonextractable keys, safe legacy promotion |
| MFA | Parallel partial implementations used separate RPC contracts and receipt formats | Fresh action-bound Supabase proof with unambiguous v2 RPC names; original verified TOTP receipts retained and counted |
| Authorization | Approval displays could confuse a device signature with a TOTP approval | Distinct methods, one role counted once, public/private status reconciled, accurate signature count |
| Recovery | CEO-only workflow and dependence on inconsistent old-key storage | Symmetric CEO/CFO recovery, requester MFA, independent approval, cooldown, replacement-key possession, retained old public keys |
| Retry / logout | Auth state and pending code dialogs could diverge from server outcome | Explicit failures, server-confirmation retry, account-generation checks, pending secret clearing |
| Certificate PNG | HTML foreignObject inside certificate SVG tainted the canvas | Native SVG text; verified PNG path plus explicit SVG and print fallback |
| Integration | Main and the live backend advanced while repair was in progress | Reconciled latest OUV model, readiness, audited distribution and automatic refresh work; preserved existing real approvals/recovery |

The shared module is `vice-executive-auth.js`; entry points are in `index.html` and `vice4x-institutional.js`. Backend changes are versioned in the migration and the existing institutional Edge Function. Build whitelist and acceptance workflow include the module and tests. No financial allocations, holder identities, certificate issuance states or official OUV are changed by this repair.

## Test record

All test identities, authenticator responses, private keys and allocations used by automated behavioral tests are isolated synthetic fixtures. No production executive code or signature was supplied by the release agent.

| Suite | Local result |
|---|---|
| Executive authorization / recovery database | 21 scenarios; includes legacy receipt preservation, live readiness contract, proof replay, wrong session, role change, stale hash, cooldown and rejection |
| Executive browser flow | 16 passing scenarios at 1440px and 390px |
| Certificate exports | 5 passing scenarios: IRU PNG, Academy PNG, safe SVG/revocation/QR, blocked-canvas fallback, print |
| Existing institutional database | 15 passed |
| Existing registry / CFO controls | 29 passed |
| Existing communications database | 5 passed |
| Existing institutional browser | Both desktop and mobile passed |
| Existing general browser smoke | 8 reported checks passed |
| PWA safe-area/navigation/layout | 10 device/viewport checks passed |
| Node unit/regression suites | 105 reported Node tests passed, including 24 OUV distribution checks and 8 Edge verification tests |
| SOLACE deterministic suite | 12 reported scenarios passed; native TradingView parity not executed |
| Build / syntax / privacy whitelist | Passed |

CI reruns the relevant suites against the candidate commit. Production checks additionally compare the exact deployed commit and published asset bytes, test public authentication/certificate endpoints without real credentials, verify that unauthorized executive RPC calls are denied, and compare protected record digests before/after the migration.

## Remaining verified limits

- Real new CEO/CFO MFA operations require those executives' enrolled devices. Existing production records already show a genuine CEO TOTP proposal approval and a completed earlier key recovery; those are preserved, not recreated by testing.
- Physical iOS Safari/PWA, Firefox and Edge testing is not completed. Chromium mobile viewport checks are not a substitute for those devices.
- Complete authenticator loss requires independent identity verification and an authorized provider administrator. There is no email-only reset or founder bypass.
- On-chain quorum verifier and structural execution infrastructure remain unconfigured. The OUV distribution model is preserved as a model; executive approval alone does not activate a reference change.
- Audit hash chains are not externally anchored. The networked app is not air-gapped and does not claim zero data leakage certification.

Operating instructions and recovery precautions: [Executive authorization guide](../security/EXECUTIVE_AUTHORIZATION_AND_RECOVERY.md).
