-- VICE4X verified finite-supply distribution/OUV issuance index.
-- Reproducible PostgreSQL migration of the additive model in production.
-- MODEL ONLY: NO OUV writes, unit transfers, securities valuations or collateral claims.
BEGIN;
ALTER TABLE public.vice_dao_config
 ALTER COLUMN vice_price TYPE numeric(28,8),
 ALTER COLUMN v4x_price TYPE numeric(28,8);
CREATE TABLE IF NOT EXISTS public.vice_ouv_release_policy (
 id smallint PRIMARY KEY DEFAULT 1 CHECK(id=1),
 status text NOT NULL DEFAULT 'MODEL_ONLY' CHECK(status='MODEL_ONLY'),
 formula_version text NOT NULL DEFAULT 'LINEAR_NET_RELEASE_FULL_20M_V1' CHECK(formula_version='LINEAR_NET_RELEASE_FULL_20M_V1'),
 total_supply_vice bigint NOT NULL DEFAULT 10000000 CHECK(total_supply_vice=10000000),
 total_supply_v4x bigint NOT NULL DEFAULT 10000000 CHECK(total_supply_v4x=10000000),
 base_vice numeric(28,8) NOT NULL CHECK(base_vice>0),
 base_v4x numeric(28,8) NOT NULL CHECK(base_v4x=base_vice*160),
 baseline_released_vice bigint NOT NULL CHECK(baseline_released_vice BETWEEN 0 AND 10000000),
 baseline_released_v4x bigint NOT NULL CHECK(baseline_released_v4x BETWEEN 0 AND 10000000),
 proposed_major_event_percent numeric(10,4) NOT NULL DEFAULT 5 CHECK(proposed_major_event_percent>0 AND proposed_major_event_percent<=100),
 recorded_at timestamptz NOT NULL DEFAULT now(),
 disclaimer text NOT NULL DEFAULT 'Purely formula-driven internal issuance/scarcity indicator, not official OUV, external FMV, liquid funds, accredited appraisal, token price, or lender-accepted collateral.'
);
INSERT INTO public.vice_ouv_release_policy(id,base_vice,base_v4x,baseline_released_vice,baseline_released_v4x)
SELECT 1,c.vice_price,c.v4x_price,
 (SELECT issued FROM public.iru_program_counters WHERE program='VICE')+(SELECT transferred_units::bigint FROM public.vice_estate_reserve_accounts WHERE program='VICE'),
 (SELECT issued FROM public.iru_program_counters WHERE program='V4X')+(SELECT transferred_units::bigint FROM public.vice_estate_reserve_accounts WHERE program='V4X')
FROM public.vice_dao_config c WHERE c.id=1 ON CONFLICT(id) DO NOTHING;
ALTER TABLE public.vice_ouv_release_policy ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.vice_ouv_release_policy FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.vice_ouv_release_policy TO service_role;
CREATE TABLE IF NOT EXISTS public.vice_ouv_release_model_events (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 source_table text NOT NULL CHECK(source_table IN ('iru_events','vice_estate_events')),
 source_seq bigint NOT NULL,source_kind text NOT NULL,
 distribution_program text NOT NULL CHECK(distribution_program IN ('VICE','V4X')),
 units_change bigint NOT NULL,net_released_vice bigint NOT NULL,net_released_v4x bigint NOT NULL,
 incremental_supply_pct numeric(20,10) NOT NULL,cumulative_supply_pct numeric(20,10) NOT NULL,
 projected_vice numeric(28,8) NOT NULL,projected_v4x numeric(28,8) NOT NULL,
 requires_governance boolean NOT NULL,recorded_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(source_table,source_seq)
);
ALTER TABLE public.vice_ouv_release_model_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.vice_ouv_release_model_events FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.vice_ouv_release_model_events TO service_role;

