-- VICE OS OUV automatic policy: DRAFT migration, NOT an activation.
-- Requires independently verified governance amendment and release review.
-- Never execute on production merely because this file exists.
BEGIN;
ALTER TABLE public.vice_ouv_release_policy
  DROP CONSTRAINT vice_ouv_release_policy_status_check;
ALTER TABLE public.vice_ouv_release_policy
  ADD CONSTRAINT vice_ouv_release_policy_status_check
  CHECK (status IN ('MODEL_ONLY','AUTO_ACTIVE','SUSPENDED'));
-- Keep MODEL_ONLY as the default; activating requires verified governance evidence.
ALTER TABLE public.vice_ouv_release_policy
  ADD COLUMN IF NOT EXISTS activated_at timestamptz,
  ADD COLUMN IF NOT EXISTS activation_proposal_id text,
  ADD COLUMN IF NOT EXISTS activation_evidence_hash text,
  ADD COLUMN IF NOT EXISTS paused_at timestamptz;
ALTER TABLE public.vice_ouv_release_policy
  ADD CONSTRAINT vice_ouv_active_evidence_required
  CHECK (status <> 'AUTO_ACTIVE' OR
    (activated_at IS NOT NULL AND activation_proposal_id IS NOT NULL
     AND length(activation_evidence_hash)=64 AND
     activation_evidence_hash ~ '^[0-9a-f]{64}$'));
CREATE TABLE IF NOT EXISTS public.vice_ouv_auto_execution_receipts(
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 idempotency_key text NOT NULL UNIQUE,
 source_table text NOT NULL,
 source_seq bigint NOT NULL,
 formula_version text NOT NULL,
 prior_vice numeric NOT NULL,
 prior_v4x numeric NOT NULL,
 new_vice numeric NOT NULL,
 new_v4x numeric NOT NULL,
 effective_version_id uuid NOT NULL REFERENCES public.ouv_versions(id),
 executed_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(source_table,source_seq),
 CHECK(new_vice>0 AND new_v4x=new_vice*160)
);
ALTER TABLE public.vice_ouv_auto_execution_receipts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.vice_ouv_auto_execution_receipts FROM PUBLIC,anon,authenticated;
REVOKE ALL ON public.vice_ouv_auto_execution_receipts_id_seq FROM PUBLIC,anon,authenticated;
-- No public mutation interface. Privileged executor must enforce authenticated
-- authorization, governance amendment, event eligibility and ledger consistency.
COMMIT;
