const test = require('node:test');
const assert = require('node:assert/strict');
const solace = require('../vice-solace-system.js');

function bars(count) {
  return Array.from({ length: count }, (_, i) => {
    const c = 100 + Math.sin(i / 9) * 4 + i / 100;
    return { t: 1700000000 + i * 60, o: c - 0.2, h: c + 0.8, l: c - 0.9, c, v: 100 };
  });
}

test('SOLACE produces finite F0/F100 levels with floor not above roof', () => {
  const input = bars(140);
  const result = solace.run(input, { structuralLookback: 100, modeLookback: false, tfSeconds: 60 });
  assert.equal(result.snapshots.length, input.length);
  for (const snapshot of result.snapshots) {
    assert.ok(Number.isFinite(snapshot.last.F0));
    assert.ok(Number.isFinite(snapshot.last.F100));
    assert.ok(snapshot.last.F0 <= snapshot.last.F100);
  }
});

test('SOLACE does not mutate supplied OHLC candles', () => {
  const input = bars(90);
  const copy = structuredClone(input);
  solace.run(input, { structuralLookback: 70, modeLookback: false });
  assert.deepEqual(input, copy);
});

test('chart snapshot lookup uses requested closed-bar boundary', () => {
  const result = solace.run(bars(100), { structuralLookback: 60, modeLookback: false });
  assert.equal(solace.at(result, 50).index, 49);
  assert.equal(solace.at(result, 100).index, 99);
});
