
-- DM client listens to Postgres INSERT events. Enable only RLS-protected DM
-- table in Supabase Realtime publication. Without this users wait for refresh.
DO $$
BEGIN
 IF NOT EXISTS (
 SELECT 1 FROM pg_catalog.pg_publication_tables
 WHERE pubname='supabase_realtime'
 AND schemaname='public' AND tablename='dm_messages'
 ) THEN
   ALTER PUBLICATION supabase_realtime ADD TABLE public.dm_messages;
 END IF;
END $$;
