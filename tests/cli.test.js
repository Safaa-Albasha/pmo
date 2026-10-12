'use strict';
const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { execFileSync } = require('child_process');
const { run, parseArgs } = require('../engine/cli');

const W = path.join(__dirname, '..', 'examples', 'waterfall', '.pmo');

test('parseArgs', () => {
  assert.deepStrictEqual(parseArgs(['evm', '--dir', 'x', '--date', '2026-01-01', '--flag']), {
    cmd: 'evm',
    opts: { dir: 'x', date: '2026-01-01', flag: true },
  });
});

test('status command', () => {
  const r = run(['status', '--dir', W]);
  assert.strictEqual(r.code, 0);
  assert.strictEqual(r.out.health.overall, 'amber');
});

test('evm, schedule, risk, validate commands', () => {
  assert.strictEqual(run(['evm', '--dir', W]).out.current.cpi, 0.9302);
  assert.strictEqual(run(['evm', '--dir', W]).out.trend.length, 3);
  assert.strictEqual(run(['schedule', '--dir', W]).out.projectDuration, 150);
  assert.strictEqual(run(['risk', '--dir', W]).out.counts.open, 4);
  assert.strictEqual(run(['validate', '--dir', W]).out.ok, true);
});

test('agile command on agile example', () => {
  const r = run(['agile', '--dir', path.join(__dirname, '..', 'examples', 'agile', '.pmo')]);
  assert.strictEqual(r.out.remainingPoints, 112);
});

test('errors are bilingual JSON with exit code 1', () => {
  const r = run(['nope']);
  assert.strictEqual(r.code, 1);
  assert.strictEqual(r.out.error.code, 'UNKNOWN_COMMAND');
  assert.ok(r.out.error.message_ar.length > 0);
  const m = run(['schedule', '--dir', path.join(__dirname, '..', 'examples', 'agile', '.pmo')]);
  assert.strictEqual(m.out.error.code, 'FILE_MISSING');
});

test('invalid data blocks computation', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pmo-'));
  fs.writeFileSync(path.join(dir, 'project.json'), JSON.stringify({ name: 'x', methodology: 'bad' }));
  const r = run(['status', '--dir', dir]);
  assert.strictEqual(r.out.error.code, 'VALIDATION_FAILED');
  assert.ok(r.out.error.details.length > 0);
});

test('init then status via real process', () => {
  const dir = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'pmo-')), '.pmo');
  const cli = path.join(__dirname, '..', 'engine', 'cli.js');
  const args = ['init', '--dir', dir, '--name', 'مشروع', '--methodology', 'waterfall', '--language', 'ar', '--currency', 'SAR', '--start', '2026-01-01', '--end', '2026-03-31', '--bac', '5000'];
  const out = JSON.parse(execFileSync(process.execPath, [cli, ...args], { encoding: 'utf8' }));
  assert.ok(out.files.includes('project.json'));
  const st = JSON.parse(execFileSync(process.execPath, [cli, 'status', '--dir', dir], { encoding: 'utf8' }));
  assert.strictEqual(st.project.name, 'مشروع');
});
