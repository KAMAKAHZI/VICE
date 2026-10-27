-- Staging-only: finalize verified executive authorization atomically.
-- This RPC must only be invoked after server-side WebAuthn signature verification.
create or replace function public.vice_passkey_finalize_action(
 p_challenge_id uuid,p_user_id uuid,p_proposal_id text,p_digest text,
 p_role text,p_credential_id text,p_challenge_hash text
) returns boolean language plpgsql security definer
set search_path=pg_catalog,public as $$
declare v_ok uuid;
begin
 if current_setting('request.jwt.claim.role',true) is distinct from 'service_role'
   and current_user <> 'service_role' then
  raise exception 'SERVICE_ROLE_REQUIRED' using errcode='42501';
 end if;
 if p_role not in ('SUPER_ADMIN','FINANCE_OFFICER') or
    p_digest !~ '^[0-9a-f]{64}$' then return false; end if;
 if not exists(select 1 from public.profiles where id=p_user_id and role=p_role) then return false; end if;
 if not exists(select 1 from public.vice_sovereign_proposals
  where id=p_proposal_id and status='LOCKED'
   and lower(regexp_replace(payload_hash,'^0x','','i'))=p_digest
   and (validation_until is null or validation_until>=now())) then return false; end if;
 if not exists(select 1 from public.vice_passkey_credentials
  where user_id=p_user_id and credential_id=p_credential_id and revoked_at is null) then return false; end if;
 update public.vice_passkey_challenges set consumed_at=now()
 where id=p_challenge_id and user_id=p_user_id and purpose='AUTHORIZE'
  and action_digest=p_digest and challenge_hash=p_challenge_hash
  and consumed_at is null and expires_at>now()
 returning id into v_ok;
 if v_ok is null then return false; end if;
 insert into public.vice_passkey_action_receipts
  (proposal_id,action_digest,executive_user_id,executive_role,credential_id,challenge_id)
 values(p_proposal_id,p_digest,p_user_id,p_role,p_credential_id,p_challenge_id);
 return true;
exception when unique_violation then return false;
end $$;
revoke all on function public.vice_passkey_finalize_action(uuid,uuid,text,text,text,text,text) from public,anon,authenticated;
grant execute on function public.vice_passkey_finalize_action(uuid,uuid,text,text,text,text,text) to service_role;