CREATE OR REPLACE FUNCTION vice_private.ouv_release_math(p_delta_vice_strategic bigint DEFAULT 0, p_delta_v4x_strategic bigint DEFAULT 0, p_delta_vice_estate bigint DEFAULT 0, p_delta_v4x_estate bigint DEFAULT 0)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
DECLARE
 p public.vice_ouv_release_policy;
 c_vice bigint;c_v4x bigint;e_vice bigint;e_v4x bigint;
 t_vice bigint;t_v4x bigint;net_units bigint;
 pct numeric;factor numeric;new_vice numeric(28,8);new_v4x numeric(28,8);
 official_vice numeric;official_v4x numeric;
BEGIN
 SELECT * INTO p FROM public.vice_ouv_release_policy WHERE id=1;
 IF NOT FOUND THEN RAISE EXCEPTION 'OUV release policy baseline not installed';END IF;
 IF p_delta_vice_strategic IS NULL OR p_delta_v4x_strategic IS NULL
 OR p_delta_vice_estate IS NULL OR p_delta_v4x_estate IS NULL
 OR LEAST(p_delta_vice_strategic,p_delta_v4x_strategic,p_delta_vice_estate,p_delta_v4x_estate)<0
 THEN RAISE EXCEPTION 'Only nonnegative whole-unit preview changes are permitted';END IF;
 SELECT issued INTO c_vice FROM public.iru_program_counters WHERE program='VICE';
 SELECT issued INTO c_v4x FROM public.iru_program_counters WHERE program='V4X';
 SELECT transferred_units::bigint INTO e_vice FROM public.vice_estate_reserve_accounts WHERE program='VICE';
 SELECT transferred_units::bigint INTO e_v4x FROM public.vice_estate_reserve_accounts WHERE program='V4X';
 IF c_vice IS NULL OR c_v4x IS NULL OR e_vice IS NULL OR e_v4x IS NULL THEN
  RAISE EXCEPTION 'Release supply ledger incomplete';END IF;
 IF c_vice<0 OR c_v4x<0 OR c_vice+p_delta_vice_strategic>2500000
  OR c_v4x+p_delta_v4x_strategic>2500000
  OR e_vice<0 OR e_v4x<0 OR e_vice+p_delta_vice_estate>7500000
  OR e_v4x+p_delta_v4x_estate>7500000
 THEN RAISE EXCEPTION 'Fixed program supply or designated allocation pool would be exceeded';END IF;
 t_vice:=c_vice+e_vice+p_delta_vice_strategic+p_delta_vice_estate;
 t_v4x:=c_v4x+e_v4x+p_delta_v4x_strategic+p_delta_v4x_estate;
 IF t_vice>p.total_supply_vice OR t_v4x>p.total_supply_v4x THEN
  RAISE EXCEPTION 'Fixed 10-million-per-program supply exceeded';END IF;
 -- Net current releases prevent double-counting repeat transfers or reversing/redoing an issuance.
 net_units:=t_vice+t_v4x-p.baseline_released_vice-p.baseline_released_v4x;
 pct:=round((net_units::numeric/20000000::numeric)*100,10);
 factor:=1+net_units::numeric/20000000::numeric;
 new_vice:=round(p.base_vice*factor,8);
 new_v4x:=round(new_vice*160,8); -- exact canonical 1:160, at 8 decimal places
 SELECT vice_price,v4x_price INTO official_vice,official_v4x FROM public.vice_dao_config WHERE id=1;
 RETURN jsonb_build_object(
 'status',p.status,'formula',p.formula_version,'supply_each',10000000,'total_fixed_supply',20000000,
 'baseline_released',jsonb_build_object('VICE',p.baseline_released_vice,'V4X',p.baseline_released_v4x),
 'currently_released',jsonb_build_object('VICE',c_vice+e_vice,'V4X',c_v4x+e_v4x),
 'modeled_released',jsonb_build_object('VICE',t_vice,'V4X',t_v4x),
 'incremental_units',net_units,'appreciation_percent',pct,
 'proposed_major_threshold_percent',p.proposed_major_event_percent,
 'major_governance_required',(abs(pct)>p.proposed_major_event_percent),
 'formula_factor',factor,
 'modeled_ouv',jsonb_build_object('VICE',new_vice,'V4X',new_v4x),
 'official_ouv',jsonb_build_object('VICE',official_vice,'V4X',official_v4x),
 'automatic_official_update_enabled',false,
 'baseline_outdated',(official_vice IS DISTINCT FROM p.base_vice OR official_v4x IS DISTINCT FROM p.base_v4x),
 'disclaimer',p.disclaimer,
 'next_steps','Activate this policy only via an independently approved governance amendment and safeguarded executor. Model readings are not independently appraised value.');
