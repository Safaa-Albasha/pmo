'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { validate } = require('../engine/validate');

const base = () => ({
  project: { name: 'P', methodology: 'waterfall', language: 'ar', currency: 'SAR', startDate: '2026-01-01', endDate: '2026-06-30' },
  schedule: { activities: [{ id: 'A', duration: 3 }, { id: 'B', duration: 2, predecessors: ['A'] }] },
  budget: { bac: 1000, plannedValue: [{ date: '2026-02-01', pv: 100 }, { date: '2026-03-01', pv: 300 }] },
  backlog: null,
  risks: { risks: [{ id: 'R1', title: 't', probability: 3, impact: 4, status: 'open' }] },
  progress: [{ date: '2026-02-01', percentComplete: 10, actualCost: 90, file: 'progress/2026-02-01.json' }],
});
const codes = (r) => r.errors.map((e) => e.code);

test('valid project passes', () => {
  const r = validate(base());
  assert.strictEqual(r.ok, true, JSON.stringify(r.errors));
});

test('project field and enum errors', () => {
  const d = base();
  delete d.project.name;
  d.project.methodology = 'kanban';
  d.project.endDate = '2025-12-01';
  const r = validate(d);
  assert.strictEqual(r.ok, false);
  assert.deepStrictEqual(codes(r).sort(), ['DATE_ORDER', 'ENUM_INVALID', 'FIELD_REQUIRED']);
  assert.match(r.errors[0].message.ar, /project\.json/);
});

test('schedule errors: duplicate, unknown pred, bad type, cycle', () => {
  const d = base();
  d.schedule.activities = [
    { id: 'A', duration: 1, predecessors: ['B'] },
    { id: 'B', duration: 1, predecessors: ['A', { id: 'Z' }, { id: 'A', type: 'XX' }] },
    { id: 'B', duration: -1 },
  ];
  const c = codes(validate(d));
  for (const code of ['ID_DUPLICATE', 'PRED_UNKNOWN', 'DEP_TYPE_INVALID', 'NUMBER_RANGE', 'CYCLE']) assert.ok(c.includes(code), code);
});

test('budget, progress and risk errors', () => {
  const d = base();
  d.budget.plannedValue[1].pv = 50;
  d.progress[0].percentComplete = 140;
  d.progress[0].activityProgress = { A: 120 };
  d.risks.risks[0].probability = 7;
  const c = codes(validate(d));
  assert.ok(c.includes('PV_DECREASING'));
  assert.strictEqual(c.filter((x) => x === 'NUMBER_RANGE').length, 3);
});

test('methodology-required files produce warnings', () => {
  const d = base();
  d.project.methodology = 'hybrid';
  const r = validate(d);
  assert.strictEqual(r.ok, true);
  assert.deepStrictEqual(r.warnings.map((w) => w.code), ['FILE_MISSING']);
});
