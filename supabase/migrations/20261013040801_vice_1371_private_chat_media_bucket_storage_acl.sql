
-- VICE OS 1.3.6.10: authenticated chat media; private, never publicly readable.
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES ('vice-chat-media','vice-chat-media',false,8388608,
 ARRAY['image/jpeg','image/png','image/webp','audio/webm','audio/mp4','audio/ogg','audio/mpeg'])
ON CONFLICT(id) DO NOTHING;

DROP POLICY IF EXISTS vice_chat_media_read ON storage.objects;
CREATE POLICY vice_chat_media_read ON storage.objects
FOR SELECT TO authenticated USING (
  bucket_id='vice-chat-media'
  AND (
    (
      (storage.foldername(name))[1]='ch'
      AND (
        (storage.foldername(name))[2] IN ('general','trading')
        OR (
          (storage.foldername(name))[2] IN ('reserve','treasury')
          AND EXISTS (
             SELECT 1 FROM public.profiles pr
             WHERE pr.id=(SELECT auth.uid())
             AND pr.role IN ('SUPER_ADMIN','EXECUTIVE','COMPLIANCE_OFFICER','FINANCE_OFFICER','LEGAL_OFFICER')
          )
        )
      )
    )
    OR
    (
      (storage.foldername(name))[1]='dm'
      AND (SELECT auth.uid())::text IN ((storage.foldername(name))[2],(storage.foldername(name))[3])
      AND (storage.foldername(name))[4] IN ((storage.foldername(name))[2],(storage.foldername(name))[3])
    )
  )
);

DROP POLICY IF EXISTS vice_chat_media_upload ON storage.objects;
CREATE POLICY vice_chat_media_upload ON storage.objects
FOR INSERT TO authenticated WITH CHECK (
 bucket_id='vice-chat-media'
 AND (
   (
     (storage.foldername(name))[1]='ch'
     AND (storage.foldername(name))[3]=(SELECT auth.uid())::text
     AND (
        (storage.foldername(name))[2] IN ('general','trading')
        OR (
          (storage.foldername(name))[2] IN ('reserve','treasury')
          AND EXISTS (
            SELECT 1 FROM public.profiles pr
            WHERE pr.id=(SELECT auth.uid())
            AND pr.role IN ('SUPER_ADMIN','EXECUTIVE','COMPLIANCE_OFFICER','FINANCE_OFFICER','LEGAL_OFFICER')
          )
        )
     )
   )
   OR
   (
     (storage.foldername(name))[1]='dm'
     AND (storage.foldername(name))[4]=(SELECT auth.uid())::text
     AND (storage.foldername(name))[2]<>(storage.foldername(name))[3]
     AND (SELECT auth.uid())::text IN ((storage.foldername(name))[2],(storage.foldername(name))[3])
     AND EXISTS(
       SELECT 1 FROM public.profiles pr
       WHERE pr.id::text=CASE
         WHEN (storage.foldername(name))[2]=(SELECT auth.uid())::text
           THEN (storage.foldername(name))[3]
         ELSE (storage.foldername(name))[2]
       END
     )
   )
 )
);

DROP POLICY IF EXISTS vice_chat_media_delete ON storage.objects;
CREATE POLICY vice_chat_media_delete ON storage.objects
FOR DELETE TO authenticated USING (
  bucket_id='vice-chat-media'
  AND (
     ((storage.foldername(name))[1]='ch' AND (storage.foldername(name))[3]=(SELECT auth.uid())::text)
     OR ((storage.foldername(name))[1]='dm' AND (storage.foldername(name))[4]=(SELECT auth.uid())::text)
  )
);
