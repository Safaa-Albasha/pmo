'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { propose, apply, list, PROTECTED } = require('../engine/approvals');
const { readJson } = require('../engine/io');

function copyExample() {
  const dir = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'pmo-')), '.pmo');
  fs.cpSync(path.join(__dirname, '..', 'examples', 'waterfall', '.pmo'), dir, { recursive: true });
  return dir;
}
const risks = (dir) => readJson(dir, 'risks.json').risks;
const newRisk = { id: 'R6', title: 'Flooding', probability: 2, impact: 5, status: 'open', owner: 'PM' };

test('protected list covers controlled records', () => {
  for (const f of ['risks.json', 'schedule.json', 'budget.json', 'project.json', 'decisions.json', 'approvals.json']) assert.ok(PROTECTED.includes(f), f);
});

test('propose does not change data; approve applies and logs', () => {
  const dir = copyExample();
  const a = propose(dir, { agent: 'risk-manager', title: 'Add flooding risk', rationale: 'Rainy season', operation: { op: 'add', file: 'risks.json', item: newRisk } });
  assert.strictEqual(a.id, 'APR-0001');
  assert.strictEqual(a.status, 'pending');
  assert.strictEqual(risks(dir).length, 5);
  assert.strictEqual(list(dir).length, 1);

  const r = apply(dir, 'APR-0001', 'approve', { by: 'Safaa', note: 'ok' });
  assert.strictEqual(r.approval.status, 'approved');
  assert.strictEqual(risks(dir).length, 6);
  assert.strictEqual(list(dir).length, 0);
  const dec = readJson(dir, 'decisions.json').decisions;
  assert.strictEqual(dec.length, 1);
  assert.deepStrictEqual([dec[0].id, dec[0].approvalId, dec[0].decision, dec[0].by], ['DEC-0001', 'APR-0001', 'approved', 'Safaa']);
});

test('reject leaves data unchanged but is logged', () => {
  const dir = copyExample();
  propose(dir, { agent: 'risk-manager', operation: { op: 'update', file: 'risks.json', id: 'R1', changes: { status: 'closed' } } });
  apply(dir, 'APR-0001', 'reject', { by: 'Safaa', note: 'still active' });
  assert.strictEqual(risks(dir).find((r) => r.id === 'R1').status, 'open');
  assert.strictEqual(readJson(dir, 'decisions.json').decisions[0].decision, 'rejected');
});

test('invalid proposal is refused and not queued', () => {
  const dir = copyExample();
  assert.throws(
    () => propose(dir, { agent: 'x', operation: { op: 'add', file: 'risks.json', item: { ...newRisk, probability: 9 } } }),
    (e) => e.code === 'VALIDATION_FAILED'
  );
  assert.strictEqual(list(dir, 'all').length, 0);
});

test('stale proposal cannot be approved', () => {
  const dir = copyExample();
  propose(dir, { agent: 'x', operation: { op: 'update', file: 'risks.json', id: 'R2', changes: { impact: 4 } } });
  propose(dir, { agent: 'x', operation: { op: 'update', file: 'risks.json', id: 'R2', changes: { probability: 1 } } });
  apply(dir, 'APR-0002', 'approve', { by: 'PM' });
  assert.throws(() => apply(dir, 'APR-0001', 'approve', { by: 'PM' }), (e) => e.code === 'PROPOSAL_STALE');
});

test('set and baseline operations', () => {
  const dir = copyExample();
  propose(dir, { agent: 'planner', operation: { op: 'set', file: 'budget.json', path: 'reserves.contingency', value: 30000 } });
  apply(dir, 'APR-0001', 'approve', { by: 'PM' });
  assert.strictEqual(readJson(dir, 'budget.json').reserves.contingency, 30000);

  const b = propose(dir, { agent: 'planner', operation: { op: 'baseline', date: '2026-01-01' } });
  assert.strictEqual(b.file, 'schedule.json');
  apply(dir, b.id, 'approve', { by: 'PM' });
  const s = readJson(dir, 'schedule.json');
  assert.strictEqual(s.baselineDate, '2026-01-01');
  assert.deepStrictEqual(
    s.activities.map((a) => a.baselineFinish),
    ['2026-01-20', '2026-02-19', '2026-03-01', '2026-04-30', '2026-05-20', '2026-05-30']
  );
});

test('guards on apply', () => {
  const dir = copyExample();
  propose(dir, { agent: 'x', operation: { op: 'add', file: 'risks.json', item: newRisk } });
  assert.throws(() => apply(dir, 'APR-0001', 'approve', {}), (e) => e.code === 'ARG_MISSING');
  assert.throws(() => apply(dir, 'APR-0001', 'maybe', { by: 'PM' }), (e) => e.code === 'ENUM_INVALID');
  assert.throws(() => apply(dir, 'APR-9999', 'approve', { by: 'PM' }), (e) => e.code === 'ITEM_NOT_FOUND');
  apply(dir, 'APR-0001', 'approve', { by: 'PM' });
  assert.throws(() => apply(dir, 'APR-0001', 'approve', { by: 'PM' }), (e) => e.code === 'APPROVAL_RESOLVED');
});

test('bad operations', () => {
  const dir = copyExample();
  assert.throws(() => propose(dir, { agent: 'x', operation: { op: 'delete', file: 'risks.json', id: 'R1' } }), (e) => e.code === 'OP_INVALID');
  assert.throws(() => propose(dir, { agent: 'x', operation: { op: 'set', file: 'risks.json', path: 'x', value: 1 } }), (e) => e.code === 'FILE_NOT_ALLOWED');
  assert.throws(() => propose(dir, { agent: 'x', operation: { op: 'update', file: 'risks.json', id: 'NOPE', changes: {} } }), (e) => e.code === 'ITEM_NOT_FOUND');
  assert.throws(() => propose(dir, { agent: 'x', operation: { op: 'add', file: 'risks.json', item: { ...newRisk, id: 'R1' } } }), (e) => e.code === 'ID_DUPLICATE');
  assert.throws(() => propose(dir, { operation: { op: 'add', file: 'risks.json', item: newRisk } }), (e) => e.code === 'ARG_MISSING');
});

test('document operation publishes an approved draft', () => {
  const dir = copyExample();
  fs.mkdirSync(path.join(dir, 'drafts'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'drafts', 'charter.md'), '# Charter v1\n');
  const a = propose(dir, { agent: 'initiation', title: 'Approve charter', operation: { op: 'document', file: 'charter.md', source: 'drafts/charter.md' } });
  assert.strictEqual(a.before, null);
  assert.strictEqual(a.after, '# Charter v1\n');
  assert.ok(!fs.existsSync(path.join(dir, 'charter.md')));
  apply(dir, a.id, 'approve', { by: 'PM' });
  assert.strictEqual(fs.readFileSync(path.join(dir, 'charter.md'), 'utf8'), '# Charter v1\n');
  assert.throws(() => propose(dir, { agent: 'x', operation: { op: 'document', file: 'risks.json', source: 'drafts/charter.md' } }), (e) => e.code === 'FILE_NOT_ALLOWED');
  assert.throws(() => propose(dir, { agent: 'x', operation: { op: 'document', file: 'charter.md', source: 'drafts/none.md' } }), (e) => e.code === 'FILE_MISSING');
});
