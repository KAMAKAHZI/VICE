CREATE OR REPLACE FUNCTION public.vice_estate_create_allocation(p_holder_id uuid,p_program text,p_units numeric,p_reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $$
DECLARE v_id uuid; v_holder public.holders%ROWTYPE;
BEGIN
 IF auth.uid() IS NULL OR NOT public.is_super() THEN RAISE EXCEPTION 'SUPER_ADMIN authorization required'; END IF;
 IF p_program IS NULL OR p_program NOT IN ('VICE','V4X') THEN RAISE EXCEPTION 'Invalid program'; END IF;
 IF p_units IS NULL OR p_units<=0 OR p_units<>trunc(p_units) OR p_units>7500000 THEN RAISE EXCEPTION 'Invalid whole units'; END IF;
 IF length(btrim(coalesce(p_reason,''))) NOT BETWEEN 8 AND 500 THEN RAISE EXCEPTION 'Reason must contain 8-500 characters'; END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(793151205);
 SELECT * INTO v_holder FROM public.holders WHERE id=p_holder_id FOR UPDATE;
 IF NOT FOUND OR coalesce(v_holder.holder_type,'')='ESTATE_RESERVE' OR coalesce(v_holder.status,'')='FROZEN' THEN RAISE EXCEPTION 'Ineligible holder'; END IF;
 INSERT INTO public.vice_estate_allocations(holder_id,program,units,status,created_by)
 VALUES(p_holder_id,p_program,p_units,'PENDING',auth.uid()) RETURNING id INTO v_id;
 INSERT INTO public.vice_estate_events(allocation_id,event_type,program,units,actor_id,correlation_id,payload)
 VALUES(v_id,'ESTATE_ALLOCATION_CREATED',p_program,p_units,auth.uid(),gen_random_uuid(),pg_catalog.jsonb_build_object('reason',btrim(p_reason),'source','ESTATE_RESERVE'));
 RETURN pg_catalog.jsonb_build_object('allocation_id',v_id,'status','PENDING','settlement','INTERNAL_BOOK_ONLY');
END;
$$;
REVOKE ALL ON FUNCTION public.vice_estate_create_allocation(uuid,text,numeric,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.vice_estate_create_allocation(uuid,text,numeric,text) TO authenticated;
