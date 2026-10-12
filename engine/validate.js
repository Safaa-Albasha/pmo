'use strict';
const { isDate, parseDate } = require('./util');
const { format } = require('./i18n');
const { normPreds, findCycle } = require('./schedule');

const METHODS = ['waterfall', 'agile', 'hybrid'];
const LANGS = ['ar', 'en'];
const DEP_TYPES = ['FS', 'SS', 'FF', 'SF'];
const RISK_STATUS = ['open', 'closed', 'occurred'];
const ITEM_STATUS = ['todo', 'doing', 'done'];
const SPRINT_STATE = ['planned', 'active', 'closed'];

const isNum = (v, min = -Infinity, max = Infinity) => typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;

function validate(data) {
  const errors = [];
  const warnings = [];
  const push = (list) => (code, params) => list.push({ code, path: params.file || null, message: format(code, params) });
  const err = push(errors);
  const warn = push(warnings);
  const range = (file, field, v, min, max) => {
    if (v !== undefined && v !== null && !isNum(v, min, max)) err('NUMBER_RANGE', { file, field, min, max });
  };

  // project.json
  const p = data.project || {};
  const F = 'project.json';
  for (const f of ['name', 'methodology', 'language', 'currency', 'startDate', 'endDate'])
    if (p[f] === undefined || p[f] === '') err('FIELD_REQUIRED', { file: F, field: f });
  if (p.methodology && !METHODS.includes(p.methodology)) err('ENUM_INVALID', { file: F, field: 'methodology', allowed: METHODS.join(', ') });
  if (p.language && !LANGS.includes(p.language)) err('ENUM_INVALID', { file: F, field: 'language', allowed: LANGS.join(', ') });
  for (const f of ['startDate', 'endDate', 'statusDate'])
    if (p[f] !== undefined && p[f] !== '' && !isDate(p[f])) err('DATE_INVALID', { file: F, field: f });
  if (isDate(p.startDate) && isDate(p.endDate) && parseDate(p.startDate) > parseDate(p.endDate))
    err('DATE_ORDER', { file: F, start: 'startDate', end: 'endDate' });

  // schedule.json
  if (data.schedule) {
    const S = 'schedule.json';
    const acts = data.schedule.activities || [];
    const ids = new Set();
    for (const a of acts) {
      if (!a.id) err('FIELD_REQUIRED', { file: S, field: 'id' });
      else if (ids.has(a.id)) err('ID_DUPLICATE', { file: S, id: a.id });
      ids.add(a.id);
      range(S, `${a.id}.duration`, a.duration, 0, 100000);
      range(S, `${a.id}.percentComplete`, a.percentComplete, 0, 100);
    }
    for (const a of acts)
      for (const pr of normPreds(a)) {
        if (!ids.has(pr.id)) err('PRED_UNKNOWN', { file: S, id: a.id, pred: pr.id });
        if (!DEP_TYPES.includes(pr.type)) err('DEP_TYPE_INVALID', { file: S, id: a.id, type: pr.type });
      }
    const cycle = findCycle(acts);
    if (cycle) err('CYCLE', { file: S, ids: cycle.join(', ') });
  }

  // budget.json
  if (data.budget) {
    const B = 'budget.json';
    if (data.budget.bac === undefined) err('FIELD_REQUIRED', { file: B, field: 'bac' });
    else range(B, 'bac', data.budget.bac, 0, Number.MAX_SAFE_INTEGER);
    let prev = 0;
    for (const pt of data.budget.plannedValue || []) {
      if (!isDate(pt.date)) err('DATE_INVALID', { file: B, field: 'plannedValue.date' });
      range(B, `plannedValue[${pt.date}].pv`, pt.pv, 0, Number.MAX_SAFE_INTEGER);
      if (isNum(pt.pv) && pt.pv < prev) err('PV_DECREASING', { file: B, date: pt.date });
      if (isNum(pt.pv)) prev = pt.pv;
    }
  }

  // progress/*.json
  for (const s of data.progress || []) {
    range(s.file, 'percentComplete', s.percentComplete, 0, 100);
    range(s.file, 'actualCost', s.actualCost, 0, Number.MAX_SAFE_INTEGER);
    range(s.file, 'pointsCompleted', s.pointsCompleted, 0, Number.MAX_SAFE_INTEGER);
    for (const [id, v] of Object.entries(s.activityProgress || {})) range(s.file, `activityProgress.${id}`, v, 0, 100);
  }

  // risks.json
  if (data.risks) {
    const R = 'risks.json';
    const ids = new Set();
    for (const r of data.risks.risks || []) {
      if (!r.id) err('FIELD_REQUIRED', { file: R, field: 'id' });
      else if (ids.has(r.id)) err('ID_DUPLICATE', { file: R, id: r.id });
      ids.add(r.id);
      range(R, `${r.id}.probability`, r.probability, 1, 5);
      range(R, `${r.id}.impact`, r.impact, 1, 5);
      range(R, `${r.id}.probabilityPct`, r.probabilityPct, 0, 100);
      if (r.status && !RISK_STATUS.includes(r.status)) err('ENUM_INVALID', { file: R, field: `${r.id}.status`, allowed: RISK_STATUS.join(', ') });
    }
  }

  // scope/backlog.json
  if (data.backlog) {
    const K = 'scope/backlog.json';
    const ids = new Set();
    for (const i of data.backlog.items || []) {
      if (ids.has(i.id)) err('ID_DUPLICATE', { file: K, id: i.id });
      ids.add(i.id);
      range(K, `${i.id}.points`, i.points, 0, 10000);
      if (i.status && !ITEM_STATUS.includes(i.status)) err('ENUM_INVALID', { file: K, field: `${i.id}.status`, allowed: ITEM_STATUS.join(', ') });
    }
    for (const s of data.backlog.sprints || [])
      if (s.state && !SPRINT_STATE.includes(s.state)) err('ENUM_INVALID', { file: K, field: `${s.id}.state`, allowed: SPRINT_STATE.join(', ') });
  }

  // methodology needs
  if (['waterfall', 'hybrid'].includes(p.methodology) && !data.schedule) warn('FILE_MISSING', { file: 'schedule.json' });
  if (['agile', 'hybrid'].includes(p.methodology) && !data.backlog) warn('FILE_MISSING', { file: 'scope/backlog.json' });

  return { ok: errors.length === 0, errors, warnings };
}

module.exports = { validate };
