'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {checkDrift,BASELINE}=require('../scripts/vice-passkey-drift.cjs');

function mockFetch(fields={},opts={}){
 return async (url,init)=>{
  assert.equal(url,'https://api.supabase.com/v1/projects/'+BASELINE.project_ref+'/functions');
  assert.equal(init.headers.Authorization,'Bearer test-read-only-management-token');
  if(opts.status)return new Response(JSON.stringify({error:'synthetic'}),{status:opts.status});
  return new Response(JSON.stringify(opts.response??[{slug:BASELINE.function_slug,
    version:BASELINE.version,status:BASELINE.status,verify_jwt:BASELINE.verify_jwt,
    ezbr_sha256:BASELINE.ezbr_sha256,...fields}]),{status:200});
 };
}
const options=fields=>({token:'test-read-only-management-token',fetcher:mockFetch(fields)});
test('passkey live bundle metadata matches approved baseline and committed source',async()=>{
 const result=await checkDrift(options());
 assert.equal(result.status,'ACTIVE');
 assert.equal(result.verify_jwt,true);
 assert.equal(result.ezbr_sha256,BASELINE.ezbr_sha256);
});
test('passkey drift check cannot succeed without a management token',async()=>{
 await assert.rejects(()=>checkDrift({token:'',fetcher:mockFetch()}),/BLOCKED.*missing/);
});
test('passkey drift check refuses tampered committed source before network call',async()=>{
 let called=false;
 await assert.rejects(()=>checkDrift({token:'test-read-only-management-token',readFile:()=>Buffer.from('tampered source'),fetcher:async()=>{called=true;throw Error('should not fetch')}}),/DRIFT.*committed/);
 assert.equal(called,false);
});
test('passkey drift check fails on altered deployed bundle, JWT, status or version',async()=>{
 for(const fields of [{ezbr_sha256:'0'.repeat(64)},{verify_jwt:false},{status:'THROTTLED'},{version:BASELINE.version+1}]){
  await assert.rejects(()=>checkDrift(options(fields)),/DRIFT.*baseline/);
 }
});
test('passkey drift check fails closed on missing or duplicate remote entry',async()=>{
 for(const response of [[],[{slug:BASELINE.function_slug},{slug:BASELINE.function_slug}],{}]){
  await assert.rejects(()=>checkDrift({token:'test-read-only-management-token',fetcher:mockFetch({},{response})}),/DRIFT|BLOCKED/);
 }
});
test('passkey drift check fails closed on unauthorized and rate-limited APIs',async()=>{
 for(const status of [401,403,429,500]){
  await assert.rejects(()=>checkDrift({token:'test-read-only-management-token',fetcher:mockFetch({},{status})}),new RegExp('BLOCKED.*HTTP '+status));
 }
});
