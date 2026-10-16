# VICE OS / Supabase Database Reference

Internal engineering • 2026-10-16 UTC • 1.3.8.0-IRU-CERTIFICATES

Project: sdsaewumabzjjvsmqqsl (VICE), Postgres 17.11. Verified 2026-10-15: 51 public tables, zero without RLS, 42 applied migration versions. Source includes the same 42 versioned files. This migration history is not a verified fresh-database bootstrap.

Private buckets: vice-documents (10 MiB; documents and selected images), vice-chat-media (8 MiB; selected images/audio). Neither bucket is public. Table RLS, Storage ACL and RPC authorization are distinct layers.

Core APIs include get_my_holder, get_or_create_holder, list_member_directory, submit_academy_quiz, sign_document, certificate verification/issuance and vice_* allocation/estate/role/operational RPCs. See dependency inventory and migrations for exact signatures and policy definitions.

Four repair migrations are installed after disposable PostgreSQL 17 tests: 20261015132937 (DM/attachment recipient lookup), 20261015140648 (audited strategic issuance correction), 20261015190802 (public certificate privacy) and 20261015193846 (Academy progress/award gates). The first two were also tested with repeat application. No financial record changes occur merely by installing these functions. The historical archive remains unverified as an empty-database bootstrap.

academy_progress uses (profile_id, module, chapter) uniqueness, a profile foreign key, validated chapter/module mapping and owner-only SELECT. mark_academy_chapter requires a provisioned authenticated profile and creates a server-timestamped receipt idempotently. issue_certificate checks 21 core receipts, seven passing server-graded assessments, canonical title and matching profile identity for a new award; per-member locking prevents duplicate active awards.

Security advisors flag 16 RLS tables without direct policies (many intentionally RPC/service-only), four anonymous SECURITY DEFINER entry points, 38 authenticated SECURITY DEFINER entry points and disabled leaked-password protection. Function exposure warnings require body-level authorization review, not blanket public grants. The Security Operations Guide links the advisor explanations.
