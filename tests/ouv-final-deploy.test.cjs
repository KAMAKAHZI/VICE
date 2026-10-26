'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');

const handler = require('../netlify/functions/ouv-final-deploy.js').handler;
const proposal = 'PROP-20261019-548A9057-34F';
const hash = '3f108d0483466f24b62efce207086110a3b76e70d8198dc7135ec0f2068742ae';
const uid = '11111111-1111-4111-8111-111111111111';
const vid = '22222222-2222-4222-8222-222222222222';
const success = body => ({ ok: true, status: 200, json: async () => body });
const event = (action = 'reconcile_ouv', overrides = {}) => ({
  httpMethod: 'POST', headers: { authorization: 'Bearer valid.jwt.token' },
  body: JSON.stringify({ action, proposal_id: proposal, request_id: '12345678-1234-4234-8234-123456789abc',
    ...(action === 'execute_ouv' ? { confirm: 'EXECUTE APPROVED OUV' } : {}) }),
  ...overrides
});
function fakeBackend({ actor = true, ready = false, executedAtStart = false, automatic = false } = {}) {
  let executed = executedAtStart;
  let executorCalls = 0;
  const fetch = async url => {
    if (url.endsWith('/auth/v1/user')) return success({ id: uid });
    if (url.includes('vice_exec_signers')) return success(actor ? (url.includes('user_id=eq.') ? [{ role: 'CEO', user_id: uid }] : [{ role: 'CEO', user_id: uid }, { role: 'CFO', user_id: '33333333-3333-4333-8333-333333333333' }]) : []);
    if (url.includes('vice_exec_mfa_authorizations')) return success([]);
    if (url.includes('vice_ouv_execution_receipts')) return success(executed ? [{ proposal_id: proposal, payload_hash: hash, ouv_version_id: vid }] : []);
    if (url.includes('ouv_versions')) {
      if (!executed) return success([]);
      if (automatic && url.includes('order=effective_at.desc')) return success([{ id: '33333333-3333-4333-8333-333333333333', version: 'AUTO-RELEASE-iru_events-10', vice_ouv: 3, v4x_ouv: 480 }]);
      return success([{ id: vid, version: proposal, vice_ouv: 2.82645403, v4x_ouv: 452.2326448 }]);
    }
    if (url.includes('vice_dao_config')) return success([{ vice_price: executed ? (automatic ? 3 : 2.82645403) : 2, v4x_price: executed ? (automatic ? 480 : 452.2326448) : 320 }]);
    if (url.includes('vice_sovereign_proposals')) return success([{ id: proposal, payload_hash: hash, status: executed ? 'EXECUTED' : 'REVIEW' }]);
    if (url.includes('vice_ouv_activation_readiness')) return success({
      proposal_id: proposal, can_apply: ready, next_unmet_gates: ready ? [] : ['STRUCTURAL_EXECUTOR_LOCKED'],
      cryptographic_signatures_verified: ready, ceo_authorization_verified: ready, cfo_authorization_verified: ready,
      executive_authorizations: 2, review_complete: true, ledger_reconciled: true,
      baseline_compatible: true, proposed_ouv: { VICE: 2.82645403, V4X: 452.2326448 }
    });
    if (url.includes('vice_ouv_execute_approved')) {
      ++executorCalls;
      executed = true;
      return success({ status: 'executed', proposal_id: proposal });
    }
    throw Error('Unexpected URL ' + url);
  };
  return { fetch, getCalls: () => executorCalls };
}
test('OUV endpoint cannot execute when authorization/policy gates are absent', async t => {
  const previous = global.fetch;
  const env = { ...process.env };
  process.env.SUPABASE_URL = 'https://unit-test.invalid';
  process.env.SUPABASE_ANON_KEY = 'anon-test';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'server-test';
  delete process.env.VICE_OUV_EXECUTION_ENABLED;
  try {
    await t.test('GET is rejected', async () => {
      assert.equal((await handler({ httpMethod: 'GET', headers: {} })).statusCode, 405);
    });
    await t.test('anonymous is rejected', async () => {
      assert.equal((await handler(event('reconcile_ouv', { headers: {} }))).statusCode, 401);
    });
    await t.test('non-executive is rejected', async () => {
      global.fetch = fakeBackend({ actor: false }).fetch;
      assert.equal((await handler(event())).statusCode, 403);
    });
    await t.test('unresolved governance gate remains blocked', async () => {
      const fake = fakeBackend();
      global.fetch = fake.fetch;
      const r = await handler(event());
      assert.equal(r.statusCode, 409);
      assert.deepEqual(JSON.parse(r.body).issues, ['STRUCTURAL_EXECUTOR_LOCKED', 'CRYPTOGRAPHIC_SIGNATURE_VERIFICATION_REQUIRED']);
      assert.equal(fake.getCalls(), 0);
    });
    await t.test('server flag prevents execution', async () => {
      const fake = fakeBackend({ ready: true });
      global.fetch = fake.fetch;
      const r = await handler(event('execute_ouv'));
      assert.equal(r.statusCode, 409);
      assert.equal(fake.getCalls(), 0);
    });
    await t.test('published records verify only when authoritative prices reconcile', async () => {
      global.fetch = fakeBackend({ executedAtStart: true }).fetch;
      const r = await handler(event());
      assert.equal(r.statusCode, 200);
      assert.equal(JSON.parse(r.body).status, 'verified');
    });
    await t.test('subsequent legitimate automatic OUV appreciation reconciles against the latest effective version', async () => {
      global.fetch = fakeBackend({ executedAtStart: true, automatic: true }).fetch;
      const r = await handler(event());
      assert.equal(r.statusCode, 200);
      const data = JSON.parse(r.body);
      assert.equal(data.status, 'verified');
      assert.equal(data.ouv_version.VICE, 3);
      assert.equal(data.ouv_version.V4X, 480);
    });
    await t.test('explicit execution calls database RPC only when all gates pass', async () => {
      process.env.VICE_OUV_EXECUTION_ENABLED = 'true';
      const fake = fakeBackend({ ready: true });
      global.fetch = fake.fetch;
      const r = await handler(event('execute_ouv'));
      assert.equal(r.statusCode, 200);
      assert.equal(JSON.parse(r.body).status, 'verified');
      assert.equal(fake.getCalls(), 1);
    });
  } finally {
    global.fetch = previous;
    for (const k of Object.keys(process.env)) if (!(k in env)) delete process.env[k];
    Object.assign(process.env, env);
  }
});
