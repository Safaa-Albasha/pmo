'use strict';
const evm = require('./evm');
const agile = require('./agile');
const risk = require('./risk');
const { cpm } = require('./schedule');
const { daysBetween } = require('./util');

const DEFAULT_TH = { green: 0.95, amber: 0.85 };
const RANK = { red: 3, amber: 2, green: 1 };

function rag(v, th) {
  if (v === null || v === undefined) return null;
  return v >= th.green ? 'green' : v >= th.amber ? 'amber' : 'red';
}

function worst(...xs) {
  const v = xs.filter(Boolean);
  return v.length ? v.reduce((a, b) => (RANK[b] > RANK[a] ? b : a)) : null;
}

function status(data, date) {
  const p = data.project;
  const th = { ...DEFAULT_TH, ...(p.thresholds || {}) };
  const m = p.methodology;
  const lastSnap = data.progress.length ? data.progress[data.progress.length - 1] : null;
  const at = date || p.statusDate || (lastSnap ? lastSnap.date : null);
  const out = {
    project: { name: p.name, methodology: m, language: p.language, currency: p.currency, startDate: p.startDate, endDate: p.endDate },
    date: at,
    notes: [],
  };

  if (m !== 'agile') {
    const snap = at ? evm.snapshotAt(data.progress, at) : null;
    if (data.budget && snap) out.evm = evm.fromProject(data, at);
    else out.notes.push('EVM_UNAVAILABLE');

    if (data.schedule) {
      if ((data.schedule.activities || []).length) {
        const c = cpm(data.schedule, p.startDate);
        out.schedule = {
          projectFinish: c.projectFinish,
          plannedFinish: p.endDate,
          finishVarianceDays: daysBetween(p.endDate, c.projectFinish),
          criticalPath: c.criticalPath,
        };
      } else out.notes.push('SCHEDULE_EMPTY');
    }
  }

  if (m !== 'waterfall' && data.backlog) {
    const snap = at ? evm.snapshotAt(data.progress, at) : lastSnap;
    out.agile = agile.analyze(data.backlog, { bac: data.budget ? data.budget.bac : null, ac: snap ? snap.actualCost : null });
  }

  if (data.risks) {
    const r = risk.analyze(data.risks);
    out.risks = {
      counts: r.counts,
      totalEmv: r.totalEmv,
      top3: r.top.slice(0, 3).map(({ id, title, score, level, owner, emv }) => ({ id, title, score, level, owner: owner || null, emv })),
    };
  }

  const idx = m === 'agile' ? out.agile && out.agile.agileEvm : out.evm;
  const scheduleRag = rag(idx ? idx.spi : null, th);
  const costRag = rag(idx ? idx.cpi : null, th);
  out.health = { overall: worst(scheduleRag, costRag), schedule: scheduleRag, cost: costRag };

  out.progress = {
    percentComplete: m === 'agile' ? (out.agile ? out.agile.percentDone : null) : out.evm ? out.evm.percentComplete : null,
    pointsDone: out.agile ? out.agile.donePoints : null,
    pointsRemaining: out.agile ? out.agile.remainingPoints : null,
    pointsTotal: out.agile ? out.agile.totalPoints : null,
  };

  return out;
}

module.exports = { status, rag, worst };
