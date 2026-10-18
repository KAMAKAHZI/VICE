/**
 * Read-only VICE OS production smoke acceptance.
 * Runs from GitHub's cloud runner against published Netlify origin.
 * Never obtains credentials, modifies records, makes trades, or charges provider accounts.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { matchesPublishedAsset } from './vice-published-assets.mjs';

const ORIGIN = (process.env.VICE_PRODUCTION_ORIGIN || 'https://vice4x.netlify.app').replace(/[/]+$/,'');
const expected = JSON.parse(readFileSync('version.json','utf8')).version;
const source = readFileSync('index.html','utf8');
const publicAnonKey = source.match(/const SUPABASE_ANON_KEY = '([^']+)'/)?.[1] || '';
const authGatewayUrl = source.match(/const SUPABASE_URL = '([^']+)'/)?.[1] || '';
const attempts=Number(process.env.VICE_SMOKE_ATTEMPTS||'6');
const delayMs=Number(process.env.VICE_SMOKE_DELAY_MS||'10000');
const results=[];
const pause=ms=>new Promise(r=>setTimeout(r,ms));
function record(id,status,details){results.push({id,status,details,timestamp:new Date().toISOString()});console.log(`[${status}] ${id}: ${details}`)}
async function request(path,extra={}){
 const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),11000);
 try{return await fetch(ORIGIN+path,{...extra,cache:'no-store',redirect:'follow',signal:controller.signal,
  headers:{'accept':'text/html,application/json',...(extra.headers||{})}})}
 finally{clearTimeout(timeout)}
}
let live;
for(let i=1;i<=attempts;i++){
 try {
  const r=await request('/version.json?smoke='+Date.now());
  const raw=await r.text();
  let j={};try{j=JSON.parse(raw)}catch{}
  if(r.ok&&j.version===expected){live=j;record('version','PASS',`Live ${j.version}; source ${expected}; attempt ${i}`);break;}
  record('version_attempt_'+i,'WAIT',`HTTP ${r.status}; published ${String(j.version||'not JSON').slice(0,120)}; expected ${expected}`);
 } catch(e){record('version_attempt_'+i,'WAIT',e.message)}
 if(i!==attempts)await pause(delayMs);
}
if(!live)record('version','FAIL','Netlify does not publish GitHub version '+expected+' yet. Check Site → Deploys and production branch.');
async function route(path,label,check){
 try{
  const r=await request(path);const body=await r.text();
  if(r.ok&&check(body,r))record(label,'PASS',`HTTP ${r.status}, ${body.length} characters`);
  else record(label,'FAIL',`HTTP ${r.status}: incorrect or missing release asset`);
 }catch(e){record(label,'FAIL',e.message)}
}
// Version alone cannot identify a repair: multiple commits share 1.3.8.0.
// Require byte identity for every published asset, allowing native deploy propagation.
let assetsMatch=false;
for(let attempt=1;attempt<=attempts;attempt++){
 const mismatches=[];
 for(const file of ['index.html','guide.html','verify.html','vice-mega.js','vice-mega.css','sw.js','manifest.json','manifest.webmanifest','version.json','vice4x-operations.js','vice4x-operations.css','vice-solace-system.js','vice4x-comms.js','vice4x-comms.css','governance.html','vice4x-institutional-core.js','vice4x-institutional.js','vice4x-institutional.css']){
  try{
   const response=await request('/'+file+'?release='+Date.now());
   const bytes=Buffer.from(await response.arrayBuffer());
   const expectedBytes=readFileSync(file);
   if(!response.ok||!matchesPublishedAsset(file,bytes,expectedBytes))mismatches.push(file);
  }catch(e){mismatches.push(file+': '+e.message)}
 }
 if(!mismatches.length){assetsMatch=true;record('exact_public_assets','PASS','Eighteen public assets match source; only the verified Netlify guide-link rewrite is permitted');break;}
 if(attempt===attempts)record('exact_public_assets','FAIL','Mismatched or unavailable: '+mismatches.join(', '));
 else await pause(delayMs);
}
await route('/deployment.json?smoke='+Date.now(),'deployment_identity',s=>{try{const d=JSON.parse(s);return d.release_version===expected&&/^[a-f0-9]{40}$/i.test(d.commit||'')&&!!d.deployment_id&&(!(process.env.VICE_EXPECTED_COMMIT||(process.env.GITHUB_EVENT_NAME==='push'&&process.env.GITHUB_SHA))||d.commit===(process.env.VICE_EXPECTED_COMMIT||process.env.GITHUB_SHA));}catch{return false}});
await route('/?smoke='+Date.now(),'application',s=>s.includes('VICE4X')&&s.includes('safeResetCloudMt5Session')&&s.includes('viceServiceDiagnostics'));
await route('/guide.html?smoke='+Date.now(),'member_guide',s=>s.includes('APPLICATION MANUAL')&&s.includes('VICE4X'));
await route('/verify.html?smoke='+Date.now(),'certificate_verify',s=>s.includes('VICE')&&s.includes('verify'));
await route('/vice-mega.js?smoke='+Date.now(),'javascript_asset',s=>s.length>1000);
await route('/manifest.webmanifest?smoke='+Date.now(),'webmanifest',s=>{try{return JSON.parse(s).name.includes('VICE')}catch{return false}});
try{
 const r=await request('/.netlify/functions/turn-credentials',{headers:{'accept':'application/json'}});
 if(r.status===401)record('TURN_endpoint','PASS','Endpoint exists, correctly enforces Supabase authentication');
 else if(r.status===503)record('TURN_endpoint','WARN','TURN endpoint exists but operator env secrets not provisioned');
 else record('TURN_endpoint','WARN',`HTTP ${r.status} (manual authenticated/WebRTC acceptance remains required)`);
}catch(e){record('TURN_endpoint','WARN',e.message)}
try{
 const url=authGatewayUrl.replace(/[/]+$/,'')+'/auth/v1/health';
 const ctrl=new AbortController();const t=setTimeout(()=>ctrl.abort(),10000);
 try{
 const r=await fetch(url,{signal:ctrl.signal,headers:{accept:'application/json',apikey:publicAnonKey}});
 record('supabase_auth_gateway',r.ok?'PASS':'WARN',`GET /auth/v1/health HTTP ${r.status}`);
 }finally{clearTimeout(t)}
}catch(e){record('supabase_auth_gateway','WARN',e.message)}
record('user_login','UNVERIFIED','No user password, OAuth redirect, invite acceptance or private session tested');
record('external_services','UNVERIFIED','MetaApi token, broker sign-in, provider charges, live MT5, TURN cross-network and custody acceptance not tested');
record('security','UNVERIFIED','Passing smoke checks does not certify security, E2EE, ledger correctness or financial claims');
const ok=!results.some(x=>x.status==='FAIL');
const report={ok,expected_build:expected,origin:ORIGIN,source_sha:process.env.GITHUB_SHA||null,
 generated_at:new Date().toISOString(),checks:results};
writeFileSync('production-smoke-report.json',JSON.stringify(report,null,2)+'\n');
console.log('Production smoke report SHA256 '+createHash('sha256').update(JSON.stringify(report)).digest('hex'));
if(!ok)process.exitCode=1;
