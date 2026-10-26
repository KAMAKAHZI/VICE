# OUV production schema parity audit

Status: BLOCKED. No authorization for production valuation changes.

Read-only audit verified production uses UUID version identifiers and a receipt foreign key to that UUID. The isolated staging fixture instead uses integer identifiers. Production proposal constraints permit only REVIEW, LOCKED, REJECTED and require quorum and execution timestamps to be null. The staging prototype does not reproduce these restrictions.

Required before activation: independently verified governance quorum and signatures, formal timelock, reviewed database constraints, production-compatible atomic SQL, rollback and true two-session concurrency tests, ledger reconciliation, and independent reviewer approval. Never disable existing triggers to force execution.

The 1:160 ratio is an internal reference-value relationship, not an independent appraisal. Keep VICE_OUV_EXECUTION_ENABLED disabled.
