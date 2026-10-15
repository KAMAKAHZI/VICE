\set ON_ERROR_STOP on
-- Disposable GitHub PostgreSQL only. Synthetic IDs; never run on production.
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE SCHEMA auth;
CREATE SCHEMA storage;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
GRANT USAGE ON SCHEMA auth,storage TO authenticated,anon;
CREATE TABLE public.profiles(id uuid PRIMARY KEY,role text);
CREATE TABLE public.dm_messages(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),sender_id uuid,peer_id uuid,text text);
CREATE TABLE storage.objects(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),bucket_id text,name text);
CREATE FUNCTION storage.foldername(text) RETURNS text[] LANGUAGE sql IMMUTABLE AS $$SELECT (string_to_array($1,'/'))[1:array_length(string_to_array($1,'/'),1)-1]$$;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dm_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.profiles TO authenticated;
GRANT SELECT,INSERT ON public.dm_messages TO authenticated;
GRANT SELECT,INSERT ON storage.objects TO authenticated;
CREATE POLICY profiles_self_read ON public.profiles FOR SELECT USING ((SELECT auth.uid())=id);
CREATE POLICY vice_read ON public.dm_messages FOR SELECT TO authenticated USING(sender_id=(SELECT auth.uid()) OR peer_id=(SELECT auth.uid()));
CREATE POLICY vice_insert ON public.dm_messages FOR INSERT TO authenticated WITH CHECK (
 sender_id=(SELECT auth.uid()) AND peer_id<>(SELECT auth.uid()) AND length(text) BETWEEN 1 AND 10000
 AND EXISTS(SELECT 1 FROM public.profiles pr WHERE pr.id=(SELECT auth.uid()))
 AND EXISTS(SELECT 1 FROM public.profiles pr WHERE pr.id=peer_id));
INSERT INTO public.profiles VALUES
 ('00000000-0000-4000-8000-000000000001','HOLDER'),
 ('00000000-0000-4000-8000-000000000002','HOLDER'),
 ('00000000-0000-4000-8000-000000000003','HOLDER');
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',false);
DO $$BEGIN
 BEGIN
 INSERT INTO public.dm_messages(sender_id,peer_id,text) VALUES(auth.uid(),'00000000-0000-4000-8000-000000000002','baseline');
 RAISE EXCEPTION 'Baseline unexpectedly accepted blocked recipient';
 EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'PASS baseline defect reproduced'; END;
END$$;
RESET ROLE;
