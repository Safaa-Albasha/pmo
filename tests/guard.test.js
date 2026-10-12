'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { decide } = require('../hooks/guard');

const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'pmo-'));
fs.mkdirSync(path.join(cwd, '.pmo'));
fs.writeFileSync(path.join(cwd, '.pmo', 'project.json'), '{}');
const plain = fs.mkdtempSync(path.join(os.tmpdir(), 'plain-'));
const d = (tool_name, tool_input, dir = cwd) => decide({ cwd: dir, tool_name, tool_input });

test('blocks direct edits to protected records', () => {
  assert.strictEqual(d('Write', { file_path: path.join(cwd, '.pmo', 'risks.json') }).decision, 'deny');
  assert.strictEqual(d('Edit', { file_path: '.pmo/schedule.json' }).decision, 'deny');
  assert.strictEqual(d('Edit', { file_path: path.join(cwd, '.pmo', 'scope', 'wbs.json') }).decision, 'deny');
});

test('allows unprotected files and non-PMO folders', () => {
  assert.strictEqual(d('Write', { file_path: path.join(cwd, '.pmo', 'issues.json') }), null);
  assert.strictEqual(d('Write', { file_path: path.join(cwd, '.pmo', 'progress', '2026-01-01.json') }), null);
  assert.strictEqual(d('Write', { file_path: path.join(cwd, 'notes.md') }), null);
  assert.strictEqual(d('Write', { file_path: path.join(plain, '.pmo', 'risks.json') }, plain), null);
  assert.strictEqual(d('Bash', { command: 'rm -rf .pmo' }, plain), null);
});

test('shell rules', () => {
  assert.strictEqual(d('Bash', { command: 'node "/x/engine/cli.js" apply --id APR-0001 --decision approve --by PM' }).decision, 'ask');
  assert.strictEqual(d('Bash', { command: 'rm -rf .pmo' }).decision, 'deny');
  assert.strictEqual(d('Bash', { command: 'echo {} > .pmo/risks.json' }).decision, 'deny');
  assert.strictEqual(d('PowerShell', { command: 'Remove-Item .pmo\\decisions.json' }).decision, 'deny');
  assert.strictEqual(d('Bash', { command: 'cat .pmo/risks.json' }), null);
  assert.strictEqual(d('Bash', { command: 'node /x/engine/cli.js status --dir .pmo > out.json' }), null);
});

test('external write tools need confirmation', () => {
  assert.strictEqual(d('mcp__atlassian__createJiraIssue', {}).decision, 'ask');
  assert.strictEqual(d('mcp__slack__slack_send_message', {}).decision, 'ask');
  assert.strictEqual(d('mcp__atlassian__getJiraIssue', {}), null);
});

test('hook process prints PreToolUse JSON', () => {
  const input = JSON.stringify({ cwd, tool_name: 'Write', tool_input: { file_path: '.pmo/budget.json' } });
  const out = execFileSync(process.execPath, [path.join(__dirname, '..', 'hooks', 'guard.js')], { input, encoding: 'utf8' });
  const j = JSON.parse(out);
  assert.strictEqual(j.hookSpecificOutput.hookEventName, 'PreToolUse');
  assert.strictEqual(j.hookSpecificOutput.permissionDecision, 'deny');
  assert.match(j.hookSpecificOutput.permissionDecisionReason, /budget\.json/);
  const none = execFileSync(process.execPath, [path.join(__dirname, '..', 'hooks', 'guard.js')], {
    input: JSON.stringify({ cwd: plain, tool_name: 'Write', tool_input: { file_path: 'x' } }),
    encoding: 'utf8',
  });
  assert.strictEqual(none, '');
});
