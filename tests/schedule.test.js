'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { cpm, findCycle } = require('../engine/schedule');

const net = {
  activities: [
    { id: 'A', name: 'A', duration: 3 },
    { id: 'B', name: 'B', duration: 2, predecessors: ['A'] },
    { id: 'C', name: 'C', duration: 4, predecessors: ['A'] },
    { id: 'D', name: 'D', duration: 2, predecessors: ['B', 'C'] },
  ],
};

test('forward/backward pass, float and critical path', () => {
  const r = cpm(net, '2026-01-01');
  const by = Object.fromEntries(r.activities.map((a) => [a.id, a]));
  assert.strictEqual(r.projectDuration, 9);
  assert.strictEqual(r.projectFinish, '2026-01-09');
  assert.deepStrictEqual([by.B.es, by.B.ef, by.B.ls, by.B.lf, by.B.totalFloat], [3, 5, 5, 7, 2]);
  assert.deepStrictEqual([by.D.es, by.D.ef], [7, 9]);
  assert.deepStrictEqual(r.criticalPath, ['A', 'C', 'D']);
  assert.strictEqual(by.A.earlyStart, '2026-01-01');
  assert.strictEqual(by.A.earlyFinish, '2026-01-03');
});

test('SS with lag and FF', () => {
  const r = cpm(
    {
      activities: [
        { id: 'A', duration: 10 },
        { id: 'B', duration: 6, predecessors: [{ id: 'A', type: 'SS', lag: 2 }] },
        { id: 'C', duration: 3, predecessors: [{ id: 'A', type: 'FF', lag: 1 }] },
      ],
    },
    '2026-01-01'
  );
  const by = Object.fromEntries(r.activities.map((a) => [a.id, a]));
  assert.deepStrictEqual([by.B.es, by.B.ef], [2, 8]);
  assert.deepStrictEqual([by.C.es, by.C.ef], [8, 11]);
  assert.strictEqual(r.projectDuration, 11);
  assert.strictEqual(by.A.totalFloat, 0);
  assert.strictEqual(by.B.totalFloat, 3);
});

test('cycle detection', () => {
  const acts = [
    { id: 'A', duration: 1, predecessors: ['C'] },
    { id: 'B', duration: 1, predecessors: ['A'] },
    { id: 'C', duration: 1, predecessors: ['B'] },
    { id: 'D', duration: 1 },
  ];
  assert.deepStrictEqual(findCycle(acts), ['A', 'B', 'C']);
  assert.throws(() => cpm({ activities: acts }, '2026-01-01'), (e) => e.code === 'CYCLE');
});

test('empty schedule', () => {
  const r = cpm({ activities: [] }, '2026-01-01');
  assert.strictEqual(r.projectDuration, 0);
  assert.deepStrictEqual(r.criticalPath, []);
});
