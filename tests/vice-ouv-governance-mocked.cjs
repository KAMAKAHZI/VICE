'use strict';
/* Mocked governance contract tests. No production credentials or network calls. */
const assert=require('node:assert/strict');
const {handler}=require('../netlify/functions/ouv-final-deploy.js');
const proposal='PROP-20261019-548A9057-34F';
const originalFetch=global.fetch;
const old={SUPABASE_URL:process.env.SUPABASE_URL,SUPABASE_ANON_KEY:process.env.SUPABASE_ANON_KEY,SUPABASE_SERVICE_ROLE_KEY:process.env.SUPABASE_SERVICE_ROLE_KEY,VICE_OUV_EXECUTION_ENABLED:process.env.VICE_OUV_EXECUTION_ENABLED};
process.env.SUPABASE_URL='https://mock.supabase.co';
process.env.SUPABASE_ANON_KEY='test-publishable';
process.env.SUPABASE_SERVICE_ROLE_KEY='test-private';
process.env.VICE_OUV_EXECUTION_ENABLED='true';
let writes=0;
let signatures={cryptographic_signatures_verified:false,ceo_authorization_verified:true,cfo_authorization_verified:false};
const json=(data,status=200)=>({ok:status>=200&&status<300,status,json:async()=>data});
global.fetch=async(url,opts={})=>{
 const path=new URL(url).pathname;
 if(path==='/auth/v1/user')return json({id:'executive-user'});
 if(path.includes('/vice_exec_signers'))return json([{user_id:'executive-user',role:'CEO'}]);
 if(path.includes('/vice_ouv_execution_receipts'))return json([]);
 if(path.includes('/ouv_versions'))return json([]);
 if(path.includes('/vice_dao_config'))return json([{vice_price:2,v4x_price:320}]);
 if(path.includes('/vice_sovereign_proposals'))return json([{id:proposal,status:'REVIEW'}]);
 if(path.endsWith('/rpc/vice_ouv_activation_readiness'))return json({
   proposal_id:proposal,can_apply:true,next_unmet_gates:[],
   executive_authorizations:2,review_complete:true,ledger_reconciled:true,
   baseline_compatible:true,proposed_ouv:{VICE:2.82645403,V4X:452.2326448},
   ...signatures
 });
 if(path.endsWith('/rpc/vice_ouv_execute_approved')){writes++;return json({status:'executed'});}
 throw Error('Unexpected mocked endpoint: '+path);
};
const event=(action,confirm)=>({httpMethod:'POST',headers:{authorization:'Bearer mock.jwt.token'},body:JSON.stringify({
 action,proposal_id:proposal,request_id:'12345678-1234-1234-1234-123456789abc',...(confirm?{confirm:'EXECUTE APPROVED OUV'}:{})
})});
(async()=>{
 try{
  let result=await handler(event('reconcile_ouv'));
  let body=JSON.parse(result.body);
  assert.equal(result.statusCode,409);
  assert.equal(body.status,'action_required');
  assert.ok(body.issues.includes('CRYPTOGRAPHIC_SIGNATURE_VERIFICATION_REQUIRED'));
  assert.equal(writes,0);
  result=await handler(event('execute_ouv',true));
  assert.equal(result.statusCode,409);
  assert.equal(writes,0,'Unverified signatures must never call executor');
  signatures={cryptographic_signatures_verified:true,ceo_authorization_verified:true,cfo_authorization_verified:true};
  result=await handler(event('reconcile_ouv'));
  body=JSON.parse(result.body);
  assert.equal(result.statusCode,200);
  assert.equal(body.status,'ready');
  assert.equal(writes,0,'Readiness must not execute');
  process.env.VICE_OUV_EXECUTION_ENABLED='false';
  result=await handler(event('execute_ouv',true));
  assert.equal(result.statusCode,409);
  assert.equal(writes,0,'Server kill switch must block execution');
  console.log('PASS mocked governance: unverified signature blocked, read-only readiness, server kill switch');
 }finally{
  global.fetch=originalFetch;
  for(const [k,v] of Object.entries(old)){if(v===undefined)delete process.env[k];else process.env[k]=v;}
 }
})().catch(e=>{console.error(e);process.exitCode=1});
