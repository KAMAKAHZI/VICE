-- Bind authorization challenges to an exact immutable proposal identity.
alter table public.vice_passkey_challenges
 add column if not exists proposal_id text;
create index if not exists vice_passkey_authorize_proposal_idx
 on public.vice_passkey_challenges(proposal_id,user_id)
 where purpose='AUTHORIZE' and consumed_at is null;
-- Prevent modifying payload or hash after proposal is locked.
create or replace function public.vice_locked_proposal_immutability()
returns trigger language plpgsql set search_path=pg_catalog,public as $$
begin
 if old.status='LOCKED' and
  (new.payload is distinct from old.payload or
   new.payload_hash is distinct from old.payload_hash) then
  raise exception 'LOCKED_PROPOSAL_IMMUTABLE' using errcode='23514';
 end if;
 return new;
end $$;
drop trigger if exists vice_locked_proposal_immutable on public.vice_sovereign_proposals;
create trigger vice_locked_proposal_immutable before update on public.vice_sovereign_proposals
for each row execute function public.vice_locked_proposal_immutability();
