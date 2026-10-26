-- Apply ONLY after the email-only login frontend is published and verified.
-- This blocks direct public username-to-email enumeration.
BEGIN;
REVOKE EXECUTE ON FUNCTION public.lookup_email_for_login(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.lookup_email_for_login(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.lookup_email_for_login(text) FROM authenticated;
COMMIT;
-- Acceptance: has_function_privilege('anon','public.lookup_email_for_login(text)','EXECUTE') = false
-- Acceptance: has_function_privilege('authenticated','public.lookup_email_for_login(text)','EXECUTE') = false
-- WARNING: legacy username-only sign-in no longer works. Notify affected users.
-- Rollback only with explicit privacy approval; granting to anon restores enumeration.
