'use strict';
// Edits made by the project manager from the dashboard (edit mode). Nothing here writes a file
// itself: free records go through execute → validate → writeJson (the same path the engine uses),
// controlled records go through approvals.propose, and decisions through approvals.apply.
// Every action is appended to audit.json (who, when, what, before → after).
const { PmoError, readJson, writeJson } = require('./io');
const { isDate } = require('./util');
const approvals = require('./approvals');

const BY = 'PM via dashboard';
const MAX_TEXT = 2000;
const ID_RE = /^[A-Za-z0-9][\w.-]{0,39}$/;

// Free records the dashboard may write directly (protocol: "Free records — write directly, then validate").
const FREE = ['issues.json', 'lessons.json', 'scope/backlog.json'];

const E = {
  priority: ['critical', 'high', 'medium', 'low'],
  area: ['scope', 'schedule', 'cost', 'quality', 'resources', 'stakeholders'],
  issueStatus: ['open', 'in-progress', 'resolved', 'closed'],
  lessonCategory: ['scope', 'schedule', 'cost', 'quality', 'risk', 'stakeholders', 'resources', 'procurement', 'governance', 'technical'],
  lessonType: ['went-well', 'improve'],
  actionStatus: ['open', 'done', 'n/a'],
  itemStatus: ['todo', 'doing', 'done'],
  riskCategory: ['technical', 'external', 'organizational', 'project-management', 'procurement', 'regulatory', 'resources', 'cost', 'scope'],
  riskStatus: ['open', 'occurred', 'closed'],
  strategy: ['avoid', 'mitigate', 'transfer', 'accept', 'escalate', 'exploit', 'enhance', 'share'],
  changeType: ['scope', 'schedule', 'cost', 'quality', 'other'],
  attitude: ['supporter', 'neutral', 'resistor'],
  engagement: ['unaware', 'resistant', 'neutral', 'supportive', 'leading'],
  language: ['ar', 'en'],
};

const text = (req = false, max = MAX_TEXT) => ({ type: 'text', req, max });
const long = (req = false) => ({ type: 'text', req, max: MAX_TEXT, long: true });
const choice = (values, labels, req = false) => ({ type: 'enum', values, labels, req });
const score = (req = false) => ({ type: 'int', min: 1, max: 5, req });
const money = () => ({ type: 'num', min: 0, max: Number.MAX_SAFE_INTEGER });
const date = (req = false) => ({ type: 'date', req });

