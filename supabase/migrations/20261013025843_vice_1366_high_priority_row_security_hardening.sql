-- Deployed migration from Supabase migration history, recorded by version.
-- Do not rerun on a previously migrated database without a DBA review.
-- Prevent direct identity/role escalation while restoring self-service profile edits.
REVOKE INSERT, UPDATE, DELETE ON TABLE public.profiles FROM anon,authenticated;
GRANT SELECT ON TABLE public.profiles TO authenticated;
GRANT UPDATE (name,username,title,phone,jurisdiction,timezone,avatar_initials,avatar_url) ON public.profiles TO authenticated;
DROP POLICY IF EXISTS profiles_self_insert ON public.profiles;
DROP POLICY IF EXISTS profiles_self_update ON public.profiles;
CREATE POLICY profiles_self_update ON public.profiles FOR UPDATE TO authenticated USING (id = (SELECT auth.uid())) WITH CHECK (id = (SELECT auth.uid()));

-- Certification must only be issued by reviewed RPC, never fabricated via direct insert.
REVOKE INSERT ON TABLE public.certificates FROM anon,authenticated;
DROP POLICY IF EXISTS certificates_public_read ON public.certificates;
DROP POLICY IF EXISTS certificates_self_issue ON public.certificates;
CREATE POLICY certificates_member_read ON public.certificates FOR SELECT TO authenticated USING (profile_id=(SELECT auth.uid()) OR (SELECT public.is_admin()));

-- Owner isolate legacy broker metadata; never grant users access to other members.
DROP POLICY IF EXISTS mt5_accounts_insert ON public.mt5_accounts;
DROP POLICY IF EXISTS mt5_accounts_read ON public.mt5_accounts;
DROP POLICY IF EXISTS mt5_accounts_update ON public.mt5_accounts;
CREATE POLICY mt5_accounts_insert ON public.mt5_accounts FOR INSERT TO authenticated WITH CHECK (owner_id=(SELECT auth.uid()));
CREATE POLICY mt5_accounts_read ON public.mt5_accounts FOR SELECT TO authenticated USING (owner_id=(SELECT auth.uid()) OR (SELECT public.is_admin()));
CREATE POLICY mt5_accounts_update ON public.mt5_accounts FOR UPDATE TO authenticated USING (owner_id=(SELECT auth.uid())) WITH CHECK (owner_id=(SELECT auth.uid()));
CREATE POLICY mt5_accounts_delete ON public.mt5_accounts FOR DELETE TO authenticated USING (owner_id=(SELECT auth.uid()));

DROP POLICY IF EXISTS external_accounts_insert ON public.external_accounts;
DROP POLICY IF EXISTS external_accounts_read ON public.external_accounts;
DROP POLICY IF EXISTS external_accounts_update ON public.external_accounts;
CREATE POLICY external_accounts_insert ON public.external_accounts FOR INSERT TO authenticated WITH CHECK (owner_id=(SELECT auth.uid()));
CREATE POLICY external_accounts_read ON public.external_accounts FOR SELECT TO authenticated USING (owner_id=(SELECT auth.uid()) OR (SELECT public.is_admin()));
CREATE POLICY external_accounts_update ON public.external_accounts FOR UPDATE TO authenticated USING (owner_id=(SELECT auth.uid())) WITH CHECK (owner_id=(SELECT auth.uid()));
CREATE POLICY external_accounts_delete ON public.external_accounts FOR DELETE TO authenticated USING (owner_id=(SELECT auth.uid()));