END $function$;

CREATE OR REPLACE FUNCTION vice_private.ouv_release_reconciliation()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
DECLARE
 cv bigint;cx bigint;ev numeric;ex numeric;uv numeric;ux numeric;dv numeric;dx numeric;
 hv numeric;hx numeric;bv numeric;bx numeric;official_vice numeric;official_v4x numeric;
 b public.vice_ouv_release_policy;
 ok boolean;
BEGIN
 SELECT issued INTO cv FROM public.iru_program_counters WHERE program='VICE';
 SELECT issued INTO cx FROM public.iru_program_counters WHERE program='V4X';
 SELECT unassigned_units,transferred_units,designated_units INTO uv,ev,dv
   FROM public.vice_estate_reserve_accounts WHERE program='VICE';
 SELECT unassigned_units,transferred_units,designated_units INTO ux,ex,dx
   FROM public.vice_estate_reserve_accounts WHERE program='V4X';
 SELECT coalesce(sum(vice_units),0),coalesce(sum(v4x_units),0)
   INTO hv,hx FROM public.holders
   WHERE coalesce(holder_type,'')<>'ESTATE_RESERVE' AND coalesce(status,'')<>'ESTATE_RESERVE';
 SELECT coalesce(sum(units) FILTER (WHERE program='VICE'),0),
        coalesce(sum(units) FILTER (WHERE program='V4X'),0)
   INTO bv,bx FROM public.vice_estate_holder_balances;
 SELECT * INTO b FROM public.vice_ouv_release_policy WHERE id=1;
 SELECT vice_price,v4x_price INTO official_vice,official_v4x FROM public.vice_dao_config WHERE id=1;
 ok:=b.id=1
   AND cv BETWEEN 0 AND 2500000 AND cx BETWEEN 0 AND 2500000
   AND hv=cv AND hx=cx
   AND ev BETWEEN 0 AND 7500000 AND ex BETWEEN 0 AND 7500000
   AND uv>=0 AND ux>=0 AND dv=7500000 AND dx=7500000
   AND uv+ev=dv AND ux+ex=dx
   AND bv=ev AND bx=ex
   AND cv+ev<=10000000 AND cx+ex<=10000000
   AND official_vice>0 AND official_v4x=official_vice*160
   AND b.base_v4x=b.base_vice*160;
 RETURN jsonb_build_object(
  'ledger_reconciled',coalesce(ok,false),
  'source','SERVER_LEDGER_RECONCILIATION',
  'holder_units',jsonb_build_object('VICE',hv,'V4X',hx),
  'strategic_counter',jsonb_build_object('VICE',cv,'V4X',cx),
  'estate_distributed',jsonb_build_object('VICE',ev,'V4X',ex),
  'estate_holder_units',jsonb_build_object('VICE',bv,'V4X',bx),
  'estate_unassigned',jsonb_build_object('VICE',uv,'V4X',ux),
  'canonical_ratio_exact',(official_v4x=official_vice*160),
  'baseline_matches_official',(official_vice=b.base_vice AND official_v4x=b.base_v4x),
  'official_ouv',jsonb_build_object('VICE',official_vice,'V4X',official_v4x),
  'status',b.status,'checked_at',now(),
  'disclaimer','Internal accounting reconciliation; does not independently validate economic value, custody, or collateral');
END $function$;

