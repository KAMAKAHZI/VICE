'use strict';
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { handler } = require('../netlify/functions/ouv-final-deploy.js');
const PROPOSAL = 'PROP-20261019-548A9057-34F';
const originalFetch = global.fetch;
const originalEnv = { SUPABASE_URL: process.env.SUPABASE_URL, SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY, VICE_OUV_EXECUTION_ENABLED: process.env.VICE_OUV_EXECUTION_ENABLED };
const response = (value, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => value });
const event = (action = 'reconcile_ouv') => ({ httpMethod: 'POST', headers: { authorization: 'Bearer test-session' }, body: JSON.stringify({ action, proposal_id: PROPOSAL }) });
function mock(readiness) {
  let executions = 0;
  global.fetch = async (url, options) => {
    const path = String(url);
    if (path.endsWith('/auth/v1/user')) return response({ id: 'test-executive' });
    if (path.includes('/rest/v1/vice_exec_signers')) return response([{ user_id: 'test-executive', role: 'CEO' }]);
    if (path.includes('/rest/v1/rpc/vice_ouv_activation_readiness')) return response(readiness);
    if (path.includes('/rest/v1/rpc/vice_ouv_execute_approved')) { executions++; return response({ status: 'executed' }); }
    if (path.includes('/rest/v1/')) return response([]);
    throw new Error('Unexpected endpoint: ' + path);
  };
  return () => executions;
}
const valid = () => ({
  proposal_id: PROPOSAL, cryptographic_signatures_verified: true,
  ceo_authorization_verified: true, cfo_authorization_verified: true,
  executive_authorizations: 2, review_complete: true, ledger_reconciled: true,
  baseline_compatible: true, can_apply: true, next_unmet_gates: [],
  proposed_ouv: { VICE: 2.82645403, V4X: 452.2326448 }
});
async function runReadiness(input) {
  const calls = mock(input);
  const result = await handler(event());
  return { result: JSON.parse(result.body), status: result.statusCode, executions: calls() };
}
test.before(() => {
  process.env.SUPABASE_URL = 'https://test-project.supabase.co';
  process.env.SUPABASE_ANON_KEY = 'test-public-key';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-private-key';
  process.env.VICE_OUV_EXECUTION_ENABLED = 'false';
});
test.after(() => {
  global.fetch = originalFetch;
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) delete process.env[key]; else process.env[key] = value;
  }
});
test('separately reports verified CEO and CFO when both are independently verified', async () => {
  const { result, status, executions } = await runReadiness(valid());
  assert.equal(status, 200);
  assert.equal(result.status, 'ready');
  assert.equal(result.checks.ceo_authorization_verified, true);
  assert.equal(result.checks.cfo_authorization_verified, true);
  assert.equal(result.checks.cryptographic_signatures_verified, true);
  assert.equal(executions, 0);
});
test('CFO device attestation without verification cannot unlock execution', async () => {
  const input = valid();
  delete input.cfo_authorization_verified;
  const { result, status, executions } = await runReadiness(input);
  assert.equal(status, 409);
  assert.equal(result.ready, false);
  assert.equal(result.checks.ceo_authorization_verified, true);
  assert.equal(result.checks.cfo_authorization_verified, false);
  assert.equal(result.checks.cryptographic_signatures_verified, false);
  assert.ok(result.issues.includes('CRYPTOGRAPHIC_SIGNATURE_VERIFICATION_REQUIRED'));
  assert.equal(executions, 0);
});
test('two recorded authorizations without verified signatures remain blocked', async () => {
  const input = valid();
  input.cryptographic_signatures_verified = false;
  const { result, status, executions } = await runReadiness(input);
  assert.equal(status, 409);
  assert.equal(result.ready, false);
  assert.equal(result.checks.executive_authorizations, 2);
  assert.equal(result.checks.cryptographic_signatures_verified, false);
  assert.equal(executions, 0);
});
test('missing session returns 401 without accessing privileged endpoints', async () => {
  let called = false;
  global.fetch = async () => { called = true; throw new Error('Unexpected request'); };
  const result = await handler({ ...event(), headers: {} });
  assert.equal(result.statusCode, 401);
  assert.equal(called, false);
});
test('execute remains disabled even when all readiness checks pass', async () => {
  const calls = mock(valid());
  const result = await handler({
    ...event('execute_ouv'),
    body: JSON.stringify({ action: 'execute_ouv', proposal_id: PROPOSAL, confirm: 'EXECUTE APPROVED OUV', request_id: '12345678-1234-1234-1234-123456789abc' })
  });
  assert.equal(result.statusCode, 409);
  assert.ok(JSON.parse(result.body).issues.includes('SERVER_EXECUTION_DISABLED'));
  assert.equal(calls(), 0);
});
