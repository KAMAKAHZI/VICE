'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync('index.html','utf8'),start=html.indexOf('const Wallet = (() => {'),end=html.indexOf('  async function refresh()',start);
test('Optional wallet readiness does not replace a chart or document being edited',()=>{
 let renders=0;const timers=[],events={};
 const c=vm.createContext({S:{tab:'markets',wallet:{status:'none'}},window:{addEventListener:(name,fn)=>events[name]=fn},localStorage:{getItem:()=>null},setTimeout:fn=>timers.push(fn),renderMain:()=>renders++,console});
 vm.runInContext(html.slice(start,end)+'return {notify};})();globalThis.wallet=Wallet;',c);
 timers[0]();assert.equal(c.S.wallet.status,'unsupported');assert.equal(renders,0);
 c.window.ViceWallet={};events['vice-wallet-ready']();assert.equal(c.S.wallet.status,'none');assert.equal(renders,0);
 c.S.tab='documents';c.wallet.notify();assert.equal(renders,0);
 c.S.tab='wallet';c.wallet.notify();assert.equal(renders,1);
});
