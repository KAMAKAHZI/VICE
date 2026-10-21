-- VICE OS | Audited fixed-supply release index integrity (additive)
-- Execute after 20261021042700_vice_ouv_release_model_replay_safe.sql.
-- Every issuance/retirement/correction must reconcile against immutable issuer events.
-- This migration neither changes official OUV nor any holder balance.
BEGIN;

CREATE OR REPLACE FUNCTION vice_private.ouv_release_reconciliation()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
DECLARE
 cv bigint;cx bigint; ev numeric;ex numeric;uv numeric;ux numeric;dv numeric;dx numeric;
 hv numeric;hx numeric;bv numeric;bx numeric;official_vice numeric;official_v4x numeric;
 audit_v numeric; audit_x numeric; estate_audit_v numeric; estate_audit_x numeric;
 invalid_events bigint;
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
 WITH audited AS (
   SELECT payload->>'program' AS program,
          event_type,
          CASE WHEN coalesce(payload->>'units','') ~ '^[0-9]{1,12}$'
             AND (payload->>'units')::numeric > 0
            THEN (payload->>'units')::numeric ELSE NULL END AS units
   FROM public.iru_events
   WHERE event_type IN ('UNITS_ISSUED','UNITS_RETIRED','UNITS_ISSUANCE_REVERSED')
 )
 SELECT coalesce(sum(CASE WHEN program='VICE'
    THEN CASE WHEN event_type='UNITS_ISSUED' THEN units ELSE -units END END),0),
    coalesce(sum(CASE WHEN program='V4X'
    THEN CASE WHEN event_type='UNITS_ISSUED' THEN units ELSE -units END END),0),
    count(*) FILTER (WHERE units IS NULL OR program NOT IN ('VICE','V4X'))
 INTO audit_v,audit_x,invalid_events
 FROM audited;
 SELECT coalesce(sum(units) FILTER (WHERE program='VICE'),0),
        coalesce(sum(units) FILTER (WHERE program='V4X'),0)
 INTO estate_audit_v,estate_audit_x
 FROM public.vice_estate_events WHERE event_type='ESTATE_ALLOCATION_DISTRIBUTED';
 SELECT * INTO b FROM public.vice_ouv_release_policy WHERE id=1;
 SELECT vice_price,v4x_price INTO official_vice,official_v4x FROM public.vice_dao_config WHERE id=1;
 ok := b.id=1
  AND cv BETWEEN 0 AND 2500000 AND cx BETWEEN 0 AND 2500000
  AND hv=cv AND hx=cx AND audit_v=cv AND audit_x=cx AND invalid_events=0
  AND ev BETWEEN 0 AND 7500000 AND ex BETWEEN 0 AND 7500000
  AND uv>=0 AND ux>=0 AND dv=7500000 AND dx=7500000
  AND uv+ev=dv AND ux+ex=dx AND bv=ev AND bx=ex
  AND estate_audit_v=ev AND estate_audit_x=ex
  AND cv+ev<=10000000 AND cx+ex<=10000000
  AND official_vice>0 AND official_v4x=official_vice*160
  AND b.base_v4x=b.base_vice*160;
 RETURN jsonb_build_object(
  'ledger_reconciled',coalesce(ok,false),
  'audit_event_validity',invalid_events=0,
  'source','SERVER_LEDGER_AND_APPEND_ONLY_EVENT_RECONCILIATION',
  'holder_units',jsonb_build_object('VICE',hv,'V4X',hx),
  'strategic_counter',jsonb_build_object('VICE',cv,'V4X',cx),
  'strategic_audited_events',jsonb_build_object('VICE',audit_v,'V4X',audit_x),
  'estate_distributed',jsonb_build_object('VICE',ev,'V4X',ex),
  'estate_audited_events',jsonb_build_object('VICE',estate_audit_v,'V4X',estate_audit_x),
  'estate_holder_units',jsonb_build_object('VICE',bv,'V4X',bx),
  'estate_unassigned',jsonb_build_object('VICE',uv,'V4X',ux),
  'canonical_ratio_exact',(official_v4x=official_vice*160),
  'baseline_matches_official',(official_vice=b.base_vice AND official_v4x=b.base_v4x),
  'official_ouv',jsonb_build_object('VICE',official_vice,'V4X',official_v4x),
  'status',b.status,'checked_at',now(),
  'disclaimer','Issuer-side fixed supply and immutable issuance-event reconciliation; not economic valuation, external custody verification or collateral appraisal');
END $function$;
REVOKE ALL ON FUNCTION vice_private.ouv_release_reconciliation()
FROM PUBLIC,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION vice_private.ouv_release_event_capture()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
DECLARE m jsonb;health jsonb;u bigint;p text;kind text;sgn int;source_name text;
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
 -- This event was already applied to issuer unit ledgers in the same transaction.
 -- Confirm both unit ledgers AND append-only provenance agree before recording a model change.
 health:=vice_private.ouv_release_reconciliation();
 IF NOT coalesce((health->>'ledger_reconciled')::boolean,false) THEN
   RAISE EXCEPTION 'OUV release event rejected: issuer counters, holder balances or signed issuance event history do not reconcile'
     USING ERRCODE='23514';
 END IF;
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
REVOKE ALL ON FUNCTION vice_private.ouv_release_event_capture()
FROM PUBLIC,anon,authenticated,service_role;
COMMIT;
