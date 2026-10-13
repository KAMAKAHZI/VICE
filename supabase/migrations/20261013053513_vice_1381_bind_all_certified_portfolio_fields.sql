
create or replace function public.token_cert_digest(p public.token_certificates)
returns text language sql stable set search_path='' as $$
  select encode(extensions.digest(
    pg_catalog.jsonb_build_object(
      'cert_id',p.cert_id,
      'kind',p.kind,
      'source_event_seq',p.source_event_seq,
      'holder_id',p.holder_id,
      'profile_id',p.profile_id,
      'holder_client_id',p.holder_client_id,
      'holder_name',p.holder_name,
      'program',p.program,
      'units',p.units,
      'units_held_before',p.units_held_before,
      'units_held_after',p.units_held_after,
      'value_basis',p.value_basis,
      'value_per_unit_cents',p.value_per_unit_cents,
      'reference_value_cents',p.reference_value_cents,
      'holdings_snapshot',p.holdings_snapshot,
      'period',p.period,
      'issued_at',pg_catalog.to_char(p.issued_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
      'salt',p.salt,
      'issued_by',p.issued_by
    )::text,'sha256'),'hex')
$$;
revoke all on function public.token_cert_digest(public.token_certificates) from public,anon,authenticated;
