'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync('index.html','utf8'),start=html.indexOf('const Academy ='),end=html.indexOf('\n})();',start)+6;
function setup(rpc){const c=vm.createContext({S:{user:{id:'fixture'},academy:{read:{},quiz:{},certs:[],answers:{}}},APP_MODE:'LIVE',authEpoch:1,sb:{rpc},renderMain(){},toast(){},nowIso:()=>new Date().toISOString(),localStorage:{getItem:()=>'{"read":{"I.1":"unverified"}}',setItem(){}}});vm.runInContext(html.slice(start,end)+';globalThis.api=Academy;',c);return c;}
test('Academy reading waits for a backend receipt and coalesces repeated clicks',async()=>{
 let done,calls=0;const c=setup(()=>{calls++;return new Promise(r=>done=r)});const a=c.api.markRead('I',1);await c.api.markRead('I',1);assert.equal(calls,1);assert.equal(c.api.state.read['I.1'],undefined);done({data:{completed_at:'server-time'}});await a;assert.equal(c.api.state.read['I.1'],'server-time');assert.equal(c.api.state.busy,false);
});
test('Denied reading write leaves progress incomplete and shows an error',async()=>{
 const c=setup(async()=>({error:Error('permission denied')}));await c.api.markRead('I',1);assert.equal(c.api.state.read['I.1'],undefined);assert.match(c.api.state.msg,/not saved/);assert.equal(c.api.state.busy,false);
});
test('Stale reading receipt cannot enter another session',async()=>{
 let done;const c=setup(()=>new Promise(r=>done=r));const p=c.api.markRead('I',1);c.authEpoch++;done({data:{completed_at:'server-time'}});await p;assert.equal(c.api.state.read['I.1'],undefined);
});
test('Live reading restoration does not certify browser-only marks',()=>{
 const c=setup(()=>{});c.api.restore();assert.equal(Object.keys(c.api.state.read).length,0);
});
