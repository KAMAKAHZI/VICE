/* VICE OS market-data integrity helpers. No synthetic prices in LIVE mode. */
(function(root){
  'use strict';
  function validateCandles(input, intervalMs, now=Date.now()){
    if(!Array.isArray(input)||!input.length)throw Error('No market candles');
    const sorted=[...input].sort((a,b)=>a.t-b.t),out=[];
    for(const b of sorted){
      if(![b.t,b.o,b.h,b.l,b.c].every(Number.isFinite)||b.t<=0||
        b.l>Math.min(b.o,b.c)||b.h<Math.max(b.o,b.c)||b.l>b.h||
        b.t>now+60000)throw Error('Invalid market OHLC');
      if(out.length&&out[out.length-1].t===b.t){out[out.length-1]=b;continue;}
      out.push(b);
    }
    const latest=out[out.length-1];
    const lag=now-latest.t;
    const stale=lag>Math.max(intervalMs*2,120000);
    return {candles:out,latest,stale,lagMs:lag,asOf:new Date(latest.t).toISOString()};
  }
  function mergeCandles(previous,incoming,limit=5000){
    const byTime=new Map();
    for(const b of previous||[])byTime.set(b.t,b);
    for(const b of incoming||[])byTime.set(b.t,b);
    return [...byTime.values()].sort((a,b)=>a.t-b.t).slice(-limit);
  }
  root.ViceMarketDataIntegrity={validateCandles,mergeCandles};
  if(typeof module!=='undefined'&&module.exports)module.exports=root.ViceMarketDataIntegrity;
})(typeof window==='undefined'?globalThis:window);
