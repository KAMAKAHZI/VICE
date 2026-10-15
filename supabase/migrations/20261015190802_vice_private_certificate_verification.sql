-- Public verification must never disclose a holder's identity, holdings,
-- valuation snapshot, source event or internal revocation narrative.
CREATE OR REPLACE FUNCTION public.verify_token_certificate(p_cert_id text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE c public.token_certificates%ROWTYPE;
BEGIN
 IF p_cert_id IS NULL OR length(p_cert_id)>40
  OR upper(trim(p_cert_id)) !~ '^VCT-[A-F0-9]{4}(-[A-F0-9]{4}){3}$'
 THEN RETURN jsonb_build_object('valid',false,'reason','INVALID_ID'); END IF;
 SELECT * INTO c FROM public.token_certificates WHERE cert_id=upper(trim(p_cert_id));
 IF NOT FOUND THEN RETURN jsonb_build_object('valid',false,'reason','NOT_FOUND'); END IF;
 IF c.revoked THEN RETURN jsonb_build_object('valid',false,'reason','REVOKED',
  'revoked_at',c.revoked_at); END IF;
 IF c.digest IS DISTINCT FROM public.token_cert_digest(c)
 THEN RETURN jsonb_build_object('valid',false,'reason','INTEGRITY_FAILURE'); END IF;
 RETURN jsonb_build_object('valid',true,'cert_id',c.cert_id,'kind',c.kind,
  'program',c.program,'issued_at',c.issued_at,'digest',c.digest,'private_details',false);
END $$;
REVOKE ALL ON FUNCTION public.verify_token_certificate(text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.verify_token_certificate(text) TO anon,authenticated;
