'use strict';
const { addDays, round } = require('./util');
const { compute } = require('./evm');

const sum = (arr, f) => arr.reduce((a, x) => a + (Number(f(x)) || 0), 0);

// What-if: sprints and finish date at a given velocity (embedded in the HTML report).
function whatIfVelocity({ remainingPoints, lastEnd, sprintLengthDays }, velocity) {
  if (!(velocity > 0)) return { sprintsRemaining: null, forecastFinish: null };
  const n = Math.ceil(remainingPoints / velocity);
  return { sprintsRemaining: n, forecastFinish: lastEnd && sprintLengthDays ? addDays(lastEnd, n * sprintLengthDays) : null };
}

function analyze(backlog, { bac = null, ac = null } = {}) {
  const sprints = backlog.sprints || [];
  const items = backlog.items || [];
  const plan = backlog.releasePlan || {};
  const closed = sprints.filter((s) => s.state === 'closed');

  const last3 = closed.slice(-3);
  const velocity = last3.length ? sum(last3, (s) => s.completedPoints) / last3.length : null;
  const totalPoints = plan.totalPoints ?? sum(items, (i) => i.points);
  const donePoints = items.length
    ? sum(items.filter((i) => i.status === 'done'), (i) => i.points)
    : sum(closed, (s) => s.completedPoints);
  const remainingPoints = Math.max(totalPoints - donePoints, 0);
  const sprintsRemaining = velocity ? Math.ceil(remainingPoints / velocity) : null;

  const lastEnd = closed.length ? closed[closed.length - 1].end : null;
  const forecastFinish =
    sprintsRemaining !== null && lastEnd && plan.sprintLengthDays
      ? addDays(lastEnd, sprintsRemaining * plan.sprintLengthDays)
      : null;

  let cum = 0;
  const burnup = closed.map((s) => {
    cum += Number(s.completedPoints) || 0;
    return { sprint: s.id, end: s.end, completed: cum, scope: totalPoints };
  });
  const burndown = burnup.map((b) => ({ sprint: b.sprint, end: b.end, remaining: Math.max(totalPoints - b.completed, 0) }));

  let agileEvm = null;
  if (bac && plan.plannedSprints && totalPoints) {
    const ppc = closed.length / plan.plannedSprints;
    const apc = donePoints / totalPoints;
    agileEvm = { ppc: round(ppc, 4), apc: round(apc, 4), ...compute({ bac, pv: bac * ppc, ev: bac * apc, ac: ac || 0 }) };
  }

  return {
    velocity: round(velocity, 1),
    totalPoints,
    donePoints,
    remainingPoints,
    percentDone: totalPoints ? round((donePoints / totalPoints) * 100, 1) : null,
    sprintsCompleted: closed.length,
    sprintsRemaining,
    forecastFinish,
    activeSprint: sprints.find((s) => s.state === 'active')?.id || null,
    burnup,
    burndown,
    agileEvm,
  };
}

module.exports = { analyze, whatIfVelocity };
