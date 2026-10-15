\set ON_ERROR_STOP on
SELECT set_config('request.jwt.claim.sub','',false);
DO $$BEGIN
 BEGIN
  PERFORM vice_private.reverse_strategic_issuance(1,'00000000-0000-4000-8000-000000000001','V4X',51000,'Synthetic review mismatch test');
  RAISE EXCEPTION 'FAIL wrong program accepted';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'Source issuance does not match%' THEN RAISE; END IF;END;
 BEGIN
  PERFORM vice_private.reverse_strategic_issuance(1,'00000000-0000-4000-8000-000000000002','VICE',51000,'Synthetic review mismatch test');
  RAISE EXCEPTION 'FAIL wrong holder accepted';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'Source issuance does not match%' THEN RAISE; END IF;END;
 BEGIN
  PERFORM vice_private.reverse_strategic_issuance(1,'00000000-0000-4000-8000-000000000001','VICE',50000,'Synthetic review mismatch test');
  RAISE EXCEPTION 'FAIL wrong quantity accepted';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'Source issuance does not match%' THEN RAISE; END IF;END;
END$$;
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',false);
DO $$BEGIN
 BEGIN
  PERFORM vice_private.reverse_strategic_issuance(1,auth.uid(),'VICE',51000,'Synthetic unauthorized correction');
  RAISE EXCEPTION 'FAIL private function executable';
 EXCEPTION WHEN insufficient_privilege THEN NULL;END;
 BEGIN
  PERFORM public.reverse_strategic_issuance(1,auth.uid(),'VICE',51000,'Synthetic unauthorized correction');
  RAISE EXCEPTION 'FAIL non-issuer correction accepted';
 EXCEPTION WHEN insufficient_privilege THEN NULL;END;
END$$;
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','',false);
SELECT vice_private.reverse_strategic_issuance(1,'00000000-0000-4000-8000-000000000001','VICE',51000,'Synthetic reviewed operator correction');
DO $$DECLARE r jsonb;BEGIN
 r:=vice_private.reverse_strategic_issuance(1,'00000000-0000-4000-8000-000000000001','VICE',51000,'Synthetic idempotent retry correction');
 IF r->>'already_reversed'<>'true' THEN RAISE EXCEPTION 'FAIL replay not idempotent';END IF;
 IF (SELECT count(*) FROM public.iru_events WHERE event_type='UNITS_ISSUANCE_REVERSED')<>1 THEN RAISE EXCEPTION 'FAIL duplicate correction';END IF;
END$$;
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000003',false);
SELECT public.reverse_strategic_issuance(2,'00000000-0000-4000-8000-000000000001','V4X',51000,'Synthetic reviewed issuer correction');
RESET ROLE;
DO $$BEGIN
 IF EXISTS(SELECT 1 FROM public.holders WHERE id='00000000-0000-4000-8000-000000000001' AND (vice_units<>0 OR v4x_units<>0)) THEN RAISE EXCEPTION 'FAIL holder correction';END IF;
 IF EXISTS(SELECT 1 FROM public.holders WHERE id='00000000-0000-4000-8000-000000000002' AND (vice_units<>396500 OR v4x_units<>396500)) THEN RAISE EXCEPTION 'FAIL unrelated holder changed';END IF;
 IF EXISTS(SELECT 1 FROM public.iru_program_counters WHERE issued<>396500 OR retired<>0) THEN RAISE EXCEPTION 'FAIL counter reconciliation';END IF;
 IF EXISTS(SELECT 1 FROM public.vice_estate_reserve_accounts WHERE designated_units<>7500000 OR unassigned_units<>7500000 OR transferred_units<>0) THEN RAISE EXCEPTION 'FAIL reserve changed';END IF;
 IF (SELECT count(*) FROM public.iru_events WHERE event_type='UNITS_ISSUED')<>2 THEN RAISE EXCEPTION 'FAIL original events lost';END IF;
 IF (SELECT count(*) FROM public.token_certificates)<>2 OR EXISTS(SELECT 1 FROM public.token_certificates WHERE NOT revoked OR revoked_reason IS NULL) THEN RAISE EXCEPTION 'FAIL certificates not retained and revoked';END IF;
 IF (SELECT count(*) FROM public.audit_log)<>2 THEN RAISE EXCEPTION 'FAIL audit records missing';END IF;
 IF (SELECT count(*) FROM public.iru_events WHERE actor_role='DATABASE_OPERATOR' AND actor_id IS NULL)<>1 THEN RAISE EXCEPTION 'FAIL operator identity';END IF;
 IF (SELECT count(*) FROM public.iru_events WHERE actor_role='SUPER_ADMIN' AND actor_id='00000000-0000-4000-8000-000000000003')<>1 THEN RAISE EXCEPTION 'FAIL issuer identity';END IF;
 RAISE NOTICE 'PASS issuance reversal permissions, exact-match checks, replay, balances, certificates, audit and reserve';
END$$;