// mode: record = free record written now; propose = controlled change queued for approval.
const KINDS = {
  'issue.add': {
    file: 'issues.json', op: 'add', mode: 'record', idPattern: 'I-001',
    fields: {
      title: text(true, 300), description: long(), priority: choice(E.priority, 'lv_', true), impactArea: choice(E.area, 'ty_'),
      owner: text(true, 120), due: date(), status: choice(E.issueStatus, 'st_'), relatedRisk: text(false, 40),
    },
    defaults: (today) => ({ raised: today, raisedBy: BY, status: 'open', escalated: false }),
  },
  'issue.update': {
    file: 'issues.json', op: 'update', mode: 'record',
    fields: {
      title: text(false, 300), description: long(), priority: choice(E.priority, 'lv_'), impactArea: choice(E.area, 'ty_'),
      owner: text(false, 120), due: date(), status: choice(E.issueStatus, 'st_'), resolution: long(),
    },
  },
  'lesson.add': {
    file: 'lessons.json', op: 'add', mode: 'record', idPattern: 'L-001',
    fields: {
      date: date(), phase: text(false, 120), category: choice(E.lessonCategory, 'ty_', true), type: choice(E.lessonType, 'lt_', true),
      situation: long(true), impact: { ...long(), label: 'f_lessonImpact' }, recommendation: long(true), owner: text(false, 120),
      actionStatus: choice(E.actionStatus, 'st_'),
    },
    defaults: (today) => ({ date: today, actionStatus: 'open' }),
  },
  'item.status': {
    file: 'scope/backlog.json', op: 'update', mode: 'record',
    fields: { status: choice(E.itemStatus, 'st_', true) },
  },
  'activity.progress': {
    file: 'schedule.json', op: 'update', mode: 'propose',
    fields: { percentComplete: { type: 'num', min: 0, max: 100, req: true } },
    title: { ar: 'تحديث نسبة إنجاز النشاط {id} إلى {percentComplete}%', en: 'Update activity {id} progress to {percentComplete}%' },
  },
  'risk.add': {
    file: 'risks.json', op: 'add', mode: 'propose', idPattern: 'R1',
    fields: {
      title: text(true, 300), category: choice(E.riskCategory, 'rc_'), probability: score(true), impact: score(true),
      owner: text(true, 120), responseStrategy: choice(E.strategy, 'rs_'), response: long(), costImpact: money(),
    },
    defaults: () => ({ status: 'open' }),
    title: { ar: 'إضافة خطر {id}: {title}', en: 'Add risk {id}: {title}' },
  },
  'risk.update': {
    file: 'risks.json', op: 'update', mode: 'propose',
    fields: {
      probability: score(), impact: score(), status: choice(E.riskStatus, 'st_'), owner: text(false, 120),
      responseStrategy: choice(E.strategy, 'rs_'), response: long(), costImpact: money(),
    },
    title: { ar: 'تعديل الخطر {id}', en: 'Update risk {id}' },
  },
  'change.add': {
    file: 'changes.json', op: 'add', mode: 'propose', idPattern: 'CR-001',
    fields: {
      title: text(true, 300), description: long(), requestedBy: text(true, 120), type: choice(E.changeType, 'ty_', true),
      scheduleDays: { type: 'int', min: -10000, max: 10000 }, cost: { type: 'num', min: -Number.MAX_SAFE_INTEGER, max: Number.MAX_SAFE_INTEGER },
    },
    defaults: (today) => ({ date: today, status: 'submitted' }),
    // scheduleDays/cost live under item.impact like the change-control agent writes them.
    shape: (d) => {
      const { scheduleDays, cost, ...rest } = d;
      const impact = {};
      if (scheduleDays !== undefined) impact.scheduleDays = scheduleDays;
      if (cost !== undefined) impact.cost = cost;
      return Object.keys(impact).length ? { ...rest, impact } : rest;
    },
    unshape: (item) => ({ ...item, ...(item.impact || {}) }),
    title: { ar: 'طلب تغيير {id}: {title}', en: 'Change request {id}: {title}' },
  },
  'stakeholder.add': {
    file: 'stakeholders.json', op: 'add', mode: 'propose', idPattern: 'SH-01',
    fields: {
      name: text(true, 200), role: text(false, 120), power: score(true), interest: score(true), attitude: choice(E.attitude, 'at_'),
      current: choice(E.engagement, 'en_'), desired: choice(E.engagement, 'en_'), language: choice(E.language, 'lang_'),
    },
    title: { ar: 'إضافة صاحب مصلحة {id}: {name}', en: 'Add stakeholder {id}: {name}' },
  },
};

// Proposal wording the PM types (why / expected impact), required "why" like /pmo:approvals expects.
const META = { reason: long(true), impactNote: long(false) };

const today = () => new Date().toISOString().slice(0, 10);
const now = () => new Date().toISOString();

function invalid(details) {
  return new PmoError('INPUT_INVALID', { count: details.length }, null, details);
}

