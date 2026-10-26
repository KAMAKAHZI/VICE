// VICE OS Phase 3 migration contract: safe, offline, non-destructive.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const sql = readFileSync(new URL('../supabase/migrations/20261025_phase3_role_delegation_fail_closed.sql', import.meta.url), 'utf8');
assert.match(sql, /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.vice_assign_member_role\s*\(/i, 'Migration must replace the precise role delegation RPC');
assert.match(sql, /p_member_id\s+uuid\s*,\s*p_role\s+text\s*,\s*p_reason\s+text/i, 'Migration must preserve the RPC signature');
assert.match(sql, /RAISE\s+EXCEPTION[\s\S]*?ERRCODE\s*=\s*'42501'/i, 'Delegation must fail closed with permission denied');
assert.match(sql, /REVOKE\s+ALL\s+ON\s+FUNCTION\s+public\.vice_assign_member_role\(uuid,text,text\)\s+FROM\s+PUBLIC,\s*anon,\s*authenticated/i, 'Direct execution must be revoked');
assert.doesNotMatch(sql, /\b(?:UPDATE|DELETE|TRUNCATE|INSERT)\s+(?:INTO\s+|FROM\s+)?(?:public\.)?(?:profiles|holders|allocations|iru_events)\b/i, 'Gate migration must not mutate profiles or financial records');
assert.doesNotMatch(sql, /\b(?:GRANT\s+EXECUTE|DISABLE\s+ROW\s+LEVEL\s+SECURITY)\b/i, 'Gate migration must not widen access');
console.log('PASS Phase 3 delegated-role fail-closed migration static contracts; staging integration pending');
