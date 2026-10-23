#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync(require('node:path').join(__dirname,'../vice-ouv-reference.js'),'utf8');
const ctx={};vm.runInNewContext(source,ctx,{filename:'vice-ouv-reference.js'});
const {normalize,portfolioValue,read}=ctx.ViceOUVReference;
const valid={reference_kind:'ISSUER_INTERNAL_MANAGEMENT_REFERENCE',independent_fair_market_value:false,holder_units_changed:false,policy_status:'MODEL_ONLY',official_ouv:{VICE:2,V4X:320},effective_at:'2026-10-23T00:00:00Z'};
assert.equal(normalize(valid).vice,2);
assert.equal(portfolioValue({VICE:16,V4X:16},normalize(valid)),5152);
assert.throws(()=>normalize({...valid,official_ouv:{VICE:2,V4X:321}}),/integrity/);
assert.throws(()=>normalize({...valid,independent_fair_market_value:true}),/Invalid/);
assert.throws(()=>normalize({...valid,effective_at:'invalid'}),/timestamp/);
assert.throws(()=>portfolioValue({VICE:-1,V4X:1},normalize(valid)),/Invalid holdings/);
(async()=>{
 const value=await read({rpc:async()=>({data:valid,error:null})});
 assert.equal(value.v4x,320);
 await assert.rejects(read({rpc:async()=>({data:null,error:{message:'forbidden'}})}),/unavailable/);
 console.log('OUV reference bridge: all tests passed');
})().catch(e=>{console.error(e);process.exitCode=1});
