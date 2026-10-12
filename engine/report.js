'use strict';
// Builds the interactive HTML report: engine numbers + optional agent narrative,
// embedded as JSON into templates/report.html (self-contained, offline).
const fs = require('fs');
const path = require('path');
const { PmoError, loadProject, loadExtras } = require('./io');
const { validate } = require('./validate');
const { status } = require('./status');
const evm = require('./evm');
const agile = require('./agile');
const risk = require('./risk');
const util = require('./util');
const { cpm, withProgress } = require('./schedule');

const TEMPLATE = path.join(__dirname, '..', 'templates', 'report.html');
const UI_STRINGS = path.join(__dirname, '..', 'templates', 'report-i18n.json');
const NEXT_HORIZON_DAYS = 30;

// Engine functions reused by the report's what-if controls, so both use one formula.
const EMBED = ['const DAY = 86400000;', util.parseDate, util.addDays, util.round, evm.whatIfCost, agile.whatIfVelocity]
  .map((f) => (typeof f === 'string' ? f : f.toString()))
  .join('\n');

function bilingual(v) {
  if (v === null || v === undefined) return null;
  if (typeof v === 'string') return { ar: v, en: v };
  return { ar: v.ar ?? v.en ?? '', en: v.en ?? v.ar ?? '' };
}

function normalizeNarrative(n) {
  if (!n) return null;
  const list = (x) => (Array.isArray(x) ? x : []).map(bilingual);
  return { summary: bilingual(n.summary), highlights: list(n.highlights), recommendations: list(n.recommendations), decisions: list(n.decisions) };
}

function quadrant(s) {
  const hp = (s.power || 0) >= 3;
  const hi = (s.interest || 0) >= 3;
  return hp && hi ? 'manage-closely' : hp ? 'keep-satisfied' : hi ? 'keep-informed' : 'monitor';
}

function scheduleSection(data, at) {
  const p = data.project;
  const planned = cpm(data.schedule, p.startDate);
  const prog = withProgress(data.schedule, data.progress.filter((s) => !at || s.date <= at));
  const fc = at ? cpm(prog, p.startDate, { statusDate: at }) : planned;
  const fcBy = Object.fromEntries(fc.activities.map((a) => [a.id, a]));
  const srcBy = Object.fromEntries(prog.activities.map((a) => [a.id, a]));
  return planned.activities.map((a) => {
    const f = fcBy[a.id];
    const s = srcBy[a.id];
    return {
      id: a.id,
      name: a.name,
      duration: a.duration,
      plannedStart: a.earlyStart,
      plannedFinish: a.earlyFinish,
      baselineStart: s.baselineStart || null,
      baselineFinish: s.baselineFinish || null,
      forecastStart: f.earlyStart,
      forecastFinish: f.earlyFinish,
      state: f.state,
      percentComplete: s.percentComplete ?? 0,
      critical: f.critical,
      totalFloat: f.totalFloat,
    };
  });
}

function qualitySection(q) {
  const metrics = (q.metrics || []).map((m) => {
    const values = [...(m.values || [])].sort((a, b) => (a.date < b.date ? -1 : 1));
    const last = values.length ? values[values.length - 1] : null;
    const latest = last ? last.value : null;
    const direction = m.direction || 'min';
    const meets = latest === null || m.target === undefined || m.target === null ? null : direction === 'max' ? latest <= m.target : latest >= m.target;
    return { id: m.id, name: m.name, unit: m.unit ?? null, target: m.target ?? null, direction, latest, date: last ? last.date : null, meets, values };
  });
  const defects = q.defects || [];
  const open = defects.filter((d) => d.status === 'open');
  const bySeverity = { critical: 0, major: 0, minor: 0 };
  for (const d of open) if (d.severity in bySeverity) bySeverity[d.severity]++;
  return { metrics, defects: { open: open.length, closed: defects.length - open.length, bySeverity } };
}

