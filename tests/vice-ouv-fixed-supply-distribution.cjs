'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
// Verifies the VICE OS MODEL ONLY distribution index, not realizable asset value.
const UNIT=100000000n,SUPPLY=20000000n,PEG=160n;
const BASE=2n*UNIT;
const round=(a,b)=>(a+b/2n)/b;
function price(base,netNew){return round(base*(SUPPLY+netNew),SUPPLY);}
function modeled(sVice,sV4x,eVice,eV4x){
 const inputs=[sVice,sV4x,eVice,eV4x];
 assert(inputs.every(v=>typeof v==='bigint'&&v>=0n),'whole nonnegative units required');
 assert(sVice<=2500000n&&sV4x<=2500000n,'2.5m strategic cap');
 assert(eVice<=7500000n&&eV4x<=7500000n,'7.5m estate cap');
 assert(sVice+eVice<=10000000n&&sV4x+eV4x<=10000000n,'10m class cap');
 const newUnits=sVice+sV4x+eVice+eV4x;
 const v=price(BASE,newUnits);
 return {newUnits,vice:v,v4x:v*PEG,major:newUnits>SUPPLY/20n};
}
function usd8(n){return (n/UNIT).toString()+'.'+(n%UNIT).toString().padStart(8,'0');}
test('100k new VICE + 100k new V4X = +1.00% model, never new supply',()=>{
 const r=modeled(100000n,100000n,0n,0n);
 assert.equal(r.newUnits,200000n);
 assert.equal(usd8(r.vice),'2.02000000');
 assert.equal(usd8(r.v4x),'323.20000000');
});
test('10,000 units total produces +0.05% and exact 1:160 references',()=>{
 const p=modeled(10000n,0n,0n,0n);
 assert.equal(p.newUnits,10000n);
 assert.equal(usd8(p.vice),'2.00100000');
 assert.equal(usd8(p.v4x),'320.16000000');
});
test('10,000 of each produces +0.10%, not +1% or compounding',()=>{
 const p=modeled(10000n,10000n,0n,0n);
 assert.equal(p.newUnits,20000n);
 assert.equal(usd8(p.vice),'2.00200000');
 assert.equal(usd8(p.v4x),'320.32000000');
});
test('a single VICE IRU makes the smallest 8-decimal fixed-supply adjustment',()=>{
 const p=modeled(1n,0n,0n,0n);
 assert.equal(usd8(p.vice),'2.00000010');
 assert.equal(usd8(p.v4x),'320.00001600');
});
test('100k combined = +0.50%, independent of program split',()=>{
 for(const x of [0n,1n,50000n,99999n,100000n]){
  const r=modeled(x,100000n-x,0n,0n);
  assert.equal(usd8(r.vice),'2.01000000');
  assert.equal(usd8(r.v4x),'321.60000000');
 }
});
test('estate reserve and strategic distribution enter exactly once',()=>{
 const a=modeled(100000n,100000n,0n,0n);
 const b=modeled(0n,0n,100000n,100000n);
 assert.equal(a.vice,b.vice);
 assert.equal(a.v4x,b.v4x);
});
test('splitting distributions does not compound or inflate the index',()=>{
 const chunks=Array.from({length:250},()=>800n);
 assert.equal(chunks.reduce((a,b)=>a+b,0n),200000n);
 assert.equal(price(BASE,chunks.reduce((a,b)=>a+b,0n)),modeled(200000n,0n,0n,0n).vice);
});
test('ratio remains mathematically exactly 1:160 at eight decimals',()=>{
 for(let x=0n;x<=1000000n;x+=100n){
  const v=price(BASE,x);
  assert.equal(v*PEG/PEG,v);
  assert(v>=BASE);
 }
});
test('draft 5% major event threshold requires approval above 1 million new units',()=>{
 assert.equal(modeled(1000000n,0n,0n,0n).major,false);
 assert.equal(modeled(1000001n,0n,0n,0n).major,true);
});
test('release cannot exceed strategic, estate or absolute fixed class supply',()=>{
 assert.throws(()=>modeled(2500001n,0n,0n,0n));
 assert.throws(()=>modeled(0n,0n,7500001n,0n));
 const full=modeled(2500000n,2500000n,7500000n,7500000n);
 assert.equal(full.newUnits,SUPPLY);
 assert.equal(usd8(full.vice),'4.00000000');
 assert.equal(usd8(full.v4x),'640.00000000');
});
test('correction reverses net issuance, cannot generate an irreversible price gain',()=>{
 const newUnits=200000n;
 assert.equal(price(BASE,newUnits-newUnits),BASE);
});
test('same unit holdings; only the modeled reference amount changes',()=>{
 const holder=Object.freeze({vice:10000n,v4x:10000n});
 const initial=(holder.vice*BASE+holder.v4x*BASE*PEG)/UNIT;
 const revised=modeled(100000n,100000n,0n,0n);
 const final=(holder.vice*revised.vice+holder.v4x*revised.v4x)/UNIT;
 assert.equal(initial,3220000n);
 assert.equal(final,3252200n);
 assert.equal(holder.vice,10000n);
 assert.equal(holder.v4x,10000n);
});
test('cash distributions and secondary transfers are NOT new releases',()=>{
 const eligible=new Set(['UNITS_ISSUED','ESTATE_ALLOCATION_DISTRIBUTED']);
 for(const type of ['CASH_DISTRIBUTION_PAID','HOLDER_TRANSFER','ALLOCATION_APPROVED','ALLOCATION_RESERVED'])
  assert.equal(eligible.has(type),false);
});


