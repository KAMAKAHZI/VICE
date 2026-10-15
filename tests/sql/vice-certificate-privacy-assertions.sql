\set ON_ERROR_STOP on
SET ROLE anon;
SELECT set_config('request.jwt.claim.sub','',false);
DO $$DECLARE r jsonb;BEGIN
 r:=public.verify_token_certificate('VCT-AAAA-BBBB-CCCC-DDDD');
 IF r->>'valid'<>'true' OR r->>'private_details'<>'false' THEN RAISE EXCEPTION 'FAIL valid status missing';END IF;
 IF r-ARRAY['valid','cert_id','kind','program','issued_at','digest','private_details']<>'{}'::jsonb
  OR r::text LIKE '%CONFIDENTIAL%' OR r::text LIKE '%999999%' THEN RAISE EXCEPTION 'FAIL public private-data leak';END IF;
 r:=public.verify_token_certificate('VCT-AAAA-BBBB-CCCC-EEEE');
 IF r->>'reason'<>'REVOKED' OR r ? 'revoked_reason' OR r::text LIKE '%CONFIDENTIAL%' THEN RAISE EXCEPTION 'FAIL internal revocation narrative exposed';END IF;
 IF public.verify_token_certificate('VCT-AAAA-BBBB-CCCC-FFFF')->>'reason'<>'INTEGRITY_FAILURE' THEN RAISE EXCEPTION 'FAIL tampered certificate accepted';END IF;
 IF public.verify_token_certificate('VCT-0000-0000-0000-0000')->>'reason'<>'NOT_FOUND' THEN RAISE EXCEPTION 'FAIL missing certificate accepted';END IF;
 IF public.verify_token_certificate('bad')->>'reason'<>'INVALID_ID' THEN RAISE EXCEPTION 'FAIL invalid ID accepted';END IF;
 RAISE NOTICE 'PASS public verification status, integrity and privacy';
END$$;
RESET ROLE;
