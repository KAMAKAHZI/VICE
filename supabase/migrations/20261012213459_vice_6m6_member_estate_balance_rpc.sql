CREATE OR REPLACE FUNCTION public.vice_get_my_estate_holdings()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $$
 SELECT pg_catalog.jsonb_build_object(
 'VICE', COALESCE((SELECT SUM(b.units) FROM public.vice_estate_holder_balances b JOIN public.holders h ON h.id=b.holder_id WHERE b.program='VICE' AND (h.user_id=auth.uid() OR h.profile_id=auth.uid())),0),
 'V4X', COALESCE((SELECT SUM(b.units) FROM public.vice_estate_holder_balances b JOIN public.holders h ON h.id=b.holder_id WHERE b.program='V4X' AND (h.user_id=auth.uid() OR h.profile_id=auth.uid())),0)
 ) WHERE auth.uid() IS NOT NULL;
$$;
REVOKE ALL ON FUNCTION public.vice_get_my_estate_holdings() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.vice_get_my_estate_holdings() TO authenticated;
