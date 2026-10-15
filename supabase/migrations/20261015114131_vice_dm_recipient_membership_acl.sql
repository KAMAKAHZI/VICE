-- Preserve private profiles while allowing an authenticated provisioned member
-- to address another provisioned member. No user or financial records change.
CREATE SCHEMA IF NOT EXISTS vice_private;
REVOKE ALL ON SCHEMA vice_private FROM PUBLIC;
GRANT USAGE ON SCHEMA vice_private TO authenticated;
CREATE OR REPLACE FUNCTION vice_private.is_member_peer(p_peer text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path=pg_catalog
AS $$
 SELECT auth.uid() IS NOT NULL
  AND EXISTS(SELECT 1 FROM public.profiles me WHERE me.id=auth.uid())
  AND EXISTS(SELECT 1 FROM public.profiles peer WHERE peer.id::text=p_peer)
$$;
REVOKE ALL ON FUNCTION vice_private.is_member_peer(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION vice_private.is_member_peer(text) TO authenticated;

DROP POLICY IF EXISTS vice_insert ON public.dm_messages;
CREATE POLICY vice_insert ON public.dm_messages FOR INSERT TO authenticated WITH CHECK (
 sender_id=(SELECT auth.uid()) AND peer_id<>(SELECT auth.uid())
 AND length(text) BETWEEN 1 AND 10000
 AND vice_private.is_member_peer(peer_id::text)
);

DROP POLICY IF EXISTS vice_chat_media_upload ON storage.objects;
CREATE POLICY vice_chat_media_upload ON storage.objects FOR INSERT TO authenticated WITH CHECK (
 EXISTS(SELECT 1 FROM public.profiles pr WHERE pr.id=(SELECT auth.uid()))
 AND bucket_id='vice-chat-media'
 AND (
  ((storage.foldername(name))[1]='ch'
   AND (storage.foldername(name))[3]=(SELECT auth.uid())::text
   AND ((storage.foldername(name))[2] IN ('general','trading')
    OR ((storage.foldername(name))[2] IN ('reserve','treasury') AND EXISTS(
     SELECT 1 FROM public.profiles pr WHERE pr.id=(SELECT auth.uid())
      AND pr.role IN ('SUPER_ADMIN','EXECUTIVE','COMPLIANCE_OFFICER','FINANCE_OFFICER','LEGAL_OFFICER')))))
  OR
  ((storage.foldername(name))[1]='dm'
   AND (storage.foldername(name))[4]=(SELECT auth.uid())::text
   AND (storage.foldername(name))[2]<>(storage.foldername(name))[3]
   AND (SELECT auth.uid())::text IN ((storage.foldername(name))[2],(storage.foldername(name))[3])
   AND vice_private.is_member_peer(CASE
    WHEN (storage.foldername(name))[2]=(SELECT auth.uid())::text THEN (storage.foldername(name))[3]
    ELSE (storage.foldername(name))[2] END))
 )
);
