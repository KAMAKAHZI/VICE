\set ON_ERROR_STOP on
-- Disposable PostgreSQL only; run after Academy fixture/migration.
-- Tests public certificate minimization against an issuer-aligned digest.
CREATE OR REPLACE FUNCTION public.verify_certificate(p_cert_id text)
RETURNS jsonb LANGUAGE sql STABLE AS $$
  SELECT jsonb_build_object('valid',false,'reason','FIXTURE_BASELINE')
$$;
GRANT EXECUTE ON FUNCTION public.verify_certificate(text) TO anon,authenticated;
WITH samples AS (
 SELECT
  '00000000-0000-4000-8000-000000000001'::uuid AS profile_id,
  'Synthetic Academy Holder'::text AS holder_name,
  'VICE4X Sovereign Trading & Wealth Architecture — Core Program (Modules I–VII)'::text AS course_title,
  '{"I":80,"II":90}'::jsonb AS scores,
  85::integer AS overall_score,
  'synthetic-test-only-salt'::text AS salt
), ids(cert_id) AS (
 VALUES
 ('VCA-0001-0002-0003-0004'),
 ('VCA-0001-0002-0003-0005'),
 ('VCA-0001-0002-0003-0006'),
 ('VCA-0001-0002-0003-0007'),
 ('VCA-0001-0002-0003-0008'),
 ('VCA-0001-0002-0003-0009')
)
INSERT INTO public.certificates
 (cert_id,profile_id,holder_name,course_title,scores,overall_score,salt,digest,expires_at,revoked)
SELECT ids.cert_id, s.profile_id, s.holder_name, s.course_title, s.scores,
 s.overall_score, s.salt,
 encode(sha256(convert_to(
  s.profile_id::text || '|' || ids.cert_id || '|' || s.holder_name || '|' ||
  s.course_title || '|' || s.scores::text || '|' || s.overall_score::text || '|' || s.salt,
  'UTF8')), 'hex'),
 CASE WHEN ids.cert_id LIKE '%0006' THEN now() - interval '1 minute' ELSE NULL END,
 ids.cert_id LIKE '%0007'
FROM ids CROSS JOIN samples s;
-- Staging-only negative vectors: changed digest, missing legacy digest inputs,
-- and altered certificate scores after issuance.
UPDATE public.certificates SET digest='synthetic-invalid-digest'
 WHERE cert_id='VCA-0001-0002-0003-0005';
UPDATE public.certificates SET salt=NULL
 WHERE cert_id='VCA-0001-0002-0003-0008';
UPDATE public.certificates SET scores='{"I":100,"II":100}'::jsonb
 WHERE cert_id='VCA-0001-0002-0003-0009';
