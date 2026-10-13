-- Applied to Supabase production sdsaewumabzjjvsmqqsl; recorded by migration version 20261013030938.

-- VICE OS 1.3.6.6 — complete missing governance voting and distribution schema.
-- Forward-only additive migration: existing records untouched.
ALTER TABLE public.proposals
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS opens_at timestamptz,
  ADD COLUMN IF NOT EXISTS closes_at timestamptz,
  ADD COLUMN IF NOT EXISTS effective_at timestamptz;

CREATE TABLE IF NOT EXISTS public.vice_proposal_votes(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id uuid NOT NULL REFERENCES public.proposals(id) ON DELETE CASCADE,
  voter_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  choice text NOT NULL CHECK (choice IN ('FOR','AGAINST')),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT vice_proposal_votes_unique_voter UNIQUE (proposal_id,voter_id)
);
CREATE INDEX IF NOT EXISTS idx_vice_proposal_votes_voter_fk ON public.vice_proposal_votes(voter_id);
ALTER TABLE public.vice_proposal_votes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.vice_proposal_votes FROM PUBLIC,anon,authenticated;
GRANT SELECT ON TABLE public.vice_proposal_votes TO authenticated;
DROP POLICY IF EXISTS vice_proposal_votes_self_read ON public.vice_proposal_votes;
CREATE POLICY vice_proposal_votes_self_read ON public.vice_proposal_votes
  FOR SELECT TO authenticated USING (voter_id = (SELECT auth.uid()));

-- Proposal creation is super-admin only; vote counters cannot be forged directly.
REVOKE INSERT,UPDATE,DELETE,TRUNCATE ON TABLE public.proposals FROM anon,authenticated;
GRANT INSERT(title,body,status,created_by,opens_at,closes_at,effective_at) ON TABLE public.proposals TO authenticated;

CREATE OR REPLACE FUNCTION public.vice_cast_proposal_vote(p_proposal_id uuid,p_choice text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_uid uuid; v_proposal public.proposals%ROWTYPE; v_total bigint; v_yes bigint; v_no bigint;
BEGIN
 v_uid := auth.uid();
 IF v_uid IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='28000'; END IF;
 IF p_choice NOT IN ('FOR','AGAINST') OR p_choice IS NULL THEN RAISE EXCEPTION 'Choice must be FOR or AGAINST'; END IF;
 IF NOT EXISTS (
  SELECT 1 FROM public.profiles p WHERE p.id=v_uid
 ) OR NOT EXISTS (
  SELECT 1 FROM public.holders h
    WHERE (h.profile_id=v_uid OR h.user_id=v_uid)
      AND COALESCE(h.status,'ACTIVE') NOT IN ('FROZEN','REVOKED','ESTATE_RESERVE')
 ) THEN RAISE EXCEPTION 'An active holder membership is required to vote';
 END IF;
 SELECT * INTO v_proposal FROM public.proposals WHERE id=p_proposal_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Proposal not found'; END IF;
 IF v_proposal.status <> 'OPEN'
    OR (v_proposal.opens_at IS NOT NULL AND v_proposal.opens_at>now())
    OR (v_proposal.closes_at IS NOT NULL AND v_proposal.closes_at<=now())
 THEN RAISE EXCEPTION 'Proposal voting is closed'; END IF;
 IF EXISTS (SELECT 1 FROM public.vice_proposal_votes WHERE proposal_id=p_proposal_id AND voter_id=v_uid)
 THEN RAISE EXCEPTION 'Vote already recorded for this proposal'; END IF;
 INSERT INTO public.vice_proposal_votes(proposal_id,voter_id,choice)
 VALUES(p_proposal_id,v_uid,p_choice);
 UPDATE public.proposals SET
    votes_for=votes_for+CASE WHEN p_choice='FOR' THEN 1 ELSE 0 END,
    votes_against=votes_against+CASE WHEN p_choice='AGAINST' THEN 1 ELSE 0 END
 WHERE id=p_proposal_id;
 SELECT votes_for,votes_against INTO v_yes,v_no FROM public.proposals WHERE id=p_proposal_id;
 RETURN jsonb_build_object('ok',true,'proposal_id',p_proposal_id,'choice',p_choice,
   'votes_for',v_yes,'votes_against',v_no,
   'voting_basis','ONE_VERIFIED_ACTIVE_HOLDER_ONE_VOTE_NOT_ONCHAIN');
END;
$$;
REVOKE ALL ON FUNCTION public.vice_cast_proposal_vote(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.vice_cast_proposal_vote(uuid,text) TO authenticated;

-- Match distribution form and privacy expectations without publishing payments.
ALTER TABLE public.distributions
  ADD COLUMN IF NOT EXISTS holder_id uuid REFERENCES public.holders(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS holder_name text,
  ADD COLUMN IF NOT EXISTS holder_client_id text,
  ADD COLUMN IF NOT EXISTS program text,
  ADD COLUMN IF NOT EXISTS note text,
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_distributions_holder_id_fk ON public.distributions(holder_id);
CREATE INDEX IF NOT EXISTS idx_distributions_created_by_fk ON public.distributions(created_by);
DROP POLICY IF EXISTS distributions_read ON public.distributions;
CREATE POLICY distributions_read ON public.distributions FOR SELECT TO authenticated USING (
  (SELECT public.is_admin()) OR EXISTS (
    SELECT 1 FROM public.holders h
      WHERE h.id=holder_id AND (h.user_id=(SELECT auth.uid()) OR h.profile_id=(SELECT auth.uid()))
  )
);
REVOKE INSERT,UPDATE,DELETE,TRUNCATE ON TABLE public.distributions FROM anon,authenticated;
GRANT INSERT, UPDATE(status) ON TABLE public.distributions TO authenticated;

-- Member account metadata never permits anonymous writers.
REVOKE INSERT,UPDATE,DELETE,TRUNCATE ON TABLE public.external_accounts FROM anon;
REVOKE INSERT,UPDATE,DELETE,TRUNCATE ON TABLE public.mt5_accounts FROM anon;

