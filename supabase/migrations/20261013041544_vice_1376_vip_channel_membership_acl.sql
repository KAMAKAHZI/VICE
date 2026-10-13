
-- Extend defense in depth to the legacy VIP discussion tables.
-- Membership is an independent gate; VIP channel records cannot be read
-- by an uninvited authenticated Supabase user or a standard holder.
DROP POLICY IF EXISTS vip_channels_read ON public.vip_channels;
CREATE POLICY vip_channels_read ON public.vip_channels
FOR SELECT TO authenticated USING (
 EXISTS (
  SELECT 1 FROM public.profiles pr WHERE pr.id=(SELECT auth.uid())
    AND (pr.vip_access IS TRUE OR (SELECT public.is_admin()))
 )
);
DROP POLICY IF EXISTS vip_messages_read ON public.vip_messages;
CREATE POLICY vip_messages_read ON public.vip_messages
FOR SELECT TO authenticated USING (
 EXISTS (
  SELECT 1 FROM public.profiles pr WHERE pr.id=(SELECT auth.uid())
    AND (pr.vip_access IS TRUE OR (SELECT public.is_admin()))
 )
 AND EXISTS (
  SELECT 1 FROM public.vip_channels ch WHERE ch.id=channel_id
   AND (NOT ch.admin_only OR (SELECT public.is_admin()))
 )
);
DROP POLICY IF EXISTS vip_messages_insert ON public.vip_messages;
CREATE POLICY vip_messages_insert ON public.vip_messages
FOR INSERT TO authenticated WITH CHECK (
 from_user=(SELECT auth.uid()) AND length(body) BETWEEN 1 AND 10000
 AND EXISTS (
  SELECT 1 FROM public.profiles pr WHERE pr.id=(SELECT auth.uid())
   AND (pr.vip_access IS TRUE OR (SELECT public.is_admin()))
 )
 AND EXISTS (
  SELECT 1 FROM public.vip_channels ch WHERE ch.id=channel_id
   AND (NOT ch.admin_only OR (SELECT public.is_admin()))
 )
);
