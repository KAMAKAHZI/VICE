
-- VICE OS 1.3.6.9: invite-only access must be enforced below the UI.
-- An auth.users record without a provisioned public.profiles membership must
-- not read even the general/trading channels or their uploaded attachments.
DROP POLICY IF EXISTS vice_read ON public.messages;
CREATE POLICY vice_read ON public.messages FOR SELECT TO authenticated USING (
  EXISTS(SELECT 1 FROM public.profiles pr WHERE pr.id=(SELECT auth.uid()))
  AND (
     channel_id IN ('general','trading')
     OR (
       channel_id IN ('reserve','treasury') AND EXISTS(
         SELECT 1 FROM public.profiles pr
         WHERE pr.id=(SELECT auth.uid())
         AND pr.role IN ('SUPER_ADMIN','EXECUTIVE','COMPLIANCE_OFFICER','FINANCE_OFFICER','LEGAL_OFFICER')
       )
     )
  )
);
DROP POLICY IF EXISTS vice_insert ON public.messages;
CREATE POLICY vice_insert ON public.messages FOR INSERT TO authenticated WITH CHECK (
 sender_id=(SELECT auth.uid())
 AND length(text) BETWEEN 1 AND 10000
 AND EXISTS(SELECT 1 FROM public.profiles pr WHERE pr.id=(SELECT auth.uid()))
 AND (
     channel_id IN ('general','trading')
     OR (
       channel_id IN ('reserve','treasury') AND EXISTS(
         SELECT 1 FROM public.profiles pr
         WHERE pr.id=(SELECT auth.uid())
         AND pr.role IN ('SUPER_ADMIN','EXECUTIVE','COMPLIANCE_OFFICER','FINANCE_OFFICER','LEGAL_OFFICER')
       )
     )
 )
);
-- Preserve the validated media path ACL, adding a cross-cutting membership
-- requirement on SELECT/INSERT/DELETE, without broadening any access.
DO $block$
DECLARE policy_row record; pred text; new_pred text; policy_action text;
BEGIN
 FOR policy_row IN SELECT policyname,cmd,qual,with_check
   FROM pg_catalog.pg_policies
   WHERE schemaname='storage' AND tablename='objects'
   AND policyname IN ('vice_chat_media_read','vice_chat_media_upload','vice_chat_media_delete')
 LOOP
   IF policy_row.cmd='SELECT' OR policy_row.cmd='DELETE' THEN
     pred := policy_row.qual;
     new_pred := '(EXISTS(SELECT 1 FROM public.profiles pr WHERE pr.id=(SELECT auth.uid()))) AND ('||pred||')';
     EXECUTE format('ALTER POLICY %I ON storage.objects USING (%s)',policy_row.policyname,new_pred);
   ELSIF policy_row.cmd='INSERT' THEN
     pred := policy_row.with_check;
     new_pred := '(EXISTS(SELECT 1 FROM public.profiles pr WHERE pr.id=(SELECT auth.uid()))) AND ('||pred||')';
     EXECUTE format('ALTER POLICY %I ON storage.objects WITH CHECK (%s)',policy_row.policyname,new_pred);
   ELSE RAISE EXCEPTION 'Unexpected chat media policy action';
   END IF;
 END LOOP;
END $block$;
