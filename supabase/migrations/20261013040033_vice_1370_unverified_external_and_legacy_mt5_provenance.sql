-- Production-applied account provenance hardening. No existing account data changed.
-- VICE OS manual-account provenance: never allow a browser to assert
-- independently verified bank balances or broker connection states.
-- Existing records and any provider-managed cloud connector records unchanged.
ALTER TABLE public.external_accounts ALTER COLUMN status SET DEFAULT 'UNVERIFIED';
ALTER TABLE public.mt5_accounts ALTER COLUMN status SET DEFAULT 'UNVERIFIED';

DROP POLICY IF EXISTS external_accounts_insert ON public.external_accounts;
CREATE POLICY external_accounts_insert ON public.external_accounts FOR INSERT TO authenticated
 WITH CHECK (owner_id=(SELECT auth.uid()) AND status='UNVERIFIED'
 AND length(trim(coalesce(institution,''))) BETWEEN 1 AND 200
 AND currency ~ '^[A-Z]{3}$' AND balance>=0);
DROP POLICY IF EXISTS external_accounts_update ON public.external_accounts;
CREATE POLICY external_accounts_update ON public.external_accounts FOR UPDATE TO authenticated
 USING(owner_id=(SELECT auth.uid()) AND status='UNVERIFIED')
 WITH CHECK(owner_id=(SELECT auth.uid()) AND status='UNVERIFIED'
 AND balance>=0);
REVOKE INSERT,UPDATE ON TABLE public.external_accounts FROM authenticated;
GRANT INSERT(id,owner_id,institution,account_number,currency,balance,status,created_at)
 ON TABLE public.external_accounts TO authenticated;
GRANT UPDATE(institution,account_number,currency,balance)
 ON TABLE public.external_accounts TO authenticated;

DROP POLICY IF EXISTS mt5_accounts_insert ON public.mt5_accounts;
CREATE POLICY mt5_accounts_insert ON public.mt5_accounts FOR INSERT TO authenticated
 WITH CHECK(owner_id=(SELECT auth.uid()) AND status='UNVERIFIED'
 AND mode='DEMO' AND balance=0 AND equity=0);
DROP POLICY IF EXISTS mt5_accounts_update ON public.mt5_accounts;
CREATE POLICY mt5_accounts_update ON public.mt5_accounts FOR UPDATE TO authenticated
 USING(owner_id=(SELECT auth.uid()) AND status='UNVERIFIED')
 WITH CHECK(owner_id=(SELECT auth.uid()) AND status='UNVERIFIED' AND mode='DEMO'
 AND balance=0 AND equity=0);
REVOKE INSERT,UPDATE ON TABLE public.mt5_accounts FROM authenticated;
GRANT INSERT(id,owner_id,broker,login,server,display_mode,created_at)
 ON TABLE public.mt5_accounts TO authenticated;
GRANT UPDATE(broker,login,server,display_mode)
 ON TABLE public.mt5_accounts TO authenticated;

