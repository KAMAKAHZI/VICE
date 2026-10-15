'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync('index.html','utf8');
function part(a,b){const i=html.indexOf(a);return html.slice(i,html.indexOf(b,i));}
function setup(){
 const handlers={};const cv={style:{},_priceRange:{min:90,max:110},getContext:()=>({}),setAttribute(){},getBoundingClientRect:()=>({left:0,top:0}),addEventListener:(n,f)=>handlers[n]=f,focus(){},setPointerCapture(){},hasPointerCapture:()=>false};
 const c=vm.createContext({S:{ch:{candles:Array(500)},view2:{count:140,end:null}},$:()=>cv,_cv:null,_ctx:null,_W:1000,_H:500,PAD:{l:10,r:84,t:22,b:42},resizeCanvas(){},drawAll(){},requestAnimationFrame:()=>1,localStorage:{getItem:()=>null,setItem(){}}});
 vm.runInContext(part('function initCanvas(){','function resizeCanvas()')+part('function zoomChart(','function fmtP('),c);c.initCanvas();
 const event=(x,y,id=1)=>({clientX:x,clientY:y,pointerId:id,button:0,preventDefault(){},stopPropagation(){}});
 return {c,cv,handlers,event};
}
test('Mouse body drag pans time and price from the latest candle without jumping to earliest data',()=>{
 const {c,handlers:h,event:e}=setup();h.pointerdown(e(400,200));h.pointermove(e(500,250));h.pointerup(e(500,250));
 assert(c.S.view2.end>400&&c.S.view2.end<500);assert(c.S.view2.priceRange.min>90);assert.equal(c.S.view2.priceRange.max-c.S.view2.priceRange.min,20);
});
test('Price-axis drag scales range; pinch zoom changes horizontal and vertical scales',()=>{
 let {c,handlers:h,event:e}=setup();h.pointerdown(e(950,200));h.pointermove(e(950,250));assert(c.S.view2.priceRange.max-c.S.view2.priceRange.min>20);
 ({c,handlers:h,event:e}=setup());h.pointerdown(e(300,200,1));h.pointerdown(e(500,200,2));h.pointermove(e(600,200,2));assert(c.S.view2.count<140);assert(c.S.view2.priceRange.max-c.S.view2.priceRange.min<20);
});
test('Wheel cursor-anchored zoom and keyboard controls remain bounded',()=>{
 const {c,handlers:h,event:e}=setup();h.wheel({...e(400,200),deltaX:0,deltaY:-150});assert(c.S.view2.count<140);
 for(let i=0;i<50;i++)h.keydown({key:'-',preventDefault(){},stopPropagation(){}});
 assert(c.S.view2.count<=500);h.keydown({key:'0',preventDefault(){},stopPropagation(){}});assert.equal(c.S.view2.priceRange,null);
});
test('Failed market feeds show unavailable state without manufacturing candles',async()=>{
 const S={ch:{pair:'EURUSD',tf:'1h',candles:[{c:1}]},view2:{},res:{}};
 const c=vm.createContext({S,authEpoch:1,APP_MODE:'LIVE',fetchCandlesUnified:async()=>{throw Error('provider outage')},toast(){},drawAll(){}});
 vm.runInContext(part('let chartRequestId=','function computeATR('),c);await c.loadCandles();assert.equal(S.ch.source,'UNAVAILABLE');assert.equal(S.ch.candles.length,0);assert.equal(S.res,null);
});
