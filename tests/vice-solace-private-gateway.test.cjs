const test = require('node:test');
const assert = require('node:assert/strict');
const { handler } = require('../netlify/functions/vice-solace-private.js');

const base = { httpMethod: 'POST', headers: {}, body: '{}' };

test('only POST requests are accepted', async () => {
  const response = await handler({ ...base, httpMethod: 'GET' });
  assert.equal(response.statusCode, 405);
});

test('requests from unknown origins are rejected', async () => {
  const response = await handler({
    ...base,
    headers: { origin: 'https://untrusted.example' }
  });
  assert.equal(response.statusCode, 403);
});

test('missing bearer authentication is rejected', async () => {
  const response = await handler(base);
  assert.equal(response.statusCode, 401);
});

test('oversized requests are rejected', async () => {
  const response = await handler({
    ...base,
    headers: { 'content-length': '256001' }
  });
  assert.equal(response.statusCode, 413);
});
