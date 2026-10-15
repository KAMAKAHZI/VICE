-- An issuance correction is distinct from retirement. Original events and
-- certificates are retained. This migration does not correct any live record.
CREATE UNIQUE INDEX IF NOT EXISTS vice_one_issuance_reversal
 ON public.iru_events ((payload->>'sourceEventSeq'))
 WHERE event_type='UNITS_ISSUANCE_REVERSED';

CREATE OR REPLACE FUNCTION vice_private.reverse_strategic_issuance(
 p_source_seq bigint,p_expected_holder uuid,p_expected_program text,
 p_expected_units bigint,p_reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $$
DECLARE src public.iru_events%ROWTYPE; prior public.iru_events%ROWTYPE;
 h public.holders%ROWTYPE; qty bigint; program_id text; held numeric;
 cid uuid:=gen_random_uuid(); new_seq bigint; actor uuid; actor_kind text;
BEGIN
 -- The private function is not executable by browser/service API roles.
 -- Authenticated issuer callers enter only through the checked public wrapper.
 IF auth.uid() IS NOT NULL AND public.is_super() THEN
  actor:=auth.uid();actor_kind:='SUPER_ADMIN';
 ELSIF session_user='postgres' AND current_user='postgres' AND auth.uid() IS NULL THEN
  actor:=NULL;actor_kind:='DATABASE_OPERATOR';
 ELSE RAISE EXCEPTION 'Issuer or authenticated database operator required' USING ERRCODE='42501'; END IF;
 IF p_source_seq IS NULL OR p_expected_holder IS NULL
  OR p_expected_program IS NULL OR p_expected_units IS NULL
  OR length(trim(coalesce(p_reason,''))) NOT BETWEEN 16 AND 500
 THEN RAISE EXCEPTION 'Exact source, holder, program, units and detailed reason required'; END IF;
 PERFORM pg_advisory_xact_lock(793151205);
 SELECT * INTO src FROM public.iru_events WHERE seq=p_source_seq FOR UPDATE;
 IF NOT FOUND OR src.event_type<>'UNITS_ISSUED' OR src.payload ? 'allocationId'
 THEN RAISE EXCEPTION 'Only a direct strategic issuance can be reversed here'; END IF;
 IF src.payload->>'program' NOT IN ('VICE','V4X')
  OR coalesce(src.payload->>'units','') !~ '^[0-9]{1,12}$'
 THEN RAISE EXCEPTION 'Invalid source issuance'; END IF;
 qty:=(src.payload->>'units')::bigint;program_id:=src.payload->>'program';
 IF qty<=0 OR qty IS DISTINCT FROM p_expected_units
  OR program_id IS DISTINCT FROM p_expected_program
  OR (src.payload->>'holderId')::uuid IS DISTINCT FROM p_expected_holder
 THEN RAISE EXCEPTION 'Source issuance does not match reviewed correction'; END IF;
 SELECT * INTO prior FROM public.iru_events
  WHERE event_type='UNITS_ISSUANCE_REVERSED' AND payload->>'sourceEventSeq'=p_source_seq::text;
 IF FOUND THEN RETURN jsonb_build_object('seq',prior.seq,'already_reversed',true,
  'source_event_seq',p_source_seq,'correlation_id',prior.correlation_id); END IF;
 SELECT * INTO h FROM public.holders WHERE id=p_expected_holder FOR UPDATE;
 IF NOT FOUND OR coalesce(h.holder_type,'')='ESTATE_RESERVE'
  OR coalesce(h.status,'')='ESTATE_RESERVE' THEN RAISE EXCEPTION 'Invalid strategic holder'; END IF;
 held:=CASE WHEN program_id='VICE' THEN h.vice_units ELSE h.v4x_units END;
 IF held IS NULL OR held<qty THEN RAISE EXCEPTION 'Insufficient current holdings for exact reversal'; END IF;
 UPDATE public.iru_program_counters SET issued=issued-qty,updated_at=now()
  WHERE program=program_id AND issued>=qty;
 IF NOT FOUND THEN RAISE EXCEPTION 'Strategic counter cannot reconcile reversal'; END IF;
 IF program_id='VICE' THEN UPDATE public.holders SET vice_units=vice_units-qty,updated_at=now() WHERE id=h.id;
 ELSE UPDATE public.holders SET v4x_units=v4x_units-qty,updated_at=now() WHERE id=h.id; END IF;
 INSERT INTO public.iru_events(event_type,payload,actor_id,actor_role,correlation_id)
 VALUES('UNITS_ISSUANCE_REVERSED',jsonb_build_object(
  'type','UNITS_ISSUANCE_REVERSED','sourceEventSeq',p_source_seq,
  'sourceCorrelationId',src.correlation_id,'program',program_id,'holderId',h.id,
  'units',qty::text,'unitsHeldBefore',held,'unitsHeldAfter',held-qty,
  'reason',trim(p_reason),'source','STRATEGIC_POOL','by',actor_kind,'at',now()),actor,actor_kind,cid)
 RETURNING seq INTO new_seq;
 UPDATE public.token_certificates SET revoked=true,revoked_at=now(),
  revoked_reason='Issuance reversed by correction event '||new_seq::text||': '||trim(p_reason)
  WHERE source_event_seq=p_source_seq AND revoked=false;
 INSERT INTO public.audit_log(event_type,action,object_type,object_id,actor_id,actor_role,outcome,correlation_id)
 VALUES('IRU_ISSUANCE_CORRECTION','Reverse direct strategic issuance; original event retained',
  'iru_events',p_source_seq::text,coalesce(actor::text,'database:postgres'),actor_kind,'SUCCESS',cid::text);
 RETURN jsonb_build_object('seq',new_seq,'source_event_seq',p_source_seq,'already_reversed',false,
  'program',program_id,'units',qty,'units_held_after',held-qty,'correlation_id',cid);
END $$;
REVOKE ALL ON FUNCTION vice_private.reverse_strategic_issuance(bigint,uuid,text,bigint,text)
 FROM PUBLIC,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION public.reverse_strategic_issuance(
 p_source_seq bigint,p_expected_holder uuid,p_expected_program text,
 p_expected_units bigint,p_reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 IF auth.uid() IS NULL OR NOT public.is_super()
 THEN RAISE EXCEPTION 'SUPER_ADMIN authorization required' USING ERRCODE='42501'; END IF;
 RETURN vice_private.reverse_strategic_issuance(p_source_seq,p_expected_holder,
  p_expected_program,p_expected_units,p_reason);
END $$;
REVOKE ALL ON FUNCTION public.reverse_strategic_issuance(bigint,uuid,text,bigint,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.reverse_strategic_issuance(bigint,uuid,text,bigint,text) TO authenticated;
