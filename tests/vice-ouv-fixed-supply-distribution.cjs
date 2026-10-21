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
test('multi-class official portfolio total rounds exact reference sum only once to cents',()=>{
 const priceVice=282645403n;       // $2.82645403 at 8dp
 const priceV4x=priceVice*160n;   // $452.23264480 at exact 1:160
 const vice=1n,v4x=2n;
 const cents=x=>(x+500000n)/1000000n;
 const lineSum=cents(vice*priceVice)+cents(v4x*priceV4x);
 const portfolioCents=cents(vice*priceVice+v4x*priceV4x);
 assert.equal(lineSum,90730n);   // incorrect two-step display sum: $907.30
 assert.equal(portfolioCents,90729n); // canonical SQL ROUND(full total): $907.29
 const displayedViceCents=cents(vice*priceVice);
 const displayedV4xCents=portfolioCents-displayedViceCents;
 assert.equal(displayedViceCents+displayedV4xCents,portfolioCents);
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

test('Sovereign OUV readiness cannot execute anything or skip approvals and timelock',()=>{
 const fs=require('node:fs'),path=require('node:path');
 const sql=fs.readFileSync(path.resolve(__dirname,'../supabase/migrations/20261021044500_vice_ouv_live_activation_preflight.sql'),'utf8');
 const ui=fs.readFileSync(path.resolve(__dirname,'../vice4x-institutional.js'),'utf8');
 assert.match(sql,/CREATE OR REPLACE FUNCTION public\.vice_ouv_activation_readiness/);
 assert.match(sql,/public\.vice_institutional_access\(\)/);
 assert.match(sql,/vice_exec_mfa_authorizations/);
 assert.match(sql,/UNION/);
 assert.match(sql,/PUBLIC_REVIEW_WINDOW_OPEN/);
 assert.match(sql,/ONCHAIN_QUORUM_VERIFIER_NOT_CONFIGURED/);
 assert.match(sql,/ATOMIC_GOVERNANCE_EXECUTOR_NOT_CONFIGURED/);
 assert.match(sql,/'can_apply',false/);
 assert.match(sql,/REVOKE ALL ON FUNCTION public\.vice_ouv_activation_readiness\(text\) FROM PUBLIC,anon/);
 assert.doesNotMatch(sql,/UPDATE public\.vice_dao_config SET/);
 assert.match(ui,/rpc\('vice_ouv_activation_readiness'/);
 assert.match(ui,/NOT EFFECTIVE/);
});
test('Each holder official IRU total rounds both 8-decimal references only once',()=>{
 const fs=require('node:fs'),path=require('node:path');
 const html=fs.readFileSync(path.resolve(__dirname,'../index.html'),'utf8');
 assert.match(html,/const combinedLiveRef=canShowOfficial/);
 assert.match(html,/roundedCents\(BigInt\(mine\.VICE\.held\)\*officialScaled\[0\]/);
 assert.match(html,/BigInt\(mine\.V4X\.held\)\*officialScaled\[1\]/);
 assert.match(html,/const v4xLiveRef=canShowOfficial\?combinedLiveRef-viceLiveRef:null/);
 assert.match(html,/combinedShownRef=APP_MODE==='LIVE'\?combinedLiveRef/);
});

test('CEO estate reserve portfolio never falls back to unassigned 7.5M when live ledger fails',()=>{
 const fs=require('node:fs'),path=require('node:path'),html=fs.readFileSync(path.resolve(__dirname,'../index.html'),'utf8');
 const code=html.slice(html.indexOf('function managedReserveUnits(program){'),html.indexOf('function managedReserveUsd(){'));
 assert.match(code,/if\(APP_MODE==='LIVE'\)/);
 assert.match(code,/if\(ledgerValue===undefined\|\|ledgerValue===null\)return 0/);
 assert.match(code,/n<=7500000\?n:0/);
});
test('Background live sync reloads authoritative strategic and estate book after new distributions',()=>{
 const fs=require('node:fs'),path=require('node:path'),html=fs.readFileSync(path.resolve(__dirname,'../index.html'),'utf8');
 const code=html.slice(html.indexOf('function startViceSync(){'),html.indexOf('async function hydrateData(){'));
 assert.match(code,/viceSyncInFlight/);
 assert.match(code,/sb\.rpc\('get_my_holder'\)/);
 assert.match(code,/await hydrateData\(\)/);
 assert.match(code,/await refreshEstateRegistry\(\)/);
 assert.match(code,/refreshIssuerReferences\(\)/);
});

test('release audit SQL reconciles holder totals against append-only issues, corrections and estate events',()=>{
 const fs=require('node:fs'),path=require('node:path');
 const sql=fs.readFileSync(path.resolve(__dirname,'../supabase/migrations/20261021080900_vice_ouv_append_only_ledger_reconciliation.sql'),'utf8');
 assert.match(sql,/CREATE OR REPLACE FUNCTION vice_private\.ouv_release_reconciliation/);
 assert.match(sql,/UNITS_ISSUANCE_REVERSED/);
 assert.match(sql,/UNITS_RETIRED/);
 assert.match(sql,/UNITS_ISSUED/);
 assert.match(sql,/estate_audited_events/);
 assert.match(sql,/strategic_audited_events/);
 assert.match(sql,/invalid_events=0/);
 assert.match(sql,/audit_v=cv AND audit_x=cx/);
 assert.match(sql,/estate_audit_v=ev AND estate_audit_x=ex/);
 assert.match(sql,/health:=vice_private\.ouv_release_reconciliation\(\)/);
 assert.match(sql,/IF NOT coalesce\(\(health->>'ledger_reconciled'\)::boolean,false\) THEN/);
 assert.doesNotMatch(sql,/UPDATE public\.vice_dao_config SET/);
});
test('audited issuance less correction equals the current strategic supply counters',()=>{
 // Independently observed aggregate issuance events and reversals from the
 // issuer append-only event log, never any personal holder information.
 const gross=Object.freeze({vice:787624n,v4x:785124n});
 const reversed=Object.freeze({vice:54125n,v4x:54125n});
 const active={vice:gross.vice-reversed.vice,v4x:gross.v4x-reversed.v4x};
 assert.equal(active.vice,733499n);
 assert.equal(active.v4x,730999n);
 assert.equal(active.vice+active.v4x,1464498n);
});

test('live governance model refreshes on a safe bounded cadence without signing in again',()=>{
 const fs=require('node:fs'),path=require('node:path');
 const js=fs.readFileSync(path.resolve(__dirname,'../vice4x-institutional.js'),'utf8');
 assert.match(js,/lastRefreshAt/);
 assert.match(js,/window\.setInterval\(/);
 assert.match(js,/Date\.now\(\)-state\.lastRefreshAt<45000/);
 assert.match(js,/document\.visibilityState!=='visible'/);
 assert.match(js,/if\(APP_MODE!=='LIVE'/);
 assert.doesNotMatch(js,/setInterval\([\s\S]{0,700}signInWithPassword/);
});

test('Manual Netlify deployment does not invent a deploy ID; source SHA is mandatory',()=>{
 const fs=require('node:fs'),path=require('node:path');
 const {identity}=require('../scripts/vice-deployment-identity.cjs');
 const sha='a'.repeat(40);
 const generated=identity({COMMIT_REF:sha,CONTEXT:'production'},'1.3.8.0-IRU-CERTIFICATES',new Date('2026-10-21T04:00:00Z'));
 assert.equal(generated.commit,sha);
 assert.equal(generated.context,'production');
 assert.equal(generated.deployment_id,null);
 const wf=fs.readFileSync(path.resolve(__dirname,'../.github/workflows/vice-netlify-production.yml'),'utf8');
 assert.match(wf,/workflow_dispatch:/);
 assert.match(wf,/COMMIT_REF: \$\{\{ github.sha \}\}/);
 assert.match(wf,/VICE_EXPECTED_COMMIT: \$\{\{ github.sha \}\}/);
 assert.match(wf,/VICE_MANUAL_DEPLOY: '1'/);
 const smoke=fs.readFileSync(path.resolve(__dirname,'vice-production-smoke.mjs'),'utf8');
 assert.match(smoke,/d.commit===expectedCommit/);
 assert.match(smoke,/manual&&d.deployment_id===null&&d.context==='production'/);
});
