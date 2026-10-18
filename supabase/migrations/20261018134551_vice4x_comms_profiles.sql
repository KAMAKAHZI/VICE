-- Additive member media and notification read APIs. No production records are removed.
BEGIN;
CREATE OR REPLACE FUNCTION public.vice_member_directory()
RETURNS TABLE(id uuid,name text,role text,avatar_initials text,vip_access boolean,avatar_url text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT p.id,p.name,p.role,p.avatar_initials,p.vip_access,p.avatar_url
 FROM public.profiles p
 WHERE (SELECT vice_private.account_allowed()) AND EXISTS(SELECT 1 FROM public.profiles member WHERE member.id=auth.uid())
 AND NOT coalesce(p.account_suspended,false) AND NOT coalesce(p.account_revoked,false)
 ORDER BY p.name LIMIT 250
$$;
REVOKE ALL ON FUNCTION public.vice_member_directory() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.vice_member_directory() TO authenticated;

INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES('vice-profile-media','vice-profile-media',false,8388608,ARRAY['image/jpeg','image/png','image/webp','image/gif'])
ON CONFLICT(id) DO NOTHING;
DO $policy$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='vice_profile_media_read') THEN
CREATE POLICY vice_profile_media_read ON storage.objects FOR SELECT TO authenticated
USING(bucket_id='vice-profile-media' AND (SELECT vice_private.account_allowed()) AND EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=auth.uid()));
END IF; END $policy$;
DO $policy$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='vice_profile_media_insert') THEN
CREATE POLICY vice_profile_media_insert ON storage.objects FOR INSERT TO authenticated
WITH CHECK(bucket_id='vice-profile-media' AND (SELECT vice_private.account_allowed()) AND EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=auth.uid())
 AND split_part(name,'/',1)=(SELECT auth.uid())::text
 AND name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|png|webp|gif)$');
END IF; END $policy$;
-- No overwrite/delete policy: replacing an avatar writes a new immutable object.

CREATE OR REPLACE FUNCTION public.vice_call_metadata(p_text text)
RETURNS jsonb LANGUAGE plpgsql IMMUTABLE SET search_path=pg_catalog AS $$
BEGIN
 IF left(p_text,13)<>'VICE_CALL_V1:' THEN RETURN NULL; END IF;
 RETURN substring(p_text FROM 14)::jsonb;
EXCEPTION WHEN invalid_text_representation THEN RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION public.vice_call_metadata(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.vice_call_metadata(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.vice_comms_inbox()
RETURNS TABLE(id text,kind text,peer_id uuid,channel_id text,sender_name text,body text,created_at timestamptz,media_mode text)
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=pg_catalog AS $$
BEGIN
 IF NOT vice_private.account_allowed() OR NOT EXISTS(SELECT 1 FROM public.profiles WHERE profiles.id=auth.uid()) THEN RAISE EXCEPTION 'Active membership required' USING ERRCODE='42501'; END IF;
 RETURN QUERY
 WITH recent_signals AS (
  SELECT d.sender_id,d.peer_id,d.sender_name,d.created_at,public.vice_call_metadata(d.text) AS m
  FROM public.dm_messages d
  WHERE (d.sender_id=auth.uid() OR d.peer_id=auth.uid()) AND d.text LIKE 'VICE_CALL_V1:%'
    AND d.created_at>now()-interval '7 days'
  ORDER BY d.created_at DESC LIMIT 2000
 ), notices AS (
  SELECT d.id::text,'message'::text,d.sender_id,NULL::text,d.sender_name,d.text,d.created_at,NULL::text
  FROM public.dm_messages d WHERE d.peer_id=auth.uid() AND d.text NOT LIKE 'VICE_CALL_V1:%' AND d.created_at>now()-interval '7 days'
  UNION ALL
  SELECT m.id::text,'message',NULL::uuid,m.channel_id::text,m.sender_name,m.text,m.created_at,NULL::text
  FROM public.messages m WHERE m.sender_id<>auth.uid() AND m.created_at>now()-interval '7 days'
  UNION ALL
  SELECT 'call:'||(s.m->>'callId'),'missed',s.sender_id,NULL::text,s.sender_name,'Missed call',s.created_at,s.m->>'mediaMode'
  FROM recent_signals s
  WHERE s.peer_id=auth.uid() AND s.m->>'kind'='offer' AND length(s.m->>'callId') BETWEEN 1 AND 80
    AND s.created_at<now()-interval '90 seconds'
    AND NOT EXISTS(SELECT 1 FROM recent_signals a WHERE a.sender_id=auth.uid() AND a.peer_id=s.sender_id
     AND a.m->>'callId'=s.m->>'callId' AND a.m->>'kind' IN ('answer','decline'))
 )
 SELECT * FROM notices ORDER BY 7 DESC LIMIT 100;
END $$;
REVOKE ALL ON FUNCTION public.vice_comms_inbox() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.vice_comms_inbox() TO authenticated;
COMMIT;
