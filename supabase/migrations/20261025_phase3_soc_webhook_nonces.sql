-- VICE OS Phase 3.15: durable SOC webhook replay protection.
-- Stage and review with the full SOC schema; never deploy this migration alone.
BEGIN;
CREATE TABLE IF NOT EXISTS public.vice_soc_webhook_nonces (
 nonce text PRIMARY KEY CHECK (nonce ~ '^[A-Za-z0-9_-]{16,128}$'),
 issued_at timestamptz NOT NULL,
 consumed_at timestamptz NOT NULL DEFAULT now(),
 expires_at timestamptz NOT NULL,
 CHECK (expires_at > issued_at)
);
ALTER TABLE public.vice_soc_webhook_nonces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vice_soc_webhook_nonces FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.vice_soc_webhook_nonces FROM PUBLIC, anon, authenticated;
CREATE INDEX IF NOT EXISTS vice_soc_webhook_nonces_expires_idx ON public.vice_soc_webhook_nonces(expires_at);
-- One atomic INSERT ... ON CONFLICT DO NOTHING is the replay barrier.
-- Never use SELECT-then-INSERT. A trusted backend must check rowCount===1.
-- Keep nonce rows beyond the allowed signature age (5 minutes plus skew).
-- Clean up only with a reviewed privileged job after the replay window.
COMMIT;
