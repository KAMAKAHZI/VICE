-- VICE OS WebAuthn counter monotonicity.
-- Apply in staging after reviewing existing credential types and RLS.
-- Prevents concurrent assertions from overwriting a newer counter.
create or replace function public.vice_passkey_advance_counter(
 p_credential_row_id uuid,
 p_user_id uuid,
 p_expected_counter bigint,
 p_new_counter bigint
) returns boolean
language plpgsql security definer
set search_path=pg_catalog,public
as $$
declare v_updated uuid;
begin
 if current_setting('request.jwt.claim.role',true) is distinct from 'service_role'
    and current_user <> 'service_role' then
   raise exception 'SERVICE_ROLE_REQUIRED' using errcode='42501';
 end if;
 if p_expected_counter < 0 or p_new_counter < 0 then
   raise exception 'INVALID_COUNTER' using errcode='22023';
 end if;
 -- Some synchronized authenticators use 0 permanently; nonzero counters must increase.
 if not ((p_expected_counter=0 and p_new_counter=0) or p_new_counter>p_expected_counter) then
   return false;
 end if;
 update public.vice_passkey_credentials
 set sign_count=p_new_counter,last_used_at=now()
 where id=p_credential_row_id and user_id=p_user_id and revoked_at is null
   and sign_count=p_expected_counter
 returning id into v_updated;
 return v_updated is not null;
end $$;
revoke all on function public.vice_passkey_advance_counter(uuid,uuid,bigint,bigint) from public,anon,authenticated;
grant execute on function public.vice_passkey_advance_counter(uuid,uuid,bigint,bigint) to service_role;