// Checks one payload against a field spec. Unknown fields are refused, so nothing unexpected reaches a file.
function checkFields(fields, data, { partial = false } = {}) {
  const out = {};
  const errors = [];
  const bad = (field, code, extra = {}) => errors.push({ field, code, ...extra });
  if (!data || typeof data !== 'object' || Array.isArray(data)) return { out, errors: [{ field: '*', code: 'NOT_OBJECT' }] };
  for (const k of Object.keys(data)) if (!fields[k]) bad(k, 'FIELD_UNKNOWN');
  for (const [k, f] of Object.entries(fields)) {
    let v = data[k];
    if (typeof v === 'string') v = v.trim();
    const blank = v === undefined || v === null || v === '';
    if (blank) {
      if (f.req && !partial) bad(k, 'FIELD_REQUIRED');
      continue;
    }
    if (f.type === 'text') {
      if (typeof v !== 'string') bad(k, 'TYPE_TEXT');
      else if (v.length > f.max) bad(k, 'TOO_LONG', { max: f.max });
      else out[k] = v;
    } else if (f.type === 'enum') {
      if (!f.values.includes(v)) bad(k, 'ENUM', { allowed: f.values });
      else out[k] = v;
    } else if (f.type === 'date') {
      if (!isDate(v)) bad(k, 'DATE');
      else out[k] = v;
    } else {
      const n = typeof v === 'string' && /^-?\d+(\.\d+)?$/.test(v) ? Number(v) : v;
      if (typeof n !== 'number' || !Number.isFinite(n) || n < f.min || n > f.max) bad(k, 'RANGE', { min: f.min, max: f.max });
      else if (f.type === 'int' && !Number.isInteger(n)) bad(k, 'INTEGER');
      else out[k] = n;
    }
  }
  if (partial && !errors.length && !Object.keys(out).length) bad('*', 'NOTHING_TO_CHANGE');
  return { out, errors };
}

function collection(dir, file) {
  const doc = readJson(dir, file, { optional: true });
  return doc ? doc[approvals.COLLECTIONS[file]] || [] : [];
}

// Next id in the file's own pattern (R6, I-003, CR-002, SH-06), skipping ids already reserved by pending proposals.
function nextItemId(dir, file, pattern) {
  const ids = collection(dir, file).map((x) => x.id);
  for (const a of approvals.list(dir, 'pending'))
    if (a.operation && a.operation.op === 'add' && a.operation.file === file && a.operation.item) ids.push(a.operation.item.id);
  let prefix = pattern.replace(/\d+$/, '');
  let width = pattern.length - prefix.length;
  let max = 0;
  for (const id of ids) {
    const m = String(id).match(/^(.*?)(\d+)$/);
    if (!m) continue;
    if (Number(m[2]) >= max) {
      max = Number(m[2]);
      prefix = m[1];
      width = m[2].length;
    }
  }
  return prefix + String(max + 1).padStart(width, '0');
}

function fill(tpl, vars) {
  return tpl.replace(/\{(\w+)\}/g, (_, k) => (vars[k] !== undefined && vars[k] !== null ? String(vars[k]) : ''));
}

function projectLanguage(dir) {
  try {
    return readJson(dir, 'project.json').language === 'en' ? 'en' : 'ar';
  } catch {
    return 'ar';
  }
}

function audit(dir, entry) {
  const doc = readJson(dir, 'audit.json', { optional: true }) || { schemaVersion: 1, entries: [] };
  const e = { id: `AUD-${String(doc.entries.length + 1).padStart(4, '0')}`, at: now(), by: BY, ...entry };
  doc.entries.push(e);
  writeJson(dir, 'audit.json', doc);
  return e;
}

// Builds the engine operation for a kind from checked fields.
function buildOperation(dir, kind, spec, fields, id) {
  if (spec.op === 'add') {
    const itemId = id || nextItemId(dir, spec.file, spec.idPattern);
    const base = spec.defaults ? spec.defaults(today()) : {};
    const item = { id: itemId, ...base, ...(spec.shape ? spec.shape(fields) : fields) };
    return { op: 'add', file: spec.file, item };
  }
  if (typeof id !== 'string' || !ID_RE.test(id)) throw invalid([{ field: 'id', code: 'FIELD_REQUIRED' }]);
  return { op: 'update', file: spec.file, id, changes: spec.shape ? spec.shape(fields) : fields };
}

