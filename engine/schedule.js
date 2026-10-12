'use strict';
const { addDays, daysBetween } = require('./util');
const { PmoError } = require('./io');

function normPreds(a) {
  return (a.predecessors || []).map((p) =>
    typeof p === 'string' ? { id: p, type: 'FS', lag: 0 } : { id: p.id, type: p.type || 'FS', lag: Number(p.lag) || 0 }
  );
}

function topoOrder(acts) {
  const ids = new Set(acts.map((a) => a.id));
  const indeg = {};
  const succ = {};
  for (const a of acts) {
    indeg[a.id] = 0;
    succ[a.id] = [];
  }
  for (const a of acts) {
    for (const p of normPreds(a)) {
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

function finishDate(start, ef, dur) {
  return addDays(start, dur > 0 ? ef - 1 : ef);
}

function cpm(schedule, startDate) {
  const acts = schedule.activities || [];
  const byId = Object.fromEntries(acts.map((a) => [a.id, a]));
  const { order, cycle } = topoOrder(acts);
  if (cycle) throw new PmoError('CYCLE', { file: 'schedule.json', ids: cycle.join(', ') }, 'schedule.json');

  const r = {};
  for (const a of acts) r[a.id] = { dur: Number(a.duration) || 0 };

  for (const id of order) {
    let es = 0;
    for (const p of normPreds(byId[id])) {
      const q = r[p.id];
      if (!q) continue;
      const d = r[id].dur;
      const c = { FS: q.ef + p.lag, SS: q.es + p.lag, FF: q.ef + p.lag - d, SF: q.es + p.lag - d }[p.type];
      es = Math.max(es, c);
    }
    r[id].es = es;
    r[id].ef = es + r[id].dur;
  }

  const duration = acts.length ? Math.max(...acts.map((a) => r[a.id].ef)) : 0;
  const succ = Object.fromEntries(acts.map((a) => [a.id, []]));
  for (const a of acts) for (const p of normPreds(a)) if (succ[p.id]) succ[p.id].push({ id: a.id, type: p.type, lag: p.lag });

  for (const id of [...order].reverse()) {
    let lf = duration;
    const d = r[id].dur;
    for (const s of succ[id]) {
      const q = r[s.id];
      const c = { FS: q.ls - s.lag, SS: q.ls - s.lag + d, FF: q.lf - s.lag, SF: q.lf - s.lag + d }[s.type];
      lf = Math.min(lf, c);
    }
    r[id].lf = lf;
    r[id].ls = lf - d;
  }

  const activities = acts.map((a) => {
    const x = r[a.id];
    const earlyFinish = finishDate(startDate, x.ef, x.dur);
    return {
      id: a.id,
      name: a.name || a.id,
      duration: x.dur,
      es: x.es,
      ef: x.ef,
      ls: x.ls,
      lf: x.lf,
      totalFloat: x.ls - x.es,
      critical: x.ls - x.es === 0,
      earlyStart: addDays(startDate, x.es),
      earlyFinish,
      percentComplete: a.percentComplete ?? null,
      baselineFinish: a.baselineFinish || null,
      finishVarianceDays: a.baselineFinish ? daysBetween(a.baselineFinish, earlyFinish) : null,
    };
  });

  const criticalPath = activities
    .filter((a) => a.critical)
    .sort((a, b) => a.es - b.es || a.ef - b.ef)
    .map((a) => a.id);

  return {
    projectDuration: duration,
    projectFinish: duration > 0 ? addDays(startDate, duration - 1) : startDate,
    activities,
    criticalPath,
  };
}

module.exports = { normPreds, topoOrder, findCycle, cpm };