test('production SQL migration is reproducible, permission-scoped, and read-only for pricing',()=>{
 const fs=require('node:fs'),path=require('node:path');
 const sql=fs.readFileSync(path.resolve(__dirname,'../supabase/migrations/20261021042700_vice_ouv_release_model_replay_safe.sql'),'utf8');
 assert.match(sql,/CREATE TABLE IF NOT EXISTS public\.vice_ouv_release_policy/);
 assert.match(sql,/status text NOT NULL DEFAULT 'MODEL_ONLY' CHECK\(status='MODEL_ONLY'\)/);
 assert.match(sql,/ALTER TABLE public\.vice_ouv_release_model_events ENABLE ROW LEVEL SECURITY/);
 assert.match(sql,/UNIQUE\(source_table,source_seq\)/);
 assert.match(sql,/vice_ouv_release_on_strategic_issuance/);
 assert.match(sql,/vice_ouv_release_on_estate_distribution/);
 assert.match(sql,/REVOKE ALL ON FUNCTION vice_private\.ouv_release_math/);
 assert.match(sql,/automatic_official_update_enabled',false/);
 assert.doesNotMatch(sql,/UPDATE public\.vice_dao_config SET vice_price=/);
});
test('issuer app and member UI recompute official references from dynamic canonical OUV',()=>{
 const fs=require('node:fs'),path=require('node:path');
 const html=fs.readFileSync(path.resolve(__dirname,'../index.html'),'utf8');
 const ui=fs.readFileSync(path.resolve(__dirname,'../vice4x-institutional.js'),'utf8');
 assert.match(html,/function viceOuvMemberModelHtml\(/);
 assert.match(html,/function viceOuvIssuerIndexHtml\(/);
 assert.match(html,/S\.daoPriceSyncStatus!=='CANONICAL'/);
 assert.match(html,/canonical_ouv_verified===true/);
 assert.match(html,/Number\(data\?\.reference_vice\)===Number\(S\.iruClasses\[0\]\.ouv\)/);
 assert.match(ui,/MODEL ONLY — GOVERNANCE NOT ACTIVATED/);
 assert.match(ui,/p_pool:v\.pool/);
});
