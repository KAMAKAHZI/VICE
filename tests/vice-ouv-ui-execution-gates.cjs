'use strict';
/* Contract tests for the alternate module-mounted executive control. No real network or financial writes. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

class Element {
  constructor(tag) {
    this.tag = tag; this.children = []; this.events = {};
    this.disabled = false; this.hidden = false; this.textContent = '';
  }
  setAttribute(name, value) { this[name] = value; }
  append(...nodes) { this.children.push(...nodes); }
  addEventListener(type, handler) { this.events[type] = handler; }
  click() { return this.events.click?.(); }
  remove() { this.removed = true; }
}
const source = fs.readFileSync(path.join(__dirname, '../src/ouv-final-deploy.js'), 'utf8');
const staticSource = fs.readFileSync(path.join(__dirname, '../vice-ouv-final-deploy.js'), 'utf8');
const url = 'data:text/javascript;base64,' + Buffer.from(source).toString('base64');
const original = { document: global.document, window: global.window, fetch: global.fetch };
async function render({ enabled, httpStatus = 200, token = 'unit-test-jwt' }) {
  global.document = { createElement: tag => new Element(tag) };
  global.window = { confirm: () => true };
  const calls = [];
  global.fetch = async (endpoint, options) => {
    const body = JSON.parse(options.body);
    calls.push(body.action);
    return {
      ok: httpStatus === 200, status: httpStatus,
      json: async () => ({
        status: httpStatus === 401 ? 'action_required' : 'ready',
        checks: { ceo_authorization_verified: true, cfo_authorization_verified: true,
          cryptographic_signatures_verified: true, server_execution_enabled: enabled },
        message: httpStatus === 401 ? 'Session expired; sign in again' : 'Eligible',
        issues: []
      })
    };
  };
  const { mountOuvFinalDeploy } = await import(url);
  const container = new Element('div');
  const unmount = mountOuvFinalDeploy({ container, getAccessToken: async () => token });
  const [verify, execute, status, receipt] = container.children[0].children;
  return { verify, execute, status, receipt, calls, unmount };
}
test.after(() => {
  for (const [key, value] of Object.entries(original)) {
    if (value === undefined) delete global[key]; else global[key] = value;
  }
});
test('module control remains disabled when server kill switch is false', async () => {
  const ui = await render({ enabled: false });
  await ui.verify.click();
  assert.equal(ui.execute.disabled, true);
  assert.match(ui.status.textContent, /production execution remains disabled/i);
  await ui.execute.click();
  assert.deepEqual(ui.calls, ['reconcile_ouv']);
  ui.unmount();
});
test('module control remains disabled if server does not report the kill switch', async () => {
  const ui = await render({ enabled: undefined });
  await ui.verify.click();
  assert.equal(ui.execute.disabled, true);
  assert.deepEqual(ui.calls, ['reconcile_ouv']);
});
test('module control enables execution only after server confirms both conditions', async () => {
  const ui = await render({ enabled: true });
  await ui.verify.click();
  assert.equal(ui.execute.disabled, false);
  assert.match(ui.status.textContent, /explicit authorized execution/);
  assert.deepEqual(ui.calls, ['reconcile_ouv']);
});
test('expired session never enables execution or asks for a new executive signature', async () => {
  const ui = await render({ enabled: true, httpStatus: 401 });
  await ui.verify.click();
  assert.equal(ui.execute.disabled, true);
  assert.match(ui.status.textContent, /SESSION EXPIRED/);
  assert.match(ui.status.textContent, /approvals are unchanged/);
});
test('static executive control avoids explicit second refresh of missing sessions', () => {
  assert.match(staticSource, /auth\.getSession\(\)/);
  assert.doesNotMatch(staticSource, /auth\.refreshSession\(/);
  assert.match(staticSource, /server_execution_enabled===true/);
  assert.match(staticSource, /SESSION EXPIRED/);
});
