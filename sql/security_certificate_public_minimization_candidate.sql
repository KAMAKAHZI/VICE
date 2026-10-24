-- Reviewed privacy hardening candidate. Apply only after staging tests.
-- Keeps public certificate verification while withholding academic scores,
-- private digest and revocation rationale from anonymous callers.
-- Certificate integrity remains checked by the underlying issuer workflow.
CREATE OR REPLACE FUNCTION public.verify_certificate(p_cert_id text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO ''
AS $fn$
DECLARE rec record;
BEGIN
  IF p_cert_id IS NULL OR length(btrim(p_cert_id)) NOT BETWEEN 8 AND 128 THEN
    RETURN jsonb_build_object('valid',false,'reason','INVALID_ID');
  END IF;
  SELECT cert_id, holder_name, course_title, issued_at, expires_at, revoked
    INTO rec FROM public.certificates
    WHERE cert_id=upper(btrim(p_cert_id)) LIMIT 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('valid',false,'reason','NOT_FOUND');
  END IF;
  IF rec.revoked THEN
    RETURN jsonb_build_object('valid',false,'reason','REVOKED');
  END IF;
  RETURN jsonb_build_object('valid',true,'cert_id',rec.cert_id,
    'name',rec.holder_name,'course',rec.course_title,
    'issued_at',rec.issued_at,'expires_at',rec.expires_at);
END;
$fn$;
-- No GRANT changes. Public visibility of name/course still requires privacy approval.