CREATE OR REPLACE FUNCTION public.vice_ouv_release_snapshot()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
DECLARE v_health jsonb; v_model jsonb;
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS(
   SELECT 1 FROM public.profiles p WHERE p.id=auth.uid()
     AND NOT p.account_revoked AND NOT p.account_suspended
 ) THEN
  RAISE EXCEPTION 'Active authenticated member required' USING ERRCODE='42501';
 END IF;
 v_health:=vice_private.ouv_release_reconciliation();
 v_model:=vice_private.ouv_release_math();
 RETURN v_model||jsonb_build_object(
  'ledger_reconciled',(v_health->>'ledger_reconciled')::boolean,
  'policy_baseline_current',(v_health->>'baseline_matches_official')::boolean,
  'model_usable',coalesce((v_health->>'ledger_reconciled')::boolean,false)
     AND coalesce((v_health->>'baseline_matches_official')::boolean,false),
  'automatic_official_update_enabled',false);
END $function$;

CREATE OR REPLACE FUNCTION public.vice_ouv_my_reference_snapshot()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
DECLARE
  a uuid:=auth.uid();v_vice numeric:=0;v_v4x numeric:=0;
  e_vice numeric:=0;e_v4x numeric:=0;
  u_vice numeric;u_v4x numeric;
  m jsonb;recon jsonb;
  mv numeric;mx numeric;ov numeric;ox numeric;
