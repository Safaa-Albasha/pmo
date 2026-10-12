'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createProject } = require('../engine/init');
const { loadProject } = require('../engine/io');
const { validate } = require('../engine/validate');

const opts = { name: 'Test', methodology: 'hybrid', language: 'ar', currency: 'SAR', startDate: '2026-01-01', endDate: '2026-12-31', bac: 1000 };

test('creates a valid hybrid skeleton', () => {
  const dir = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'pmo-')), '.pmo');
  const r = createProject(dir, opts);
  assert.ok(r.files.includes('schedule.json'));
  assert.ok(r.files.includes('scope/backlog.json'));
  assert.ok(fs.existsSync(path.join(dir, 'progress')));
  const v = validate(loadProject(dir));
  assert.strictEqual(v.ok, true, JSON.stringify(v.errors));
  assert.strictEqual(v.warnings.length, 0);
});

test('waterfall has no backlog; agile has no schedule', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pmo-'));
  const w = createProject(path.join(root, 'w'), { ...opts, methodology: 'waterfall' });
  const a = createProject(path.join(root, 'a'), { ...opts, methodology: 'agile' });
  assert.ok(!w.files.includes('scope/backlog.json'));
  assert.ok(!a.files.includes('schedule.json'));
});

test('refuses to overwrite and validates required args', () => {
  const dir = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'pmo-')), '.pmo');
  createProject(dir, opts);
  assert.throws(() => createProject(dir, opts), (e) => e.code === 'PROJECT_EXISTS');
  assert.throws(() => createProject(dir + '2', { ...opts, name: undefined }), (e) => e.code === 'ARG_MISSING');
  assert.throws(() => createProject(dir + '3', { ...opts, methodology: 'x' }), (e) => e.code === 'VALIDATION_FAILED');
});
