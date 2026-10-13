-- Canonical applied Supabase migration: permission-audited and transaction-tested.
-- VICE OS 1.3.6.10: trusted audit provenance, invite-only DM access,
-- and bounded client self-reporting. Existing audit entries are retained.
-- A browser event is never an issuer-authorized operation.
REVOKE INSERT,UPDATE,DELETE,TRUNCATE ON TABLE public.audit_log FROM PUBLIC,anon,authenticated;
DROP POLICY IF EXISTS audit_log_insert ON public.audit_log;
CREATE INDEX IF NOT EXISTS idx_vice_audit_client_event_rate
  ON public.audit_log (actor_id,created_at DESC)
  WHERE actor_role='CLIENT_REPORTED';

CREATE OR REPLACE FUNCTION public.vice_record_client_activity(
  p_event_type text,p_action text,p_object_type text,p_object_id text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path='' AS $fn$
DECLARE v_uid uuid;v_id uuid;v_count integer;
BEGIN
  v_uid:=auth.uid();
  IF v_uid IS NULL OR NOT EXISTS
    (SELECT 1 FROM public.profiles pr WHERE pr.id=v_uid) THEN
    RAISE EXCEPTION 'Provisioned member session required' USING ERRCODE='42501';
  END IF;
  IF length(trim(coalesce(p_event_type,''))) NOT BETWEEN 3 AND 60
    OR p_event_type !~ '^[A-Z0-9_:-]+$'
    OR length(trim(coalesce(p_action,''))) NOT BETWEEN 3 AND 180
    OR length(trim(coalesce(p_object_type,''))) NOT BETWEEN 2 AND 70
    OR length(coalesce(p_object_id,'')) > 160 THEN
      RAISE EXCEPTION 'Invalid event description' USING ERRCODE='22023';
  END IF;
  -- Telemetry cannot be used to overwhelm the authoritative audit ledger.
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext(v_uid::text||':vice_client_audit'));
  SELECT count(*)::integer INTO v_count
  FROM public.audit_log WHERE actor_id=v_uid::text
    AND actor_role='CLIENT_REPORTED'
    AND created_at>pg_catalog.now()-INTERVAL '60 seconds';
  IF v_count>=20 THEN RETURN jsonb_build_object('recorded',false,'reason','RATE_LIMIT'); END IF;
  INSERT INTO public.audit_log(event_type,action,object_type,object_id,
    actor_id,actor_role,outcome,correlation_id)
  VALUES ('CLIENT_ACTIVITY',left(trim(p_action),180),
    left(trim(p_object_type),70),left(coalesce(p_object_id,''),160),
    v_uid::text,'CLIENT_REPORTED','UNVERIFIED_CLIENT_EVENT',
    'client-'||pg_catalog.gen_random_uuid()::text)
  RETURNING id INTO v_id;
  RETURN jsonb_build_object('recorded',true,'entry_id',v_id,
    'classification','UNVERIFIED_CLIENT_EVENT');
END $fn$;
REVOKE ALL ON FUNCTION public.vice_record_client_activity(text,text,text,text)
 FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.vice_record_client_activity(text,text,text,text)
 TO authenticated;

DROP POLICY IF EXISTS vice_read ON public.dm_messages;
CREATE POLICY vice_read ON public.dm_messages FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.profiles pr WHERE pr.id=(SELECT auth.uid()))
  AND (sender_id=(SELECT auth.uid()) OR peer_id=(SELECT auth.uid()))
);
DROP POLICY IF EXISTS vice_insert ON public.dm_messages;
CREATE POLICY vice_insert ON public.dm_messages FOR INSERT TO authenticated WITH CHECK (
  sender_id=(SELECT auth.uid()) AND peer_id<>(SELECT auth.uid())
  AND length(text) BETWEEN 1 AND 10000
  AND EXISTS (SELECT 1 FROM public.profiles pr WHERE pr.id=(SELECT auth.uid()))
  AND EXISTS (SELECT 1 FROM public.profiles pr WHERE pr.id=peer_id)
);
