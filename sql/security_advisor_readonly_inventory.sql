-- VICE OS security remediation: READ ONLY, review before applying any change.
-- Run with a privileged read-only auditor. This script DOES NOT modify production.
-- Inventory publicly exposed SECURITY DEFINER functions and exact grants.
SELECT n.nspname AS schema_name, p.proname AS function_name,
       pg_get_function_identity_arguments(p.oid) AS signature,
       p.prosecdef AS security_definer,
       has_function_privilege('anon',p.oid,'EXECUTE') AS anon_execute,
       has_function_privilege('authenticated',p.oid,'EXECUTE') AS authenticated_execute,
       p.proconfig AS function_settings
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname IN ('public','vice_private') AND p.prosecdef
ORDER BY n.nspname,p.proname,signature;

-- Inspect deny-by-default RLS and table grants. Missing policy does not imply exposure.
SELECT n.nspname AS schema_name,c.relname AS table_name,c.relrowsecurity AS rls_enabled,
       COUNT(pol.oid) AS policy_count,
       has_table_privilege('anon',c.oid,'SELECT') AS anon_select,
       has_table_privilege('authenticated',c.oid,'SELECT') AS authenticated_select
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
LEFT JOIN pg_policy pol ON pol.polrelid=c.oid
WHERE c.relkind IN ('r','p') AND n.nspname IN ('public','vice_private')
GROUP BY n.nspname,c.relname,c.relrowsecurity,c.oid
ORDER BY n.nspname,c.relname;

-- Never automatically revoke public login/verification RPCs without dependency tests.
-- Never add permissive RLS policies just to clear linter warnings.
-- Review security-definer function bodies, search_path, auth.uid checks,
-- nested function permissions and public response fields before patching.
