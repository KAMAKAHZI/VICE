-- VICE OS: server-authoritative proposal digest lookup for executive WebAuthn.
-- Staging only. No governance status is changed by this migration.
-- The canonical payload hash is taken from the existing proposal registry;
-- clients may never supply or override the authoritative hash.
create or replace function public.vice_passkey_proposal_binding(p_proposal_id text)
returns table(proposal_id text, payload_hash text, proposal_status text)
language plpgsql security definer set search_path=pg_catalog,public
as $$
begin
 if current_setting('request.jwt.claim.role',true) is distinct from 'service_role'
    and current_user <> 'service_role' then
  raise exception 'SERVICE_ROLE_REQUIRED' using errcode='42501';
 end if;
 return query
 select p.id,p.payload_hash,p.status
 from public.vice_sovereign_proposals p
 where p.id=p_proposal_id and p.status='LOCKED'
   and p.payload_hash is not null and length(p.payload_hash)>0
   and (p.validation_until is null or p.validation_until>=now());
end $$;
revoke all on function public.vice_passkey_proposal_binding(text) from public,anon,authenticated;
grant execute on function public.vice_passkey_proposal_binding(text) to service_role;
