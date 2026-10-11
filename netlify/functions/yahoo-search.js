exports.handler = async (event) => {
  const q = (event.queryStringParameters?.q || '').trim();
  if (!q) return json(200, { quotes: [] });
  const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(q)}&quotesCount=25&newsCount=0&enableFuzzyQuery=true&quotesQueryId=tss_match_phrase_query`;
  try {
    const r = await fetch(url, { headers: { 'User-Agent':'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Safari/537.36','Accept':'application/json' }});
    const j = await r.json();
    const quotes = (j.quotes || []).map(q => ({ symbol:q.symbol, name:q.shortname||q.longname||q.symbol, exchange:q.exchange||q.exchDisp||'', type:q.quoteType||q.typeDisp||'', source:'YAHOO' }));
    return { statusCode:200, headers:{'Content-Type':'application/json','Access-Control-Allow-Origin':'*','Cache-Control':'public, max-age=60'}, body:JSON.stringify({ quotes }) };
  } catch (e) { return json(502, { error:e.message, quotes:[] }); }
};
function json(c, o){ return { statusCode:c, headers:{'Content-Type':'application/json','Access-Control-Allow-Origin':'*'}, body:JSON.stringify(o) }; }
