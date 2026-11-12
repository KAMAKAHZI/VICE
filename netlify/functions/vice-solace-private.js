// VICE OS private SOLACE compute gateway.
// This gateway contains NO proprietary algorithm and fails closed until a
// separately deployed private engine is configured and validated.
const ALLOWED_ORIGIN = 'https://vice4x.netlify.app';
const json = (status, data) => ({
  statusCode: status,
  headers: {
    'Content-Type': 'application/json',
    'Cache-Control': 'private, no-store',
    'X-Content-Type-Options': 'nosniff',
    'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
    Vary: 'Origin'
  },
  body: JSON.stringify(data)
});
exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });
  const origin = event.headers?.origin || event.headers?.Origin;
  if (origin && origin !== ALLOWED_ORIGIN) return json(403, { error: 'Origin not allowed' });
  const length = Number(event.headers?.['content-length'] || 0);
  if (length > 256000 || (event.body || '').length > 256000) return json(413, { error: 'Payload too large' });
  const token = (event.headers?.authorization || event.headers?.Authorization || '').match(/^Bearer (.+)$/i)?.[1];
  if (!token) return json(401, { error: 'Authentication required' });
  const supabaseUrl = process.env.SUPABASE_URL;
  const publicKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY;
  const privateEngine = process.env.VICE_SOLACE_PRIVATE_ENGINE_URL;
  const privateToken = process.env.VICE_SOLACE_ENGINE_TOKEN;
  if (!supabaseUrl || !publicKey || !privateEngine || !privateToken)
    return json(503, { error: 'Private SOLACE service not configured' });
  let endpoint;
  try {
    endpoint = new URL(privateEngine);
    if (endpoint.protocol !== 'https:' || endpoint.username || endpoint.password ||
        /^(localhost|127\\.|0\\.|10\\.|192\\.168\\.|169\\.254\\.|172\\.(1[6-9]|2[0-9]|3[01])\\.|\\[::1\\])/.test(endpoint.hostname))
      return json(503, { error: 'Private SOLACE service configuration invalid' });
  } catch {
    return json(503, { error: 'Private SOLACE service configuration invalid' });
  }
  let body;
  try { body = JSON.parse(event.body || '{}'); } catch { return json(400, { error: 'Invalid JSON' }); }
  if (!Array.isArray(body.bars) || body.bars.length < 30 || body.bars.length > 5000 ||
      body.bars.some(b => !b || !['o','h','l','c'].every(k => typeof b[k] === 'number' && Number.isFinite(b[k]))))
    return json(422, { error: 'Invalid OHLC candles' });
  if (body.options && (typeof body.options !== 'object' || Array.isArray(body.options))) return json(422, { error: 'Invalid options' });
  try {
    const auth = await fetch(supabaseUrl.replace(/\/$/, '') + '/auth/v1/user', {
      headers: { apikey: publicKey, authorization: 'Bearer ' + token },
      signal: AbortSignal.timeout(6000)
    });
    if (!auth.ok) return json(401, { error: 'Invalid session' });
    const user = await auth.json();
    if (!user?.id) return json(401, { error: 'Invalid session' });
    // A private engine must independently authorize the user; never trust a
    // client-provided user ID. No secrets or algorithm source return to browser.
    const result = await fetch(endpoint.href, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + privateToken,
        'X-Vice-User-Id': user.id
      },
      body: JSON.stringify({ bars: body.bars, options: body.options || {}, user_id: user.id }),
      signal: AbortSignal.timeout(12000)
    });
    if (!result.ok) return json(502, { error: 'Private calculation unavailable' });
    const data = await result.json();
    if (!data || typeof data !== 'object' || Array.isArray(data))
      return json(502, { error: 'Invalid calculation response' });
    return json(200, data);
  } catch {
    return json(503, { error: 'Calculation temporarily unavailable' });
  }
};