function checkMeta(body, mode) {
  if (mode !== 'propose') return {};
  const { out, errors } = checkFields(META, { reason: body.reason, impactNote: body.impactNote });
  if (errors.length) throw invalid(errors);
  return out;
}

// One dashboard action: {kind, id?, data, reason?, impactNote?}.
function submit(dir, body) {
  if (!body || typeof body !== 'object') throw invalid([{ field: '*', code: 'NOT_OBJECT' }]);
  const spec = KINDS[body.kind];
  if (!spec) throw invalid([{ field: 'kind', code: 'ENUM', allowed: Object.keys(KINDS) }]);
  const { out, errors } = checkFields(spec.fields, body.data, { partial: spec.op === 'update' });
  if (errors.length) throw invalid(errors);
  const meta = checkMeta(body, spec.mode);
  const operation = buildOperation(dir, body.kind, spec, out, body.id);

  if (spec.mode === 'record') {
    if (!FREE.includes(spec.file) || approvals.PROTECTED.includes(spec.file)) throw new PmoError('FILE_NOT_ALLOWED', { op: operation.op, file: spec.file });
    const r = approvals.execute(dir, operation);
    approvals.checkValid(dir, r.file, r.doc);
    writeJson(dir, r.file, r.doc);
    const entry = audit(dir, { action: 'record', kind: body.kind, file: r.file, itemId: r.after.id, before: r.before, after: r.after });
    return { mode: 'record', file: r.file, id: r.after.id, before: r.before, after: r.after, audit: entry.id };
  }

  const lang = projectLanguage(dir);
  const vars = { ...out, id: operation.item ? operation.item.id : operation.id };
  const a = approvals.propose(dir, {
    agent: BY,
    title: fill(spec.title[lang], vars),
    rationale: meta.reason,
    impact: meta.impactNote || null,
    operation,
  });
  const entry = audit(dir, { action: 'propose', kind: body.kind, file: a.file, itemId: vars.id, approvalId: a.id, before: a.before, after: a.after });
  return { mode: 'proposal', approval: a, audit: entry.id };
}

// Which form fits a queued proposal (so Edit can reopen it); null = edit the raw operation.
function kindOf(op) {
  if (!op) return null;
  for (const [k, s] of Object.entries(KINDS)) {
    if (s.mode !== 'propose' || s.file !== op.file || s.op !== op.op) continue;
    const keys = Object.keys(op.op === 'add' ? (s.unshape ? s.unshape(op.item || {}) : op.item || {}) : op.changes || {});
    const allowed = new Set([...Object.keys(s.fields), 'id', ...Object.keys(s.defaults ? s.defaults(today()) : {}), 'impact']);
    if (keys.every((x) => allowed.has(x))) return k;
  }
  return null;
}

function decide(dir, body) {
  if (!body || typeof body.id !== 'string' || !ID_RE.test(body.id)) throw invalid([{ field: 'id', code: 'FIELD_REQUIRED' }]);
  if (!['approve', 'reject'].includes(body.decision)) throw invalid([{ field: 'decision', code: 'ENUM', allowed: ['approve', 'reject'] }]);
  const { out, errors } = checkFields({ note: long(false) }, { note: body.note });
  if (errors.length) throw invalid(errors);
  const r = approvals.apply(dir, body.id, body.decision, { by: BY, note: out.note || null });
  const op = r.approval.operation || {};
  const itemId = (op.item && op.item.id) || op.id || null;
  const entry = audit(dir, { action: body.decision, file: r.approval.file, itemId, approvalId: body.id, decisionId: r.decision.id, before: r.approval.before, after: r.approval.after, note: out.note || null });
  return { ...r, audit: entry.id };
}

