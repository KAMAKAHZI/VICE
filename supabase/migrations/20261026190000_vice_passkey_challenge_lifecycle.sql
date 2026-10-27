-- VICE OS: WebAuthn challenge lifecycle primitives.
-- REVIEW AND TEST ON STAGING BEFORE APPLYING TO PRODUCTION.
-- RPCs are internal: only service_role may invoke; no browser grants.
create or replace function public.vice_passkey_consume_challenge(
 p_challenge_id uuid, p_user_id uuid, p_purpose text, p_hash text, p_action_digest text default null
) returns boolean language plpgsql security definer
set search_path = pg_catalog, public as $$
declare v_id uuid;
begin
 if current_setting('request.jwt.claim.role',true) is distinct from 'service_role'
    and current_user <> 'service_role' then
   raise exception 'SERVICE_ROLE_REQUIRED' using errcode='42501';
 end if;
 update public.vice_passkey_challenges
 set consumed_at=now()
 where id=p_challenge_id and user_id=p_user_id and purpose=p_purpose
   and challenge_hash=p_hash
   and action_digest is not distinct from p_action_digest
   and consumed_at is null and expires_at>now()
 returning id into v_id;
 return v_id is not null;
end $$;
revoke all on function public.vice_passkey_consume_challenge(uuid,uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.vice_passkey_consume_challenge(uuid,uuid,text,text,text) to service_role;
create unique index if not exists vice_passkey_credentials_unique_credential
 on public.vice_passkey_credentials(credential_id);
create index if not exists vice_passkey_challenges_pending
 on public.vice_passkey_challenges(user_id,purpose,expires_at) where consumed_at is null;
-- NOTE: consuming before verification prevents replay but failed assertions burn a challenge.
-- Do not enable passkey authorization until server verifies all WebAuthn fields and
-- records the resulting proposal-bound authorization in a separate audited transaction.