function buildReportData(data, { date, narrative, lang } = {}) {
  const p = data.project;
  const m = p.methodology;
  const st = status(data, date);
  const at = st.date;
  const r = {
    meta: {
      name: p.name,
      methodology: m,
      lang: lang || p.language,
      currency: p.currency,
      statusDate: at,
      startDate: p.startDate,
      endDate: p.endDate,
      sponsor: p.sponsor || null,
      projectManager: p.projectManager || null,
      thresholds: { green: 0.95, amber: 0.85, ...(p.thresholds || {}) },
      generatedAt: new Date().toISOString(),
    },
    status: st,
    sections: {},
    omitted: [],
    narrative: normalizeNarrative(narrative),
  };
  const omit = (section, reason) => r.omitted.push({ section, reason });
  const reserves = data.budget ? data.budget.reserves || null : null;

  if (st.evm) {
    r.sections.cost = { agile: false, current: st.evm, trend: evm.trend(data), pvCurve: [{ date: p.startDate, pv: 0 }, ...(data.budget.plannedValue || [])], reserves };
  } else if (st.agile && st.agile.agileEvm) {
    r.sections.cost = { agile: true, current: st.agile.agileEvm, trend: [], pvCurve: [], reserves };
  } else omit('cost', 'EVM_UNAVAILABLE');

  if (m !== 'agile') {
    const acts = data.schedule ? data.schedule.activities || [] : [];
    if (acts.length) r.sections.schedule = { summary: st.schedule, activities: scheduleSection(data, at) };
    else omit('schedule', data.schedule ? 'SCHEDULE_EMPTY' : 'NO_DATA');
  }

  if (st.agile) {
    const bu = st.agile.burnup;
    r.sections.agile = {
      ...st.agile,
      sprintLengthDays: (data.backlog.releasePlan || {}).sprintLengthDays ?? null,
      lastEnd: bu.length ? bu[bu.length - 1].end : null,
      endDate: p.endDate,
    };
  }

  if (data.risks && (data.risks.risks || []).length) {
    const a = risk.analyze(data.risks);
    r.sections.risks = {
      counts: a.counts,
      totalEmv: a.totalEmv,
      heatmap: a.heatmap,
      contingency: reserves ? reserves.contingency ?? null : null,
      risks: a.risks.map((x) => ({
        id: x.id,
        title: x.title,
        probability: x.probability,
        impact: x.impact,
        score: x.score,
        level: x.level,
        status: x.status || 'open',
        owner: x.owner || null,
        responseStrategy: x.responseStrategy || null,
        response: x.response || null,
        emv: x.emv,
      })),
    };
  } else omit('risks', 'NO_DATA');

  const q = data.quality;
  if (q && ((q.metrics || []).length || (q.defects || []).length)) r.sections.quality = qualitySection(q);
  else omit('quality', 'NO_DATA');

  const changes = (data.changes && data.changes.changes) || [];
  if (changes.length)
    r.sections.changes = changes.map((c) => ({ id: c.id, title: c.title, type: c.type || null, status: c.status || null, date: c.date || null, impact: c.impact || null }));
  else omit('changes', 'NO_DATA');

  const issues = ((data.issues && data.issues.issues) || []).filter((i) => !['resolved', 'closed'].includes(i.status));
  if (issues.length)
    r.sections.issues = issues.map((i) => ({ id: i.id, title: i.title, priority: i.priority || null, owner: i.owner || null, due: i.due || null, status: i.status || 'open' }));
  else omit('issues', 'NO_DATA');

  const sh = (data.stakeholders && data.stakeholders.stakeholders) || [];
  if (sh.length) r.sections.stakeholders = sh.map((s) => ({ id: s.id, name: s.name, role: s.role || null, power: s.power, interest: s.interest, quadrant: quadrant(s) }));
  else omit('stakeholders', 'NO_DATA');

  const pending = ((data.approvals && data.approvals.approvals) || []).filter((a) => a.status === 'pending');
  const decisions = ((data.decisions && data.decisions.decisions) || []).slice(-10).reverse();
  if (pending.length || decisions.length)
    r.sections.governance = {
      pending: pending.map((a) => ({ id: a.id, title: a.title, agent: a.agent, rationale: a.rationale, impact: a.impact })),
      decisions: decisions.map((d) => ({ id: d.id, approvalId: d.approvalId, decision: d.decision, by: d.by, at: d.at, title: d.title })),
    };

  const horizon = at ? util.addDays(at, NEXT_HORIZON_DAYS) : null;
  const nextActs = r.sections.schedule
    ? r.sections.schedule.activities
        .filter((a) => a.state === 'in-progress' || (a.state !== 'complete' && a.forecastStart && horizon && a.forecastStart <= horizon))
        .sort((a, b) => (a.forecastStart < b.forecastStart ? -1 : 1))
        .map((a) => ({ id: a.id, name: a.name, forecastStart: a.forecastStart, forecastFinish: a.forecastFinish, critical: a.critical, state: a.state }))
    : [];
  const items = data.backlog
    ? (data.backlog.items || [])
        .filter((i) => i.status !== 'done')
        .sort((a, b) => (a.priority ?? 999) - (b.priority ?? 999))
        .slice(0, 5)
        .map((i) => ({ id: i.id, title: i.title, points: i.points ?? null, status: i.status || 'todo' }))
    : [];
  r.sections.next = { horizon, activities: nextActs, activeSprint: st.agile ? st.agile.activeSprint : null, items };

  return r;
}

const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// JSON inside <script>: escape "<" (no "</script>" breakout) and JS line separators.
const safeJson = (o) => JSON.stringify(o).replace(/[<\u2028\u2029]/g, (c) => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'));

function renderHtml(r) {
  const ui = JSON.parse(fs.readFileSync(UI_STRINGS, 'utf8'));
  return fs
    .readFileSync(TEMPLATE, 'utf8')
    .split('__PMO_TITLE__').join(escapeHtml(r.meta.name))
    .split('__PMO_LANG__').join(r.meta.lang)
    .split('__PMO_DIR__').join(r.meta.lang === 'ar' ? 'rtl' : 'ltr')
    .split('/*__PMO_ENGINE__*/').join(EMBED)
    .split('__PMO_UI__').join(safeJson(ui))
    .split('__PMO_DATA__').join(safeJson(r));
}

function readNarrative(file) {
  if (!file) return null;
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8').replace(/^﻿/, ''));
  } catch (e) {
    throw new PmoError('JSON_INVALID', { file, detail: e.message });
  }
}

function writeReport(dir, { date, lang, narrativeFile, out } = {}) {
  const data = loadProject(dir);
  const v = validate(data);
  if (!v.ok) throw new PmoError('VALIDATION_FAILED', { count: v.errors.length }, null, v.errors);
  const r = buildReportData({ ...data, ...loadExtras(dir) }, { date, lang, narrative: readNarrative(narrativeFile) });
  const target = out || path.join(dir, 'reports', `${r.meta.statusDate || 'report'}-report.html`);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, renderHtml(r), 'utf8');
  return { path: target, statusDate: r.meta.statusDate, lang: r.meta.lang, sections: Object.keys(r.sections), omitted: r.omitted };
}

module.exports = { buildReportData, renderHtml, writeReport };
