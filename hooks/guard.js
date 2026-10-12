#!/usr/bin/env node
'use strict';
// PreToolUse guard: keeps controlled .pmo records behind the approval flow.
// Active only when the session cwd contains .pmo/project.json.
const fs = require('fs');
const path = require('path');
const { PROTECTED } = require('../engine/approvals');
const { format } = require('../engine/i18n');

const EDIT_TOOLS = ['Write', 'Edit', 'MultiEdit', 'NotebookEdit'];
const SHELL_TOOLS = ['Bash', 'PowerShell'];
const MCP_WRITE = /(create|update|send|post|delete|remove|add|edit|write|transition|comment|reply|forward|upload|move|assign|publish|share)/i;
const SHELL_WRITE = /(>|\brm\b|\brmdir\b|\bdel\b|\bmv\b|\bcp\b|\bmove\b|\bcopy\b|sed\s+-i|\btee\b|\btruncate\b|Set-Content|Add-Content|Out-File|Clear-Content|Remove-Item|Move-Item|Copy-Item|New-Item|writeFileSync)/i;
const SHELL_DELETE = /(\brm\b|\brmdir\b|\bdel\b|\brd\b|Remove-Item)/i;
const APPLY = /cli\.js["']?\s+apply\b/;

const both = (code, params) => {
  const m = format(code, params);
  return `${m.ar}\n${m.en}`;
};

function pmoRel(cwd, p) {
  if (!p) return null;
  const rel = path.relative(path.join(cwd, '.pmo'), path.resolve(cwd, p));
  if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) return null;
  return rel.split(path.sep).join('/');
}

function decide(input) {
  const cwd = input.cwd || process.cwd();
  if (!fs.existsSync(path.join(cwd, '.pmo', 'project.json'))) return null;
  const tool = input.tool_name || '';
  const ti = input.tool_input || {};

  if (EDIT_TOOLS.includes(tool)) {
    const rel = pmoRel(cwd, ti.file_path || ti.notebook_path);
    return rel && PROTECTED.includes(rel) ? { decision: 'deny', reason: both('GUARD_DENY_FILE', { file: rel }) } : null;
  }

  if (SHELL_TOOLS.includes(tool)) {
    const c = ti.command || '';
    if (APPLY.test(c)) return { decision: 'ask', reason: both('GUARD_ASK_APPLY', { cmd: c.slice(c.search(APPLY)) }) };
    if (!/\.pmo/.test(c) || /cli\.js/.test(c)) return null;
    const touchesProtected = PROTECTED.some((f) => c.includes(path.basename(f))) || SHELL_DELETE.test(c);
    return touchesProtected && SHELL_WRITE.test(c) ? { decision: 'deny', reason: both('GUARD_DENY_SHELL') } : null;
  }

  if (tool.startsWith('mcp__') && MCP_WRITE.test(tool.split('__').pop())) {
    return { decision: 'ask', reason: both('GUARD_ASK_MCP', { tool }) };
  }
  return null;
}

function main() {
  let raw = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (d) => (raw += d));
  process.stdin.on('end', () => {
    let r = null;
    try {
      r = decide(JSON.parse(raw || '{}'));
    } catch {
      r = null; // never block the session because of a guard bug
    }
    if (r)
      process.stdout.write(
        JSON.stringify({
          hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: r.decision, permissionDecisionReason: r.reason },
        })
      );
  });
}

if (require.main === module) main();

module.exports = { decide };
