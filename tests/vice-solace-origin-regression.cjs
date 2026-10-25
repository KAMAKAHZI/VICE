'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const solace=require('../vice-solace-system.js');
const o=solace.options({modeLookback:false,structuralLookback:100,tfSeconds:60,exhWindow:3,minRR:10});
const b=(i,open,high,low,close)=>({t:1700000000000+i*60000,o:open,h:high,l:low,c:close,v:100});
function originSteps(rows,poles={loPrev:100,hiPrev:120,lo:100,hi:120},atr=1){
 let state={origin:null,serial:0},previous=null,ev=[];
 for(const [i,x,p=poles] of rows){state=solace.originStep(state,x,previous,i,p,atr,o);ev.push(...state.events);previous=x;}
 return {...state,events:ev};
}
test('XAUUSD M1 regression: F0 touch then 2-candle bullish turn cannot become TOP on ascent',()=>{
 const x=originSteps([
  [100,b(100,101,102,99,99.1),{loPrev:100,hiPrev:120,lo:99,hi:120}],
  [101,b(101,99.4,101.1,99.3,100.8),{loPrev:99,hiPrev:120,lo:99,hi:120}],
  [102,b(102,100.8,105,100.2,104.6),{loPrev:99,hiPrev:120,lo:99,hi:120}]
 ]);
 assert.equal(x.origin.pole,'F0');assert.equal(x.origin.side,'LONG');
 assert.equal(x.origin.bar,100);assert.equal(x.origin.wick,99);
 assert.equal(x.origin.armedAt,101);
 assert.equal(x.origin.stage,'ARMED');
 assert(!x.events.some(e=>e.side==='SHORT'));
 assert.equal(x.events.filter(e=>e.type==='MACRO_ORIGIN_ARMED').length,1);
});
test('F100 symmetry: bearish advance does not mislabel a floor',()=>{
 const x=originSteps([
  [100,b(100,119,121,118,120.9),{loPrev:100,hiPrev:120,lo:100,hi:121}],
  [101,b(101,120.6,120.8,118,118.6),{loPrev:100,hiPrev:121,lo:100,hi:121}],
  [102,b(102,118.5,119,114,114.5),{loPrev:100,hiPrev:121,lo:100,hi:121}]
 ]);
 assert.equal(x.origin.pole,'F100');assert.equal(x.origin.side,'SHORT');
 assert.equal(x.origin.bar,100);assert.equal(x.origin.armedAt,101);
 assert(!x.events.some(e=>e.side==='LONG'));
 assert.equal(x.events.filter(e=>e.type==='MACRO_ORIGIN_ARMED').length,1);
});
test('unqualified candle at the floor stays TOUCHED instead of inventing a reversal',()=>{
 const x=originSteps([
  [100,b(100,103,103.2,99,99.01),{loPrev:100,hiPrev:120,lo:99,hi:120}],
  [101,b(101,99.01,99.3,98.8,98.85),{loPrev:99,hiPrev:120,lo:98.8,hi:120}]
 ]);
 assert.equal(x.origin.side,'LONG');
 assert.equal(x.origin.stage,'TOUCHED');
 assert(!x.events.some(e=>e.type==='MACRO_ORIGIN_ARMED'));
});
test('distinct opposite F100 touch can initiate bearish origin after bullish arm',()=>{
 let state={origin:null,serial:0},prev=b(99,100,101,100,100);
 const prices=[
  [100,b(100,100,102,99,101),{loPrev:100,hiPrev:120,lo:99,hi:120}],
  [101,b(101,101,107,100,106),{loPrev:99,hiPrev:120,lo:99,hi:120}],
  [102,b(102,119.5,121,119,119.3),{loPrev:99,hiPrev:120,lo:99,hi:121}]
 ];
 const events=[];
 for(const [i,bar,p] of prices){state=solace.originStep(state,bar,prev,i,p,1,o);events.push(...state.events);prev=bar;}
 assert.equal(state.origin.side,'SHORT');
 assert.equal(state.origin.pole,'F100');
 assert.equal(state.origin.bar,102);
 assert.equal(events.filter(e=>e.type==='MACRO_ORIGIN_TOUCHED').length,2);
});
test('one candle touching F0 and F100 is ambiguous without intrabar chronology',()=>{
 const p={loPrev:100,hiPrev:120,lo:99,hi:121};
 const x=solace.originStep({origin:null,serial:0},b(100,108,121,99,112),null,100,p,1,o);
 assert.equal(x.origin,null);
 assert.equal(x.events.length,0);
});
test('failed F0-origin returns to unarmed state; never flips automatically to SHORT',()=>{
 let state=solace.originStep({origin:null,serial:0},b(100,101,102,99,101),b(99,101,102,100,100),100,
  {loPrev:100,hiPrev:120,lo:99,hi:120},1,o);
 const next=solace.originStep(state,b(101,100.5,101,97,97.5),b(100,101,102,99,101),101,
  {loPrev:99,hiPrev:120,lo:97,hi:120},1,o);
 assert.equal(next.origin?.side,'LONG'); // fresh independently observed F0, not invented SHORT
 assert(!next.events.some(e=>e.side==='SHORT'));
 assert(next.events.some(e=>e.type==='MACRO_ORIGIN_INVALIDATED'));
});
test('10:1 planned RR and entry zone are both required; ARM never submits an order',()=>{
 const x=originSteps([[100,b(100,101,102,99,101),{loPrev:100,hiPrev:103,lo:99,hi:103}]]);
 assert.equal(x.origin.stage,'ARMED');
 assert.equal(x.origin.entryEligible,false);
 assert(x.origin.rr<10);
 assert(!Object.hasOwn(x.origin,'order'));
});
test('same existing origin does not duplicate arming even across extra touches',()=>{
 const x=originSteps([
  [100,b(100,101,102,99,101),{loPrev:100,hiPrev:120,lo:99,hi:120}],
  [101,b(101,101,105,99,104),{loPrev:99,hiPrev:120,lo:99,hi:120}],
  [102,b(102,104,106,99.1,105),{loPrev:99,hiPrev:120,lo:99,hi:120}]
 ]);
 assert.equal(x.origin.bar,100);
 assert.equal(x.events.filter(e=>e.type==='MACRO_ORIGIN_TOUCHED').length,1);
 assert.equal(x.events.filter(e=>e.type==='MACRO_ORIGIN_ARMED').length,1);
});