-- Holder ledger visibility: only issuer personnel and the actual holder may read. 
DROP POLICY IF EXISTS holders_insert ON public.holders;
DROP POLICY IF EXISTS holders_update ON public.holders;
DROP POLICY IF EXISTS holders_read ON public.holders;
CREATE POLICY holders_read ON public.holders FOR SELECT TO authenticated USING ((SELECT public.is_admin()) OR user_id=(SELECT auth.uid()) OR profile_id=(SELECT auth.uid()));
CREATE POLICY holders_insert ON public.holders FOR INSERT TO authenticated WITH CHECK ((SELECT public.is_super()));
CREATE POLICY holders_update ON public.holders FOR UPDATE TO authenticated USING ((SELECT public.is_super())) WITH CHECK ((SELECT public.is_super()));
DROP POLICY IF EXISTS allocations_insert ON public.allocations;
DROP POLICY IF EXISTS allocations_update ON public.allocations;
DROP POLICY IF EXISTS allocations_read ON public.allocations;
CREATE POLICY allocations_read ON public.allocations FOR SELECT TO authenticated USING ((SELECT public.is_admin()) OR EXISTS(SELECT 1 FROM public.holders h WHERE h.id=holder_id AND (h.user_id=(SELECT auth.uid()) OR h.profile_id=(SELECT auth.uid()))));
CREATE POLICY allocations_insert ON public.allocations FOR INSERT TO authenticated WITH CHECK ((SELECT public.is_super()));
CREATE POLICY allocations_update ON public.allocations FOR UPDATE TO authenticated USING ((SELECT public.is_super())) WITH CHECK ((SELECT public.is_super()));

-- Staff-only accounting sources; issuer holdings must not be public via API.
DROP POLICY IF EXISTS treasury_tx_read ON public.treasury_tx;
DROP POLICY IF EXISTS treasury_tx_insert ON public.treasury_tx;
DROP POLICY IF EXISTS treasury_tx_update ON public.treasury_tx;
CREATE POLICY treasury_tx_read ON public.treasury_tx FOR SELECT TO authenticated USING ((SELECT public.is_admin()));
CREATE POLICY treasury_tx_insert ON public.treasury_tx FOR INSERT TO authenticated WITH CHECK ((SELECT public.is_super()));
CREATE POLICY treasury_tx_update ON public.treasury_tx FOR UPDATE TO authenticated USING ((SELECT public.is_super())) WITH CHECK ((SELECT public.is_super()));
DROP POLICY IF EXISTS distributions_read ON public.distributions;
DROP POLICY IF EXISTS distributions_insert ON public.distributions;
DROP POLICY IF EXISTS distributions_update ON public.distributions;
CREATE POLICY distributions_read ON public.distributions FOR SELECT TO authenticated USING ((SELECT public.is_admin()));
CREATE POLICY distributions_insert ON public.distributions FOR INSERT TO authenticated WITH CHECK ((SELECT public.is_super()));
CREATE POLICY distributions_update ON public.distributions FOR UPDATE TO authenticated USING ((SELECT public.is_super())) WITH CHECK ((SELECT public.is_super()));

-- Operator-only institutional records.
DO $body$
DECLARE tb text;
BEGIN
  FOREACH tb IN ARRAY ARRAY['compliance_cases','data_rooms'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', tb||'_read', tb);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', tb||'_insert', tb);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', tb||'_update', tb);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING ((SELECT public.is_admin()))',tb||'_read',tb);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK ((SELECT public.is_admin()))',tb||'_insert',tb);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING ((SELECT public.is_admin())) WITH CHECK ((SELECT public.is_admin()))',tb||'_update',tb);
  END LOOP;
END $body$;

-- Members can log actions for their own identity, but cannot rewrite previous audit events.
DROP POLICY IF EXISTS audit_log_read ON public.audit_log;
DROP POLICY IF EXISTS audit_log_insert ON public.audit_log;
DROP POLICY IF EXISTS audit_log_update ON public.audit_log;
CREATE POLICY audit_log_read ON public.audit_log FOR SELECT TO authenticated USING ((SELECT public.is_admin()));
CREATE POLICY audit_log_insert ON public.audit_log FOR INSERT TO authenticated WITH CHECK (actor_id = (SELECT auth.uid())::text OR (SELECT public.is_super()));
REVOKE UPDATE, DELETE, TRUNCATE ON TABLE public.audit_log FROM anon,authenticated;

