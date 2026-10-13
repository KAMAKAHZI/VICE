CREATE OR REPLACE FUNCTION public.vice_get_estate_admin_dashboard()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO ''
AS $fn$
DECLARE r jsonb; a jsonb;
BEGIN
 IF auth.uid() IS NULL OR NOT public.is_super() THEN
  RAISE EXCEPTION 'SUPER_ADMIN authorization required';
 END IF;
 SELECT COALESCE(pg_catalog.jsonb_object_agg(x.program,
  pg_catalog.jsonb_build_object('designated_units',x.designated_units,
    'unassigned_units',x.unassigned_units,'transferred_units',x.transferred_units,
    'reserved_units',(SELECT COALESCE(SUM(y.units),0)
      FROM public.vice_estate_allocations y WHERE y.program=x.program AND y.status='RESERVED'),
    'opening_basis',x.opening_basis,'settlement','INTERNAL_BOOK_ONLY')),'{}'::jsonb)
 INTO r FROM public.vice_estate_reserve_accounts x;
 SELECT COALESCE(pg_catalog.jsonb_agg(pg_catalog.to_jsonb(x)),'[]'::jsonb)
 INTO a FROM (SELECT id,holder_id,program,units,status,created_at,distributed_at
  FROM public.vice_estate_allocations ORDER BY created_at DESC LIMIT 100) x;
 RETURN pg_catalog.jsonb_build_object('programs',r,'allocations',a,
  'settlement','INTERNAL_BOOK_ONLY','custody_verification','UNVERIFIED');
END $fn$;
REVOKE ALL ON FUNCTION public.vice_get_estate_admin_dashboard() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.vice_get_estate_admin_dashboard() TO authenticated;
