-- Applied to live Supabase production. Privilege-safe chat RLS.

-- VICE OS 1.3.6.9 security: enforce channel permissions at the database.
-- Client navigation is not an authorization boundary; RLS is.
DROP POLICY IF EXISTS vice_read ON public.messages;
DROP POLICY IF EXISTS vice_insert ON public.messages;
CREATE POLICY vice_read ON public.messages FOR SELECT TO authenticated
USING (
 (SELECT auth.uid()) IS NOT NULL AND
 (
  channel_id IN ('general','trading')
  OR (
    channel_id IN ('reserve','treasury')
    AND EXISTS (
      SELECT 1 FROM public.profiles pr
      WHERE pr.id=(SELECT auth.uid()) AND pr.role IN (
        'SUPER_ADMIN','EXECUTIVE','COMPLIANCE_OFFICER','FINANCE_OFFICER','LEGAL_OFFICER'
      )
    )
  )
 )
);
CREATE POLICY vice_insert ON public.messages FOR INSERT TO authenticated
WITH CHECK (
 sender_id=(SELECT auth.uid())
 AND length(text) BETWEEN 1 AND 10000
 AND (
  channel_id IN ('general','trading')
  OR (
    channel_id IN ('reserve','treasury')
    AND EXISTS (
      SELECT 1 FROM public.profiles pr
      WHERE pr.id=(SELECT auth.uid()) AND pr.role IN (
        'SUPER_ADMIN','EXECUTIVE','COMPLIANCE_OFFICER','FINANCE_OFFICER','LEGAL_OFFICER'
      )
    )
  )
 )
);
-- A user cannot impersonate another member via the display-name column.
CREATE OR REPLACE FUNCTION public.vice_message_identity_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_uid uuid; v_name text;
BEGIN
  v_uid := auth.uid();
  -- Service-role system processes are out of scope of the client guard.
  IF v_uid IS NULL THEN RETURN NEW; END IF;
  IF NEW.sender_id IS DISTINCT FROM v_uid THEN
    RAISE EXCEPTION 'Message sender does not match authenticated session' USING ERRCODE='42501';
  END IF;
  SELECT pr.name INTO v_name FROM public.profiles pr WHERE pr.id=v_uid;
  IF NOT FOUND THEN RAISE EXCEPTION 'Provisioned profile required' USING ERRCODE='42501'; END IF;
  NEW.sender_name := coalesce(nullif(trim(v_name),''),'Member');
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS vice_message_identity_guard ON public.messages;
CREATE TRIGGER vice_message_identity_guard BEFORE INSERT ON public.messages
FOR EACH ROW EXECUTE FUNCTION public.vice_message_identity_guard();
DROP TRIGGER IF EXISTS vice_dm_identity_guard ON public.dm_messages;
CREATE TRIGGER vice_dm_identity_guard BEFORE INSERT ON public.dm_messages
FOR EACH ROW EXECUTE FUNCTION public.vice_message_identity_guard();
REVOKE ALL ON FUNCTION public.vice_message_identity_guard() FROM PUBLIC,anon,authenticated;
-- DM recipients must be existing members, not arbitrary UUIDs.
DROP POLICY IF EXISTS vice_insert ON public.dm_messages;
CREATE POLICY vice_insert ON public.dm_messages FOR INSERT TO authenticated
WITH CHECK (
 sender_id=(SELECT auth.uid()) AND peer_id<>(SELECT auth.uid())
 AND length(text) BETWEEN 1 AND 10000
 AND EXISTS (SELECT 1 FROM public.profiles pr WHERE pr.id=peer_id)
);

