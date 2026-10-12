'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { analyze } = require('../engine/agile');

const backlog = {
  releasePlan: { totalPoints: 200, plannedSprints: 10, sprintLengthDays: 14 },
  sprints: [
    { id: 'S1', start: '2026-01-01', end: '2026-01-14', state: 'closed', plannedPoints: 20, completedPoints: 20 },
    { id: 'S2', start: '2026-01-15', end: '2026-01-28', state: 'closed', plannedPoints: 25, completedPoints: 25 },
    { id: 'S3', start: '2026-01-29', end: '2026-02-11', state: 'closed', plannedPoints: 30, completedPoints: 30 },
    { id: 'S4', start: '2026-02-12', end: '2026-02-25', state: 'active', plannedPoints: 25 },
  ],
  items: [
    { id: '1', points: 75, status: 'done' },
    { id: '2', points: 125, status: 'todo' },
  ],
};

test('velocity, remaining and forecast', () => {
  const r = analyze(backlog);
  assert.strictEqual(r.velocity, 25);
  assert.strictEqual(r.donePoints, 75);
  assert.strictEqual(r.remainingPoints, 125);
  assert.strictEqual(r.percentDone, 37.5);
  assert.strictEqual(r.sprintsCompleted, 3);
  assert.strictEqual(r.sprintsRemaining, 5);
  assert.strictEqual(r.forecastFinish, '2026-04-22');
  assert.deepStrictEqual(r.burnup.map((b) => b.completed), [20, 45, 75]);
  assert.deepStrictEqual(r.burndown.map((b) => b.remaining), [180, 155, 125]);
});

test('AgileEVM', () => {
  const r = analyze(backlog, { bac: 100000, ac: 40000 });
  assert.strictEqual(r.agileEvm.pv, 30000);
  assert.strictEqual(r.agileEvm.ev, 37500);
  assert.strictEqual(r.agileEvm.cpi, 0.9375);
  assert.strictEqual(r.agileEvm.spi, 1.25);
});

test('no closed sprints → null velocity', () => {
  const r = analyze({ sprints: [], items: [{ id: 'a', points: 5, status: 'todo' }] });
  assert.strictEqual(r.velocity, null);
  assert.strictEqual(r.sprintsRemaining, null);
  assert.strictEqual(r.totalPoints, 5);
  assert.strictEqual(r.agileEvm, null);
});
