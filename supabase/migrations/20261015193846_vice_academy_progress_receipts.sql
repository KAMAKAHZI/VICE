CREATE TABLE IF NOT EXISTS public.academy_progress (
 profile_id uuid NOT NULL REFERENCES public.profiles(id),
 module text NOT NULL,chapter integer NOT NULL,completed_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(profile_id,module,chapter),
 CHECK (array_position(ARRAY['I','II','III','IV','V','VI','VII','VIII','IX'],module) IS NOT NULL
  AND chapter BETWEEN 3*array_position(ARRAY['I','II','III','IV','V','VI','VII','VIII','IX'],module)-2
  AND 3*array_position(ARRAY['I','II','III','IV','V','VI','VII','VIII','IX'],module))
);
ALTER TABLE public.academy_progress ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.academy_progress FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.academy_progress TO authenticated;
DROP POLICY IF EXISTS academy_progress_owner_read ON public.academy_progress;
CREATE POLICY academy_progress_owner_read ON public.academy_progress FOR SELECT TO authenticated
 USING(profile_id=(SELECT auth.uid()));
CREATE OR REPLACE FUNCTION public.mark_academy_chapter(p_module text,p_chapter integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE uid uuid:=auth.uid();completed timestamptz;module_index integer;
BEGIN
 IF uid IS NULL OR NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=uid)
 THEN RAISE EXCEPTION 'Provisioned member required' USING ERRCODE='42501';END IF;
 module_index:=array_position(ARRAY['I','II','III','IV','V','VI','VII','VIII','IX'],p_module);
 IF module_index IS NULL OR p_chapter IS NULL OR p_chapter NOT BETWEEN module_index*3-2 AND module_index*3
 THEN RAISE EXCEPTION 'Invalid module/chapter';END IF;
 INSERT INTO public.academy_progress(profile_id,module,chapter)
 VALUES(uid,p_module,p_chapter) ON CONFLICT(profile_id,module,chapter) DO NOTHING
 RETURNING completed_at INTO completed;
 IF completed IS NULL THEN SELECT completed_at INTO completed FROM public.academy_progress
  WHERE profile_id=uid AND module=p_module AND chapter=p_chapter;END IF;
 RETURN jsonb_build_object('module',p_module,'chapter',p_chapter,'completed_at',completed);
END $$;
REVOKE ALL ON FUNCTION public.mark_academy_chapter(text,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.mark_academy_chapter(text,integer) TO authenticated;

-- Server-side award verification. Browser scores/digests are untrusted.
CREATE OR REPLACE FUNCTION public.issue_certificate(
 p_name text, p_course_title text, p_scores jsonb,
 p_overall integer, p_digest text, p_salt text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
 v_uid uuid; v_name text; v_email text; v_required integer; v_passed integer;
 v_scores jsonb; v_overall integer; v_cert_id text; v_salt text; v_digest text;
 v_record public.certificates%ROWTYPE;
BEGIN
 v_uid := auth.uid();
 IF v_uid IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='28000'; END IF;
 IF length(trim(coalesce(p_name,''))) NOT BETWEEN 2 AND 120
    OR length(trim(coalesce(p_course_title,''))) NOT BETWEEN 3 AND 200 THEN
    RAISE EXCEPTION 'Invalid award details';
 END IF;
 SELECT p.name,p.email INTO v_name,v_email FROM public.profiles p WHERE p.id=v_uid;
 IF NOT FOUND THEN RAISE EXCEPTION 'Provisioned VICE profile required'; END IF;
 IF lower(trim(p_name)) IS DISTINCT FROM lower(trim(v_name))
 THEN RAISE EXCEPTION 'Certificate name must match member profile'; END IF;

 -- This RPC certifies only the established core program, not arbitrary caller titles.
 IF trim(p_course_title) <> 'VICE4X Sovereign Trading & Wealth Architecture — Core Program (Modules I–VII)'
 THEN RAISE EXCEPTION 'Unknown certificate course'; END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('vice-academy:'||v_uid::text,0));
 SELECT * INTO v_record FROM public.certificates
  WHERE profile_id=v_uid AND course_title=trim(p_course_title) AND revoked=false AND (expires_at IS NULL OR expires_at>now())
  ORDER BY issued_at LIMIT 1;
 IF FOUND THEN
  RETURN jsonb_build_object('cert_id',v_record.cert_id,'name',v_record.holder_name,
   'course',v_record.course_title,'issued_at',v_record.issued_at,
   'overall_score',v_record.overall_score,'digest',v_record.digest,'scores',v_record.scores);
 END IF;
 IF (SELECT count(*) FROM public.academy_progress WHERE profile_id=v_uid
  AND module IN ('I','II','III','IV','V','VI','VII'))<>21
 THEN RAISE EXCEPTION 'Record completion of all 21 core chapters first'; END IF;

 -- Seven courses must each have an independently graded passing attempt.
 WITH scores AS (
   SELECT k.module, max(a.score) AS score
   FROM public.academy_answer_keys k
   LEFT JOIN public.academy_attempts a
     ON a.module=k.module AND a.profile_id=v_uid AND a.passed IS TRUE AND a.score>=75
   GROUP BY k.module
 )
 SELECT count(*)::integer,count(score)::integer,
        jsonb_object_agg(module,score ORDER BY module),
        round(avg(score))::integer
 INTO v_required,v_passed,v_scores,v_overall
 FROM scores;
 IF v_required <> 7 OR v_passed <> 7 OR v_overall < 75 THEN
   RAISE EXCEPTION 'Pass all seven server-graded academy modules to receive a certificate';
 END IF;
 -- Do not use any caller-submitted scores, percentages, hashes or salts.
 v_cert_id := 'VCA-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,4)) || '-' ||
                        upper(substr(replace(gen_random_uuid()::text,'-',''),1,4)) || '-' ||
                        upper(substr(replace(gen_random_uuid()::text,'-',''),1,4)) || '-' ||
                        upper(substr(replace(gen_random_uuid()::text,'-',''),1,4));
 v_salt := gen_random_uuid()::text;
 v_digest := encode(sha256(convert_to(
   v_uid::text||'|'||v_cert_id||'|'||trim(p_name)||'|'||
   trim(p_course_title)||'|'||v_scores::text||'|'||v_overall::text||'|'||v_salt,
   'UTF8')),'hex');

 INSERT INTO public.certificates(
   cert_id,profile_id,holder_name,holder_email,course_title,scores,overall_score,digest,salt
 ) VALUES(v_cert_id,v_uid,trim(p_name),v_email,trim(p_course_title),v_scores,v_overall,v_digest,v_salt)
 RETURNING * INTO v_record;

 RETURN jsonb_build_object('cert_id',v_record.cert_id,'name',v_record.holder_name,
   'course',v_record.course_title,'issued_at',v_record.issued_at,
   'overall_score',v_record.overall_score,'digest',v_record.digest,'scores',v_record.scores);
END;
$$;
REVOKE ALL ON FUNCTION public.issue_certificate(text,text,jsonb,integer,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.issue_certificate(text,text,jsonb,integer,text,text) TO authenticated;
