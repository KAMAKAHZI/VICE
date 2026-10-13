CREATE TABLE IF NOT EXISTS public.vice_mt5_cloud_accounts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 provider text NOT NULL DEFAULT 'METAAPI' CHECK(provider='METAAPI'),
 provider_account_id text UNIQUE,
 request_nonce uuid NOT NULL,
 provisioning_transaction_id text NOT NULL,
 label text NOT NULL CHECK(length(label) BETWEEN 1 AND 120),
 server text NOT NULL CHECK(length(server) BETWEEN 2 AND 160),
 account_mode text NOT NULL DEFAULT 'DEMO' CHECK(account_mode IN('DEMO','LIVE')),
 connection_state text NOT NULL DEFAULT 'PREPARING' CHECK(connection_state IN('PREPARING','DRAFT','UNDEPLOYED','DEPLOYED','CONNECTED','DISCONNECTED','ERROR')),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(owner_id,request_nonce));
CREATE INDEX IF NOT EXISTS vice_mt5_cloud_accounts_owner_idx ON public.vice_mt5_cloud_accounts(owner_id,created_at DESC);
ALTER TABLE public.vice_mt5_cloud_accounts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.vice_mt5_cloud_accounts FROM PUBLIC,anon,authenticated;
COMMENT ON TABLE public.vice_mt5_cloud_accounts IS 'Read-only MT5 portfolio connector mapping; credentials configured at provider-hosted page. Edge function owner-scoped read.';
