-- Reviewed privacy hardening candidate. Apply only after staging tests.
-- Keeps public certificate verification while withholding academic scores,
-- private digest and revocation rationale from anonymous callers.
-- Verify issuer's original digest before asserting validity. A public
-- database row by itself must never be accepted as proof of an authentic award.
-- This requires staging compatibility checks against legacy awards before rollout.
CREATE OR REPLACE FUNCTION public.verify_certificate(p_cert_id text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO ''
AS $fn$
DECLARE rec record; expected_digest text;
BEGIN
  IF p_cert_id IS NULL OR length(btrim(p_cert_id)) NOT BETWEEN 1 AND 128 THEN
    RETURN jsonb_build_object('valid',false,'reason','INVALID_ID');
  END IF;
  SELECT cert_id, profile_id, holder_name, course_title, scores,
         overall_score, salt, digest, issued_at, expires_at, revoked
    INTO rec FROM public.certificates
    WHERE cert_id=upper(btrim(p_cert_id)) LIMIT 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('valid',false,'reason','NOT_FOUND');
  END IF;
  IF rec.revoked THEN
    RETURN jsonb_build_object('valid',false,'reason','REVOKED');
  END IF;
  IF rec.expires_at IS NOT NULL AND rec.expires_at <= now() THEN
    RETURN jsonb_build_object('valid',false,'reason','EXPIRED');
  END IF;
  -- Current issuer award creation derives the SHA-256 digest from stored
  -- certificate attributes (see issue_certificate). Never return valid=true
  -- if those stored attributes are missing or have been modified.
  IF rec.profile_id IS NULL OR rec.holder_name IS NULL OR
     rec.course_title IS NULL OR rec.scores IS NULL OR
     rec.overall_score IS NULL OR rec.salt IS NULL OR rec.digest IS NULL THEN
    RETURN jsonb_build_object('valid',false,'reason','INTEGRITY_UNVERIFIED');
  END IF;
  expected_digest := pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(
    rec.profile_id::text || '|' || rec.cert_id || '|' ||
    pg_catalog.btrim(rec.holder_name) || '|' ||
    pg_catalog.btrim(rec.course_title) || '|' ||
    rec.scores::text || '|' || rec.overall_score::text || '|' || rec.salt,
    'UTF8')), 'hex');
  IF rec.digest IS DISTINCT FROM expected_digest THEN
    RETURN jsonb_build_object('valid',false,'reason','INTEGRITY_FAILURE');
  END IF;
  RETURN jsonb_build_object('valid',true,'cert_id',rec.cert_id,
    'name',rec.holder_name,'course',rec.course_title,
    'issued_at',rec.issued_at,'expires_at',rec.expires_at);
END;
$fn$;
-- No GRANT changes. Public visibility of name/course still requires privacy approval.
