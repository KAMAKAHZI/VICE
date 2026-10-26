# VICE OS — AI-Assisted Defensive Security Architecture (review candidate)

## Threat model
Protect against compromised credentials, supply-chain injections, malicious pull requests, prompt injection into AI security tooling, data exfiltration, unauthorized administrative operations, compromised dependencies and insider misuse. No claim of AGI, perfect detection or NSA certification.

## Hard security boundaries
- **AI is advisory, not an authority.** No model-generated command may modify production IAM, databases, DNS, releases, finance ledgers, or secrets without deterministic policy checks and authorized human approval.
- Treat logs, tickets, pull requests, webpages, repository text, and model outputs as untrusted. Never obey instructions embedded in them.
- Security automations operate with least-privilege, short-lived identities, scoped tokens and explicit allowlists. Separate observation from remediation credentials.
- No direct access to plaintext signing keys, TOTP seeds, recovery codes, or unrestricted service-role tokens by AI systems.
- CEO/CFO governance signatures and independent cryptographic verification cannot be replaced by anomaly scores or model judgments.
- Preserve append-only, timestamped, tamper-evident audit records with immutable offsite retention; no automatic deletion of evidence.
- Automatic low-impact defenses: rate-limit abusive traffic, quarantine suspicious build artifacts, block known-malicious dependency versions and open a security incident.
- High-impact actions (account disablement, release rollback, token revocation, financial freeze) require deterministic criteria, break-glass recovery and approved escalation.

## Layered implementation roadmap
1. **Identity:** phishing-resistant passkeys for executives, device-bound sessions, short expiry for privileged actions, replay-resistant challenges and login abuse detection.
2. **Build integrity:** pinned CI actions to immutable commit SHAs, restricted workflow permissions, branch protection, signed release provenance, SBOM and dependency scanning, secret scanning with automatic rotation playbooks.
3. **Runtime:** Netlify/WAF rate limits, Supabase RLS and SECURITY DEFINER privilege audits, database audit logs, alerts on abnormal authorization failures and high-risk data exports.
4. **Detection:** combine deterministic rules with optional AI triage; model outputs are structured, schema-validated, and evidence-linked. No autonomous code execution from model recommendations.
5. **Response:** incident severity classification, deduplicated alerts, bounded containment, forensic preservation, operator confirmation, recovery drills.
6. **Verification:** adversarial prompt-injection tests, red-team authorization tests, restore drills, external penetration test and independent financial control audit.

## Minimum incident signal schema
`event_id`, `observed_at`, `source`, `actor_id_hash`, `event_type`, `asset`, `rule_id`, `severity`, `evidence_digest`, `correlation_id`, `action`, `review_status`.

Never include passwords, session tokens, full email addresses, private keys, or raw personal financial information in security alerts.

## Detection quality gates
- Measure precision, recall, false positives, mean time to detect, mean time to contain and recovery time against a versioned adversarial test suite.
- Rehearse attacks on a staging environment only. Record rollback paths and verify that financial state is unchanged.
- Fail closed for governance and money movement. Fail safely for public-facing login availability with rate limits rather than blanket lockouts.
- Disable AI-assisted response if telemetry integrity, model validation, or the deterministic authorization policy fails.

**Status:** design and release criteria only. No runtime protection or monitoring service is implied by this document.
