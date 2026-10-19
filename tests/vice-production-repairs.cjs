'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync(process.env.VICE_TEST_SOURCE||'index.html','utf8');
function section(a,b){const i=html.indexOf(a);assert(i>=0,a);return html.slice(i,html.indexOf(b,i));}
function run(src,globals={}){const c=vm.createContext({console,setTimeout,clearTimeout,clearInterval,...globals});vm.runInContext(src,c);return c;}
test('Yahoo uses same-origin proxy and discards null/invalid OHLC',async()=>{
 let url;
 const c=run(section('async function fetchCandlesYahoo(', 'async function fetchCandlesUnified('),{
 YAHOO_TF:{'1h':'1h'},YAHOO_RANGE:{'1h':'3mo'},fetch:async u=>{url=u;return {ok:true,json:async()=>({chart:{result:[{timestamp:[1,2,3],indicators:{quote:[{open:[2,2,2],high:[3,null,1],low:[1,1,1],close:[2,2,2]}]}}]}})}}});
 const bars=await c.fetchCandlesYahoo('EURUSD=X','1h');
 assert.match(url,/^\/\.netlify\/functions\/yahoo\?/);assert.equal(bars.length,1);assert.equal(bars[0].t,1000);
});
test('Yahoo refuses entirely missing prices',async()=>{
 const c=run(section('async function fetchCandlesYahoo(', 'async function fetchCandlesUnified('),{YAHOO_TF:{'1h':'1h'},YAHOO_RANGE:{},fetch:async()=>({ok:true,json:async()=>({chart:{result:[{timestamp:[1],indicators:{quote:[{}]}}]}})})});
 await assert.rejects(c.fetchCandlesYahoo('EURUSD=X','1h'),/no valid price candles/);
});
test('Channel history requests newest rows, displays chronological order, deduplicates',async()=>{
 let ascending;
 const q={select(){return this},eq(){return this},order(k,o){ascending=o.ascending;return this},limit:async()=>({data:[{id:'b',text:'new',created_at:'2026-10-15',sender_id:'other'},{id:'a',text:'old',created_at:'2026-10-14',sender_id:'me'}]})};
 const S={user:{id:'me'},comms:{messages:{}}};
 const c=run(section('  async function loadHistory(', '  async function loadDmHistory('),{authEpoch:1,S,sb:{from:()=>q},MsgCrypto:{decrypt:async(k,t)=>t},toast:()=>{}});
 await c.loadHistory('general');await c.loadHistory('general');assert.equal(ascending,false);assert.equal(S.comms.messages.general.length,2);assert.equal(S.comms.messages.general[0].id,'a');
});
test('History response after account change cannot repopulate member cache',async()=>{
 let finish;const S={user:{id:'me'},comms:{messages:{}}};
 const q={select(){return this},eq(){return this},order(){return this},limit:()=>new Promise(r=>finish=r)};
 const c=run(section('  async function loadHistory(', '  async function loadDmHistory('),{authEpoch:1,S,sb:{from:()=>q},MsgCrypto:{decrypt:async(k,t)=>t},toast:()=>{}});
 const p=c.loadHistory('general');c.authEpoch++;finish({data:[{id:'x',text:'private',created_at:'2026-10-15'}]});await p;assert.equal(Object.keys(S.comms.messages).length,0);
});
test('Message persistence rejects encoded overflow before database write',async()=>{
 let writes=0;const c=run(section('  async function persist(', '  async function send('),{S:{user:{id:'me'}},sb:{from:()=>({insert:async()=>{writes++;return {}}})}});
 await assert.rejects(c.persist('messages',{text:'x'.repeat(10001)}),/too large/);assert.equal(writes,0);
 await c.persist('messages',{text:'ok'});assert.equal(writes,1);
});
test('Authentication coalesces duplicate initialization',async()=>{
 let calls=0,resolve;const c=run('let authSetupTask=null,authSetupOwner=null,authSetupEpoch=-1,authEpoch=0;'+section('function onAuthenticated(', 'async function completeAuthenticatedSetup('),{
 APP_MODE:'LIVE',S:{user:null},$:()=>({hidden:false}),clearMemberSession:()=>{},completeAuthenticatedSetup:()=>{calls++;return new Promise(r=>resolve=r)}});
 const a=c.onAuthenticated({id:'a'}),b=c.onAuthenticated({id:'a'});assert.equal(a,b);assert.equal(calls,1);resolve();await a;
});
test('Logout cleanup removes member records, messages, certificates, and quiz answers',()=>{
 let navigationOpen=true;
 const S={user:{id:'a'},profile:{role:'SUPER_ADMIN'},comms:{messages:{secret:1}},academy:{quiz:{secret:1}},support:{tickets:[1]},oi:{messages:[1]},iru:{state:{secret:1}},documents:[1]};
 const c=run(section('function clearMemberSession(', 'function onAuthenticated('),{authEpoch:0,viceSyncTimer:null,S,setSidebarOpen(open){navigationOpen=open;},Realtime:{disconnect(){}},Link:{stop(){}},viceAbortVoiceRecording(){},safeResetCloudMt5Session(){},closeModal(){},closeSheet(){}});
 c.clearMemberSession();assert.equal(S.user,null);assert.equal(S.profile.role,null);assert.equal(S.documents.length,0);assert.equal(Object.keys(S.comms.messages).length,0);assert.equal(Object.keys(S.academy.quiz).length,0);assert.equal(c.authEpoch,1);
 assert.equal(navigationOpen,false,'Successful logout clears menu and its backdrop');
});
test('Failed or canceled signout preserves synchronization',async()=>{
 let cleared=false;const c=run(section('async function logout(', 'async function audit('),{viceSyncTimer:123,APP_MODE:'LIVE',confirm:()=>true,viceAbortVoiceRecording(){},sb:{auth:{signOut:async()=>({error:new Error('offline')})}},toast(){},clearMemberSession(){cleared=true},clearInterval(){cleared=true}});
 await c.logout();assert.equal(cleared,false);
});
test('Profile permission denial does not mutate local profile',async()=>{
 const S={user:{id:'a'},profile:{name:'Original'}};
 const q={update(){return this},eq(){return this},select(){return this},single:async()=>({error:new Error('permission denied')})};
 const c=run(section('async function saveMemberProfile(', 'async function logout('),{S,authEpoch:1,APP_MODE:'LIVE',sb:{from:()=>q}});
 await assert.rejects(c.saveMemberProfile({name:'Changed',role:'SUPER_ADMIN'}),/permission denied/);assert.equal(S.profile.name,'Original');assert.equal(S.profile.role,undefined);
});
test('Profile save whitelists editable fields and waits for confirmation',async()=>{
 let row;const S={user:{id:'a'},profile:{name:'Original'}};
 const q={update(x){row=x;return this},eq(){return this},select(){return this},single:async()=>({data:{id:'a'}})};
 const c=run(section('async function saveMemberProfile(', 'async function logout('),{S,authEpoch:1,APP_MODE:'LIVE',sb:{from:()=>q}});
 await c.saveMemberProfile({name:'Changed',role:'SUPER_ADMIN',vipAccess:true});assert.equal(row.name,'Changed');assert.equal(row.role,undefined);assert.equal(row.vipAccess,undefined);assert.equal(S.profile.name,'Changed');
});
test('SOLACE macro structure prefix is unchanged by future candles',()=>{
 const c=run(section('const Solace =', 'const PRACTICE =')+'\nglobalThis.engine=Solace;');
 const bars=Array.from({length:180},(_,i)=>{const x=100+Math.sin(i/5)*5;return {t:i*60000,o:x,h:x+2,l:x-2,c:x+0.5,v:10}});
 const prefix=c.engine.run(bars.slice(0,120)),full=c.engine.run(bars);
 for(const field of ['f0','f100','s0','s100'])assert.deepEqual(full[field].slice(0,120),prefix[field],field);
});
