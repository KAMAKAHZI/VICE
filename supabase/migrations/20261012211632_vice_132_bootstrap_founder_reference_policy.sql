BEGIN;
CREATE TABLE IF NOT EXISTS public.vice_dao_config (
 id smallint PRIMARY KEY DEFAULT 1 CHECK (id=1),
 vice_price numeric(24,4) NOT NULL DEFAULT 2 CHECK (vice_price>=0),
 v4x_price numeric(24,4) NOT NULL DEFAULT 320 CHECK (v4x_price>=0),
 total_vice bigint NOT NULL DEFAULT 10000000 CHECK(total_vice=10000000),
 total_v4x bigint NOT NULL DEFAULT 10000000 CHECK(total_v4x=10000000),
 estate_vice bigint NOT NULL DEFAULT 7500000 CHECK(estate_vice=7500000),
 estate_v4x bigint NOT NULL DEFAULT 7500000 CHECK(estate_v4x=7500000),
 holder_vice bigint NOT NULL DEFAULT 2500000 CHECK(holder_vice=2500000),
 holder_v4x bigint NOT NULL DEFAULT 2500000 CHECK(holder_v4x=2500000),
 updated_by uuid REFERENCES auth.users(id),
 updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.vice_dao_config(id,vice_price,v4x_price)
 VALUES (1,2,320) ON CONFLICT(id) DO NOTHING;
DO $ensure$
DECLARE v public.vice_dao_config%ROWTYPE;
BEGIN
 SELECT * INTO v FROM public.vice_dao_config WHERE id=1;
 IF NOT FOUND OR v.vice_price<>2 OR v.v4x_price<>320 THEN
  RAISE EXCEPTION 'Existing management price policy conflicts with 2/320. Stop and reconcile.';
 END IF;
END $ensure$;
CREATE TABLE IF NOT EXISTS public.vice_reference_price_policy_history (
 policy_id text PRIMARY KEY,
 reference_vice numeric(24,4) NOT NULL,
 reference_v4x numeric(24,4) NOT NULL,
 relationship text NOT NULL,
 effective_date date NOT NULL,
 recorded_at timestamptz NOT NULL DEFAULT now(),
 provenance text NOT NULL,
 valuation_disclaimer text NOT NULL
);
INSERT INTO public.vice_reference_price_policy_history(
 policy_id,reference_vice,reference_v4x,relationship,effective_date,
 provenance,valuation_disclaimer)
VALUES (
 'VICE-IRU-REFERENCE-2026-10-12-R160',2,320,'VICE:V4X=1:160',
 DATE '2026-10-12',
 'Founder-supplied current management reference directive; not external verification',
 'Issuer reference arithmetic only, not FMV, market capitalization, equity, cash, or lender collateral value'
) ON CONFLICT(policy_id) DO NOTHING;
ALTER TABLE public.vice_dao_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vice_reference_price_policy_history ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.vice_dao_config FROM PUBLIC,anon,authenticated;
REVOKE ALL ON public.vice_reference_price_policy_history FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.vice_dao_config TO authenticated;
GRANT SELECT ON public.vice_reference_price_policy_history TO authenticated;
DROP POLICY IF EXISTS vice_dao_config_member_read ON public.vice_dao_config;
CREATE POLICY vice_dao_config_member_read
 ON public.vice_dao_config FOR SELECT TO authenticated
 USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS vice_reference_policy_member_read
 ON public.vice_reference_price_policy_history;
CREATE POLICY vice_reference_policy_member_read
 ON public.vice_reference_price_policy_history FOR SELECT TO authenticated
 USING (auth.uid() IS NOT NULL);
COMMIT;
