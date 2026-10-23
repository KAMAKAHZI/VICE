-- Canonical, read-only effective issuer reference snapshot.
-- Never substitutes modeled prices for official published references.
CREATE OR REPLACE FUNCTION public.vice_ouv_effective_reference()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path=pg_catalog
AS $$
DECLARE c record; p record; v record;
BEGIN
 IF auth.uid() IS NULL THEN
   RAISE EXCEPTION 'Authentication required' USING ERRCODE='28000';
 END IF;
 SELECT vice_price,v4x_price,updated_at INTO STRICT c
 FROM public.vice_dao_config WHERE id=1;
 SELECT status INTO STRICT p FROM public.vice_ouv_release_policy WHERE id=1;
 SELECT id,version,effective_at,vice_ouv,v4x_ouv INTO v
 FROM public.ouv_versions WHERE effective_at<=now()
 ORDER BY effective_at DESC,created_at DESC LIMIT 1;
 IF c.vice_price<=0 OR c.v4x_price<>c.vice_price*160 THEN
   RAISE EXCEPTION 'Official OUV reference integrity failure';
 END IF;
 IF v.id IS NOT NULL AND (v.vice_ouv<>c.vice_price OR v.v4x_ouv<>c.v4x_price) THEN
   RAISE EXCEPTION 'Published OUV version does not match canonical configuration';
 END IF;
 RETURN jsonb_build_object(
  'reference_kind','ISSUER_INTERNAL_MANAGEMENT_REFERENCE',
  'independent_fair_market_value',false,
  'policy_status',p.status,
  'official_ouv',jsonb_build_object('VICE',c.vice_price,'V4X',c.v4x_price),
  'effective_version_id',v.id,'effective_version',v.version,
  'effective_at',coalesce(v.effective_at,c.updated_at),
  'canonical_ratio','1:160',
  'holder_units_changed',false);
END $$;
REVOKE ALL ON FUNCTION public.vice_ouv_effective_reference() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.vice_ouv_effective_reference() TO authenticated;