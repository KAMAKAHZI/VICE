
-- Correct correlated storage.objects.name lookup; never use profiles.name
-- in a DM file path authorization decision.
DROP POLICY IF EXISTS vice_chat_media_upload ON storage.objects;
CREATE POLICY vice_chat_media_upload ON storage.objects
FOR INSERT TO authenticated WITH CHECK (
 bucket_id='vice-chat-media'
 AND (
   (
     (storage.foldername(storage.objects.name))[1]='ch'
     AND (storage.foldername(storage.objects.name))[3]=(SELECT auth.uid())::text
     AND (
       (storage.foldername(storage.objects.name))[2] IN ('general','trading')
       OR (
         (storage.foldername(storage.objects.name))[2] IN ('reserve','treasury')
         AND EXISTS(SELECT 1 FROM public.profiles pr
            WHERE pr.id=(SELECT auth.uid())
            AND pr.role IN ('SUPER_ADMIN','EXECUTIVE','COMPLIANCE_OFFICER','FINANCE_OFFICER','LEGAL_OFFICER'))
       )
     )
   )
   OR
   (
     (storage.foldername(storage.objects.name))[1]='dm'
     AND (storage.foldername(storage.objects.name))[4]=(SELECT auth.uid())::text
     AND (storage.foldername(storage.objects.name))[2]<>(storage.foldername(storage.objects.name))[3]
     AND (SELECT auth.uid())::text IN ((storage.foldername(storage.objects.name))[2],(storage.foldername(storage.objects.name))[3])
     AND EXISTS(
       SELECT 1 FROM public.profiles pr
       WHERE pr.id::text=CASE
         WHEN (storage.foldername(storage.objects.name))[2]=(SELECT auth.uid())::text
           THEN (storage.foldername(storage.objects.name))[3]
         ELSE (storage.foldername(storage.objects.name))[2]
       END
     )
   )
 )
);
