\set ON_ERROR_STOP on
DO $$BEGIN
 IF NOT has_function_privilege('anon','public.verify_certificate(text)','EXECUTE') THEN
   RAISE EXCEPTION 'Public verifier unexpectedly unavailable';
 END IF;
END$$;
SET ROLE anon;
DO $$
DECLARE r jsonb;
BEGIN
 r:=public.verify_certificate('vca-0001-0002-0003-0004');
 IF r->>'valid' IS DISTINCT FROM 'true'
   OR r->>'course' NOT LIKE 'VICE4X%'
   OR r ? 'scores' OR r ? 'overall_score' OR r ? 'digest'
   OR r ? 'salt' OR r ? 'profile_id' OR r ? 'holder_email'
   OR r::text LIKE '%synthetic-test-only-salt%' OR r::text LIKE '%"I":80%'
 THEN RAISE EXCEPTION 'Valid certificate failed redacted response: %',r; END IF;
 r:=public.verify_certificate('VCA-0001-0002-0003-0005');
 IF r->>'reason' IS DISTINCT FROM 'INTEGRITY_FAILURE' OR r->>'valid' IS DISTINCT FROM 'false'
 THEN RAISE EXCEPTION 'Tampered digest accepted: %',r; END IF;
 r:=public.verify_certificate('VCA-0001-0002-0003-0006');
 IF r->>'reason' IS DISTINCT FROM 'EXPIRED'
 THEN RAISE EXCEPTION 'Expired certificate accepted: %',r; END IF;
 r:=public.verify_certificate('VCA-0001-0002-0003-0007');
 IF r->>'reason' IS DISTINCT FROM 'REVOKED'
 THEN RAISE EXCEPTION 'Revoked certificate accepted: %',r; END IF;
 r:=public.verify_certificate('VCA-0001-0002-0003-0008');
 IF r->>'reason' IS DISTINCT FROM 'INTEGRITY_UNVERIFIED'
 THEN RAISE EXCEPTION 'Legacy certificate without salt was accepted: %',r; END IF;
 r:=public.verify_certificate('VCA-0001-0002-0003-0009');
 IF r->>'reason' IS DISTINCT FROM 'INTEGRITY_FAILURE'
 THEN RAISE EXCEPTION 'Modified academy scores were accepted: %',r; END IF;
 r:=public.verify_certificate('VCA-0001-0002-0003-0010');
 IF r->>'reason' IS DISTINCT FROM 'NOT_FOUND'
 THEN RAISE EXCEPTION 'Missing certificate accepted: %',r; END IF;
 r:=public.verify_certificate('   ');
 IF r->>'reason' IS DISTINCT FROM 'INVALID_ID'
 THEN RAISE EXCEPTION 'Blank certificate ID accepted: %',r; END IF;
 IF r ? 'name' OR r ? 'scores' THEN
   RAISE EXCEPTION 'Invalid certificate response leaked private information';
 END IF;
 RAISE NOTICE 'PASS: public certificate privacy, validity, integrity, expiry, revocation, legacy rejection';
END $$;
RESET ROLE;
