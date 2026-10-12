'use strict';
const fs = require('fs');
const path = require('path');

class PmoError extends Error {
  constructor(code, params = {}, filePath = null, details = null) {
    super(code);
    this.code = code;
    this.params = params;
    this.path = filePath;
    this.details = details;
  }
}

function readJson(dir, rel, { optional = false } = {}) {
  const p = path.join(dir, rel);
  if (!fs.existsSync(p)) {
    if (optional) return null;
    throw new PmoError('FILE_MISSING', { file: rel }, rel);
  }
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8').replace(/^﻿/, ''));
  } catch (e) {
    throw new PmoError('JSON_INVALID', { file: rel, detail: e.message }, rel);
  }
}

function writeJson(dir, rel, data) {
  const p = path.join(dir, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

function listProgress(dir) {
  const pdir = path.join(dir, 'progress');
  if (!fs.existsSync(pdir)) return [];
  return fs
    .readdirSync(pdir)
    .filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f))
    .sort()
    .map((f) => ({ ...readJson(dir, 'progress/' + f), date: f.slice(0, 10), file: 'progress/' + f }));
}

function loadProject(dir) {
  return {
    project: readJson(dir, 'project.json'),
    schedule: readJson(dir, 'schedule.json', { optional: true }),
    budget: readJson(dir, 'budget.json', { optional: true }),
    backlog: readJson(dir, 'scope/backlog.json', { optional: true }),
    risks: readJson(dir, 'risks.json', { optional: true }),
    progress: listProgress(dir),
  };
}

// Registers that only the report needs.
function loadExtras(dir) {
  const o = (f) => readJson(dir, f, { optional: true });
  return {
    quality: o('quality.json'),
    changes: o('changes.json'),
    issues: o('issues.json'),
    stakeholders: o('stakeholders.json'),
    decisions: o('decisions.json'),
    approvals: o('approvals.json'),
  };
}

module.exports = { PmoError, readJson, writeJson, listProgress, loadProject, loadExtras };
