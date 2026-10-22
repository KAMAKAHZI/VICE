// OUV final deploy endpoint: intentionally fail-closed until the audited
// governance executor exists. Never infer authority from a UI click.
const headers = { 'content-type': 'application/json', 'cache-control': 'no-store' };
const respond = (statusCode, body) => ({ statusCode, headers, body: JSON.stringify(body) });
exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return respond(405, { status: 'action_required', message: 'POST required' });
  const authorization = event.headers.authorization || event.headers.Authorization || '';
  const token = authorization.match(/^Bearer (.+)$/)?.[1];
  if (!token) return respond(401, { status: 'action_required', message: 'Sign in required' });
  const base = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!base || !key) return respond(503, { status: 'action_required', message: 'Backend authentication configuration unavailable' });
  try {
    const auth = await fetch(base.replace(/\/$/, '') + '/auth/v1/user', {
      headers: { apikey: key, authorization: 'Bearer ' + token },
      signal: AbortSignal.timeout(8000)
    });
    if (!auth.ok) return respond(401, { status: 'action_required', message: 'Invalid or expired session' });
    const user = await auth.json();
    if (!user?.id) return respond(401, { status: 'action_required', message: 'Authenticated user unavailable' });
    // A valid login does not imply executive authorization. Require a
    // verified backend role, quorum, signature and transactional executor.
    return respond(409, {
      status: 'action_required',
      message: 'OUV execution is locked pending verified executive-role authorization, quorum certification, and an atomic governance executor.',
      checks: [{ name: 'authenticated_session', passed: true },
        { name: 'executive_authorization', passed: false },
        { name: 'quorum_certification', passed: false },
        { name: 'atomic_ouv_executor', passed: false }],
      issues: ['No verified execution pathway configured; no valuation records were changed.']
    });
  } catch {
    return respond(503, { status: 'action_required', message: 'Authentication service unavailable; no valuation records were changed' });
  }
};
