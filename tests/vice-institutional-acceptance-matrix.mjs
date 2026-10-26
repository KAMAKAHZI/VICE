// Institutional acceptance matrix static integrity checks (offline, read-only).
// This is NOT a live production, staging, or independent audit.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const matrix = readFileSync(new URL('../docs/audit/INSTITUTIONAL_ACCEPTANCE_MATRIX_20261026.md', import.meta.url), 'utf8');
const rows = matrix.split('\n').filter(line => /^\| (?:FIN|SEC|TRA|DOC|APP|DB|INF|AUD|QA|REL|OPS)-\d{2} \|/.test(line));
assert.equal(rows.length, 23, 'All 23 acceptance criteria must be present');
const seen = new Set();
let totalWeight = 0;
for (const row of rows) {
  const cells = row.split('|').slice(1, -1).map(cell => cell.trim());
  assert.equal(cells.length, 7, 'Every criterion must have seven columns');
  const [id, domain, criterion, evidence, status, weight, nextProof] = cells;
  assert.ok(!seen.has(id), 'Duplicate criterion: ' + id);
  seen.add(id);
  assert.ok(domain && criterion && evidence && nextProof, 'Incomplete evidence mapping: ' + id);
  assert.ok(['VERIFIED', 'UNVERIFIED', 'PARTIAL', 'BLOCKED', 'NOT STARTED'].includes(status), 'Unknown state: ' + id);
  const n = Number(weight);
  assert.ok(Number.isSafeInteger(n) && n > 0, 'Invalid weight: ' + id);
  totalWeight += n;
}
assert.ok(totalWeight > 0, 'Missing acceptance weights');
for (const id of ['FIN-01','FIN-02','FIN-03','FIN-04','FIN-05','SEC-01','SEC-02','TRA-01','TRA-02','DOC-01','DB-01','INF-02','AUD-01','QA-01','REL-01']) {
  assert.ok(seen.has(id), 'Required acceptance gate absent: ' + id);
}
const verifiedWeight = rows.reduce((sum, row) => {
  const cells = row.split('|').slice(1, -1).map(x => x.trim());
  return sum + (cells[4] === 'VERIFIED' ? Number(cells[5]) : 0);
}, 0);
assert.equal(verifiedWeight, 0, 'Baseline may not assert verified criteria without current-commit evidence');
const requiredDefects = ['CEO-001','OUV-001','AUTH-001','DB-001','DOC-001','DATA-001'];
for (const id of requiredDefects) assert.ok(matrix.includes(id), 'Missing defect: ' + id);
assert.ok(matrix.includes('No claim of 100% readiness'), 'Release disclaimer removed');
console.log('PASS institutional matrix static contract: ' + rows.length + ' criteria; ' + totalWeight + ' total weight; ' + requiredDefects.length + ' tracked defects; 0 accepted without current evidence');
