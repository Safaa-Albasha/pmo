'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { compute, pvAt, fromProject, trend } = require('../engine/evm');

test('PMI worked example', () => {
  const m = compute({ bac: 100000, pv: 50000, ev: 40000, ac: 45000 });
  assert.strictEqual(m.sv, -10000);
  assert.strictEqual(m.cv, -5000);
  assert.strictEqual(m.spi, 0.8);
  assert.strictEqual(m.cpi, 0.8889);
  assert.strictEqual(m.eac.typical, 112500);
  assert.strictEqual(m.eac.atypical, 105000);
  assert.strictEqual(m.eac.cpiSpi, 129375);
  assert.strictEqual(m.eacPrimary, 112500);
  assert.strictEqual(m.etc, 67500);
  assert.strictEqual(m.vac, -12500);
  assert.strictEqual(m.tcpi.bac, 1.0909);
  assert.strictEqual(m.percentComplete, 40);
});

test('zero AC and PV give null indices', () => {
  const m = compute({ bac: 1000, pv: 0, ev: 0, ac: 0 });
  assert.strictEqual(m.spi, null);
  assert.strictEqual(m.cpi, null);
  assert.strictEqual(m.eacPrimary, 1000);
});

test('pvAt interpolates cumulative curve from start date', () => {
  const budget = { bac: 300, plannedValue: [{ date: '2026-01-11', pv: 100 }, { date: '2026-01-21', pv: 300 }] };
  assert.strictEqual(pvAt(budget, '2026-01-01', '2025-12-31'), 0);
  assert.strictEqual(pvAt(budget, '2026-01-01', '2026-01-06'), 50);
  assert.strictEqual(pvAt(budget, '2026-01-01', '2026-01-16'), 200);
  assert.strictEqual(pvAt(budget, '2026-01-01', '2026-02-01'), 300);
});

const data = {
  project: { startDate: '2026-01-01', statusDate: '2026-01-21' },
  budget: { bac: 300, plannedValue: [{ date: '2026-01-11', pv: 100 }, { date: '2026-01-21', pv: 300 }] },
  progress: [
    { date: '2026-01-11', percentComplete: 30, actualCost: 100 },
    { date: '2026-01-21', percentComplete: 50, actualCost: 200 },
  ],
};

test('fromProject uses latest snapshot on/before status date', () => {
  const m = fromProject(data);
  assert.strictEqual(m.date, '2026-01-21');
  assert.strictEqual(m.ev, 150);
  assert.strictEqual(m.pv, 300);
  assert.strictEqual(m.ac, 200);
  const early = fromProject(data, '2026-01-15');
  assert.strictEqual(early.snapshotDate, '2026-01-11');
});

test('fromProject without snapshot throws NO_PROGRESS', () => {
  assert.throws(() => fromProject(data, '2026-01-05'), (e) => e.code === 'NO_PROGRESS');
});

test('trend has one point per snapshot', () => {
  const t = trend(data);
  assert.strictEqual(t.length, 2);
  assert.deepStrictEqual(t[0], { date: '2026-01-11', pv: 100, ev: 90, ac: 100, spi: 0.9, cpi: 0.9 });
});
