create table if not exists public.token_certificates (
 id uuid primary key default gen_random_uuid(),
 cert_id text not null unique check(cert_id ~ '^VCT-[A-F0-9]{4}(-[A-F0-9]{4}){3}$'),
 kind text not null check(kind in ('ISSUANCE','ALLOCATION','DISTRIBUTION','CONSOLIDATION','RETIREMENT')),
 source_event_seq bigint unique references public.iru_events(seq),
 holder_id uuid not null references public.holders(id),
 profile_id uuid references auth.users(id),
 holder_client_id text,
 holder_name text not null,
 program text not null check(program in ('VICE','V4X','BOTH')),
 units numeric(20,0) not null default 0 check(units>=0),
 units_held_before numeric(20,0),
 units_held_after numeric(20,0),
 value_basis text not null default 'INTERNAL_REFERENCE',
 value_per_unit_cents bigint,
 reference_value_cents numeric(24,0),
 holdings_snapshot jsonb not null,
 period text,
 issued_at timestamptz not null default now(),
 salt text not null,
 digest text not null check(digest ~ '^[0-9a-f]{64}$'),
 revoked boolean not null default false,
 revoked_at timestamptz,
 revoked_reason text,
 issued_by uuid references auth.users(id),
 created_at timestamptz not null default now()
);
create index if not exists token_cert_holder_issue_idx on public.token_certificates(holder_id,issued_at desc);
create index if not exists token_cert_profile_idx on public.token_certificates(profile_id,issued_at desc);
create index if not exists token_cert_client_idx on public.token_certificates(holder_client_id,issued_at desc);
create unique index if not exists token_cert_consolidation_active_uq on public.token_certificates(holder_id,period)
 where kind='CONSOLIDATION' and revoked=false;
