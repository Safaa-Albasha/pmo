'use strict';
const fs = require('fs');
const path = require('path');
const { PmoError, readJson, writeJson, loadProject } = require('./io');
const { validate } = require('./validate');
const { cpm } = require('./schedule');

// Records that only change through an approved proposal.
const PROTECTED = [
  'project.json',
  'charter.md',
  'schedule.json',
  'budget.json',
  'risks.json',
  'changes.json',
  'scope/wbs.json',
  'decisions.json',
  'approvals.json',
];
const OPS = ['add', 'update', 'set', 'baseline', 'document'];
// Controlled documents published from a draft in .pmo/drafts/.
const DOCUMENTS = ['charter.md'];
const COLLECTIONS = {
  'risks.json': 'risks',
  'changes.json': 'changes',
  'schedule.json': 'activities',
  'stakeholders.json': 'stakeholders',
  'issues.json': 'issues',
  'scope/backlog.json': 'items',
  'scope/wbs.json': 'elements',
};
const SET_FILES = ['project.json', 'budget.json'];
const DATA_KEY = { 'project.json': 'project', 'schedule.json': 'schedule', 'budget.json': 'budget', 'risks.json': 'risks', 'scope/backlog.json': 'backlog' };

const nextId = (items, prefix) => `${prefix}-${String(items.length + 1).padStart(4, '0')}`;
const now = () => new Date().toISOString();
const clone = (x) => JSON.parse(JSON.stringify(x));

function getPath(obj, p) {
  return p.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
}

function setPath(obj, p, v) {
  const ks = p.split('.');
  let o = obj;
  for (const k of ks.slice(0, -1)) {
    if (o[k] == null || typeof o[k] !== 'object') o[k] = {};
    o = o[k];
  }
  o[ks[ks.length - 1]] = v;
}

// Computes the result of an operation without writing it.
function execute(dir, op) {
  if (!op || !OPS.includes(op.op)) throw new PmoError('OP_INVALID', { op: op && op.op });

  if (op.op === 'baseline') {
    const data = loadProject(dir);
    if (!data.schedule) throw new PmoError('FILE_MISSING', { file: 'schedule.json' }, 'schedule.json');
    const plan = cpm(data.schedule, data.project.startDate);
    const byId = Object.fromEntries(plan.activities.map((a) => [a.id, a]));
    const doc = clone(data.schedule);
    const pick = (a) => ({ id: a.id, baselineStart: a.baselineStart ?? null, baselineFinish: a.baselineFinish ?? null });
    const before = doc.activities.map(pick);
    for (const a of doc.activities) {
      a.baselineStart = byId[a.id].earlyStart;
      a.baselineFinish = byId[a.id].earlyFinish;
    }
    doc.baselineDate = op.date || now().slice(0, 10);
    return { file: 'schedule.json', doc, before, after: doc.activities.map(pick) };
  }

  if (op.op === 'document') {
    if (!DOCUMENTS.includes(op.file)) throw new PmoError('FILE_NOT_ALLOWED', { op: op.op, file: op.file });
    const src = path.join(dir, op.source || '');
    if (!op.source || !fs.existsSync(src)) throw new PmoError('FILE_MISSING', { file: op.source || 'source' }, op.source);
    const target = path.join(dir, op.file);
    const before = fs.existsSync(target) ? fs.readFileSync(target, 'utf8') : null;
    return { file: op.file, text: fs.readFileSync(src, 'utf8'), before, after: fs.readFileSync(src, 'utf8') };
  }

  if (op.op === 'set') {
    if (!SET_FILES.includes(op.file)) throw new PmoError('FILE_NOT_ALLOWED', { op: op.op, file: op.file });
    if (!op.path) throw new PmoError('ARG_MISSING', { arg: 'operation.path' });
    const doc = clone(readJson(dir, op.file));
    const before = getPath(doc, op.path) ?? null;
    setPath(doc, op.path, op.value);
    return { file: op.file, doc, before, after: op.value };
  }

  const coll = COLLECTIONS[op.file];
  if (!coll) throw new PmoError('FILE_NOT_ALLOWED', { op: op.op, file: op.file });
  const doc = clone(readJson(dir, op.file, { optional: true }) || { schemaVersion: 1, [coll]: [] });
  const items = (doc[coll] = doc[coll] || []);

  if (op.op === 'add') {
    if (!op.item || !op.item.id) throw new PmoError('ARG_MISSING', { arg: 'operation.item.id' });
    if (items.some((x) => x.id === op.item.id)) throw new PmoError('ID_DUPLICATE', { file: op.file, id: op.item.id }, op.file);
    items.push(op.item);
    return { file: op.file, doc, before: null, after: op.item };
  }

  const idx = items.findIndex((x) => x.id === op.id);
  if (idx < 0) throw new PmoError('ITEM_NOT_FOUND', { file: op.file, id: op.id }, op.file);
  const before = items[idx];
  const after = { ...before, ...(op.changes || {}), id: before.id };
  items[idx] = after;
  return { file: op.file, doc, before, after };
}

