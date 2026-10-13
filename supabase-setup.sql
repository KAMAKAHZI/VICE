-- VICE OS DATABASE INITIALIZATION - SAFE ENTRYPOINT
-- DO NOT RUN THE OBSOLETE BOOTSTRAP.
-- The formerly included 2026 legacy template had permissive authenticated
-- RLS policies and a predictable bootstrap invitation. Re-applying it would
-- undermine production authorization, private account isolation and issuer
-- governance. It has been preserved for historical review only at:
-- docs/legacy/supabase-setup-LEGACY-INSECURE-DO-NOT-RUN.sql
--
-- Production project: sdsaewumabzjjvsmqqsl. All schema changes MUST use
-- reviewed, numbered supabase/migrations/*.sql and migration tracking.
-- Test in a development branch with member/admin role acceptance tests.
-- Do not install legacy schema by copying individual queries.
DO $$ BEGIN
  RAISE EXCEPTION 'The historical supabase-setup.sql bootstrap is retired. Use reviewed Supabase migrations and the operator release runbook.' USING ERRCODE='P0001';
END $$;
