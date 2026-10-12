'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { addDays, daysBetween, isDate, round } = require('../engine/util');
const { format } = require('../engine/i18n');
const { PmoError, readJson, writeJson, loadProject } = require('../engine/io');

test('util date helpers', () => {
  assert.strictEqual(addDays('2026-01-01', 31), '2026-02-01');
  assert.strictEqual(daysBetween('2026-01-01', '2026-03-01'), 59);
  assert.strictEqual(isDate('2026-02-30'), false);
  assert.strictEqual(isDate('2026-02-28'), true);
  assert.strictEqual(round(0.888888, 4), 0.8889);
  assert.strictEqual(round(null), null);
});

test('format fills both languages', () => {
  const m = format('FILE_MISSING', { file: 'x.json' });
  assert.match(m.en, /x\.json/);
  assert.match(m.ar, /x\.json/);
});

test('readJson missing and optional', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pmo-'));
  assert.strictEqual(readJson(dir, 'nope.json', { optional: true }), null);
  assert.throws(() => readJson(dir, 'nope.json'), (e) => e instanceof PmoError && e.code === 'FILE_MISSING');
});

test('loadProject reads files and sorted progress', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pmo-'));
  writeJson(dir, 'project.json', { name: 'x' });
  writeJson(dir, 'progress/2026-02-01.json', { actualCost: 2 });
  writeJson(dir, 'progress/2026-01-01.json', { actualCost: 1 });
  const d = loadProject(dir);
  assert.strictEqual(d.project.name, 'x');
  assert.strictEqual(d.schedule, null);
  assert.deepStrictEqual(d.progress.map((p) => p.date), ['2026-01-01', '2026-02-01']);
});
