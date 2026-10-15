'use strict';
// Defensive read-only chart proxy. Intervals/ranges explicitly constrained.
const intervals=new Set(['1m','2m','5m','15m','30m','60m','90m','1h','1d','5d','1wk','1mo','3mo']);
const ranges=new Set(['1d','5d','1mo','3mo','6mo','1y','2y','5y','10y','ytd','max']);
const json=(statusCode,payload)=>({statusCode,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','Access-Control-Allow-Origin':'*','X-Content-Type-Options':'nosniff'},body:JSON.stringify(payload)});
exports.handler=async(event={})=>{
 if(event.httpMethod&&event.httpMethod!=='GET')return json(405,{error:'Method not allowed'});
 const {symbol,interval='1h',range='3mo'}=event.queryStringParameters||{};
 const sym=String(symbol||'').trim();
 if(!sym||sym.length>50||!/^[-a-zA-Z0-9._:^=]+$/.test(sym))return json(400,{error:'Valid market symbol required'});
 if(!intervals.has(interval)||!ranges.has(range))return json(400,{error:'Unsupported interval or date range'});
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);
 try{
   const url=new URL('https://query1.finance.yahoo.com/v8/finance/chart/'+encodeURIComponent(sym));
   url.searchParams.set('interval',interval);url.searchParams.set('range',range);url.searchParams.set('includePrePost','false');
   const upstream=await fetch(url,{headers:{'User-Agent':'VICE OS market data/1.3.6','Accept':'application/json'},signal:controller.signal});
   if(!upstream.ok)return json(502,{error:'Chart provider unavailable (HTTP '+upstream.status+')'});
   const raw=await upstream.text();
   if(raw.length>3500000)return json(502,{error:'Chart response exceeds safe size'});
   let parsed;try{parsed=JSON.parse(raw)}catch{return json(502,{error:'Invalid chart provider payload'})}
   const result=parsed?.chart?.result?.[0]; 
   if(!result||!Array.isArray(result.timestamp)||!result.timestamp.length||!result.indicators?.quote?.[0])return json(502,{error:'Market data unavailable for this symbol/interval',symbol:sym,interval,range});\n   return {statusCode:200,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'public, max-age=30','Access-Control-Allow-Origin':'*','X-Content-Type-Options':'nosniff'},body:JSON.stringify(parsed)};
 }catch{return json(502,{error:'Chart provider connection timeout or outage'})}
 finally{clearTimeout(timer)}
};
