-- VICE OS 1.3.6.10: no implicit null=missing member identity for signing;
-- directory and quiz functions require server-provisioned member profiles.
CREATE OR REPLACE FUNCTION public.sign_document(
 p_document_id uuid,p_typed_name text,p_consent boolean
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE d public.documents%ROWTYPE; p public.profiles%ROWTYPE; sig uuid;
BEGIN
 IF auth.uid() IS NULL OR p_consent IS DISTINCT FROM true THEN
   RAISE EXCEPTION 'Authenticated explicit consent required' USING ERRCODE='42501';
 END IF;
 SELECT * INTO p FROM public.profiles WHERE id=auth.uid();
 IF NOT FOUND OR length(trim(coalesce(p.name,'')))<2 THEN
   RAISE EXCEPTION 'Provisioned member identity required' USING ERRCODE='42501';
 END IF;
 IF p_document_id IS NULL THEN RAISE EXCEPTION 'Document identity required'; END IF;
 SELECT * INTO d FROM public.documents WHERE id=p_document_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Document is unavailable'; END IF;
 -- No privilege to sign another holder's document merely for being staff
 -- (COMPLIANCE_OFFICER / AUDITOR / EXECUTIVE etc.).
 IF NOT public.is_super() AND NOT (
   (p.client_id IS NOT NULL AND d.holder_client_id=p.client_id)
   OR (d.holder_client_id IS NULL AND d.uploaded_by=auth.uid()::text)
 ) THEN
   RAISE EXCEPTION 'Document is not assigned to this signatory' USING ERRCODE='42501';
 END IF;
 IF d.signed IS TRUE THEN RAISE EXCEPTION 'Document already signed'; END IF;
 IF d.sha256 IS NULL OR d.sha256 !~ '^[a-f0-9]{64}$' THEN
   RAISE EXCEPTION 'Valid original SHA-256 digest required';
 END IF;
 IF length(trim(coalesce(p_typed_name,''))) NOT BETWEEN 2 AND 160
    OR lower(trim(p_typed_name))<>lower(trim(p.name)) THEN
   RAISE EXCEPTION 'Typed name must match the provisioned member profile';
 END IF;
 INSERT INTO public.signatures(document_id,signed_by,signature_data)
 VALUES(d.id,auth.uid(),
  jsonb_build_object('typed_name',p.name,'sha256',d.sha256,
    'statement','I consent to electronically sign this identified document',
    'method','typed-name-attestation','signed_at',now()))
 RETURNING id INTO sig;
 UPDATE public.documents SET signed=true,signed_at=now(),signed_by=auth.uid()
 WHERE id=d.id;
 INSERT INTO public.audit_log(event_type,action,object_type,object_id,
   actor_id,actor_role,outcome,correlation_id)
 VALUES ('DOCUMENT_SIGNATURE','SIGNATURE_RECORDED','documents',d.id::text,
   auth.uid()::text,p.role,'SUCCESS',pg_catalog.gen_random_uuid()::text);
 RETURN jsonb_build_object('signed',true,'signature_id',sig,'document_id',d.id,
   'method','TYPED_NAME_ATTESTATION','onchain_signed',false);
END $fn$;

CREATE OR REPLACE FUNCTION public.list_member_directory()
RETURNS TABLE(id uuid,name text,role text,avatar_initials text,vip_access boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $fn$
 SELECT p.id,p.name,p.role,p.avatar_initials,p.vip_access
 FROM public.profiles p
 WHERE auth.uid() IS NOT NULL
   AND EXISTS (SELECT 1 FROM public.profiles member WHERE member.id=auth.uid())
 ORDER BY p.name LIMIT 250
$fn$;

CREATE OR REPLACE FUNCTION public.submit_academy_quiz(
 p_module text,p_answers integer[]
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'pg_catalog','extensions','public' AS $fn$
DECLARE k int[]; i int; n int:=0; score int;
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS
    (SELECT 1 FROM public.profiles WHERE id=auth.uid()) THEN
   RAISE EXCEPTION 'Provisioned member required to submit exams' USING ERRCODE='42501';
 END IF;
 SELECT answers INTO k FROM public.academy_answer_keys WHERE module=p_module;
 IF k IS NULL OR array_length(p_answers,1)<>4 OR array_length(k,1)<>4
 THEN RAISE EXCEPTION 'Invalid module or answers'; END IF;
 FOR i IN 1..4 LOOP
  IF p_answers[i] IS NULL OR p_answers[i] NOT BETWEEN 0 AND 3 THEN
   RAISE EXCEPTION 'Invalid answer';
  END IF;
  IF p_answers[i]=k[i] THEN n:=n+1; END IF;
 END LOOP;
 score:=n*25;
 INSERT INTO public.academy_attempts(profile_id,module,correct,total,score,passed)
 VALUES(auth.uid(),p_module,n,4,score,score>=75);
 RETURN jsonb_build_object('module',p_module,'correct',n,'total',4,
  'score',score,'passed',score>=75);
END $fn$;
-- Service-specific RPC grants only; browsers still cannot read answer keys.
REVOKE ALL ON FUNCTION public.sign_document(uuid,text,boolean) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.list_member_directory() FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.submit_academy_quiz(text,integer[]) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.sign_document(uuid,text,boolean),
 public.list_member_directory(),
 public.submit_academy_quiz(text,integer[]) TO authenticated;
