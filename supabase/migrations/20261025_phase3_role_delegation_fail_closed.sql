-- VICE OS Phase 3: fail-closed delegated-role MFA gate
-- SECURITY BRANCH ONLY. Review against staging schema before running.
-- This migration deliberately DISABLES role assignment until a separate,
-- verified, action-bound MFA protocol has been implemented.
-- It preserves the function signature to avoid unexpected RPC 404 errors.
-- It does not change any existing member roles.
BEGIN;
CREATE OR REPLACE FUNCTION public.vice_assign_member_role(
 p_member_id uuid, p_role text, p_reason text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
 RAISE EXCEPTION 'Role delegation temporarily disabled: fresh action-bound executive MFA required'
 USING ERRCODE='42501';
END;
$$;
REVOKE ALL ON FUNCTION public.vice_assign_member_role(uuid,text,text) FROM PUBLIC, anon, authenticated;
COMMIT;
-- Restoration must use a reviewed implementation that validates and
-- atomically consumes a fresh one-time proof bound to actor, target, role
-- and reason digest; do not restore the original MFA-free implementation.
