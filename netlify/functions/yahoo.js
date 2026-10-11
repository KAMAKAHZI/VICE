exports.handler = async (event) => {
  const { symbol, interval = '1h', range = '3mo' } = event.queryStringParameters || {};
  if (!symbol) return json(400, { error: 'symbol required' });
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=${interval}&range=${range}&includePrePost=false`;
  try {
    const r = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Safari/537.36',
        'Accept': 'application/json'
      }
    });
    return { statusCode: r.status, headers: { 'Content-Type':'application/json','Access-Control-Allow-Origin':'*','Cache-Control':'public, max-age=30' }, body: await r.text() };
  } catch (e) { return json(502, { error: e.message }); }
};
function json(c, o){ return { statusCode:c, headers:{'Content-Type':'application/json','Access-Control-Allow-Origin':'*'}, body:JSON.stringify(o) }; }
