-- Index FK join and delete paths identified by Supabase Database Advisor; no data modified.
CREATE INDEX IF NOT EXISTS idx_academy_attempts_profile_id_fk ON public.academy_attempts (profile_id);
CREATE INDEX IF NOT EXISTS idx_allocations_holder_id_fk ON public.allocations (holder_id);
CREATE INDEX IF NOT EXISTS idx_external_accounts_owner_id_fk ON public.external_accounts (owner_id);
CREATE INDEX IF NOT EXISTS idx_holders_user_id_fk ON public.holders (user_id);
CREATE INDEX IF NOT EXISTS idx_mt5_accounts_owner_id_fk ON public.mt5_accounts (owner_id);
CREATE INDEX IF NOT EXISTS idx_signatures_document_id_fk ON public.signatures (document_id);
CREATE INDEX IF NOT EXISTS idx_signatures_signed_by_fk ON public.signatures (signed_by);
CREATE INDEX IF NOT EXISTS idx_vice_dao_config_updated_by_fk ON public.vice_dao_config (updated_by);
CREATE INDEX IF NOT EXISTS idx_vice_estate_allocations_created_by_fk ON public.vice_estate_allocations (created_by);
CREATE INDEX IF NOT EXISTS idx_vice_estate_allocations_holder_id_fk ON public.vice_estate_allocations (holder_id);
CREATE INDEX IF NOT EXISTS idx_vice_estate_events_actor_id_fk ON public.vice_estate_events (actor_id);
CREATE INDEX IF NOT EXISTS idx_vice_estate_events_allocation_id_fk ON public.vice_estate_events (allocation_id);
CREATE INDEX IF NOT EXISTS idx_vice_estate_holder_balances_holder_id_fk ON public.vice_estate_holder_balances (holder_id);
CREATE INDEX IF NOT EXISTS idx_vip_messages_from_user_fk ON public.vip_messages (from_user);
