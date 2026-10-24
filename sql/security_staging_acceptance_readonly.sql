-- Read-only acceptance checks for the isolated VICE-STAGING security fixtures.
-- Run against staging only; never against production as a substitute for app integration.
DO $$
DECLARE
  v jsonb;
BEGIN
  IF has_function_privilege('anon','public.lookup_email_for_login(text)','EXECUTE')
     OR has_function_privilege('authenticated','public.lookup_email_for_login(text)','EXECUTE') THEN
    RAISE EXCEPTION 'Username lookup still publicly executable';
  END IF;
  IF NOT has_function_privilege('anon','public.verify_certificate(text)','EXECUTE') THEN
    RAISE EXCEPTION 'Public certificate verification unavailable';
  END IF;
  v := public.verify_certificate(NULL);
  IF v->>'reason' IS DISTINCT FROM 'INVALID_ID' THEN
    RAISE EXCEPTION 'Null certificate ID not rejected';
  END IF;
  v := public.verify_certificate('NONEXISTENT-STAGING-TEST');
  IF v->>'reason' IS DISTINCT FROM 'NOT_FOUND' THEN
    RAISE EXCEPTION 'Unknown certificate ID not rejected';
  END IF;
  IF position('rec.expires_at <= now()' in pg_get_functiondef('public.verify_certificate(text)'::regprocedure)) = 0 THEN
    RAISE EXCEPTION 'Certificate expiry guard missing';
  END IF;
END $$;
