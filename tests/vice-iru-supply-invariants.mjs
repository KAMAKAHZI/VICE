// VICE IRU finite-supply and reference-value contract tests.
// Offline exact-integer model; NOT a live ledger reconciliation or appraisal.
import assert from 'node:assert/strict';

const SCALE = 100_000_000n;
const SUPPLY = 10_000_000n * SCALE;
const RESERVE = 7_500_000n * SCALE;
const HOLDER_POOL = 2_500_000n * SCALE;
const MAX_POOL = HOLDER_POOL;
const usd = x => BigInt(x) * SCALE;
const initial = () => ({reserve: RESERVE, holders: 0n, treasury: 0n, other: 0n, unallocatedHolderPool: HOLDER_POOL});
function reconcile(a) {
  for (const value of Object.values(a)) assert.ok(value >= 0n, 'Negative balance');
  assert.equal(Object.values(a).reduce((s, v) => s + v, 0n), SUPPLY, 'Supply mismatch');
}
function transfer(a, from, to, amount) {
  assert.ok(Object.hasOwn(a, from) && Object.hasOwn(a, to) && from !== to, 'Invalid categories');
  assert.equal(typeof amount, 'bigint', 'Authoritative amount must use bigint');
  assert.ok(amount > 0n && a[from] >= amount, 'Insufficient balance');
  const next = {...a, [from]: a[from] - amount, [to]: a[to] + amount};
  reconcile(next);
  assert.ok(next.holders + next.unallocatedHolderPool <= MAX_POOL, 'Holder pool exceeded');
  assert.equal(next.reserve, RESERVE, 'Reserve may not be reassigned by holder distribution');
  return next;
}
for (const symbol of ['VICE', 'V4X']) {
  let ledger = initial();
  reconcile(ledger);
  ledger = transfer(ledger, 'unallocatedHolderPool', 'holders', 100_000n * SCALE);
  assert.equal(ledger.holders, 100_000n * SCALE);
  assert.equal(ledger.unallocatedHolderPool, 2_400_000n * SCALE);
  assert.throws(() => transfer(ledger, 'reserve', 'holders', 1n * SCALE), /Holder pool exceeded|Reserve may not/);
  assert.throws(() => transfer(ledger, 'unallocatedHolderPool', 'holders', 2_500_000n * SCALE), /Insufficient/);
  assert.throws(() => transfer(ledger, 'holders', 'reserve', 0n), /Insufficient/);
  assert.throws(() => transfer(ledger, 'holders', 'reserve', 1.1), /bigint/);
  assert.equal(Object.values(ledger).reduce((s,v)=>s+v,0n), SUPPLY, symbol + ' supply conserved');
}
// Internal reference values are management assumptions, not independent fair-market value.
const viceReference = usd(2);
const v4xReference = usd(320);
assert.equal(v4xReference, viceReference * 160n);
assert.equal(viceReference * 10_000_000n, usd(20_000_000));
assert.equal(v4xReference * 10_000_000n, usd(3_200_000_000));
// Transfers preserve reference values unless an independently approved methodology explicitly changes them.
const before = initial();
const after = transfer(before, 'unallocatedHolderPool', 'holders', 10_000n * SCALE);
assert.notDeepEqual(before, after);
assert.equal(viceReference, usd(2));
assert.equal(v4xReference, usd(320));
console.log('PASS fixed supply / 75-25 partition / exact arithmetic / no scarcity-only reprice (offline model)');
