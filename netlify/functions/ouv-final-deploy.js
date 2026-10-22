'use strict';
// VICE OS: authenticated OUV reconciliation and conditional execution.
// No service key or SQL write is ever sent to the browser.
// Execution remains DISABLED until the issuer has deployed an audited,
// formally authorized database policy and explicitly enables the server flag.
const PROPOSAL = 'PROP-20261019-548A9057-34F';
const HASH = '3f108d0483466f24b62efce207086110a3b76e70d8198dc7135ec0f2068742ae';
const TARGET = { VICE: 2.82645403, V4X: 452.2326448 };
const headers = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' };
const reply = (code, body) => ({ statusCode: code, headers, body: JSON.stringify(body) });
const SAFE = { management_reference_only: true, holder_units_changed: false };
const urlBase = () => (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const publicKey = () => process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY;
const privateKey = () => process.env.SUPABASE_SERVICE_ROLE_KEY;
const requestJSON = async (url, options = {}) => {
  const r = await fetch(url, { ...options, signal: AbortSignal.timeout(10000) });
  let value = null;
  try { value = await r.json(); } catch { /* fail closed below */ }
  if (!r.ok) {
    const e = new Error('Supabase verification failed');
    e.httpStatus = r.status;
    throw e;
  }
  if (value === null) throw new Error('Malformed upstream verification response');
  return value;
};
const keyHeaders = (key) => ({ apikey: key, authorization: 'Bearer ' + key });
const userHeaders = (key, bearer) => ({ apikey: key, authorization: 'Bearer ' + bearer });
const rpc = (base, key, bearer, name, params) => requestJSON(base + '/rest/v1/rpc/' + name, {
  method: 'POST', headers: { ...userHeaders(key, bearer), 'content-type': 'application/json' },
  body: JSON.stringify(params)
});
const row = async (base, key, path) => requestJSON(base + '/rest/v1/' + path, {
  headers: keyHeaders(key)
});
const sameNumber = (a, b) => Number.isFinite(Number(a)) && Math.abs(Number(a) - b) < 0.00000001;
async function checkPublished(base, secret) {
  const id = encodeURIComponent(PROPOSAL);
  const [receipts, versions, config, proposals] = await Promise.all([
    row(base, secret, 'vice_ouv_execution_receipts?select=proposal_id,payload_hash,ouv_version_id,executed_at&proposal_id=eq.' + id + '&limit=2'),
    row(base, secret, 'ouv_versions?select=id,version,vice_ouv,v4x_ouv&version=eq.' + id + '&limit=2'),
    row(base, secret, 'vice_dao_config?select=vice_price,v4x_price&id=eq.1&limit=1'),
    row(base, secret, 'vice_sovereign_proposals?select=id,status,payload_hash&id=eq.' + id + '&limit=1')
  ]);
  if (![receipts, versions, config, proposals].every(Array.isArray)) throw new Error('Invalid reconciliation records');
  const receipt = receipts[0], version = versions[0], official = config[0], proposal = proposals[0];
  if (!receipt && !version) return { executed: false };
  const sound = receipts.length === 1 && versions.length === 1 && receipt &&
    receipt.payload_hash === HASH && version.id === receipt.ouv_version_id &&
    version.version === PROPOSAL && proposal?.status === 'EXECUTED' &&
    proposal.payload_hash === HASH && official &&
    sameNumber(version.vice_ouv, TARGET.VICE) && sameNumber(version.v4x_ouv, TARGET.V4X) &&
    sameNumber(official.vice_price, TARGET.VICE) && sameNumber(official.v4x_price, TARGET.V4X);
  return { executed: true, verified: Boolean(sound),
    receipt_id: receipt?.ouv_version_id || null, executed_at: receipt?.executed_at || null,
    ouv_version: sound ? TARGET : null,
    issues: sound ? [] : ['Execution records or authoritative prices do not reconcile'] };
}
async function readiness(base, anon, bearer) {
  const s = await rpc(base, anon, bearer, 'vice_ouv_activation_readiness', { p_proposal_id: PROPOSAL });
  if (!s || s.proposal_id !== PROPOSAL) throw new Error('Governance readiness response invalid');
  const issues = Array.isArray(s.next_unmet_gates) ? s.next_unmet_gates : ['UNVERIFIED_GOVERNANCE_READINESS'];
  // Solely the database authorization engine can unlock execution.
  const ready = s.can_apply === true && issues.length === 0 &&
    s.executive_authorizations === 2 && s.review_complete === true &&
    s.ledger_reconciled === true && s.baseline_compatible === true &&
    sameNumber(s.proposed_ouv?.VICE, TARGET.VICE) &&
    sameNumber(s.proposed_ouv?.V4X, TARGET.V4X);
  return { ready, issues, checks: {
    executive_authorizations: s.executive_authorizations,
    review_complete: s.review_complete,
    ledger_reconciled: s.ledger_reconciled,
    baseline_compatible: s.baseline_compatible,
    proposed_ouv: s.proposed_ouv,
    database_can_apply: s.can_apply
  } };
}
exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return reply(405, { status: 'action_required', message: 'POST required', ...SAFE });
  if ((event.body || '').length > 8192) return reply(413, { status: 'action_required', message: 'Request too large', ...SAFE });
  const bearer = (event.headers?.authorization || event.headers?.Authorization || '').match(/^Bearer ([A-Za-z0-9._-]+)$/)?.[1];
  if (!bearer) return reply(401, { status: 'action_required', message: 'Executive sign-in required', ...SAFE });
  let request;
  try { request = JSON.parse(event.body || '{}'); } catch {
    return reply(400, { status: 'action_required', message: 'Invalid JSON', ...SAFE });
  }
  if (!request || request.proposal_id !== PROPOSAL ||
    !['reconcile_ouv', 'execute_ouv'].includes(request.action)) {
    return reply(400, { status: 'action_required', message: 'Invalid action or proposal', ...SAFE });
  }
  if (request.action === 'execute_ouv' &&
    (request.confirm !== 'EXECUTE APPROVED OUV' || typeof request.request_id !== 'string' ||
     !/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(request.request_id))) {
    return reply(400, { status: 'action_required', message: 'Explicit execution confirmation and request ID required', ...SAFE });
  }
  const base = urlBase(), anon = publicKey(), secret = privateKey();
  if (!/^https:\/\//.test(base) || !anon || !secret) return reply(503, {
    status: 'action_required', message: 'Server integration not configured', ...SAFE
  });
  try {
    const user = await requestJSON(base + '/auth/v1/user', { headers: userHeaders(anon, bearer) });
    if (!user?.id) return reply(401, { status: 'action_required', message: 'Invalid session', ...SAFE });
    const signers = await row(base, secret, 'vice_exec_signers?select=user_id,role&user_id=eq.' + encodeURIComponent(user.id));
    if (!Array.isArray(signers) || !signers.some(v => ['CEO', 'CFO'].includes(v.role))) {
      return reply(403, { status: 'action_required', message: 'Designated executive authorization required', ...SAFE });
    }
    const publication = await checkPublished(base, secret);
    if (publication.executed) return reply(publication.verified ? 200 : 409, {
      status: publication.verified ? 'verified' : 'action_required',
      message: publication.verified ? 'OUV published and independently reconciled' : 'Execution reconciliation requires investigation',
      proposal_id: PROPOSAL, ...publication, ...SAFE
    });
    const gate = await readiness(base, anon, bearer);
    if (request.action === 'reconcile_ouv') return reply(gate.ready ? 200 : 409, {
      status: gate.ready ? 'ready' : 'action_required', proposal_id: PROPOSAL,
      message: gate.ready ? 'Eligible for explicit executive execution' : 'Execution blocked by authoritative governance checks',
      ...gate, ...SAFE
    });
    // Backend flag is a second independent go-live gate. User confirmation in chat
    // never grants permission to bypass a stored corporate governance restriction.
    if (process.env.VICE_OUV_EXECUTION_ENABLED !== 'true') return reply(409, {
      status: 'action_required', proposal_id: PROPOSAL,
      issues: [...gate.issues, 'SERVER_EXECUTION_DISABLED'],
      message: 'Production execution is disabled pending formal policy adoption and audited migration',
      checks: gate.checks, ...SAFE
    });
    if (!gate.ready) return reply(409, {
      status: 'action_required', proposal_id: PROPOSAL, message: 'Database governance gates not satisfied',
      ...gate, ...SAFE
    });
    const result = await rpc(base, anon, bearer, 'vice_ouv_execute_approved', { p_proposal_id: PROPOSAL });
    if (!['executed', 'already_executed'].includes(result?.status)) throw new Error('Executor result not recognized');
    const finalState = await checkPublished(base, secret);
    return reply(finalState.verified ? 200 : 409, {
      status: finalState.verified ? 'verified' : 'action_required',
      message: finalState.verified ? 'OUV published and reconciled' : 'Executor returned; independent database reconciliation failed',
      proposal_id: PROPOSAL, ...finalState, ...SAFE
    });
  } catch (error) {
    return reply(error?.httpStatus === 401 ? 401 : 503, {
      status: 'action_required', proposal_id: PROPOSAL,
      message: error?.httpStatus === 401 ? 'Session expired; sign in again' : 'Could not verify governance or execution. No successful publication is claimed.',
      ...SAFE
    });
  }
};