BEGIN
 IF a IS NULL OR NOT vice_private.account_allowed() THEN
  RAISE EXCEPTION 'Active signed-in member required' USING ERRCODE='42501';END IF;
 -- Only balances belonging to the authenticated user. No cross-member exposure.
 SELECT coalesce(sum(h.vice_units),0),coalesce(sum(h.v4x_units),0)
   INTO v_vice,v_v4x FROM public.holders h
   WHERE (h.user_id=a OR h.profile_id=a)
     AND coalesce(h.holder_type,'')<>'ESTATE_RESERVE'
     AND coalesce(h.status,'')<>'ESTATE_RESERVE';
 SELECT coalesce(sum(b.units) FILTER (WHERE b.program='VICE'),0),
        coalesce(sum(b.units) FILTER (WHERE b.program='V4X'),0)
   INTO e_vice,e_v4x FROM public.vice_estate_holder_balances b
   INNER JOIN public.holders h ON h.id=b.holder_id
   WHERE (h.user_id=a OR h.profile_id=a)
     AND coalesce(h.holder_type,'')<>'ESTATE_RESERVE';
 u_vice:=v_vice+e_vice;u_v4x:=v_v4x+e_v4x;
 m:=vice_private.ouv_release_math();
 recon:=vice_private.ouv_release_reconciliation();
 SELECT vice_price,v4x_price INTO ov,ox FROM public.vice_dao_config WHERE id=1;
 mv:=(m#>>'{modeled_ouv,VICE}')::numeric;
 mx:=(m#>>'{modeled_ouv,V4X}')::numeric;
 RETURN jsonb_build_object(
  'as_of',now(),'policy_status',m->>'status',
  'reconciled',(recon->>'ledger_reconciled')::boolean,
  'stale_baseline',(m->>'baseline_outdated')::boolean,
  'user_has_holder_record',exists(
    SELECT 1 FROM public.holders h WHERE (h.user_id=a OR h.profile_id=a)
      AND coalesce(h.holder_type,'')<>'ESTATE_RESERVE'),
  'units',jsonb_build_object('VICE',u_vice,'V4X',u_v4x),
  'official_ouv',jsonb_build_object('VICE',ov,'V4X',ox),
  'model_ouv',jsonb_build_object('VICE',mv,'V4X',mx),
  'official_reference_cents',round((u_vice*ov+u_v4x*ox)*100,0),
  'modeled_reference_cents',CASE WHEN (recon->>'ledger_reconciled')::boolean
       AND (recon->>'baseline_matches_official')::boolean
       THEN round((u_vice*mv+u_v4x*mx)*100,0) ELSE NULL END,
  'distribution_model_change_percent',m->>'appreciation_percent',
  'incremental_distributed_units',m->>'incremental_units',
  'automatic_official_update_enabled',false,
  'disclaimer','Issuance activity index is a MODEL ONLY. Changes to allocated units do not prove economic appreciation. Official OUVs and issued certificates are unchanged.'
 );
END $function$;

CREATE OR REPLACE FUNCTION public.vice_ouv_release_quote(p_vice_units bigint DEFAULT 0, p_v4x_units bigint DEFAULT 0, p_pool text DEFAULT 'STRATEGIC_POOL'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
DECLARE v_health jsonb; v_data jsonb;
BEGIN
 IF NOT public.vice_institutional_access() THEN
  RAISE EXCEPTION 'Designated CEO/CFO authentication required for issuer quote' USING ERRCODE='42501';
 END IF;
 v_health:=vice_private.ouv_release_reconciliation();
 IF NOT coalesce((v_health->>'ledger_reconciled')::boolean,false) THEN
  RAISE EXCEPTION 'OUV model quote paused: ledger reconciliation failed; correct underlying records first';
 END IF;
 IF NOT coalesce((v_health->>'baseline_matches_official')::boolean,false) THEN
  RAISE EXCEPTION 'OUV model quote paused: a new official OUV is effective; approved policy rebasing required';
 END IF;
 IF p_pool='STRATEGIC_POOL' THEN
  v_data:=vice_private.ouv_release_math(p_vice_units,p_v4x_units,0,0);
 ELSIF p_pool='ESTATE_RESERVE' THEN
  v_data:=vice_private.ouv_release_math(0,0,p_vice_units,p_v4x_units);
 ELSE
  RAISE EXCEPTION 'Source must be STRATEGIC_POOL or ESTATE_RESERVE';
 END IF;
 RETURN v_data||jsonb_build_object('ledger_reconciled',true,'policy_baseline_current',true,
   'official_ouv_change_performed',false,
   'independent_value_verified',false);
END $function$;

CREATE OR REPLACE FUNCTION public.vice_ouv_release_health()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
BEGIN
 IF auth.uid() IS NULL OR NOT public.vice_institutional_access()
 THEN RAISE EXCEPTION 'CEO/CFO session required' USING ERRCODE='42501';END IF;
 RETURN vice_private.ouv_release_reconciliation();
END $function$;

CREATE OR REPLACE FUNCTION vice_private.ouv_release_event_capture()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
DECLARE m jsonb;u bigint;p text;kind text;sgn int;source_name text;
BEGIN
 IF TG_TABLE_NAME='iru_events' THEN
  IF NEW.event_type NOT IN ('UNITS_ISSUED','UNITS_RETIRED','UNITS_ISSUANCE_REVERSED')
  THEN RETURN NEW;END IF;
  source_name:='iru_events';kind:=NEW.event_type;p:=NEW.payload->>'program';
  IF coalesce(NEW.payload->>'units','') !~ '^[0-9]{1,12}$' THEN RAISE EXCEPTION 'Invalid IRU release event units';END IF;
  u:=(NEW.payload->>'units')::bigint;
  sgn:=CASE WHEN kind='UNITS_ISSUED' THEN 1 ELSE -1 END;
 ELSIF TG_TABLE_NAME='vice_estate_events' THEN
  IF NEW.event_type<>'ESTATE_ALLOCATION_DISTRIBUTED' THEN RETURN NEW;END IF;
  source_name:='vice_estate_events';kind:=NEW.event_type;p:=NEW.program;
  IF NEW.units IS NULL OR NEW.units<=0 OR NEW.units<>trunc(NEW.units) THEN
   RAISE EXCEPTION 'Invalid estate transfer unit count';END IF;
  u:=NEW.units::bigint;sgn:=1;
 ELSE RETURN NEW; END IF;
 IF p NOT IN ('VICE','V4X') OR u IS NULL OR u<=0 THEN RAISE EXCEPTION 'Invalid distribution release'; END IF;
 m:=vice_private.ouv_release_math();
 INSERT INTO public.vice_ouv_release_model_events
 (source_table,source_seq,source_kind,distribution_program,units_change,
  net_released_vice,net_released_v4x,incremental_supply_pct,cumulative_supply_pct,
  projected_vice,projected_v4x,requires_governance)
 VALUES(source_name,NEW.seq,kind,p,sgn*u,
  (m#>>'{modeled_released,VICE}')::bigint,
  (m#>>'{modeled_released,V4X}')::bigint,
  round((sgn*u)::numeric*100/20000000::numeric,10),
  (m->>'appreciation_percent')::numeric,
  (m#>>'{modeled_ouv,VICE}')::numeric,
  (m#>>'{modeled_ouv,V4X}')::numeric,
  (m->>'major_governance_required')::boolean)
 ON CONFLICT(source_table,source_seq) DO NOTHING;
 RETURN NEW;
END $function$;

CREATE OR REPLACE FUNCTION public.vice_financial_release_capabilities()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
DECLARE
  v_vice numeric; v_v4x numeric; v_ready boolean;
  v_supply_ok boolean;
BEGIN
 IF auth.uid() IS NULL OR NOT public.is_super() THEN
  RAISE EXCEPTION 'SUPER_ADMIN authorization required' USING ERRCODE='42501';
 END IF;
 SELECT c.vice_price,c.v4x_price,
  (c.total_vice=10000000 AND c.total_v4x=10000000 AND
   c.estate_vice=7500000 AND c.estate_v4x=7500000 AND
   c.holder_vice=2500000 AND c.holder_v4x=2500000)
 INTO v_vice,v_v4x,v_supply_ok
 FROM public.vice_dao_config c WHERE c.id=1;
 v_ready := coalesce(v_supply_ok,false)
   AND coalesce(v_vice>0,false)
   AND coalesce(v_v4x=v_vice*160,false)
   AND EXISTS(SELECT 1 FROM public.iru_program_counters
              WHERE program='VICE' AND issued BETWEEN 0 AND 2500000)
   AND EXISTS(SELECT 1 FROM public.iru_program_counters
              WHERE program='V4X' AND issued BETWEEN 0 AND 2500000)
   AND to_regclass('public.vice_estate_reserve_accounts') IS NOT NULL;
 RETURN jsonb_build_object(
   'strategic_price_rpc_v133',v_ready,
   'canonical_ouv_verified',v_ready,
   'reference_vice',v_vice,'reference_v4x',v_v4x,
   'reference_ratio',160,
   'total_units_per_class',10000000,
   'strategic_capacity_per_class',2500000,
   'estate_capacity_per_class',7500000,
   'source','SERVER_VERIFIED_CANONICAL_REFERENCE_DYNAMIC',
   'reserve_book_available',(to_regclass('public.vice_estate_reserve_accounts') IS NOT NULL),
   'settlement','INTERNAL_BOOK_ONLY_NOT_ONCHAIN',
   'independent_market_value_verified',false,
   'not_a_price_mutation',true
 );
END $function$;

REVOKE ALL ON FUNCTION vice_private.ouv_release_math(bigint,bigint,bigint,bigint) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION vice_private.ouv_release_reconciliation() FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION vice_private.ouv_release_event_capture() FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.vice_ouv_release_snapshot() FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.vice_ouv_my_reference_snapshot() FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.vice_ouv_release_quote(bigint,bigint,text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.vice_ouv_release_health() FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.vice_financial_release_capabilities() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.vice_ouv_release_snapshot() TO authenticated;
GRANT EXECUTE ON FUNCTION public.vice_ouv_my_reference_snapshot() TO authenticated;
GRANT EXECUTE ON FUNCTION public.vice_ouv_release_quote(bigint,bigint,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.vice_ouv_release_health() TO authenticated;
GRANT EXECUTE ON FUNCTION public.vice_financial_release_capabilities() TO authenticated;
DO $block$BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgname='vice_ouv_release_on_strategic_issuance'
   AND tgrelid='public.iru_events'::regclass) THEN
 CREATE TRIGGER vice_ouv_release_on_strategic_issuance
 AFTER INSERT ON public.iru_events FOR EACH ROW EXECUTE FUNCTION vice_private.ouv_release_event_capture();
 END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgname='vice_ouv_release_on_estate_distribution'
   AND tgrelid='public.vice_estate_events'::regclass) THEN
 CREATE TRIGGER vice_ouv_release_on_estate_distribution
 AFTER INSERT ON public.vice_estate_events FOR EACH ROW EXECUTE FUNCTION vice_private.ouv_release_event_capture();
 END IF;
END$block$;
COMMIT;
