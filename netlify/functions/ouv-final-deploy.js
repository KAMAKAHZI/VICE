// Server-side OUV gate audit. Financial execution remains locked until the
// issuer's approved on-chain quorum/timelock/transactional policy is implemented.
const headers = { 'content-type': 'application/json', 'cache-control': 'no-store' };
const reply = (statusCode, data) => ({ statusCode, headers, body: JSON.stringify(data) });
const fetchJson = async (url, headers) => {
  const r = await fetch(url, { headers, signal: AbortSignal.timeout(8000) });
  if (!r.ok) throw new Error('Upstream verification failed (' + r.status + ')');
  return r.json();
};
exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return reply(405, { status: 'action_required', message: 'POST required' });
  const bearer = (event.headers.authorization || event.headers.Authorization || '').match(/^Bearer (.+)$/)?.[1];
  if (!bearer) return reply(401, { status: 'action_required', message: 'Sign in required' });
  const base = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
  const anon = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base || !anon || !secret) return reply(503, { status: 'action_required', message: 'Server configuration incomplete' });
  let request;
  try { request = JSON.parse(event.body || '{}'); } catch { return reply(400, { status: 'action_required', message: 'Invalid JSON' }); }
  if (request.action !== 'reconcile_ouv') return reply(400, { status: 'action_required', message: 'Unsupported action' });
  try {
    const user = await fetchJson(base + '/auth/v1/user', { apikey: anon, authorization: 'Bearer ' + bearer });
    if (!user.id) return reply(401, { status: 'action_required', message: 'Invalid session' });
    const admin = await fetchJson(base + '/rest/v1/vice_exec_signers?select=role,user_id&user_id=eq.' + encodeURIComponent(user.id), { apikey: secret, authorization: 'Bearer ' + secret });
    if (!Array.isArray(admin) || !admin.some(s => s.role === 'CEO' || s.role === 'CFO'))
      return reply(403, { status: 'action_required', message: 'Authorized executive access required' });
    const p = await fetchJson(base + '/rest/v1/vice_sovereign_proposals?select=id,status,payload_hash,validation_until,quorum_verified_at,execute_after&status=eq.REVIEW&order=published_at.desc&limit=1', { apikey: secret, authorization: 'Bearer ' + secret });
    if (!p.length) return reply(409, { status: 'action_required', message: 'No pending OUV proposal found' });
    const proposal = p[0];
    const filter = 'proposal_id=eq.' + encodeURIComponent(proposal.id) + '&payload_hash=eq.' + encodeURIComponent(proposal.payload_hash);
    const [mfa, signed] = await Promise.all([
      fetchJson(base + '/rest/v1/vice_exec_mfa_authorizations?select=role,action,verified_at&' + filter + '&action=eq.APPROVE', { apikey: secret, authorization: 'Bearer ' + secret }),
      fetchJson(base + '/rest/v1/vice_exec_attestations?select=role,verified_at&' + filter, { apikey: secret, authorization: 'Bearer ' + secret })
    ]);
    const roles = new Set([...mfa, ...signed].filter(a => a.verified_at).map(a => a.role));
    const dual = roles.has('CEO') && roles.has('CFO');
    const reviewClosed = Date.now() >= Date.parse(proposal.validation_until);
    const checks = [
      { name: 'executive_approvals_2_of_2', passed: dual },
      { name: 'public_review_complete', passed: reviewClosed },
      { name: 'on_chain_quorum_verified', passed: Boolean(proposal.quorum_verified_at) },
      { name: 'execution_timelock_complete', passed: Boolean(proposal.execute_after) && Date.now() >= Date.parse(proposal.execute_after) },
      { name: 'atomic_governance_executor', passed: false }
    ];
    return reply(409, {
      status: 'action_required', proposal_id: proposal.id,
      message: dual ? 'CEO and CFO approvals confirmed; remaining execution gates are listed.' : 'Missing matching executive authorization.',
      checks, issues: checks.filter(c => !c.passed).map(c => c.name),
      note: 'No OUV values or unit balances were changed.'
    });
  } catch {
    return reply(503, { status: 'action_required', message: 'Could not verify governance records; no financial changes were made.' });
  }
};
