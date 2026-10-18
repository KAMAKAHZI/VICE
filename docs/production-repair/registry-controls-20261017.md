# VICE4X / Registry authority and account controls

Release: 1.3.8.0-IRU-CERTIFICATES · Registry control revision: 2026-10-17

The database owns permissions, balances and audit receipts. Interface labels do not grant authority.

| Capability | KAHZI / Reserve administrator | CFO |
|---|---|---|
| Administer the 7,500,000 Estate Reserve per program | Yes, existing reserve workflow | No |
| Allocate, approve, reserve and distribute the 2,500,000 strategic holder pool per program | Yes | Yes |
| Appoint holders; record tier and legacy | Yes | Yes |
| Correct an exact mistaken direct strategic issuance | Yes | Yes; reserve administrator protected |
| Distribute from own strategic holdings | Yes, if eligible holdings exist | Yes |
| Freeze/unfreeze eligible holder balances | Yes, including CFO | Yes; reserve administrator protected |
| Suspend/restore account access | Yes, including CFO | Yes; reserve administrator protected |
| Revoke/restore membership | Yes, including CFO | No |
| Assign or remove the CFO role | Yes | No |

The protected administrator cannot be frozen, suspended or revoked through these delegated controls. Self-suspension is also blocked. Institutional recovery of the protected administrator is a separate operator procedure. KAHZI retains authority over both pools and can unfreeze or restore an eligible account before approving further financial activity.

## Using the registry

Open **Holder Registry**, select **View**, and choose the required action. **Issue from holder pool** debits available strategic-pool capacity. **Distribute from my holdings** debits the acting administrator's existing balance and credits the selected recipient; it does not mint units or consume reserve capacity. **2,500,000 holder pool** opens the existing approval/reservation/distribution workflow.

Freezing holdings blocks financial changes while preserving login access. Suspension blocks authenticated data access, invalidates login sessions and prevents financial changes. Membership revocation preserves balances, certificates and original financial history while removing access. Restoration requires a fresh login; it does not remove a separate holdings freeze. Administrative controls require a reason and append a ledger event and audit record.

Own-holdings distributions produce paired, persistent ledger receipts. Existing issuance certificates remain historical issuance records; the transfer ledger establishes subsequent movements. This change does not claim to issue new transfer PDFs or send distribution emails.

Retries reuse the original request ID and contents. The backend either returns the existing receipt or rejects a conflicting reuse. Direct issuance also prevents duplicate writes for the same request. Invalid, frozen, suspended, closed, overdraft and protected-reserve targets are rejected transactionally.

## Identity and correction integrity

Email and username login identifiers are trimmed and case-insensitive. Password characters, case and spaces are preserved. Existing appointed records link to verified member profiles by normalized email, without creating duplicate holders. Ambiguous duplicate records require reconciliation instead of selecting an arbitrary match.

Account cleanup reverses reviewed source issuances through the established correction function, revokes their certificates, and closes zero-balance holder records. Original ledger and audit records are retained. Closed records no longer consume active holder capacity. Auth identities and sessions are removed only for the exact reviewed accounts. Private member details and correction receipts remain in the database, not this public repository.

## Verification

- `tests/vice-registry-controls.mjs`: 21 isolated PostgreSQL 17 checks, including repeatable migration, case-insensitive linking, CFO pool authority, certificate attribution, allocation lifecycle, transfer conservation/idempotency, pool cap, protected reserve, root override, session revocation, RLS, stale JWT denial and exact issuance correction.
- `tests/vice-registry-ui.cjs`: 9 behavioral tests covering normalized identifiers with unchanged passwords, backend access denial, broker connector membership enforcement, uncertain transfer retry, paired/private ledger replay, closed-record handling and role-specific controls.
- Existing behavioral and contract suites remain release gates. Hosted browser testing covers desktop and mobile public UI; it is not a real member password-login test.
- The broker Edge Function checks active membership with the user's JWT before using its service-role database client. RLS account checks also apply to private storage and Realtime policies.

This revision does not close the broader platform's previously documented acceptance gaps. No production allocation is created merely to test a feature.
