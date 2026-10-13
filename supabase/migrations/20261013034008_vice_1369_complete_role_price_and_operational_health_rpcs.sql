
-- VICE OS 1.3.6.8 — Fill two missing privileged application RPCs and
-- provide safe backend integrity diagnostics. No user data is changed.
-- Reprice function preserves current canonical $2:$320 (1:160) policy.
CREATE OR REPLACE FUNCTION public.vice_assign_member_role(
  p_member_id uuid, p_role text, p_reason text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $function$
DECLARE v_old_role text; v_new_role text;
BEGIN
 IF auth.uid() IS NULL OR NOT public.is_super() THEN
   RAISE EXCEPTION 'SUPER_ADMIN authorization required' USING ERRCODE='42501';
 END IF;
 v_new_role := upper(trim(coalesce(p_role,'')));
 IF v_new_role NOT IN ('HOLDER','EXECUTIVE','COMPLIANCE_OFFICER',
   'FINANCE_OFFICER','TREASURY_OPERATOR','LEGAL_OFFICER','AUDITOR') THEN
   RAISE EXCEPTION 'Invalid delegated member role' USING ERRCODE='22023';
 END IF;
 IF p_member_id IS NULL OR p_member_id=auth.uid() THEN
   RAISE EXCEPTION 'Self-role changes are prohibited' USING ERRCODE='42501';
 END IF;
 IF length(trim(coalesce(p_reason,''))) NOT BETWEEN 8 AND 400 THEN
   RAISE EXCEPTION 'Provide an 8-400 character authorization rationale';
 END IF;
 SELECT role INTO v_old_role
 FROM public.profiles WHERE id=p_member_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Provisioned member profile not found'; END IF;
 IF v_old_role='SUPER_ADMIN' THEN
   RAISE EXCEPTION 'Cannot modify the issuer administrator role';
 END IF;
 IF v_old_role=v_new_role THEN
   RETURN jsonb_build_object('ok',true,'changed',false,'role',v_old_role);
 END IF;
 UPDATE public.profiles SET role=v_new_role,updated_at=now()
 WHERE id=p_member_id;
 INSERT INTO public.audit_log(event_type,action,object_type,object_id,
   actor_id,actor_role,outcome,correlation_id)
 VALUES ('ACCESS_CONTROL','MEMBER_ROLE_CHANGED','profiles',p_member_id::text,
   auth.uid()::text,'SUPER_ADMIN','SUCCESS',gen_random_uuid()::text);
 RETURN jsonb_build_object('ok',true,'changed',true,'profile_id',p_member_id,
   'former_role',v_old_role,'role',v_new_role);
END $function$;
REVOKE ALL ON FUNCTION public.vice_assign_member_role(uuid,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.vice_assign_member_role(uuid,text,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.vice_set_dao_prices(
  p_vice numeric,p_v4x numeric,p_reason text,p_effective_at timestamptz
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path='' AS $function$
DECLARE v_old_vice numeric;v_old_v4x numeric;
BEGIN
 IF auth.uid() IS NULL OR NOT public.is_super() THEN
   RAISE EXCEPTION 'SUPER_ADMIN required' USING ERRCODE='42501';
 END IF;
 IF length(trim(coalesce(p_reason,''))) NOT BETWEEN 12 AND 600
    OR p_effective_at IS NULL THEN
   RAISE EXCEPTION 'Documented pricing basis and effective date required';
 END IF;
 -- Fixed reference integrity: the issuer's 1:160 reference may not be
 -- changed casually by a browser form. Changes require a separately audited
 -- formal governance migration; never infer real market liquidity.
 IF p_vice IS DISTINCT FROM 2::numeric OR
    p_v4x IS DISTINCT FROM 320::numeric THEN
   RAISE EXCEPTION 'Reference policy fixed at VICE $2 / V4X $320 (1:160). A separate approved policy migration is required to amend these values.';
 END IF;
 SELECT vice_price,v4x_price INTO v_old_vice,v_old_v4x
 FROM public.vice_dao_config WHERE id=1 FOR UPDATE;
 IF NOT FOUND OR v_old_vice IS DISTINCT FROM 2::numeric
     OR v_old_v4x IS DISTINCT FROM 320::numeric THEN
   RAISE EXCEPTION 'Live issuer reference configuration is missing or inconsistent';
 END IF;
 -- No units minted, transferred, appraised or revalued. Historical reference
 -- version is stored through separate owner-scoped ouv_versions write.
 INSERT INTO public.audit_log(event_type,action,object_type,object_id,
   actor_id,actor_role,outcome,correlation_id)
 VALUES ('ISSUER_REFERENCE','REASSERT_REFERENCE_POLICY','vice_dao_config','1',
   auth.uid()::text,'SUPER_ADMIN','SUCCESS',gen_random_uuid()::text);
 RETURN jsonb_build_object('ok',true,'reference_vice',v_old_vice,
  'reference_v4x',v_old_v4x,'relationship','1:160',
  'effective_at',p_effective_at,'market_value_verified',false,
  'valuation_disclaimer','Issuer management reference only; not independent FMV or liquid collateral.');
END $function$;
REVOKE ALL ON FUNCTION public.vice_set_dao_prices(numeric,numeric,text,timestamptz) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.vice_set_dao_prices(numeric,numeric,text,timestamptz) TO authenticated;

CREATE OR REPLACE FUNCTION public.vice_operational_health()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $function$
DECLARE v_config public.vice_dao_config%ROWTYPE;
 v_schema_count integer;v_schema_unprotected integer;
 v_holder_count integer;v_holder_cap boolean;
 v_orphans integer;v_invalid_units integer;v_missing_owner integer;
 v_ok boolean;
BEGIN
 IF auth.uid() IS NULL OR NOT public.is_super() THEN
   RAISE EXCEPTION 'SUPER_ADMIN required' USING ERRCODE='42501';
 END IF;
 SELECT * INTO v_config FROM public.vice_dao_config WHERE id=1;
 SELECT count(*)::int,count(*) FILTER(WHERE NOT c.relrowsecurity)::int
 INTO v_schema_count,v_schema_unprotected
 FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname='public' AND c.relkind='r';
 SELECT count(*)::int INTO v_holder_count
 FROM public.holders WHERE COALESCE(status,'ACTIVE')<>'ESTATE_RESERVE'
   AND COALESCE(holder_type,'')<>'ESTATE_RESERVE';
 SELECT count(*)::int INTO v_orphans
 FROM public.holders h
 LEFT JOIN public.profiles p ON p.id=h.profile_id
 WHERE h.profile_id IS NOT NULL AND p.id IS NULL;
 SELECT count(*)::int INTO v_invalid_units
 FROM public.holders
 WHERE COALESCE(vice_units,0)<0 OR COALESCE(v4x_units,0)<0;
 SELECT count(*)::int INTO v_missing_owner
 FROM public.external_accounts WHERE owner_id IS NULL;
 v_holder_cap := v_holder_count<=250;
 v_ok := v_config.id=1 AND v_config.total_vice=10000000
   AND v_config.total_v4x=10000000
   AND v_config.estate_vice=7500000 AND v_config.estate_v4x=7500000
   AND v_config.holder_vice=2500000 AND v_config.holder_v4x=2500000
   AND v_config.vice_price=2 AND v_config.v4x_price=320
   AND v_schema_count>0 AND v_schema_unprotected=0 AND v_holder_cap
   AND v_orphans=0 AND v_invalid_units=0 AND v_missing_owner=0;
 RETURN jsonb_build_object(
  'status',CASE WHEN v_ok THEN 'PASS' ELSE 'WARN' END,
  'checked_at',now(),
  'database_checks_only',true,
  'public_tables',v_schema_count,
  'public_tables_without_rls',v_schema_unprotected,
  'active_holder_records',v_holder_count,
  'holder_capacity_ok',v_holder_cap,
  'holder_profile_orphans',v_orphans,
  'holder_negative_unit_records',v_invalid_units,
  'external_accounts_missing_owner',v_missing_owner,
  'canonical_reference_vice',v_config.vice_price,
  'canonical_reference_v4x',v_config.v4x_price,
  'reference_policy_valid',v_ok,
  'live_auth_tested',false,
  'netlify_publication_tested',false,
  'broker_provider_tested',false,
  'financial_custody_tested',false
 );
END $function$;
REVOKE ALL ON FUNCTION public.vice_operational_health() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.vice_operational_health() TO authenticated;

-- Normalize username lookup: preserves existing username login (public RPC).
-- Username enumeration remains a known rate-limiting risk until a proxy or
-- CAPTCHA protection is introduced upstream.
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_username_case_insensitive
ON public.profiles (lower(username)) WHERE username IS NOT NULL;
CREATE OR REPLACE FUNCTION public.lookup_email_for_login(p_identifier text)
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $function$
DECLARE v_email text;
BEGIN
 IF length(coalesce(p_identifier,'')) NOT BETWEEN 3 AND 100
    OR position('@' IN coalesce(p_identifier,''))>0 THEN RETURN NULL; END IF;
 SELECT lower(p.email) INTO v_email FROM public.profiles p
 WHERE lower(p.username)=lower(trim(p_identifier))
 LIMIT 1;
 RETURN v_email;
END $function$;
REVOKE ALL ON FUNCTION public.lookup_email_for_login(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.lookup_email_for_login(text) TO anon,authenticated;
