\set ON_ERROR_STOP on
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',false);
DO $$DECLARE r jsonb;a jsonb;b jsonb;m text;n int;idx int:=0;course text:='VICE4X Sovereign Trading & Wealth Architecture — Core Program (Modules I–VII)';BEGIN
 BEGIN
  PERFORM public.issue_certificate('Synthetic Student',course,'{}',100,'fake','fake');
  RAISE EXCEPTION 'FAIL certificate issued without chapter completion';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'Record completion%' THEN RAISE; END IF;END;
 BEGIN
  INSERT INTO public.academy_progress(profile_id,module,chapter) VALUES(auth.uid(),'I',1);
  RAISE EXCEPTION 'FAIL direct progress write accepted';
 EXCEPTION WHEN insufficient_privilege THEN NULL;END;
 BEGIN
  PERFORM public.mark_academy_chapter('II',1);
  RAISE EXCEPTION 'FAIL invalid chapter accepted';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'Invalid module/chapter' THEN RAISE;END IF;END;
 a:=public.mark_academy_chapter('I',1);b:=public.mark_academy_chapter('I',1);
 IF a IS DISTINCT FROM b THEN RAISE EXCEPTION 'FAIL chapter retry changed receipt';END IF;
 FOREACH m IN ARRAY ARRAY['I','II','III','IV','V','VI','VII'] LOOP
  idx:=idx+1;FOR n IN (idx*3-2)..(idx*3) LOOP PERFORM public.mark_academy_chapter(m,n);END LOOP;
 END LOOP;
 IF (SELECT count(*) FROM public.academy_progress)<>21 THEN RAISE EXCEPTION 'FAIL progress not persisted';END IF;
 a:=public.issue_certificate('Synthetic Student',course,'{"I":100}',100,'fake','fake');
 b:=public.issue_certificate('Synthetic Student',course,'{}',1,'fake','fake');
 IF a->>'cert_id' IS DISTINCT FROM b->>'cert_id' THEN RAISE EXCEPTION 'FAIL duplicate certificate';END IF;
 IF a->>'overall_score'<>'75' THEN RAISE EXCEPTION 'FAIL caller score trusted';END IF;
 BEGIN
  PERFORM public.issue_certificate('Synthetic Student','Unapproved degree','{}',100,'fake','fake');
  RAISE EXCEPTION 'FAIL arbitrary course title accepted';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'Unknown certificate course' THEN RAISE;END IF;END;
END$$;
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',false);
DO $$BEGIN
 IF (SELECT count(*) FROM public.academy_progress)<>0 THEN RAISE EXCEPTION 'FAIL other member reading disclosed';END IF;
END$$;
RESET ROLE;
DO $$BEGIN
 IF (SELECT count(*) FROM public.certificates)<>1 THEN RAISE EXCEPTION 'FAIL certificate count';END IF;
 RAISE NOTICE 'PASS academy owner RLS, chapter validation, persisted receipts, completion gate, authoritative scores and duplicate award prevention';
END$$;