test('origin stop is immutable after arm even if subsequent ATR surges',()=>{
 const touch=solace.originStep({origin:null,serial:0},b(100,100,102,99,101),null,100,
  {loPrev:100,hiPrev:120,lo:99,hi:120},1,o);
 const stop=touch.origin.stop;
 const next=solace.originStep(touch,b(101,101,106,100,105),b(100,100,102,99,101),101,
  {loPrev:99,hiPrev:120,lo:99,hi:120},5,o);
 assert.equal(next.origin.stop,stop,'Volatility must not rewrite originating risk');
 assert.equal(next.origin.target,touch.origin.target);
 assert.equal(next.origin.bar,touch.origin.bar);
});
test('configurable origin expiry prevents infinite setup carry without a new touch',()=>{
 const cfg=solace.options({...o,originExpiryBars:3});
 let state=solace.originStep({origin:null,serial:0},b(100,101,102,99,101),null,100,
  {loPrev:100,hiPrev:120,lo:99,hi:120},1,cfg);
 for(let i=101;i<=104;i++){
  state=solace.originStep(state,b(i,108,111,105,109),b(i-1,108,111,105,109),i,
   {loPrev:99,hiPrev:120,lo:99,hi:120},1,cfg);
 }
 assert.equal(state.origin,null);
 assert(state.events.some(e=>e.type==='MACRO_ORIGIN_INVALIDATED'));
});
