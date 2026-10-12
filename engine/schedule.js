'use strict';
const { addDays, daysBetween } = require('./util');
const { PmoError } = require('./io');

function normPreds(a) {
  return (a.predecessors || []).map((p) =>
    typeof p === 'string' ? { id: p, type: 'FS', lag: 0 } : { id: p.id, type: p.type || 'FS', lag: Number(p.lag) || 0 }
  );
}

function topoOrder(acts, getPreds = normPreds) {
  const ids = new Set(acts.map((a) => a.id));
  const indeg = {};
  const succ = {};
  for (const a of acts) {
    indeg[a.id] = 0;
    succ[a.id] = [];
  }
  for (const a of acts) {
    for (const p of getPreds(a)) {
      if (!ids.has(p.id)) continue;
      indeg[a.id]++;
      succ[p.id].push(a.id);
    }
  }
  const queue = acts.filter((a) => indeg[a.id] === 0).map((a) => a.id);
  const order = [];
  while (queue.length) {
    const id = queue.shift();
    order.push(id);
    for (const s of succ[id]) if (--indeg[s] === 0) queue.push(s);
  }
  const done = new Set(order);
  const cycle = order.length < acts.length ? acts.filter((a) => !done.has(a.id)).map((a) => a.id) : null;
  return { order, cycle };
}

function findCycle(acts) {
  return topoOrder(acts).cycle;
}

// Turn source activities into network nodes. With a status date (forecast mode):
// complete → zero remaining duration; in progress → remaining duration starting at the
// status date, predecessors ignored (work already started); not started → cannot start
// before the status date.
function toNodes(acts, sd) {
  return acts.map((a) => {
    const dur = Number(a.duration) || 0;
    const pct = Number(a.percentComplete) || 0;
    if (sd === null) return { src: a, dur, min: 0, preds: normPreds(a), state: null };
    if (pct >= 100) return { src: a, dur: 0, min: 0, preds: normPreds(a), state: 'complete' };
    if (pct > 0) return { src: a, dur: Math.ceil(dur * (1 - pct / 100)), min: sd, preds: [], state: 'in-progress' };
    return { src: a, dur, min: sd, preds: normPreds(a), state: 'not-started' };
  });
}

// Overlay activity % complete recorded in progress snapshots (free records) onto the plan.
// Accepts one snapshot or a list (applied in order, later wins).
function withProgress(schedule, snaps) {
  const list = (Array.isArray(snaps) ? snaps : [snaps]).filter((s) => s && s.activityProgress);
  if (!list.length) return schedule;
  const pct = Object.assign({}, ...list.map((s) => s.activityProgress));
  return {
    ...schedule,
    activities: (schedule.activities || []).map((a) => (a.id in pct ? { ...a, percentComplete: pct[a.id] } : a)),
  };
}

function cpm(schedule, startDate, { statusDate = null } = {}) {
  const acts = schedule.activities || [];
  const sd = statusDate ? daysBetween(startDate, statusDate) + 1 : null;
  const nodes = toNodes(acts, sd);
  const byId = Object.fromEntries(nodes.map((n) => [n.src.id, n]));
  const { order, cycle } = topoOrder(
    nodes.map((n) => ({ id: n.src.id, preds: n.preds })),
    (x) => x.preds
  );
  if (cycle) throw new PmoError('CYCLE', { file: 'schedule.json', ids: cycle.join(', ') }, 'schedule.json');

  for (const id of order) {
    const n = byId[id];
    let es = n.min;
    for (const p of n.preds) {
      const q = byId[p.id];
      if (!q) continue;
      const c = { FS: q.ef + p.lag, SS: q.es + p.lag, FF: q.ef + p.lag - n.dur, SF: q.es + p.lag - n.dur }[p.type];
      es = Math.max(es, c);
    }
    n.es = es;
    n.ef = es + n.dur;
  }

  const duration = nodes.length ? Math.max(...nodes.map((n) => n.ef)) : 0;
  const succ = Object.fromEntries(nodes.map((n) => [n.src.id, []]));
  for (const n of nodes) for (const p of n.preds) if (succ[p.id]) succ[p.id].push({ id: n.src.id, type: p.type, lag: p.lag });

  for (const id of [...order].reverse()) {
    const n = byId[id];
    let lf = duration;
    for (const s of succ[id]) {
      const q = byId[s.id];
      const c = { FS: q.ls - s.lag, SS: q.ls - s.lag + n.dur, FF: q.lf - s.lag, SF: q.lf - s.lag + n.dur }[s.type];
      lf = Math.min(lf, c);
    }
    n.lf = lf;
    n.ls = lf - n.dur;
  }

  const activities = nodes.map((n) => {
    const a = n.src;
    const complete = n.state === 'complete';
    const earlyFinish = complete ? null : addDays(startDate, n.dur > 0 ? n.ef - 1 : n.ef);
    return {
      id: a.id,
      name: a.name || a.id,
      duration: Number(a.duration) || 0,
      remainingDuration: n.dur,
      state: n.state,
      es: n.es,
      ef: n.ef,
      ls: n.ls,
      lf: n.lf,
      totalFloat: n.ls - n.es,
      critical: !complete && n.ls - n.es === 0,
      earlyStart: complete ? null : addDays(startDate, n.es),
      earlyFinish,
      percentComplete: a.percentComplete ?? null,
      baselineFinish: a.baselineFinish || null,
      finishVarianceDays: a.baselineFinish && earlyFinish ? daysBetween(a.baselineFinish, earlyFinish) : null,
    };
  });

  const criticalPath = activities
    .filter((a) => a.critical)
    .sort((a, b) => a.es - b.es || a.ef - b.ef)
    .map((a) => a.id);

  return {
    projectDuration: duration,
    projectFinish: duration > 0 ? addDays(startDate, duration - 1) : statusDate || startDate,
    statusDate,
    activities,
    criticalPath,
  };
}

module.exports = { normPreds, topoOrder, findCycle, withProgress, cpm };
