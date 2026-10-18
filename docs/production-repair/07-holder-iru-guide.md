# VICE4X / Holder and IRU Guide

Internal engineering • 2026-10-16 UTC • 1.3.8.0-IRU-CERTIFICATES

Both VICE and V4X/VPRE have maximum supply 10,000,000, strategic pool 2,500,000 and combined estate/administrative reserve 7,500,000. Management references are VICE $2 and V4X $320, a 1:160 relationship. These are not independent fair-market or collateral valuations, redemption guarantees or borrowing capacity.

Entry classes are Foundation, Strategic, Executive, Sovereign and Titan, based on approved contribution history. Legacy classification is separate. Missing holder data must remain missing until verified; do not fabricate identities or balances.

Use backend approval and distribution APIs. Preserve correlation IDs, allocation status, event history and correction/revocation records. Certificate eligibility depends on authoritative issuance records. Public IRU verification reports certificate identifier, class, issue time, digest and validity. Holder names, identifiers, quantities, snapshots and internal revocation reasons are private. Sign in with authorized owner/issuer access for full certificate details.

Strategic allocations → Direct issuance corrections allows an issuer to review the exact source event, holder, class and quantity, then supply an authorization reason. The server reverses each direct issuance at most once, appends a correction and audit record, and revokes its existing certificates. It preserves the original records and Estate Reserve and Administrative Reserve. Distributed allocation corrections require their own reviewed workflow and are rejected by this direct-issuance function. PostgreSQL staging and ledger replay tests pass; live correction results belong in the release record.
