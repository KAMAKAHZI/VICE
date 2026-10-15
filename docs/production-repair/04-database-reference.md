# VICE OS / Supabase Database Reference

Internal engineering • 2026-10-15 UTC • 1.3.8.0-IRU-CERTIFICATES

Project: sdsaewumabzjjvsmqqsl (VICE), Postgres 17.11. At audit: 50 public tables, zero without RLS, 38 applied migration versions. Source includes the same 38 versioned files. This migration history is not a verified fresh-database bootstrap.

Private buckets: vice-documents (10 MiB; documents and selected images), vice-chat-media (8 MiB; selected images/audio). Neither bucket is public. Table RLS, Storage ACL and RPC authorization are distinct layers.

Core APIs include get_my_holder, get_or_create_holder, list_member_directory, submit_academy_quiz, sign_document, certificate verification/issuance and vice_* allocation/estate/role/operational RPCs. See dependency inventory and migrations for exact signatures and policy definitions.

No database rows or schema were changed in this repair. The connected project has no separate staging branch. Production migrations must wait for staging validation; do not assume the historical SQL archive is a safe bootstrap.

Security advisors flag 16 RLS tables without direct policies (many intentionally RPC/service-only), four anonymous SECURITY DEFINER entry points, 36 authenticated SECURITY DEFINER entry points and disabled leaked-password protection. Function exposure warnings require body-level authorization review, not blanket public grants.
