BEGIN;
CREATE TABLE IF NOT EXISTS public.vice_iru_pool_policy (
 program text NOT NULL CHECK(program IN ('VICE','V4X')),
 allocation_source text NOT NULL CHECK(allocation_source IN ('ESTATE_RESERVE','STRATEGIC_POOL')),
 designated_capacity bigint NOT NULL CHECK(designated_capacity IN (7500000,2500000)),
 verification_status text NOT NULL DEFAULT 'NOT_CUSTODY_VERIFIED'
  CHECK(verification_status IN ('NOT_CUSTODY_VERIFIED','ISSUANCE_EVIDENCE_REVIEWED','CUSTODY_RECONCILED')),
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(program,allocation_source),
 CONSTRAINT vice_pool_capacity_match CHECK(
 (allocation_source='ESTATE_RESERVE' AND designated_capacity=7500000) OR
 (allocation_source='STRATEGIC_POOL' AND designated_capacity=2500000))
);
INSERT INTO public.vice_iru_pool_policy(program,allocation_source,designated_capacity)
VALUES ('VICE','ESTATE_RESERVE',7500000),('V4X','ESTATE_RESERVE',7500000),
('VICE','STRATEGIC_POOL',2500000),('V4X','STRATEGIC_POOL',2500000)
ON CONFLICT(program,allocation_source) DO NOTHING;
ALTER TABLE public.vice_iru_pool_policy ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.vice_iru_pool_policy FROM PUBLIC,anon,authenticated;
COMMIT;
