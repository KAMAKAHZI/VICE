CREATE OR REPLACE FUNCTION public.vice_estate_distribute_allocation(p_allocation_id uuid,p_correlation_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $$
DECLARE a public.vice_estate_allocations%ROWTYPE; h public.holders%ROWTYPE; remaining numeric;
BEGIN
 IF auth.uid() IS NULL OR NOT public.is_super() THEN RAISE EXCEPTION 'SUPER_ADMIN authorization required'; END IF;
 IF p_allocation_id IS NULL OR p_correlation_id IS NULL THEN RAISE EXCEPTION 'Allocation and correlation required'; END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(793151205);
 SELECT * INTO a FROM public.vice_estate_allocations WHERE id=p_allocation_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Allocation not found'; END IF;
 IF a.status='DISTRIBUTED' THEN
  RETURN pg_catalog.jsonb_build_object('allocation_id',a.id,'status','DISTRIBUTED','already_distributed',true,'correlation_id',a.correlation_id,'settlement','INTERNAL_BOOK_ONLY');
 END IF;
 IF a.status<>'RESERVED' THEN RAISE EXCEPTION 'Only reserved allocations can be distributed'; END IF;
 SELECT * INTO h FROM public.holders WHERE id=a.holder_id FOR UPDATE;
 IF NOT FOUND OR coalesce(h.holder_type,'')='ESTATE_RESERVE' OR coalesce(h.status,'')='FROZEN' THEN RAISE EXCEPTION 'Ineligible recipient'; END IF;
 UPDATE public.vice_estate_reserve_accounts
 SET unassigned_units=unassigned_units-a.units,transferred_units=transferred_units+a.units,updated_at=now()
 WHERE program=a.program AND unassigned_units>=a.units RETURNING unassigned_units INTO remaining;
 IF NOT FOUND THEN RAISE EXCEPTION 'Insufficient estate reserve'; END IF;
 INSERT INTO public.vice_estate_holder_balances(program,holder_id,units,updated_at)
 VALUES(a.program,a.holder_id,a.units,now())
 ON CONFLICT(program,holder_id) DO UPDATE SET units=public.vice_estate_holder_balances.units+EXCLUDED.units,updated_at=now();
 UPDATE public.vice_estate_allocations SET status='DISTRIBUTED',distributed_at=now(),correlation_id=p_correlation_id WHERE id=a.id;
 INSERT INTO public.vice_estate_events(allocation_id,event_type,program,units,actor_id,correlation_id,payload)
 VALUES(a.id,'ESTATE_ALLOCATION_DISTRIBUTED',a.program,a.units,auth.uid(),p_correlation_id,
 pg_catalog.jsonb_build_object('holder_id',a.holder_id,'settlement','INTERNAL_BOOK_ONLY'));
 RETURN pg_catalog.jsonb_build_object('allocation_id',a.id,'status','DISTRIBUTED','units',a.units,'program',a.program,'unassigned_remaining',remaining,'already_distributed',false,'settlement','INTERNAL_BOOK_ONLY');
END;
$$;
REVOKE ALL ON FUNCTION public.vice_estate_distribute_allocation(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.vice_estate_distribute_allocation(uuid,uuid) TO authenticated;
