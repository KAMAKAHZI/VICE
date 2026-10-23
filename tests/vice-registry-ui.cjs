'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync('index.html','utf8');
function section(a,b){const i=html.indexOf(a);assert(i>=0,a);const j=html.indexOf(b,i);assert(j>i,b);return html.slice(i,j);}
function run(src,globals={}){const c=vm.createContext({console,...globals});vm.runInContext(src,c);return c;}
const normalize=section('function normalizeLoginIdentifier(', 'function isClient(');
test('Privileged broker connector denies suspended, unprovisioned and unverifiable accounts',async()=>{
 const edge=fs.readFileSync('supabase/functions/vice-mt5-cloud/index.ts','utf8');
 const c=run(edge.slice(edge.indexOf('async function verifyCloudMemberAccess('),edge.indexOf('Deno.serve(')));
 let access={data:{allowed:true}},profile={data:{id:'member'}};
 const client={rpc:async()=>access,from:()=>({select(){return this},eq(){return this},maybeSingle:async()=>profile})};
 assert.equal(await c.verifyCloudMemberAccess(client,'member'),null);
 access={data:{allowed:false}};assert.equal((await c.verifyCloudMemberAccess(client,'member')).status,403);
 access={error:Error('offline')};assert.equal((await c.verifyCloudMemberAccess(client,'member')).status,503);
 access={data:{allowed:true}};profile={data:null};assert.equal((await c.verifyCloudMemberAccess(client,'member')).status,403);
});
for(const identifier of ['  MEMBER@EXAMPLE.TEST  ','  MiXeD_UsEr  '])test('Login normalizes identifier without altering password: '+identifier.trim(),async()=>{
 let sent,lookup;const fields={lIdentifier:{value:identifier},lPass:{value:'  MiXeD Password  '},loginBtn:{disabled:false}};
 const c=run(normalize+section('async function login(', '// Read-only connectivity checks.'),{authBusy:false,viceLoginCooldownSeconds:()=>0,viceAuthReady:Promise.resolve(true),$:id=>fields[id],toast(){},onAuthenticated:async()=>{},sb:{rpc:async(n,p)=>{lookup=p.p_identifier;return {data:'MEMBER@EXAMPLE.TEST'}},auth:{signInWithPassword:async p=>{sent=p;return {data:{user:{id:'test'}}}}}}});
 await c.login();assert.equal(sent.email,'member@example.test');assert.equal(sent.password,'  MiXeD Password  ');assert.equal(fields.loginBtn.disabled,false);
 if(!identifier.includes('@'))assert.equal(lookup,'mixed_user');
});
test('Only authoritative access denial clears a session; network errors preserve it',async()=>{
 let clears=0,signouts=0,mode='offline';
 const c=run(section('async function checkMemberAccess(', 'function startViceSync('),{APP_MODE:'LIVE',window:{addEventListener:()=>{}},document:{getElementById:()=>null,querySelectorAll:()=>[],addEventListener:()=>{}},authEpoch:1,clearMemberSession(){clears++},toast(){},sb:{rpc:async()=>mode==='offline'?{error:Error('offline')}:{data:{allowed:false,suspended:true}},auth:{signOut:async()=>{signouts++}}}});
 await assert.rejects(c.checkMemberAccess(),/offline/);assert.equal(clears,0);
 mode='denied';assert.equal(await c.checkMemberAccess(),false);assert.equal(clears,1);assert.equal(signouts,1);
});
test('Own distribution coalesces clicks and reuses the original request after uncertain response',async()=>{
 let resolve,calls=0,finished=0;const requests=[];
 const fields={holderTransferUnits:{value:'25'},holderTransferReason:{value:'Authorized synthetic transfer'},holderTransferProgram:{value:'VICE'}};
 const op={kind:'TRANSFER',holderId:'target',id:'stable-request',busy:false,payload:null};
 const c=run(section('async function submitOwnHoldingsTransfer(', 'function openIssueUnitsModal('),{holderOperation:op,$:id=>fields[id],toast(){},finishHolderOperation:async()=>{finished++},sb:{rpc:async(n,p)=>{calls++;requests.push(JSON.stringify(p));return new Promise(r=>resolve=r)}}});
 const button={disabled:false};const first=c.submitOwnHoldingsTransfer(button);await c.submitOwnHoldingsTransfer(button);assert.equal(calls,1);
 resolve({error:Error('uncertain response')});await first;assert.equal(finished,0);
 fields.holderTransferUnits.value='99';const retry=c.submitOwnHoldingsTransfer(button);assert.equal(requests[0],requests[1]);resolve({data:{seq_out:1,seq_in:2}});await retry;assert.equal(finished,1);assert.equal(button.disabled,false);
});
const src=section('const IruEngine =','\n})();')+'\n})();globalThis.engine=IruEngine;';
const ctx=run(src);const E=ctx.engine;
const added=(id,seq)=>({type:'HOLDER_ADDED',holderId:id,clientId:'VC-'+id,name:id,by:'test',seq});
const base=[added('a',1),added('b',2),{type:'UNITS_ISSUED',holderId:'a',program:'VICE',units:'100',reason:'Synthetic allocation',by:'test',seq:3}];
const outgoing={type:'UNITS_TRANSFERRED_OUT',holderId:'a',counterpartyId:'b',transferId:'x',program:'VICE',units:'25',reason:'Synthetic transfer',by:'test',seq:4};
const incoming={...outgoing,type:'UNITS_TRANSFERRED_IN',holderId:'b',counterpartyId:'a',seq:5};
test('Paired transfer replay conserves supply and reserve, rejects duplicate receipts',()=>{
 const s=E.replay([...base,outgoing,incoming]);assert.equal(s.balances.VICE.a,75n);assert.equal(s.balances.VICE.b,25n);assert.equal(s.supply.VICE,100n);assert.equal(s.balances.VICE.ESTATE,7500000n);assert.equal(E.checkInvariants(s).length,0);
 assert.throws(()=>E.replay([...base,outgoing,incoming,{...incoming,seq:6}]),/already recorded/);
});
test('Recipient can replay only their authorized side',()=>{
 const s=E.replay([added('b',2),incoming]);assert.equal(s.balances.VICE.b,25n);assert.equal(s.holders.b.clientId,'VC-b');assert.equal(E.checkInvariants(s).length,0);
});
test('Closure preserves history, frees active capacity and requires zero holdings',()=>{
 const closure={type:'HOLDER_CLOSED',holderId:'a',by:'test',seq:4};
 assert.throws(()=>E.replay([...base,closure]),/reconciled/);
 const s=E.replay([added('a',1),closure]);assert.equal(s.journal.length,2);assert.equal(E.capacity(s).current,0);assert.equal(E.registry(s).rows.length,0);
});
test('CFO sees pool and holder controls while protected reserve has no delegated controls',()=>{
 let rendered='';const s=E.replay(base);s.holders.a.reserveProtected=true;
 const S={user:{id:'finance'},profile:{role:'FINANCE_OFFICER'},iru:{state:s}};
 const c=run(section('function isOwner(', 'function isClient(')+section('function openHolderViewModal(', 'const HOLDER_CONTROL_LABELS='),{S,IruEngine:E,toast(){},esc:String,fmtNum:String,openModal:(title,body)=>{rendered=body}});
 c.openHolderViewModal('b');assert.match(rendered,/Issue from holder pool/);assert.match(rendered,/Freeze holdings/);assert.match(rendered,/Distribute from my holdings/);assert.doesNotMatch(rendered,/Revoke membership/);
 c.openHolderViewModal('a');assert.doesNotMatch(rendered,/holder-control|holder-issue|holder-transfer/);
 S.profile.role='SUPER_ADMIN';s.holders.b.userId='finance';c.openHolderViewModal('b');assert.match(rendered,/Revoke membership/);
});
