#!/usr/bin/env node
'use strict';
// Read-only smoke test for authenticated issuer reference RPC.
// Requires SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_USER_JWT.
// Does not approve proposals, alter policy, or update balances.
const assert = require('node:assert/strict');
const { env } = process;
const missing = ['SUPABASE_URL','SUPABASE_ANON_KEY','SUPABASE_USER_JWT'].filter(key => !env[key]);
if (missing.length) { console.error('Missing '+missing.join(', ')); process.exit(2); }
(async () => {
 const url=new URL('/rest/v1/rpc/vice_ouv_effective_reference',env.SUPABASE_URL);
 const res=await fetch(url,{method:'POST',headers:{
  apikey:env.SUPABASE_ANON_KEY,
  Authorization:'Bearer '+env.SUPABASE_USER_JWT,
  'Content-Type':'application/json'
 },body:'{}'});
 if (!res.ok) throw Error('RPC rejected: HTTP '+res.status);
 const d=await res.json();
 assert.equal(d.reference_kind,'ISSUER_INTERNAL_MANAGEMENT_REFERENCE');
 assert.equal(d.independent_fair_market_value,false);
 assert.equal(d.holder_units_changed,false);
 assert.ok(['MODEL_ONLY','AUTO_ACTIVE','SUSPENDED'].includes(d.policy_status));
 const vice=Number(d.official_ouv?.VICE),v4x=Number(d.official_ouv?.V4X);
 assert.ok(Number.isFinite(vice)&&vice>0);
 assert.ok(Number.isFinite(v4x)&&v4x===vice*160);
 assert.ok(d.effective_at);
 console.log(JSON.stringify({pass:true,policy_status:d.policy_status,official_ouv:d.official_ouv,effective_at:d.effective_at,effective_version_id:d.effective_version_id},null,2));
})().catch(e=>{console.error('OUV smoke test failed:',e.message);process.exitCode=1});