alter table public.token_certificates enable row level security;
revoke all on table public.token_certificates from public,anon,authenticated;
grant select on public.token_certificates to authenticated;
drop policy if exists token_cert_select_owner_or_issuer on public.token_certificates;
create policy token_cert_select_owner_or_issuer on public.token_certificates
 for select to authenticated using (
 (select public.is_super()) OR exists (
   select 1 from public.holders h where h.id=token_certificates.holder_id
   and (h.user_id=(select auth.uid()) or h.profile_id=(select auth.uid()))
 )
);
create or replace function public.token_cert_digest(p public.token_certificates)
returns text language sql stable set search_path='' as $$
 select encode(extensions.digest(
 concat_ws('|',p.cert_id,p.kind,p.holder_id::text,p.program,p.units::text,
 coalesce(p.units_held_before::text,''),coalesce(p.units_held_after::text,''),
 p.holdings_snapshot::text,
 pg_catalog.to_char(p.issued_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
 p.salt),'sha256'),'hex')
$$;
revoke all on function public.token_cert_digest(public.token_certificates) from public,anon,authenticated;
create or replace function public.vice_token_certificate_snapshot(p_holder_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare h public.holders%rowtype; v_vice numeric; v_v4x numeric;
begin
 if auth.uid() is null or not public.is_super() then raise exception 'Issuer authorization required'; end if;
 select * into h from public.holders where id=p_holder_id;
 if not found then raise exception 'Holder not found'; end if;
 select vice_price,v4x_price into v_vice,v_v4x from public.vice_dao_config where id=1;
 if v_vice is null or v_v4x is null then raise exception 'Canonical reference price missing'; end if;
 return jsonb_build_object('vice_units',coalesce(h.vice_units,0),
  'v4x_units',coalesce(h.v4x_units,0),
  'vice_reference_cents',round(v_vice*100)::bigint,
  'v4x_reference_cents',round(v_v4x*100)::bigint,
  'combined_reference_cents',round((coalesce(h.vice_units,0)*v_vice+coalesce(h.v4x_units,0)*v_v4x)*100)::numeric(24,0),
  'as_of',pg_catalog.to_char(now() at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'));
end $$;
revoke all on function public.vice_token_certificate_snapshot(uuid) from public,anon,authenticated;
create or replace function public.trg_vice_token_certificate()
returns trigger language plpgsql security definer set search_path='' as $$
declare h public.holders%rowtype; c public.token_certificates%rowtype;
  qty numeric;after_units numeric;before_units numeric;
begin
 if new.event_type not in ('UNITS_ISSUED','UNITS_RETIRED') then return new; end if;
 if auth.uid() is null or not public.is_super()
  or new.actor_id is distinct from auth.uid()
  or new.actor_role is distinct from 'SUPER_ADMIN'
 then raise exception 'Certified unit event requires issuer authorization'; end if;
 select * into h from public.holders where id=(new.payload->>'holderId')::uuid;
 if not found then raise exception 'Unit certificate holder missing'; end if;
 qty:=(new.payload->>'units')::numeric;
 if qty <= 0 or qty<>trunc(qty) then raise exception 'Invalid certified units'; end if;
 after_units:=case when new.payload->>'program'='VICE' then coalesce(h.vice_units,0)
                   when new.payload->>'program'='V4X' then coalesce(h.v4x_units,0)
                   else null end;
 if after_units is null then raise exception 'Unrecognized IRU program'; end if;
 before_units:=after_units + (case when new.event_type='UNITS_ISSUED' then -qty else qty end);
 if before_units<0 then raise exception 'Invalid before/after holdings snapshot'; end if;
 c.cert_id:='VCT-'||upper(substr(encode(extensions.gen_random_bytes(8),'hex'),1,4))||'-'||
   upper(substr(encode(extensions.gen_random_bytes(8),'hex'),1,4))||'-'||
   upper(substr(encode(extensions.gen_random_bytes(8),'hex'),1,4))||'-'||
   upper(substr(encode(extensions.gen_random_bytes(8),'hex'),1,4));
 c.kind:=case when new.event_type='UNITS_RETIRED' then 'RETIREMENT'
              when new.payload ? 'allocationId' then 'ALLOCATION' else 'ISSUANCE' end;
 c.source_event_seq:=new.seq;c.holder_id:=h.id;c.profile_id:=coalesce(h.profile_id,h.user_id);
 c.holder_client_id:=h.client_id;c.holder_name:=coalesce(nullif(h.name,''),'VICE HOLDER');
 c.program:=new.payload->>'program';c.units:=qty;
 c.units_held_before:=before_units;c.units_held_after:=after_units;
 c.holdings_snapshot:=public.vice_token_certificate_snapshot(h.id);
 c.value_basis:='INTERNAL_REFERENCE';
 c.value_per_unit_cents:=case when c.program='VICE' then (c.holdings_snapshot->>'vice_reference_cents')::bigint
                                    else (c.holdings_snapshot->>'v4x_reference_cents')::bigint end;
 c.reference_value_cents:=qty*c.value_per_unit_cents;
 c.issued_by:=auth.uid();c.issued_at:=now();c.salt:=encode(extensions.gen_random_bytes(16),'hex');
 c.digest:=public.token_cert_digest(c);
 insert into public.token_certificates(cert_id,kind,source_event_seq,holder_id,profile_id,
 holder_client_id,holder_name,program,units,units_held_before,units_held_after,value_basis,
 value_per_unit_cents,reference_value_cents,holdings_snapshot,issued_at,salt,digest,issued_by)
 values(c.cert_id,c.kind,c.source_event_seq,c.holder_id,c.profile_id,c.holder_client_id,c.holder_name,
 c.program,c.units,c.units_held_before,c.units_held_after,c.value_basis,c.value_per_unit_cents,
 c.reference_value_cents,c.holdings_snapshot,c.issued_at,c.salt,c.digest,c.issued_by);
 return new;
end $$;
revoke all on function public.trg_vice_token_certificate() from public,anon,authenticated;
drop trigger if exists trg_vice_token_certificate on public.iru_events;
create trigger trg_vice_token_certificate after insert on public.iru_events
 for each row execute function public.trg_vice_token_certificate();
create or replace function public.verify_token_certificate(p_cert_id text)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare c public.token_certificates%rowtype;
begin
 if p_cert_id is null or length(p_cert_id)>40
 or upper(trim(p_cert_id)) !~ '^VCT-[A-F0-9]{4}(-[A-F0-9]{4}){3}$'
 then return jsonb_build_object('valid',false,'reason','INVALID_ID'); end if;
 select * into c from public.token_certificates where cert_id=upper(trim(p_cert_id));
 if not found then return jsonb_build_object('valid',false,'reason','NOT_FOUND'); end if;
 if c.revoked then return jsonb_build_object('valid',false,'reason','REVOKED',
   'revoked_at',c.revoked_at,'revoked_reason',c.revoked_reason);end if;
 if c.digest is distinct from public.token_cert_digest(c) then
   return jsonb_build_object('valid',false,'reason','INTEGRITY_FAILURE'); end if;
 return jsonb_build_object('valid',true,'cert_id',c.cert_id,'kind',c.kind,
  'holder_name',c.holder_name,'holder_client_id',c.holder_client_id,'program',c.program,
  'units',c.units,'units_held_before',c.units_held_before,'units_held_after',c.units_held_after,
  'issued_at',c.issued_at,'source_event_seq',c.source_event_seq,
  'period',c.period,'snapshot',c.holdings_snapshot,
  'value_basis',c.value_basis,'digest',c.digest);
end $$;
revoke all on function public.verify_token_certificate(text) from public,anon,authenticated;
grant execute on function public.verify_token_certificate(text) to anon,authenticated;
create or replace function public.my_portfolio_certificate_details(p_cert_id text)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare c public.token_certificates%rowtype; h public.holders%rowtype;
 v_vice numeric;v_v4x numeric;
begin
 if auth.uid() is null then raise exception 'Sign-in required'; end if;
 select * into c from public.token_certificates where cert_id=upper(trim(p_cert_id));
 if not found or c.revoked then return jsonb_build_object('found',false);end if;
 select * into h from public.holders where id=c.holder_id;
 if not found or (not public.is_super() and
   h.user_id is distinct from auth.uid() and h.profile_id is distinct from auth.uid())
 then return jsonb_build_object('found',false);end if;
 select vice_price,v4x_price into v_vice,v_v4x from public.vice_dao_config where id=1;
 return jsonb_build_object('found',true,'cert_id',c.cert_id,
 'current',jsonb_build_object('vice_units',coalesce(h.vice_units,0),
  'v4x_units',coalesce(h.v4x_units,0),
  'combined_reference_cents',round(100*(coalesce(h.vice_units,0)*v_vice+
    coalesce(h.v4x_units,0)*v_v4x))::numeric(24,0)));
end $$;
revoke all on function public.my_portfolio_certificate_details(text) from public,anon,authenticated;
grant execute on function public.my_portfolio_certificate_details(text) to authenticated;
create or replace function public.revoke_token_certificate(p_cert_id text,p_reason text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare c public.token_certificates%rowtype;
begin
 if auth.uid() is null or not public.is_super() then raise exception 'Issuer required';end if;
 if length(trim(coalesce(p_reason,'')))<8 then raise exception 'Detailed reason required';end if;
 update public.token_certificates set revoked=true,revoked_at=now(),revoked_reason=left(trim(p_reason),500)
 where cert_id=upper(trim(p_cert_id)) and revoked=false returning * into c;
 if not found then raise exception 'Certificate missing or already revoked';end if;
 return jsonb_build_object('cert_id',c.cert_id,'revoked',true,'revoked_at',c.revoked_at);
end $$;
revoke all on function public.revoke_token_certificate(text,text) from public,anon,authenticated;
grant execute on function public.revoke_token_certificate(text,text) to authenticated;
create or replace function public.issue_holdings_consolidation(p_holder_id uuid,p_period text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare h public.holders%rowtype;c public.token_certificates%rowtype;
begin
 if auth.uid() is null or not public.is_super() then raise exception 'Issuer required';end if;
 if p_period !~ '^20[0-9]{2}-(0[1-9]|1[0-2])$' then raise exception 'Invalid period';end if;
 perform pg_catalog.pg_advisory_xact_lock(hashtextextended(p_holder_id::text||p_period,0));
 if exists(select 1 from public.token_certificates where holder_id=p_holder_id
 and period=p_period and kind='CONSOLIDATION' and revoked=false) then
  raise exception 'Active consolidated certificate already exists for period';end if;
 select * into h from public.holders where id=p_holder_id for update;
 if not found then raise exception 'Holder missing';end if;
 c.cert_id:='VCT-'||upper(substr(encode(extensions.gen_random_bytes(8),'hex'),1,4))||'-'||
   upper(substr(encode(extensions.gen_random_bytes(8),'hex'),1,4))||'-'||
   upper(substr(encode(extensions.gen_random_bytes(8),'hex'),1,4))||'-'||
   upper(substr(encode(extensions.gen_random_bytes(8),'hex'),1,4));
 c.kind:='CONSOLIDATION';c.holder_id:=h.id;c.profile_id:=coalesce(h.profile_id,h.user_id);
 c.holder_client_id:=h.client_id;c.holder_name:=coalesce(nullif(h.name,''),'VICE HOLDER');
 c.program:='BOTH';c.units:=coalesce(h.vice_units,0)+coalesce(h.v4x_units,0);
 c.units_held_before:=c.units;c.units_held_after:=c.units;
 c.holdings_snapshot:=public.vice_token_certificate_snapshot(h.id);
 c.value_basis:='INTERNAL_REFERENCE';c.period:=p_period;
 c.reference_value_cents:=(c.holdings_snapshot->>'combined_reference_cents')::numeric;
 c.issued_at:=now();c.salt:=encode(extensions.gen_random_bytes(16),'hex');c.issued_by:=auth.uid();
 c.digest:=public.token_cert_digest(c);
 insert into public.token_certificates(cert_id,kind,holder_id,profile_id,holder_client_id,holder_name,
 program,units,units_held_before,units_held_after,holdings_snapshot,value_basis,period,
 reference_value_cents,issued_at,salt,digest,issued_by)
 values(c.cert_id,c.kind,c.holder_id,c.profile_id,c.holder_client_id,c.holder_name,c.program,c.units,
 c.units_held_before,c.units_held_after,c.holdings_snapshot,c.value_basis,c.period,
 c.reference_value_cents,c.issued_at,c.salt,c.digest,c.issued_by);
 return jsonb_build_object('cert_id',c.cert_id,'status','ISSUED');
end $$;
revoke all on function public.issue_holdings_consolidation(uuid,text) from public,anon,authenticated;
grant execute on function public.issue_holdings_consolidation(uuid,text) to authenticated;
