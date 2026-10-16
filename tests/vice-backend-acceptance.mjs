// VICE OS — read-only public-backend acceptance. No passwords, secrets or real-user login.
import {readFileSync,writeFileSync} from 'node:fs';
const source=readFileSync('index.html','utf8');
const match=source.match(/const SUPABASE_ANON_KEY = '([^']+)'/);
const base=source.match(/const SUPABASE_URL = '([^']+)'/)?.[1];
if(!match||!base)throw new Error('Missing public Supabase configuration');
const key=match[1], checks=[];
const save=(name,status,detail)=>{checks.push({name,status,detail});console.log('['+status+'] '+name+' — '+detail)};
async function req(path,body,extra={}){
 const c=new AbortController(),t=setTimeout(()=>c.abort(),9000);
 try{
  const r=await fetch(base+path,{method:body===undefined?'GET':'POST',
   headers:{apikey:key,'Authorization':'Bearer '+key,'Content-Type':'application/json',Accept:'application/json'},
   body:body===undefined?undefined:JSON.stringify(body),signal:c.signal,...extra});
  const raw=await r.text();let json;try{json=JSON.parse(raw)}catch{}
  return {status:r.status,ok:r.ok,json,raw:raw.slice(0,300)};
 }finally{clearTimeout(t)}
}
async function check(name,fn){try{await fn()}catch(e){save(name,'FAIL',String(e?.message||e))}}
await check('Supabase Auth gateway',async()=>{
 const r=await req('/auth/v1/health');save('Supabase Auth gateway',r.ok?'PASS':'FAIL','HTTP '+r.status);
});
await check('Certificate verification',async()=>{
 const r=await req('/rest/v1/rpc/verify_certificate',{p_cert_id:'VCA-NONEXISTENT-TEST-VICE-OS'});
 const good=r.ok && r.json?.valid===false;
 save('Certificate verification',good?'PASS':'FAIL','Unknown certificate denied; HTTP '+r.status);
});
await check('Invitation privacy',async()=>{
 const r=await req('/rest/v1/rpc/validate_invite',{p_code:'VICE-NONEXISTENT-PUBLIC-SMOKE',p_email:'nobody@test.invalid'});
 const good=r.ok&&r.json?.valid===false;save('Invitation privacy',good?'PASS':'FAIL','Unknown invite denied; HTTP '+r.status);
});
await check('IRU certificate verification',async()=>{
 const r=await req('/rest/v1/rpc/verify_token_certificate',{p_cert_id:'VCT-NONEXISTENT-PUBLIC-SMOKE'});
 save('IRU certificate verification',r.ok&&r.json?.valid===false?'PASS':'FAIL','Unknown IRU certificate denied; HTTP '+r.status);
});
await check('No public profiles',async()=>{
 const r=await req('/rest/v1/profiles?select=id%2Cemail&limit=1');
 const good=[401,403,404].includes(r.status)||(r.ok&&Array.isArray(r.json)&&r.json.length===0);
 save('No public profiles',good?'PASS':'FAIL','Anonymous member directory access HTTP '+r.status+', rows '+(Array.isArray(r.json)?r.json.length:'not returned'));
});
await check('No public cloud MT5 records',async()=>{
 const r=await req('/rest/v1/vice_mt5_cloud_accounts?select=id%2Cowner_id&limit=1');
 const good=[401,403,404].includes(r.status)||(r.ok&&Array.isArray(r.json)&&r.json.length===0);
 save('No public cloud MT5 records',good?'PASS':'FAIL','Anonymous broker records HTTP '+r.status+', rows '+(Array.isArray(r.json)?r.json.length:'not returned'));
});
// Every finance and member record must reject anonymous reading; a 200 []
// response is acceptable under PostgreSQL RLS, while even one row is a leak.
const privateTables=[
 ['Academy reading receipts','academy_progress','profile_id,module'],
 ['IRU certificates','token_certificates','cert_id,holder_id'],
 ['Holder registry','holders','id,client_id'],
 ['Private allocations','allocations','id,holder_id'],
 ['Issuer distributions','distributions','id,total'],
 ['Member documents','documents','id,url'],
 ['Financial treasury','treasury_tx','id,amount'],
 ['External bank metadata','external_accounts','id,owner_id'],
 ['Legacy broker metadata','mt5_accounts','id,owner_id'],
 ['Governance ballots','vice_proposal_votes','id,voter_id'],
 ['Support tickets','support_tickets','id,profile_id'],
 ['Institutional audit trail','audit_log','id,actor_id']
];
for(const [name,table,fields] of privateTables){
 await check('Anonymous '+name,async()=>{
  const r=await req('/rest/v1/'+table+'?select='+encodeURIComponent(fields)+'&limit=1');
  const safe=[401,403,404].includes(r.status)||(r.ok&&Array.isArray(r.json)&&r.json.length===0);
  save('Anonymous '+name,safe?'PASS':'FAIL','HTTP '+r.status+'; rows '+(Array.isArray(r.json)?r.json.length:'not disclosed'));
 });
}
await check('Anonymous super-admin backend diagnostics blocked',async()=>{
 const r=await req('/rest/v1/rpc/vice_operational_health',{});
 const safe=[401,403,404].includes(r.status)||
  (r.ok&&r.json?.status!=='PASS'&&r.json?.error);
 save('Anonymous super-admin backend diagnostics blocked',safe?'PASS':'FAIL','RPC HTTP '+r.status);
});
await check('MT5 Edge Function rejects anon JWT',async()=>{
 const r=await req('/functions/v1/vice-mt5-cloud',{action:'status'});
 // Anon JWT MUST NOT reveal provider configuration nor register broker accounts.
 const good=[401,403].includes(r.status) || (r.ok&&r.json?.configured!==true&&r.json?.error);
 save('MT5 Edge Function rejects anon JWT',good?'PASS':'FAIL','HTTP '+r.status+'; JWT/no owner boundary');
});
const failures=checks.filter(x=>x.status==='FAIL');
const report={release:JSON.parse(readFileSync('version.json','utf8')).version,
  origin:base,checked_at:new Date().toISOString(),checks,failures:failures.length,
  limit:'Read-only checks; not a credentialed member or brokerage acceptance test'};
writeFileSync('backend-acceptance-report.json',JSON.stringify(report,null,2)+'\n');
console.log('BACKEND CHECK RESULTS',checks.length-failures.length,'/',checks.length,'PASS');
if(failures.length)process.exitCode=1;
