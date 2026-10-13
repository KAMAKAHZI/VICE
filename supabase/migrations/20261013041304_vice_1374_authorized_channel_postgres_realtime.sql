-- Applied: route member/channel messages through RLS-gated database streaming.

-- Publish only table INSERT changes to authorized authenticated recipients.
-- Unlike a global broadcast, Postgres Changes respects the table's RLS
-- SELECT policies, which hide reserve/treasury channel messages from holders.
DO $$
BEGIN
 IF NOT EXISTS (
 SELECT 1 FROM pg_catalog.pg_publication_tables
 WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='messages'
 ) THEN
   ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
 END IF;
END $$;

