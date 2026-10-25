\set ON_ERROR_STOP on
DO $$BEGIN
 IF has_function_privilege('anon','public.lookup_email_for_login(text)','EXECUTE') THEN
   RAISE EXCEPTION 'Anonymous account enumeration still executable'; END IF;
 IF has_function_privilege('authenticated','public.lookup_email_for_login(text)','EXECUTE') THEN
   RAISE EXCEPTION 'Authenticated account enumeration still executable'; END IF;
 RAISE NOTICE 'PASS: legacy username lookup unavailable to anon and authenticated';
END $$;
SET ROLE anon;
DO $$BEGIN
 BEGIN
  PERFORM public.lookup_email_for_login('any-user');
  RAISE EXCEPTION 'Anonymous username lookup unexpectedly succeeded';
 EXCEPTION WHEN insufficient_privilege THEN
  RAISE NOTICE 'PASS: anonymous execution denied';
 END;
END $$;
RESET ROLE;
SET ROLE authenticated;
DO $$BEGIN
 BEGIN
  PERFORM public.lookup_email_for_login('any-user');
  RAISE EXCEPTION 'Authenticated username lookup unexpectedly succeeded';
 EXCEPTION WHEN insufficient_privilege THEN
  RAISE NOTICE 'PASS: authenticated execution denied';
 END;
END $$;
RESET ROLE;
