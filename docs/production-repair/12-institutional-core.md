# VICE4X · Institutional Core

18 October 2026 · OMEGA Engine, Sovereign Governance, Self Diagnosis

## What is implemented

The CEO and CFO can open three new entries under Operations. Other members cannot access institutional contact, financing, signature or audit records. Permissions use active database roles, not browser labels. Ordinary holder allocations, reserve controls and member operations remain separate from structural reference policy.

OMEGA stores executive/company contact records with A/B/C classifications, provider/source metadata, email evidence, contact basis, suppression and review references. Apollo search uses the current `mixed_people/api_search` endpoint and a separate `people/match` enrichment call. One activation imports at most ten records, with a shared two-minute import cooldown. It creates drafts for review and never silently sends. Email and provider identity duplicates resolve to the existing record. Paid provider enrichment requires the operator's Apollo key/account. Missing fields remain missing; personal-email and mobile-number reveal are disabled. Business phone details can be recorded manually. ZoomInfo and Bytemine adapters are not implemented.

Outreach drafts use the requested 15% contractual APR and 65/35 split while distinguishing return objectives, credit risk, executed collateral documentation and loss controls. An executive must record recipient verification, a contact/relationship basis, offering route and counsel-review reference before queuing. Edits cancel unsent drafts; suppressed contacts cannot receive new drafts. Sending claims a queued record once and uses a stable provider idempotency key. A provider receipt means accepted by the provider, not delivered. Uncertain outcomes become UNKNOWN and require provider reconciliation before any new campaign. No marketing email was sent during development or acceptance tests.

The financing model uses simple 15% annual interest, equivalent to 3.75% per quarter. Costs and carried losses are deducted before the baseline hurdle; eligible net alpha is divided 65% to the provider and 35% to VICE. The server recomputes saved amounts. A loss scenario shows the contractual baseline funding gap instead of inventing distributable cash. Draft records are not executed notes, binding conversion terms, custody records or accepted capital commitments. Executed note/term-sheet documents, maturity, collateral perfection, conversion economics, subscription evidence and accounting integration remain necessary for a live financing program. The model accepts monthly periods of 1–12 months and does not silently compound the contractual baseline.

The risk monitor calculates flow-adjusted month-to-date drawdown from explicitly entered scenario values. Its threshold range is 10–12%. It is not connected to a broker or a native EA circuit breaker and cannot guarantee a maximum realized loss. Native MT5 integration, compilation and broker-specific execution acceptance remain outstanding. No automated order or transfer is enabled by this release.

## Governance and signing

The designated CEO and CFO are resolved from existing VC-000001 / VC-000006 linked profiles. Each enrolls a P-256 signing key on their own device. The private CryptoKey is non-extractable and stored locally in IndexedDB; the server receives only the public key and full signatures. Enrollment itself requires proof of possession. Challenges bind user, role, action, proposal hash and a random nonce, expire after ten minutes and are consumed once. The Edge Function verifies ECDSA SHA-256 before the service-only database recorder accepts the attestation. This is application-level dual cryptographic authorization, not a deployed blockchain multisig or hardware-key attestation. Browser-origin compromise could still misuse a locally available key; hardware-backed signing and independent assurance remain future work. Lost-device recovery is deliberately not an automatic key reset.

Proposal IDs and payloads are immutable. Client-provided VERIFIED labels are retained as submitted claims, not accepted evidence. The public feed at `/governance.html` exposes only ID, numeric reference parameters, payload hash, validation state, public-review dates and verified-signature count. It excludes signer identities, holder balances, raw signature strings and arbitrary payload fields.

The implemented review window is 72 hours. This is separate from the requested 72-hour execution timelock, which must begin after independently verified on-chain quorum. No blockchain network, deployed governance contract, token ownership snapshot, quorum threshold, finality policy or signer wallet addresses were supplied. An on-chain verifier, atomic execution adapter, automatic rollback and post-migration account Merkle proofs are not implemented/deployed. They cannot be replaced with a JSON status assertion. Structural writes therefore remain locked; existing ordinary allocation RPCs continue under their established controls. Direct reference/configuration/history writes are blocked by database triggers. The execution-gate check records a blocked attempt and its reasons in the institutional audit chain; a rejected SQL transaction cannot itself persist a new audit event after rollback. This is not an irreversible system-wide account lockout.

The requested PROP-2026-10-ELITE-SCALE-003 declares a $2.50/$400 baseline. The live baseline is $2/$320. Its $25/$4,000 targets preserve 1:160 but represent a 12.5x change from the live references, not 10x. The proposal is stored for review with BASELINE_MISMATCH; the supplied abbreviated signatures are not valid attestations. No price, holder quantity, allocation, reserve, certificate or collateral value is changed. Reference scaling must never multiply holder quantities.

## Diagnosis and environment boundaries

Self Diagnosis runs authenticated database checks on refresh: reference-ratio consistency, institutional audit-chain recomputation, event count/head and actual structural gate status. Audit rows are append-only through the application API and chained by SHA-256 under a serialized database lock; database superusers remain a trust boundary and no external immutable anchor is deployed.

VICE4X is an internet-connected Netlify/Supabase application. It is not air-gapped. No isolated OI agent container, embedding-based exfiltration detector, model-weight registry, LLM memory inspection or continuous socket scanner is installed. The UI explicitly reports these checks as unavailable/unverified instead of green. No autonomous agent receives production write credentials in this implementation. Additional agent-runtime and network infrastructure is required to implement and certify those capabilities.

## Provider setup

Configure server-only Supabase Edge Function secrets, never frontend files or Git:

| Capability | Required configuration |
|---|---|
| Apollo | `APOLLO_API_KEY` with search and enrichment access; verify credit allowance |
| Outreach email | `RESEND_API_KEY`, verified `OMEGA_FROM_EMAIL`, monitored `OMEGA_REPLY_TO`, real `OMEGA_POSTAL_ADDRESS` |
| Governance execution | Selected chain and governance contract, wallet ownership binding, quorum/validation policy, independent verifier and audited executor |
| Native drawdown enforcement | Authorized broker/MT5 runtime, compiled and tested EA integration, monitored reset/flow policy |

Recipient identity, offering route and legal evidence are recorded and checked for workflow completeness, not independently certified by software. Relevant reference sources: [SEC Rule 506(c)](https://www.sec.gov/resources-small-businesses/exempt-offerings/general-solicitation-rule-506c), [SEC general solicitation](https://www.sec.gov/resources-small-businesses/capital-raising-building-blocks/general-solicitation), [Apollo search](https://docs.apollo.io/reference/people-api-search), [Apollo enrichment](https://docs.apollo.io/reference/people-enrichment), [Resend API](https://resend.com/docs/api-reference/emails/send-email). Counsel must determine the applicable offering framework and verify executed security/conversion arrangements. The software does not determine whether an IRU or a particular financing is a security.

## Verification

15 isolated PostgreSQL checks cover repeat migrations, role isolation, import deduplication, suppression, evidence gates, server-calculated economics, immutable proposals, public-field privacy, structural bypass denial, one-use signatures, distinct executive identities, expiry and suspension. Eight deterministic model/cryptography tests and six Edge Function tests pass. Desktop 1440px and mobile 390px browser tests cover calculations, lead forms, search, escaped names, draft previews, device-key enrollment, blocked mismatched scaling and access denial. Edge/provider tests use synthetic responses and do not prove live provider credentials, real executive signing or email delivery. Production identity and final checks are recorded in the release report.
