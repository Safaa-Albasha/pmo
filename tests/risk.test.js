'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { analyze, level } = require('../engine/risk');

const doc = {
  risks: [
    { id: 'R1', title: 'Supplier delay', probability: 4, impact: 5, status: 'open', costImpact: 50000 },
    { id: 'R2', title: 'Key staff leaves', probability: 2, impact: 4, status: 'open', probabilityPct: 25, costImpact: 20000 },
    { id: 'R3', title: 'Minor scope creep', probability: 2, impact: 2, status: 'open' },
    { id: 'R4', title: 'Permit', probability: 5, impact: 5, status: 'closed', costImpact: 10000 },
  ],
};

test('levels', () => {
  assert.strictEqual(level(15), 'high');
  assert.strictEqual(level(6), 'medium');
  assert.strictEqual(level(5), 'low');
});

test('scores, EMV, counts, top and heatmap', () => {
  const r = analyze(doc);
  const by = Object.fromEntries(r.risks.map((x) => [x.id, x]));
  assert.strictEqual(by.R1.score, 20);
  assert.strictEqual(by.R1.emv, 35000);
  assert.strictEqual(by.R2.emv, 5000);
  assert.strictEqual(by.R3.emv, null);
  assert.deepStrictEqual(r.counts, { open: 3, closed: 1, high: 1, medium: 1, low: 1 });
  assert.strictEqual(r.totalEmv, 40000);
  assert.deepStrictEqual(r.top.map((x) => x.id), ['R1', 'R2', 'R3']);
  assert.strictEqual(r.heatmap[3][4].count, 1);
  assert.deepStrictEqual(r.heatmap[3][4].ids, ['R1']);
  assert.strictEqual(r.heatmap[4][4].count, 0);
});
