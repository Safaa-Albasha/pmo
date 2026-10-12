'use strict';
const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const { loadProject } = require('../engine/io');
const { status, rag } = require('../engine/status');

const ex = (m) => loadProject(path.join(__dirname, '..', 'examples', m, '.pmo'));

test('rag thresholds', () => {
  const th = { green: 0.95, amber: 0.85 };
  assert.strictEqual(rag(0.95, th), 'green');
  assert.strictEqual(rag(0.9, th), 'amber');
  assert.strictEqual(rag(0.84, th), 'red');
  assert.strictEqual(rag(null, th), null);
});

test('waterfall example', () => {
  const s = status(ex('waterfall'));
  assert.strictEqual(s.date, '2026-03-31');
  assert.deepStrictEqual([s.evm.pv, s.evm.ev, s.evm.ac, s.evm.spi, s.evm.cpi], [220000, 200000, 215000, 0.9091, 0.9302]);
  assert.deepStrictEqual(s.health, { overall: 'amber', schedule: 'amber', cost: 'amber' });
  assert.deepStrictEqual(s.schedule, {
    plannedFinish: '2026-05-30',
    baselineFinish: '2026-05-30',
    forecastFinish: '2026-06-23',
    deadline: '2026-06-30',
    slipDays: 24,
    deadlineVarianceDays: -7,
    criticalPath: ['D', 'E', 'F'],
  });
  assert.strictEqual(s.risks.top3[0].id, 'R1');
  assert.strictEqual(s.progress.percentComplete, 40);
  assert.strictEqual(s.agile, undefined);
});

test('agile example', () => {
  const s = status(ex('agile'));
  assert.strictEqual(s.agile.velocity, 22.7);
  assert.deepStrictEqual([s.progress.pointsDone, s.progress.pointsRemaining, s.progress.pointsTotal], [128, 112, 240]);
  assert.strictEqual(s.agile.sprintsRemaining, 5);
  assert.strictEqual(s.agile.forecastFinish, '2026-07-04');
  assert.deepStrictEqual([s.agile.agileEvm.spi, s.agile.agileEvm.cpi], [1.0667, 0.96]);
  assert.strictEqual(s.health.overall, 'green');
  assert.strictEqual(s.evm, undefined);
  assert.strictEqual(s.schedule, undefined);
});

test('hybrid example', () => {
  const s = status(ex('hybrid'));
  assert.deepStrictEqual([s.evm.spi, s.evm.cpi], [0.8684, 0.9429]);
  assert.strictEqual(s.health.overall, 'amber');
  assert.strictEqual(s.agile.donePoints, 60);
  assert.strictEqual(s.progress.pointsRemaining, 60);
  assert.strictEqual(s.progress.percentComplete, 55);
  assert.strictEqual(s.schedule.forecastFinish, '2026-07-20');
  assert.strictEqual(s.schedule.baselineFinish, '2026-06-23');
  assert.strictEqual(s.schedule.slipDays, 27);
});

test('missing progress adds note instead of throwing', () => {
  const d = ex('waterfall');
  d.progress = [];
  const s = status(d);
  assert.strictEqual(s.evm, undefined);
  assert.ok(s.notes.includes('EVM_UNAVAILABLE'));
  assert.strictEqual(s.health.overall, null);
});

test('latest snapshot drives status date and activity progress', () => {
  const d = ex('waterfall');
  d.progress.push({
    date: '2026-04-30',
    file: 'progress/2026-04-30.json',
    percentComplete: 55,
    actualCost: 300000,
    activityProgress: { C: 100, D: 40 },
  });
  const s = status(d);
  assert.strictEqual(s.date, '2026-04-30');
  assert.strictEqual(s.evm.ev, 275000);
  // sd=120; D 40% of 60 → 36 left → ef 156; E 156–176; F 176–186 → day 186 = 2026-07-05
  assert.strictEqual(s.schedule.forecastFinish, '2026-07-05');
});
