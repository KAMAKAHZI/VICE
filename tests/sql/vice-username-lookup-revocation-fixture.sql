\set ON_ERROR_STOP on
-- Disposable PostgreSQL only: prove that revocation removes both PUBLIC and
-- authenticated access without touching real usernames or member emails.
CREATE OR REPLACE FUNCTION public.lookup_email_for_login(p_identifier text)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT 'synthetic-only@example.invalid'::text
$$;
GRANT EXECUTE ON FUNCTION public.lookup_email_for_login(text) TO PUBLIC,anon,authenticated;
DO $$BEGIN
 IF NOT has_function_privilege('anon','public.lookup_email_for_login(text)','EXECUTE')
   OR NOT has_function_privilege('authenticated','public.lookup_email_for_login(text)','EXECUTE')
 THEN RAISE EXCEPTION 'Fixture must reproduce the pre-revocation public EXECUTE grant'; END IF;
END $$;