function checkValid(dir, file, doc) {
  const data = loadProject(dir);
  if (DATA_KEY[file]) data[DATA_KEY[file]] = doc;
  const v = validate(data);
  if (!v.ok) throw new PmoError('VALIDATION_FAILED', { count: v.errors.length }, null, v.errors);
}

function propose(dir, p) {
  if (!p || !p.agent) throw new PmoError('ARG_MISSING', { arg: 'agent' });
  if (!p.operation) throw new PmoError('ARG_MISSING', { arg: 'operation' });
  const r = execute(dir, p.operation);
  if (r.doc) checkValid(dir, r.file, r.doc);
  const doc = readJson(dir, 'approvals.json', { optional: true }) || { schemaVersion: 1, approvals: [] };
  const a = {
    id: nextId(doc.approvals, 'APR'),
    status: 'pending',
    createdAt: now(),
    agent: p.agent,
    title: p.title || null,
    rationale: p.rationale || null,
    impact: p.impact || null,
    operation: p.operation,
    file: r.file,
    before: r.before,
    after: r.after,
  };
  doc.approvals.push(a);
  writeJson(dir, 'approvals.json', doc);
  return a;
}

function list(dir, status = 'pending') {
  const doc = readJson(dir, 'approvals.json', { optional: true });
  const all = doc ? doc.approvals : [];
  return status === 'all' ? all : all.filter((a) => a.status === status);
}

function apply(dir, id, decision, { by, note } = {}) {
  if (!['approve', 'reject'].includes(decision))
    throw new PmoError('ENUM_INVALID', { file: 'apply', field: 'decision', allowed: 'approve, reject' });
  if (!by) throw new PmoError('ARG_MISSING', { arg: 'by' });
  const doc = readJson(dir, 'approvals.json');
  const a = doc.approvals.find((x) => x.id === id);
  if (!a) throw new PmoError('ITEM_NOT_FOUND', { file: 'approvals.json', id }, 'approvals.json');
  if (a.status !== 'pending') throw new PmoError('APPROVAL_RESOLVED', { id, status: a.status });

  if (decision === 'approve') {
    const r = execute(dir, a.operation);
    if (JSON.stringify(r.before) !== JSON.stringify(a.before)) throw new PmoError('PROPOSAL_STALE', { id });
    if (r.text !== undefined) fs.writeFileSync(path.join(dir, r.file), r.text, 'utf8');
    else {
      checkValid(dir, r.file, r.doc);
      writeJson(dir, r.file, r.doc);
    }
  }

  a.status = decision === 'approve' ? 'approved' : 'rejected';
  a.resolvedAt = now();
  a.resolvedBy = by;
  a.note = note || null;
  writeJson(dir, 'approvals.json', doc);

  const log = readJson(dir, 'decisions.json', { optional: true }) || { schemaVersion: 1, decisions: [] };
  const d = {
    id: nextId(log.decisions, 'DEC'),
    approvalId: id,
    decision: a.status,
    by,
    at: a.resolvedAt,
    agent: a.agent,
    title: a.title,
    file: a.file,
    before: a.before,
    after: a.after,
    note: a.note,
  };
  log.decisions.push(d);
  writeJson(dir, 'decisions.json', log);
  return { approval: a, decision: d };
}

module.exports = { PROTECTED, propose, apply, list, execute };
