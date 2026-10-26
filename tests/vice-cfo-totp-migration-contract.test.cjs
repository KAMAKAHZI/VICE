const fs = require('node:fs');
const assert = require('node:assert/strict');
const test = require('node:test');

const sql=fs.readFileSync('supabase/migrations/20261026193000_vice_cfo_legacy_attestation_totp_unblock.sql','utf8');
test('CFO legacy attestation is not mistaken for completed TOTP authorization',()=>{
 assert.match(sql,/previous_condition text :=/);
 assert.match(sql,/vice_exec_attestations a WHERE a\.proposal_id=p_proposal/);
 const next=sql.match(/new_condition text := \$new\$([\s\S]*?)\$new\$/);
 assert.ok(next,'replacement condition must be explicit');
 assert.doesNotMatch(next[1],/vice_exec_attestations/);
 assert.match(next[1],/vice_exec_mfa_authorizations/);
 assert.match(next[1],/a\.action='APPROVE'/);
 assert.match(sql,/position\(previous_condition IN original\)=0/);
 assert.match(sql,/EXECUTE replace\(original,previous_condition,new_condition\)/);
});
test('migration does not manufacture approvals or mutate official values',()=>{
 assert.doesNotMatch(sql,/\bINSERT\s+INTO\s+(?:public\.)?vice_exec_mfa_authorizations\b/i);
 assert.doesNotMatch(sql,/\bUPDATE\s+(?:public\.)?(?:vice_exec_mfa_authorizations|vice_dao_config|ouv_versions)\b/i);
 assert.doesNotMatch(sql,/\bDELETE\s+FROM\b/i);
});

test('replacement preserves role-specific duplicate TOTP guard while removing legacy attestation gate',()=>{
 const old=sql.match(/previous_condition text := \$old\$([\s\S]*?)\$old\$/);
 const next=sql.match(/new_condition text := \$new\$([\s\S]*?)\$new\$/);
 assert.ok(old && next);
 const before="IF p_action='APPROVE' THEN\n  "+old[1]+"\n  THEN RAISE EXCEPTION 'Executive role already authorized this proposal'; END IF;";
 const after=before.replace(old[1],next[1]);
 assert.notEqual(after,before);
 assert.doesNotMatch(after,/vice_exec_attestations/);
 assert.match(after,/a\.role=v_role AND a\.action='APPROVE'/);
 assert.match(after,/Executive role already authorized this proposal/);
 assert.equal(after.replace(next[1],old[1]),before);
});
