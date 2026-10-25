'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const engine=require('../vice-solace-system.js');
const START=1700000000000;
const b=(i,o,h,l,c)=>({t:START+i*60000,o,h,l,c,v:100,closed:true});
const baseline=()=>Array.from({length:130},(_,i)=>b(i,115,120,110,115));
const opts={modeLookback:false,structuralLookback:100,tfSeconds:60,exhOn:false,zoneArmMacro:true,now:START+180*60000};
test('integration: XAUUSD M1 F0 bullish origin survives advance and is never reclassified TOP',()=>{
 const candles=baseline();
 candles.push(b(130,110,111,99,101),b(131,101,104,100,103),
              b(132,103,108,102,107),b(133,107,112,106,111));
 const full=engine.run(candles,opts);
 const touch=full.events.find(x=>x.type==='MACRO_ORIGIN_TOUCHED'&&x.side==='LONG'&&x.i===130);
 assert(touch,'F0 touch must be captured at the sweep');
 const arm=full.events.find(x=>x.type==='MACRO_ORIGIN_ARMED'&&x.side==='LONG'&&x.i>=130&&x.i<=133);
 assert(arm,'Early bull arm must appear within first 2-3 relevant candles');
 assert.equal(full.snapshots[133].macroOrigin.side,'LONG');
 assert.equal(full.snapshots[133].macroOrigin.bar,130);
 assert.equal(full.snapshots[133].sellArmed,false,'Macro display must remain BUY from F0');
 assert(!full.events.some(x=>x.type==='MACRO_ORIGIN_TOUCHED'&&x.side==='SHORT'&&x.i>=130));
 const prefix=engine.run(candles.slice(0,133),opts);
 assert.deepEqual(full.events.filter(x=>x.i<133),prefix.events,'closed history must never acquire retroactive event changes');
});
test('integration: F100-origin bearish reversal cannot be labeled a bullish floor on descent',()=>{
 const candles=baseline();
 candles.push(b(130,120,131,119,129),b(131,129,130,125,126),
              b(132,126,127,122,123),b(133,123,124,119,120.5));
 const full=engine.run(candles,opts);
 assert(full.events.some(x=>x.type==='MACRO_ORIGIN_TOUCHED'&&x.side==='SHORT'&&x.i===130));
 assert(full.events.some(x=>x.type==='MACRO_ORIGIN_ARMED'&&x.side==='SHORT'&&x.i>=130&&x.i<=133));
 assert.equal(full.snapshots[133].macroOrigin.side,'SHORT');
 assert.equal(full.snapshots[133].sellArmed,true);
});
test('lookback inputs are still adjustable and limit their accepted bounds',()=>{
 assert.equal(engine.options({modeLookback:false,structuralLookback:991}).lookback,991);
 assert.equal(engine.options({modeLookback:false,structuralLookback:200}).lookback,200);
 assert.equal(engine.options({mode:'Swing',modeLookback:true,lbSwing:3000}).lookback,3000);
});
