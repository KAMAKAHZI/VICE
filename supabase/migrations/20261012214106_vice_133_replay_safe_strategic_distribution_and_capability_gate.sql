BEGIN;
CREATE OR REPLACE FUNCTION public.distribute_iru_allocation(
 p_allocation_id uuid,p_correlation_id uuid DEFAULT gen_random_uuid())
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE a public.allocations%ROWTYPE; v_holder public.holders%ROWTYPE; v_ledger jsonb;
BEGIN
 IF auth.uid() IS NULL OR NOT public.is_super() THEN RAISE EXCEPTION 'SUPER_ADMIN authorization required'; END IF;
 IF p_allocation_id IS NULL OR p_correlation_id IS NULL THEN RAISE EXCEPTION 'Allocation and correlation required'; END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(793151205);
 SELECT * INTO a FROM public.allocations WHERE id=p_allocation_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Allocation not found'; END IF;
 IF a.status='DISTRIBUTED' THEN
  RETURN pg_catalog.jsonb_build_object('allocation_id',a.id,'status','DISTRIBUTED','already_distributed',true,
   'correlation_id',a.distribution_correlation_id,'source','STRATEGIC_POOL');
 END IF;
 IF a.status<>'RESERVED' THEN RAISE EXCEPTION 'Only reserved allocations may distribute'; END IF;
 IF a.class NOT IN ('VICE','V4X') OR a.units IS NULL OR a.units<=0
  OR a.units<>trunc(a.units) OR a.units>2500000 THEN RAISE EXCEPTION 'Invalid whole-unit allocation'; END IF;
 SELECT * INTO v_holder FROM public.holders WHERE id=a.holder_id FOR UPDATE;
 IF NOT FOUND OR coalesce(v_holder.holder_type,'')='ESTATE_RESERVE'
  OR coalesce(v_holder.status,'') IN ('ESTATE_RESERVE','FROZEN') THEN RAISE EXCEPTION 'Invalid or frozen recipient'; END IF;
 UPDATE public.allocations SET status='DISTRIBUTED',
  distributed_at=now(),distribution_correlation_id=p_correlation_id WHERE id=a.id;
 SELECT public.append_iru_event(
  pg_catalog.jsonb_build_object('type','UNITS_ISSUED','program',a.class,'holderId',a.holder_id,
  'units',a.units::text,'reason','Approved strategic allocation '||a.id::text,
  'allocationId',a.id,'source','STRATEGIC_POOL'),p_correlation_id) INTO v_ledger;
 RETURN pg_catalog.jsonb_build_object('allocation_id',a.id,'status','DISTRIBUTED',
  'program',a.class,'holder_id',a.holder_id,'units',a.units,'already_distributed',false,
  'correlation_id',p_correlation_id,'source','STRATEGIC_POOL','ledger',v_ledger);
END $fn$;
REVOKE ALL ON FUNCTION public.distribute_iru_allocation(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.distribute_iru_allocation(uuid,uuid) TO authenticated;
CREATE OR REPLACE FUNCTION public.vice_financial_release_capabilities()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE v_vice numeric; v_v4x numeric;
BEGIN
 IF auth.uid() IS NULL OR NOT public.is_super() THEN RAISE EXCEPTION 'SUPER_ADMIN authorization required'; END IF;
 SELECT vice_price,v4x_price INTO v_vice,v_v4x FROM public.vice_dao_config WHERE id=1;
 RETURN pg_catalog.jsonb_build_object(
  'strategic_price_rpc_v133',(v_vice=2 AND v_v4x=320),
  'reference_vice',v_vice,'reference_v4x',v_v4x,
  'source','SERVER_MIGRATION_1_3_3',
  'reserve_book_available',(to_regclass('public.vice_estate_reserve_accounts') IS NOT NULL),
  'settlement','INTERNAL_BOOK_ONLY_NOT_ONCHAIN');
END $fn$;
REVOKE ALL ON FUNCTION public.vice_financial_release_capabilities() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.vice_financial_release_capabilities() TO authenticated;
COMMIT;
