-- VICE OS AI-SOC incident ledger (staging-first migration).
-- Incident records are security telemetry, NOT financial authorization.
BEGIN;
CREATE TABLE IF NOT EXISTS public.vice_soc_incidents (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 source_event_key text NOT NULL UNIQUE,
 actor_reference text NOT NULL CHECK (char_length(actor_reference) BETWEEN 1 AND 128),
 severity text NOT NULL CHECK (severity IN ('low','medium','high','critical')),
 risk_score integer NOT NULL CHECK (risk_score BETWEEN 0 AND 100),
 signals jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(signals)='array'),
 categories jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(categories)='array'),
 rule_version text NOT NULL,
 first_seen_at timestamptz NOT NULL,
 last_seen_at timestamptz NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 CHECK (last_seen_at >= first_seen_at)
);
ALTER TABLE public.vice_soc_incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vice_soc_incidents FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.vice_soc_incidents FROM PUBLIC, anon, authenticated;
-- Deliberately NO client RLS policies. Only trusted backend with narrowly
-- scoped database privileges may write; do not expose a client insert RPC.
CREATE INDEX IF NOT EXISTS vice_soc_incidents_created_idx ON public.vice_soc_incidents(created_at DESC);
CREATE INDEX IF NOT EXISTS vice_soc_incidents_severity_idx ON public.vice_soc_incidents(severity,created_at DESC);
COMMIT;
