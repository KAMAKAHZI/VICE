-- VICE OS: staged proposal-bound WebAuthn authorizations.
-- This migration records verification receipts only; it does NOT execute OUV proposals.
-- No browser access to this table. Approval policy and quorum are separate.
create table if not exists public.vice_passkey_action_receipts (
 id uuid primary key default gen_random_uuid(),
 proposal_id text not null,
 action_digest text not null check (length(action_digest)=64 and action_digest ~ '^[0-9a-f]{64}$'),
 executive_user_id uuid not null references auth.users(id),
 executive_role text not null check (executive_role in ('SUPER_ADMIN','FINANCE_OFFICER')),
 credential_id text not null,
 challenge_id uuid not null unique references public.vice_passkey_challenges(id),
 verified_at timestamptz not null default now(),
 unique(proposal_id,action_digest,executive_role)
);
alter table public.vice_passkey_action_receipts enable row level security;
revoke all on public.vice_passkey_action_receipts from anon,authenticated;
grant select,insert on public.vice_passkey_action_receipts to service_role;
create index if not exists vice_passkey_receipts_proposal on public.vice_passkey_action_receipts(proposal_id);
-- Prevent the same human account from authorizing both roles for a proposal.
create unique index if not exists vice_passkey_receipts_unique_person
 on public.vice_passkey_action_receipts(proposal_id,executive_user_id);
-- A receipt is only a cryptographic evidence record, not a governance approval by itself.
