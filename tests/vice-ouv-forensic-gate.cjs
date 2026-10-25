'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const sql=fs.readFileSync('sql/vice_ouv_executive_forensic_gate.sql','utf8');
assert.match(sql,/BEGIN READ ONLY\s*;/i,'forensic query must be read-only');
assert.match(sql,/ROLLBACK\s*;/i,'forensic query must close without commit');
assert.doesNotMatch(sql,/\b(?:INSERT|UPDATE|DELETE|TRUNCATE|ALTER|DROP|CREATE|GRANT|REVOKE)\s+(?:INTO\s+|TABLE\s+|FUNCTION\s+)?(?:public\.|vice_private\.)/i,'forensic query must not mutate issuer tables');
for(const needle of ['payload_hash','vice_exec_attestations','vice_exec_mfa_authorizations','quorum_verified_at','execute_after','validation_until','vice_dao_config','ouv_versions','vice_ouv_execution_receipts','total_vice=10000000','total_v4x=10000000','v4x_price=vice_price*160','false AS executor_activation_authorized','vice_sovereign_proposals_check','vice_sovereign_proposals_status_check']){
 assert.ok(sql.includes(needle),'missing release gate '+needle);
}
assert.match(sql,/a\.payload_hash=p\.payload_hash/,'approvals must bind to proposal hash');
assert.match(sql,/GROUP BY a\.role/,'executive roles must be distinct');
console.log('PASS: forensic gate is read-only and checks all mandatory release evidence');
