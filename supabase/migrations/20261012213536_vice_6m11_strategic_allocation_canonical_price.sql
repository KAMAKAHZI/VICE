CREATE OR REPLACE FUNCTION public.create_iru_allocation(p_holder_id uuid,p_program text,p_units numeric,p_price numeric DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $$
DECLARE v_id uuid;v_price numeric;v_type text;
BEGIN
 IF auth.uid() IS NULL OR NOT public.is_super() THEN RAISE EXCEPTION 'SUPER_ADMIN required'; END IF;
 IF p_program NOT IN ('VICE','V4X') OR p_program IS NULL THEN RAISE EXCEPTION 'Invalid program'; END IF;
 IF p_units IS NULL OR p_units<=0 OR p_units<>trunc(p_units) OR p_units>2500000 THEN RAISE EXCEPTION 'Invalid whole units'; END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(793151205);
 SELECT holder_type INTO v_type FROM public.holders WHERE id=p_holder_id FOR UPDATE;
 IF NOT FOUND OR coalesce(v_type,'')='ESTATE_RESERVE' THEN RAISE EXCEPTION 'Ineligible holder'; END IF;
 SELECT CASE WHEN p_program='VICE' THEN vice_price ELSE v4x_price END INTO v_price FROM public.vice_dao_config WHERE id=1;
 IF v_price IS NULL THEN RAISE EXCEPTION 'Canonical price unavailable'; END IF;
 IF p_price IS NOT NULL AND p_price<>v_price THEN RAISE EXCEPTION 'Price disagrees with canonical reference'; END IF;
 INSERT INTO public.allocations(holder_id,class,units,price,status,created_by)
 VALUES(p_holder_id,p_program,p_units,v_price,'PENDING',auth.uid()) RETURNING id INTO v_id;
 RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.create_iru_allocation(uuid,text,numeric,numeric) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.create_iru_allocation(uuid,text,numeric,numeric) TO authenticated;
