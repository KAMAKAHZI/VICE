-- VICE executive signing device registry, additive and fail-closed.
-- This migration does not activate new signing methods or reset enrolled keys.
CREATE TABLE IF NOT EXISTS public.vice_exec_devices (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 role text NOT NULL REFERENCES public.vice_exec_signers(role),
 user_id uuid NOT NULL,
 public_key jsonb NOT NULL,
 fingerprint text NOT NULL,
 device_label text NOT NULL DEFAULT 'Executive device',
 enrolled_at timestamptz NOT NULL DEFAULT now(),
 revoked_at timestamptz,
 legacy boolean NOT NULL DEFAULT false,
 authorized_by uuid REFERENCES public.vice_exec_devices(id),
 CHECK (public_key->>'kty'='EC' AND public_key->>'crv'='P-256' AND NOT(public_key ? 'd')),
 UNIQUE(role,fingerprint)
);
CREATE INDEX IF NOT EXISTS vice_exec_devices_user_idx ON public.vice_exec_devices(user_id);
ALTER TABLE public.vice_exec_devices ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.vice_exec_devices FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.vice_exec_devices TO authenticated;
CREATE POLICY vice_exec_devices_owner_read ON public.vice_exec_devices
 FOR SELECT TO authenticated USING (user_id=(SELECT auth.uid()) AND (SELECT public.vice_institutional_access()));
INSERT INTO public.vice_exec_devices(role,user_id,public_key,fingerprint,legacy,device_label)
SELECT role,user_id,public_key,encode(extensions.digest(convert_to(public_key::text,'UTF8'),'sha256'),'hex'),true,'Original enrolled key'
FROM public.vice_exec_signers WHERE public_key IS NOT NULL
ON CONFLICT(role,fingerprint) DO NOTHING;
