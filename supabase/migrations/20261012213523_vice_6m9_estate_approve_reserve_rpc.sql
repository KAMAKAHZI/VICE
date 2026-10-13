CREATE OR REPLACE FUNCTION public.vice_estate_advance_allocation(p_allocation_id uuid,p_action text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $$
DECLARE a public.vice_estate_allocations%ROWTYPE; v_available numeric; v_reserved numeric; v_next text;
BEGIN
 IF auth.uid() IS NULL OR NOT public.is_super() THEN RAISE EXCEPTION 'SUPER_ADMIN authorization required'; END IF;
 IF p_action NOT IN ('APPROVE','RESERVE','REVOKE') OR p_action IS NULL THEN RAISE EXCEPTION 'Invalid action'; END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(793151205);
 SELECT * INTO a FROM public.vice_estate_allocations WHERE id=p_allocation_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Allocation not found'; END IF;
 IF p_action='APPROVE' THEN
  IF a.status<>'PENDING' THEN RAISE EXCEPTION 'Only pending allocations can be approved'; END IF;
  UPDATE public.vice_estate_allocations SET status='APPROVED',approved_at=now() WHERE id=a.id;
  v_next:='APPROVED';
 ELSIF p_action='RESERVE' THEN
  IF a.status<>'APPROVED' THEN RAISE EXCEPTION 'Only approved allocations can be reserved'; END IF;
  SELECT unassigned_units INTO v_available FROM public.vice_estate_reserve_accounts WHERE program=a.program FOR UPDATE;
  IF v_available IS NULL THEN RAISE EXCEPTION 'Reserve account missing'; END IF;
  SELECT COALESCE(SUM(units),0) INTO v_reserved FROM public.vice_estate_allocations WHERE program=a.program AND status='RESERVED';
  IF v_reserved+a.units>v_available THEN RAISE EXCEPTION 'Reserve capacity exceeded'; END IF;
  UPDATE public.vice_estate_allocations SET status='RESERVED',reserved_at=now() WHERE id=a.id;
  v_next:='RESERVED';
 ELSE
  IF a.status NOT IN ('PENDING','APPROVED','RESERVED') THEN RAISE EXCEPTION 'Cannot revoke completed allocation'; END IF;
  UPDATE public.vice_estate_allocations SET status='REVOKED' WHERE id=a.id;
  v_next:='REVOKED';
 END IF;
 INSERT INTO public.vice_estate_events(allocation_id,event_type,program,units,actor_id,correlation_id,payload)
 VALUES(a.id,'ESTATE_ALLOCATION_'||v_next,a.program,a.units,auth.uid(),gen_random_uuid(),pg_catalog.jsonb_build_object('previous_status',a.status,'next_status',v_next));
 RETURN pg_catalog.jsonb_build_object('allocation_id',a.id,'status',v_next,'settlement','INTERNAL_BOOK_ONLY');
END;
$$;
REVOKE ALL ON FUNCTION public.vice_estate_advance_allocation(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.vice_estate_advance_allocation(uuid,text) TO authenticated;
