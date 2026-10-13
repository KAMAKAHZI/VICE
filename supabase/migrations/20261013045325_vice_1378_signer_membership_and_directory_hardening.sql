-- VICE OS controlled release: provisioned membership and document signing grants.
-- No existing holder, document, certificate, or financial data is changed.
CREATE OR REPLACE FUNCTION public.list_member_directory()
 RETURNS TABLE(id uuid, name text, role text, avatar_initials text, vip_access boolean)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
 AS $fn$
 SELECT p.id,p.name,p.role,p.avatar_initials,p.vip_access
 FROM public.profiles p
 WHERE EXISTS (
   SELECT 1 FROM public.profiles me WHERE me.id=(SELECT auth.uid())
 )
 ORDER BY p.name LIMIT 250
 $fn$;
REVOKE ALL ON FUNCTION public.list_member_directory() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.list_member_directory() TO authenticated;

CREATE OR REPLACE FUNCTION public.submit_academy_quiz(p_module text,p_answers integer[])
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
 SET search_path TO 'pg_catalog','extensions','public'
 AS $fn$
DECLARE k int[]; i int; n int:=0; score int; v_uid uuid;
BEGIN
 v_uid:=auth.uid();
 IF v_uid IS NULL OR NOT EXISTS(
   SELECT 1 FROM public.profiles pr WHERE pr.id=v_uid
 ) THEN RAISE EXCEPTION 'Provisioned VICE membership required' USING ERRCODE='42501'; END IF;
 SELECT answers INTO k FROM public.academy_answer_keys WHERE module=p_module;
 IF k IS NULL OR array_length(p_answers,1) IS DISTINCT FROM 4
    OR array_length(k,1) IS DISTINCT FROM 4 THEN
   RAISE EXCEPTION 'Invalid module or answers' USING ERRCODE='22023';
 END IF;
 FOR i IN 1..4 LOOP
  IF p_answers[i] IS NULL OR p_answers[i] NOT BETWEEN 0 AND 3 THEN
   RAISE EXCEPTION 'Invalid answer' USING ERRCODE='22023';
  END IF;
  IF p_answers[i]=k[i] THEN n:=n+1; END IF;
 END LOOP;
 score:=n*25;
 INSERT INTO public.academy_attempts(profile_id,module,correct,total,score,passed)
 VALUES(v_uid,p_module,n,4,score,score>=75);
 RETURN jsonb_build_object('module',p_module,'correct',n,'total',4,
   'score',score,'passed',score>=75);
END $fn$;
REVOKE ALL ON FUNCTION public.submit_academy_quiz(text,integer[]) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.submit_academy_quiz(text,integer[]) TO authenticated;

CREATE OR REPLACE FUNCTION public.sign_document(
  p_document_id uuid,p_typed_name text,p_consent boolean
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
 SET search_path TO ''
AS $fn$
DECLARE d public.documents%ROWTYPE; p public.profiles%ROWTYPE;
        v_uid uuid;v_sig uuid;v_assigned boolean:=false;
BEGIN
 v_uid:=auth.uid();
 IF v_uid IS NULL OR p_consent IS DISTINCT FROM TRUE THEN
   RAISE EXCEPTION 'Authenticated explicit signature consent required' USING ERRCODE='42501';
 END IF;
 SELECT * INTO p FROM public.profiles WHERE id=v_uid;
 IF NOT FOUND OR nullif(trim(p.name),'') IS NULL THEN
   RAISE EXCEPTION 'Provisioned signer identity required' USING ERRCODE='42501';
 END IF;
 IF length(trim(coalesce(p_typed_name,''))) NOT BETWEEN 2 AND 120
   OR lower(trim(p_typed_name)) IS DISTINCT FROM lower(trim(p.name)) THEN
   RAISE EXCEPTION 'Typed name must match the verified VICE profile' USING ERRCODE='42501';
 END IF;
 SELECT * INTO d FROM public.documents
 WHERE id=p_document_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Document is unavailable' USING ERRCODE='42501'; END IF;
 -- An assigned client can sign only when the document explicitly matches
 -- their client identity and any specified holder row belongs to them.
 v_assigned := (
   d.holder_client_id IS NOT NULL
   AND p.client_id IS NOT NULL
   AND d.holder_client_id=p.client_id
   AND (d.holder_id IS NULL OR EXISTS (
     SELECT 1 FROM public.holders h
     WHERE h.id=d.holder_id
       AND (h.user_id=v_uid OR h.profile_id=v_uid)
   ))
 ) OR (
   d.holder_id IS NOT NULL
   AND d.holder_client_id IS NULL
   AND EXISTS (
     SELECT 1 FROM public.holders h
     WHERE h.id=d.holder_id
       AND (h.user_id=v_uid OR h.profile_id=v_uid)
   )
 ) OR (
   d.holder_client_id IS NULL
   AND d.holder_id IS NULL
   AND d.uploaded_by=v_uid::text
 );
 IF NOT v_assigned THEN RAISE EXCEPTION 'Document is not assigned to this signer' USING ERRCODE='42501'; END IF;
 IF d.signed IS TRUE THEN RAISE EXCEPTION 'Document already signed'; END IF;
 IF d.sha256 IS NULL OR d.sha256 !~ '^[a-f0-9]{64}$' THEN
   RAISE EXCEPTION 'Document digest missing or invalid' USING ERRCODE='22023';
 END IF;
 INSERT INTO public.signatures(document_id,signed_by,signature_data)
 VALUES (d.id,v_uid,
   jsonb_build_object('typed_name',trim(p.name),'sha256',d.sha256,
    'statement','I consent to electronically sign this identified document',
    'method','typed-name-attestation','signed_at',now()))
 RETURNING id INTO v_sig;
 UPDATE public.documents SET signed=true,signed_at=now(),signed_by=v_uid
 WHERE id=d.id;
 RETURN jsonb_build_object('signed',true,'signature_id',v_sig,'document_id',d.id);
END $fn$;
REVOKE ALL ON FUNCTION public.sign_document(uuid,text,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.sign_document(uuid,text,boolean) TO authenticated;
