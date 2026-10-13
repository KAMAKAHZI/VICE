BEGIN;
ALTER FUNCTION public.issue_certificate(text,text,jsonb,integer,text,text) SET search_path TO '';
ALTER FUNCTION public.verify_certificate(text) SET search_path TO '';
REVOKE EXECUTE ON FUNCTION public.issue_certificate(text,text,jsonb,integer,text,text) FROM PUBLIC,anon;
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM PUBLIC,anon,authenticated;
COMMIT;
