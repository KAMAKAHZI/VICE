CREATE OR REPLACE FUNCTION public.vice_get_estate_admin_dashboard()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO ''
AS $$
DECLARE r jsonb; a jsonb;
BEGIN
 IF auth.uid() IS NULL OR NOT public.is_super() THEN RAISE EXCEPTION 'SUPER_ADMIN authorization required'; END IF;
 SELECT COALESCE(pg_catalog.jsonb_object_agg(program,pg_catalog.jsonb_build_object('designated_units',designated_units,'unassigned_units',unassigned_units,'transferred_units',transferred_units,'opening_basis',opening_basis,'settlement','INTERNAL_BOOK_ONLY')),'{}'::jsonb)
 INTO r FROM public.vice_estate_reserve_accounts;
 SELECT COALESCE(pg_catalog.jsonb_agg(pg_catalog.to_jsonb(x)),'[]'::jsonb) INTO a
 FROM (SELECT id,holder_id,program,units,status,created_at,distributed_at FROM public.vice_estate_allocations ORDER BY created_at DESC LIMIT 100) x;
 RETURN pg_catalog.jsonb_build_object('programs',r,'allocations',a,'settlement','INTERNAL_BOOK_ONLY');
END;
$$;
REVOKE ALL ON FUNCTION public.vice_get_estate_admin_dashboard() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.vice_get_estate_admin_dashboard() TO authenticated;
