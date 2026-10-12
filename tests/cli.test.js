'use strict';
const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { execFileSync } = require('child_process');
const { run, parseArgs } = require('../engine/cli');

const W = path.join(__dirname, '..', 'examples', 'waterfall', '.pmo');
const tmpCopy = () => {
  const dir = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'pmo-')), '.pmo');
  fs.cpSync(W, dir, { recursive: true });
  return dir;
};

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
  assert.strictEqual(r.out.schedule.forecastFinish, '2026-06-23');
});

test('evm, schedule, risk, validate commands', () => {
  assert.strictEqual(run(['evm', '--dir', W]).out.current.cpi, 0.9302);
  assert.strictEqual(run(['evm', '--dir', W]).out.trend.length, 3);
  const s = run(['schedule', '--dir', W]).out;
  assert.strictEqual(s.planned.projectDuration, 150);
  assert.strictEqual(s.forecast.projectFinish, '2026-06-23');
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

test('propose (json and file), approvals, apply, decisions', () => {
  const dir = tmpCopy();
  const op = { agent: 'risk-manager', title: 'Close R4', operation: { op: 'update', file: 'risks.json', id: 'R4', changes: { status: 'closed' } } };
  assert.strictEqual(run(['propose', '--dir', dir, '--json', JSON.stringify(op)]).out.id, 'APR-0001');
  const f = path.join(path.dirname(dir), 'p.json');
  fs.writeFileSync(f, JSON.stringify({ ...op, title: 'dup' }));
  assert.strictEqual(run(['propose', '--dir', dir, '--file', f]).out.id, 'APR-0002');
  assert.strictEqual(run(['approvals', '--dir', dir]).out.length, 2);
  assert.strictEqual(run(['apply', '--dir', dir, '--id', 'APR-0001', '--decision', 'approve', '--by', 'PM']).code, 0);
  assert.strictEqual(run(['apply', '--dir', dir, '--id', 'APR-0002', '--decision', 'approve', '--by', 'PM']).out.error.code, 'PROPOSAL_STALE');
  assert.strictEqual(run(['decisions', '--dir', dir]).out.length, 1);
  assert.strictEqual(run(['approvals', '--dir', dir, '--status', 'all']).out.length, 2);
  assert.strictEqual(run(['propose', '--dir', dir]).out.error.code, 'ARG_MISSING');
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
