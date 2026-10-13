
alter table public.token_certificates
add column if not exists source_distribution_id uuid unique references public.distributions(id);
create or replace function public.token_cert_digest(p public.token_certificates)
returns text language sql stable set search_path='' as $$
 select encode(extensions.digest(
 pg_catalog.jsonb_build_object(
 'cert_id',p.cert_id,'kind',p.kind,'source_event_seq',p.source_event_seq,
 'source_distribution_id',p.source_distribution_id,
 'holder_id',p.holder_id,'profile_id',p.profile_id,
 'holder_client_id',p.holder_client_id,'holder_name',p.holder_name,
 'program',p.program,'units',p.units,
 'units_held_before',p.units_held_before,'units_held_after',p.units_held_after,
 'value_basis',p.value_basis,'value_per_unit_cents',p.value_per_unit_cents,
 'reference_value_cents',p.reference_value_cents,
 'holdings_snapshot',p.holdings_snapshot,'period',p.period,
 'issued_at',pg_catalog.to_char(p.issued_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
 'salt',p.salt,'issued_by',p.issued_by)::text,'sha256'),'hex')
$$;
revoke all on function public.token_cert_digest(public.token_certificates) from public,anon,authenticated;
create or replace function public.trg_vice_distribution_certificate()
returns trigger language plpgsql security definer set search_path='' as $$
declare h public.holders%rowtype; c public.token_certificates%rowtype;
begin
 if new.status is distinct from 'PAID' or old.status='PAID' then return new;end if;
 if auth.uid() is null or not public.is_super() then raise exception 'Issuer authorization required for distribution certificate';end if;
 if new.holder_id is null then raise exception 'Distribution holder ID required before marking PAID';end if;
 select * into h from public.holders where id=new.holder_id;
 if not found then raise exception 'Distribution holder missing';end if;
 if new.program not in ('VICE','V4X') or new.total is null or new.total<0 then
   raise exception 'Invalid issuer distribution reference';end if;
 if exists(select 1 from public.token_certificates where source_distribution_id=new.id) then
   raise exception 'Distribution certificate already recorded';end if;
 c.cert_id:='VCT-'||upper(substr(encode(extensions.gen_random_bytes(8),'hex'),1,4))||'-'||
   upper(substr(encode(extensions.gen_random_bytes(8),'hex'),1,4))||'-'||
   upper(substr(encode(extensions.gen_random_bytes(8),'hex'),1,4))||'-'||
   upper(substr(encode(extensions.gen_random_bytes(8),'hex'),1,4));
 c.kind:='DISTRIBUTION';c.source_distribution_id:=new.id;c.holder_id:=h.id;
 c.profile_id:=coalesce(h.profile_id,h.user_id);c.holder_client_id:=h.client_id;
 c.holder_name:=coalesce(nullif(h.name,''),'VICE HOLDER');
 c.program:=new.program;
 c.units:=case when c.program='VICE' then coalesce(h.vice_units,0) else coalesce(h.v4x_units,0) end;
 c.units_held_before:=c.units;c.units_held_after:=c.units;
 c.holdings_snapshot:=public.vice_token_certificate_snapshot(h.id)||
   jsonb_build_object('distribution_record',jsonb_build_object(
    'id',new.id,'period',new.period,'status','PAID','issuer_recorded_amount_cents',round(new.total*100)::bigint,
    'per_unit_cents',round(coalesce(new.per_unit,0)*100)::bigint,
    'external_settlement_verified',false));
 c.value_basis:='INTERNAL_REFERENCE';c.value_per_unit_cents:=
    case when c.program='VICE' then (c.holdings_snapshot->>'vice_reference_cents')::bigint
    else (c.holdings_snapshot->>'v4x_reference_cents')::bigint end;
 c.reference_value_cents:=c.units*c.value_per_unit_cents;
 c.period:=new.period;c.issued_at:=now();c.salt:=encode(extensions.gen_random_bytes(16),'hex');
 c.issued_by:=auth.uid();c.digest:=public.token_cert_digest(c);
 insert into public.token_certificates(cert_id,kind,source_distribution_id,holder_id,profile_id,
 holder_client_id,holder_name,program,units,units_held_before,units_held_after,value_basis,
 value_per_unit_cents,reference_value_cents,holdings_snapshot,period,issued_at,salt,digest,issued_by)
 values(c.cert_id,c.kind,c.source_distribution_id,c.holder_id,c.profile_id,c.holder_client_id,
 c.holder_name,c.program,c.units,c.units_held_before,c.units_held_after,c.value_basis,
 c.value_per_unit_cents,c.reference_value_cents,c.holdings_snapshot,c.period,c.issued_at,c.salt,c.digest,c.issued_by);
 return new;
end $$;
revoke all on function public.trg_vice_distribution_certificate() from public,anon,authenticated;
drop trigger if exists trg_vice_distribution_certificate on public.distributions;
create trigger trg_vice_distribution_certificate after update of status on public.distributions
for each row execute function public.trg_vice_distribution_certificate();
