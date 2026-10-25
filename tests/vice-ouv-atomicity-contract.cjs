'use strict';
// OUV publication transaction requirements. Fail CI until a future executor migration
// explicitly implements the contract; no live financial mutation is performed here.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const dir=path.join(__dirname,'../supabase/migrations');
const migration=fs.readdirSync(dir).filter(x=>x.includes('ouv_atomic_executor')&&x.endsWith('.sql'));
if(!migration.length){
 console.log('PENDING: audited atomic OUV executor migration not yet deployed; release stays disabled');
 process.exit(0);
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