-- Reference price/history is never client-managed by an ordinary holder.
DROP POLICY IF EXISTS ouv_versions_read ON public.ouv_versions;
DROP POLICY IF EXISTS ouv_versions_insert ON public.ouv_versions;
DROP POLICY IF EXISTS ouv_versions_update ON public.ouv_versions;
CREATE POLICY ouv_versions_read ON public.ouv_versions FOR SELECT TO authenticated USING ((SELECT auth.uid()) IS NOT NULL);
CREATE POLICY ouv_versions_insert ON public.ouv_versions FOR INSERT TO authenticated WITH CHECK ((SELECT public.is_super()));
CREATE POLICY ouv_versions_update ON public.ouv_versions FOR UPDATE TO authenticated USING ((SELECT public.is_super())) WITH CHECK ((SELECT public.is_super()));

DROP POLICY IF EXISTS proposals_read ON public.proposals;
DROP POLICY IF EXISTS proposals_insert ON public.proposals;
DROP POLICY IF EXISTS proposals_update ON public.proposals;
CREATE POLICY proposals_read ON public.proposals FOR SELECT TO authenticated USING ((SELECT auth.uid()) IS NOT NULL);
CREATE POLICY proposals_insert ON public.proposals FOR INSERT TO authenticated WITH CHECK ((SELECT public.is_super()));
CREATE POLICY proposals_update ON public.proposals FOR UPDATE TO authenticated USING ((SELECT public.is_super())) WITH CHECK ((SELECT public.is_super()));

-- Channel ACLs: owner-scoped authors and role-scoped private rooms.
DROP POLICY IF EXISTS vip_channels_read ON public.vip_channels;
DROP POLICY IF EXISTS vip_channels_insert ON public.vip_channels;
DROP POLICY IF EXISTS vip_channels_update ON public.vip_channels;
CREATE POLICY vip_channels_read ON public.vip_channels FOR SELECT TO authenticated USING ((SELECT auth.uid()) IS NOT NULL);
CREATE POLICY vip_channels_insert ON public.vip_channels FOR INSERT TO authenticated WITH CHECK ((SELECT public.is_super()));
CREATE POLICY vip_channels_update ON public.vip_channels FOR UPDATE TO authenticated USING ((SELECT public.is_super())) WITH CHECK ((SELECT public.is_super()));
DROP POLICY IF EXISTS vip_messages_read ON public.vip_messages;
DROP POLICY IF EXISTS vip_messages_insert ON public.vip_messages;
CREATE POLICY vip_messages_read ON public.vip_messages FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.vip_channels ch WHERE ch.id=channel_id AND (NOT ch.admin_only OR (SELECT public.is_admin())))
);
CREATE POLICY vip_messages_insert ON public.vip_messages FOR INSERT TO authenticated WITH CHECK (
  from_user=(SELECT auth.uid()) AND length(body)<=10000 AND EXISTS (SELECT 1 FROM public.vip_channels ch WHERE ch.id=channel_id AND (NOT ch.admin_only OR (SELECT public.is_admin())))
);
REVOKE UPDATE,DELETE ON TABLE public.vip_messages FROM anon,authenticated;

-- Document metadata access is restricted to submitter, mapped holder or staff.
DROP POLICY IF EXISTS documents_read ON public.documents;
DROP POLICY IF EXISTS documents_insert ON public.documents;
DROP POLICY IF EXISTS documents_update ON public.documents;
CREATE POLICY documents_read ON public.documents FOR SELECT TO authenticated USING (
 (SELECT public.is_admin()) OR uploaded_by = (SELECT auth.uid())::text
 OR EXISTS(SELECT 1 FROM public.holders h WHERE h.id=holder_id AND (h.user_id=(SELECT auth.uid()) OR h.profile_id=(SELECT auth.uid())))
);
CREATE POLICY documents_insert ON public.documents FOR INSERT TO authenticated WITH CHECK (uploaded_by = (SELECT auth.uid())::text);
CREATE POLICY documents_update ON public.documents FOR UPDATE TO authenticated USING ((SELECT public.is_super())) WITH CHECK ((SELECT public.is_super()));
CREATE POLICY documents_delete ON public.documents FOR DELETE TO authenticated USING ((SELECT public.is_super()) OR (uploaded_by=(SELECT auth.uid())::text AND COALESCE(signed,false)=false));
GRANT INSERT ON TABLE public.documents TO authenticated;
