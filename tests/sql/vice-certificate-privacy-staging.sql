\set ON_ERROR_STOP on
-- Extends only the disposable financial fixture, never production.
ALTER TABLE public.token_certificates ADD kind text,ADD program text,ADD issued_at timestamptz DEFAULT now(),ADD digest text,ADD holder_name text,ADD holdings_snapshot jsonb;
CREATE FUNCTION public.token_cert_digest(public.token_certificates) RETURNS text LANGUAGE sql STABLE AS $$SELECT 'fixture-valid-digest'::text$$;
INSERT INTO public.token_certificates(cert_id,kind,program,digest,holder_name,holdings_snapshot,revoked,revoked_reason) VALUES
 ('VCT-AAAA-BBBB-CCCC-DDDD','ISSUANCE','VICE','fixture-valid-digest','CONFIDENTIAL NAME','{"units":999999}',false,NULL),
 ('VCT-AAAA-BBBB-CCCC-EEEE','ISSUANCE','VICE','fixture-valid-digest','CONFIDENTIAL NAME','{"units":999999}',true,'CONFIDENTIAL CORRECTION NARRATIVE'),
 ('VCT-AAAA-BBBB-CCCC-FFFF','ISSUANCE','VICE','tampered','CONFIDENTIAL NAME','{"units":999999}',false,NULL);
