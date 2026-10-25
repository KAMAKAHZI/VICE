'use strict';
// OUV publication transaction requirements. Fail CI until a future executor migration
// explicitly implements the contract; no live financial mutation is performed here.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const dir=path.join(__dirname,'../supabase/migrations');
const migration=fs.readdirSync(dir).filter(x=>x.includes('ouv_atomic_executor')&&x.endsWith('.sql'));
const proof=path.join(__dirname,'../docs/audit/OUV_ATOMIC_EXECUTOR_STAGING_PROOF.json');
if(!migration.length){
 if(process.env.VICE_OUV_EXECUTION_ENABLED==='true'){
  console.error('BLOCKED: execution flag enabled without audited atomic executor migration');
  process.exit(1);
 }
 console.log('PENDING: audited atomic OUV executor migration absent; activation must remain disabled');
 process.exit(0);
}
if(process.env.VICE_OUV_EXECUTION_ENABLED==='true'){
 if(!fs.existsSync(proof)) throw new Error('OUV activation blocked: independent staging proof absent');
 const evidence=JSON.parse(fs.readFileSync(proof,'utf8'));
 for(const k of ['migration_sha256','staging_project','transaction_rollback_passed','concurrent_idempotency_passed','quorum_signature_verification_passed','reviewer_approval']){
  assert.ok(evidence[k], 'OUV activation blocked: missing independent proof '+k);
 }
 assert.equal(evidence.transaction_rollback_passed,true);
 assert.equal(evidence.concurrent_idempotency_passed,true);
 assert.equal(evidence.quorum_signature_verification_passed,true);
}
const sql=migration.map(x=>fs.readFileSync(path.join(dir,x),'utf8')).join('\n');
for(const [name,pattern] of Object.entries({
 transaction:/\bBEGIN\s*;/i,
 rollback:/\bROLLBACK\s*;/i,
 proposalLock:/FOR UPDATE/i,
 version:/ouv_versions/i,
 receipt:/vice_ouv_execution_receipts/i,
 officialConfig:/vice_dao_config/i,
 proposalState:/vice_sovereign_proposals/i,
 quorum:/quorum_verified_at/i,
 timelock:/execute_after/i,
 hash:/payload_hash/i,
 idempotency:/ON CONFLICT|already_executed/i,
 supply:/total_vice/i,
}))assert.match(sql,pattern,'Missing atomic executor contract: '+name);
assert.doesNotMatch(sql,/DISABLE TRIGGER ALL|SET session_replication_role\s*=\s*replica/i,'Must not bypass database guards');
console.log('PASS: OUV atomic executor migration contains mandatory transactional safeguards');
