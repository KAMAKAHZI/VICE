
-- Certificate integrity: no direct changes to grades or dates from user JWT.
-- Server-issued certificate creation/revocation functions remain available.
DROP POLICY IF EXISTS certificates_admin_all ON public.certificates;
REVOKE ALL ON TABLE public.certificates FROM PUBLIC,anon,authenticated;
GRANT SELECT ON TABLE public.certificates TO authenticated;
-- Keep existing certificates_member_read policy with owner/admin access.

-- Same access semantics; tell PostgreSQL to evaluate auth.uid once per statement
-- rather than once per row. Do not transform policies which have already been
-- optimized with an initplan SELECT wrapper.
DO $m$
DECLARE r record; q text; w text; statement text;
BEGIN
 FOR r IN
   SELECT schemaname,tablename,policyname,cmd,qual,with_check
   FROM pg_policies WHERE schemaname='public' AND
     (tablename,policyname) IN (
      ('profiles','profiles_self_read'),
      ('iru_events','vice_read'),
      ('messages','vice_read'),('messages','vice_insert'),
      ('dm_messages','vice_read'),('dm_messages','vice_insert'),
      ('iru_program_counters','vice_step6_counters_read'),
      ('academy_attempts','vice_step6_attempts_read'),
      ('signatures','vice_step6_signatures_read'),
      ('invites','vice_step7_invites_insert'),
      ('service_requests','vice_service_read'),('service_requests','vice_service_create'),
      ('support_tickets','vice_support_read'),('support_tickets','vice_support_create'),
      ('vice_dao_config','vice_dao_config_member_read'),
      ('vice_reference_price_policy_history','vice_reference_policy_member_read')
     )
 LOOP
   IF r.qual IS NOT NULL AND position('auth.uid()' IN r.qual)>0 THEN
     q := replace(r.qual,'auth.uid()','(SELECT auth.uid())');
     statement := format('ALTER POLICY %I ON public.%I USING (%s)',r.policyname,r.tablename,q);
     EXECUTE statement;
   END IF;
   IF r.with_check IS NOT NULL AND position('auth.uid()' IN r.with_check)>0 THEN
     w := replace(r.with_check,'auth.uid()','(SELECT auth.uid())');
     statement := format('ALTER POLICY %I ON public.%I WITH CHECK (%s)',r.policyname,r.tablename,w);
     EXECUTE statement;
   END IF;
 END LOOP;
END $m$;