// Edit = submit a corrected proposal, then reject the original with "superseded by <new id>" (as /pmo:approvals does).
function revise(dir, body) {
  if (!body || typeof body.id !== 'string' || !ID_RE.test(body.id)) throw invalid([{ field: 'id', code: 'FIELD_REQUIRED' }]);
  const orig = approvals.list(dir, 'all').find((a) => a.id === body.id);
  if (!orig) throw new PmoError('ITEM_NOT_FOUND', { file: 'approvals.json', id: body.id }, 'approvals.json');
  if (orig.status !== 'pending') throw new PmoError('APPROVAL_RESOLVED', { id: orig.id, status: orig.status });
  const op = orig.operation;
  const kind = kindOf(op);
  const meta = checkFields(META, { reason: body.reason || orig.rationale || '-', impactNote: body.impactNote === undefined ? orig.impact : body.impactNote });
  if (meta.errors.length) throw invalid(meta.errors);
  let operation;
  if (kind) {
    const spec = KINDS[kind];
    const { out, errors } = checkFields(spec.fields, body.data, { partial: spec.op === 'update' });
    if (errors.length) throw invalid(errors);
    operation = spec.op === 'add'
      ? { ...op, item: { ...op.item, ...(spec.shape ? spec.shape(out) : out), id: op.item.id } }
      : { ...op, changes: spec.shape ? spec.shape(out) : out };
  } else {
    // Raw edit for agent proposals the forms do not cover: same op, same file, same target.
    if (!['add', 'update', 'set'].includes(op.op)) throw new PmoError('FILE_NOT_ALLOWED', { op: op.op, file: op.file || '' });
    const o = body.operation;
    if (!o || typeof o !== 'object') throw invalid([{ field: 'operation', code: 'FIELD_REQUIRED' }]);
    const same = o.op === op.op && o.file === op.file && (op.op !== 'update' || o.id === op.id) && (op.op !== 'set' || o.path === op.path) &&
      (op.op !== 'add' || (o.item && o.item.id === op.item.id));
    if (!same) throw invalid([{ field: 'operation', code: 'TARGET_CHANGED' }]);
    if (JSON.stringify(o).length > 32 * 1024) throw invalid([{ field: 'operation', code: 'TOO_LONG', max: 32768 }]);
    operation = { op: o.op, file: o.file, ...(o.id !== undefined ? { id: o.id } : {}), ...(o.path !== undefined ? { path: o.path } : {}),
      ...(o.item !== undefined ? { item: o.item } : {}), ...(o.changes !== undefined ? { changes: o.changes } : {}), ...(o.value !== undefined ? { value: o.value } : {}) };
  }
  const lang = projectLanguage(dir);
  const mark = lang === 'ar' ? ' (معدّل)' : ' (edited)';
  const a = approvals.propose(dir, {
    agent: BY,
    title: (orig.title || orig.id).replace(/ \((معدّل|edited)\)$/, '') + mark,
    rationale: meta.out.reason,
    impact: meta.out.impactNote || null,
    operation,
  });
  const r = approvals.apply(dir, orig.id, 'reject', { by: BY, note: `superseded by ${a.id}` });
  const entry = audit(dir, { action: 'revise', file: a.file, itemId: (operation.item && operation.item.id) || operation.id || null, approvalId: a.id, replaces: orig.id, decisionId: r.decision.id, before: a.before, after: a.after });
  return { approval: a, superseded: r.approval, audit: entry.id };
}

// Field specs for the page's forms (no functions).
function describe() {
  const kinds = {};
  for (const [k, s] of Object.entries(KINDS))
    kinds[k] = { file: s.file, op: s.op, mode: s.mode, controlled: approvals.PROTECTED.includes(s.file), fields: s.fields };
  return { by: BY, kinds, meta: META };
}

module.exports = { BY, FREE, KINDS, submit, decide, revise, kindOf, describe, checkFields, nextItemId, audit };
