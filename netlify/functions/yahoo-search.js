'use strict';
// Read-only public market symbol discovery. Never proxy user-supplied URLs.
const json=(statusCode,payload,cache='no-store')=>({
 statusCode,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':cache,
 'X-Content-Type-Options':'nosniff','Access-Control-Allow-Origin':'*'},
 body:JSON.stringify(payload)
});
exports.handler=async(event={})=>{
 if(event.httpMethod&&event.httpMethod!=='GET')return json(405,{error:'Method not allowed',quotes:[]});
 const q=String(event.queryStringParameters?.q||'').trim();
 if(q.length<1)return json(200,{quotes:[]},'public, max-age=30');
 if(q.length>100)return json(400,{error:'Query too long',quotes:[]});
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),9000);
 try{
  const upstream=new URL('https://query1.finance.yahoo.com/v1/finance/search');
  upstream.searchParams.set('q',q);upstream.searchParams.set('quotesCount','25');
  upstream.searchParams.set('newsCount','0');upstream.searchParams.set('enableFuzzyQuery','true');
  upstream.searchParams.set('quotesQueryId','tss_match_phrase_query');
  const response=await fetch(upstream,{headers:{'User-Agent':'VICE OS market search/1.3.6','Accept':'application/json'},signal:controller.signal});
  if(!response.ok)return json(502,{error:'Market search provider unavailable (HTTP '+response.status+')',quotes:[]});
  const data=await response.json();
  const quotes=Array.isArray(data?.quotes)?data.quotes.slice(0,25)
   .filter(x=>typeof x.symbol==='string'&&x.symbol.length<=40)
   .map(x=>({symbol:x.symbol,name:String(x.shortname||x.longname||x.symbol).slice(0,160),
     exchange:String(x.exchange||x.exchDisp||'').slice(0,60),
     type:String(x.quoteType||x.typeDisp||'').slice(0,50),source:'YAHOO'})):[];
  return json(200,{quotes},'public, max-age=60');
 }catch{return json(502,{error:'Market search temporarily unavailable',quotes:[]})}
 finally{clearTimeout(timer)}
};
