'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync('index.html','utf8'),a=html.indexOf('const Solace ='),b=html.indexOf('const PRACTICE =',a),c=vm.createContext({});vm.runInContext(html.slice(a,b)+';globalThis.engine=Solace;',c);
const bars=Array.from({length:6000},(_,i)=>{const v=100+Math.sin(i/3)*5;return {t:i*60000,o:v,c:v,h:v+1,l:v-1};});
test('Confirmed fractals retain confirmation time and remain unchanged with future history',()=>{
 const prefix=c.engine.run(bars.slice(0,120)),full=c.engine.run(bars);
 assert.deepEqual(full.fractals.filter(f=>f.confirmedAt<120),prefix.fractals);
 assert(full.fractals.every(f=>f.confirmedAt-f.bar===5));
 assert(full.fractals.length>200);assert(full.fractals[0].bar<100);
});
test('A known swing high is not confirmed before its five right-hand candles',()=>{
 const fixture=Array.from({length:12},(_,i)=>{const h=i<=6?i+1:13-i;return {t:i,o:h-1,c:h-1,h,l:h-2};});
 assert(!c.engine.run(fixture.slice(0,11)).fractals.some(f=>f.side==='HIGH'&&f.bar===6));
 assert(c.engine.run(fixture).fractals.some(f=>f.side==='HIGH'&&f.bar===6&&f.confirmedAt===11&&f.price===7));
});
