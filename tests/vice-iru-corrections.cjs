'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync('index.html','utf8');
const start=html.indexOf('const IruEngine =');
const end=html.indexOf('\n})();',start)+6;
const c=vm.createContext({});vm.runInContext(html.slice(start,end)+';globalThis.engine=IruEngine',c);
const base=[{seq:1,type:'HOLDER_ADDED',holderId:'synthetic',name:'Synthetic holder',by:'test'},
 {seq:47,type:'UNITS_ISSUED',holderId:'synthetic',program:'VICE',units:'51000',reason:'Test issuance',by:'test'}];
const correction={seq:60,type:'UNITS_ISSUANCE_REVERSED',sourceEventSeq:47,holderId:'synthetic',program:'VICE',units:'51000',reason:'Reviewed correction test',by:'DATABASE_OPERATOR'};
test('Correction replay preserves reserve and original issuance with noncontiguous sequences',()=>{
 const s=c.engine.replay([...base,correction]);assert.equal(s.balances.VICE.synthetic,0n);assert.equal(s.supply.VICE,0n);assert.equal(s.balances.VICE.ESTATE,7500000n);assert.equal(s.journal[1].seq,47);assert.equal(s.journal.length,3);assert.equal(c.engine.checkInvariants(s).length,0);
});
test('Correction replay rejects mismatches and a second reversal',()=>{
 assert.throws(()=>c.engine.replay([...base,{...correction,units:'50000'}]),/does not match/);
 assert.throws(()=>c.engine.replay([...base,correction,{...correction,seq:61}]),/already corrected/);
});
