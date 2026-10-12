'use strict';
const { round } = require('./util');

// Default probability % for a 1–5 scale when probabilityPct is not given.
const P_PCT = { 1: 0.1, 2: 0.3, 3: 0.5, 4: 0.7, 5: 0.9 };

function level(score) {
  return score >= 15 ? 'high' : score >= 6 ? 'medium' : 'low';
}

function analyze(doc) {
  const risks = (doc && doc.risks) || [];
  const scored = risks.map((r) => {
    const score = (Number(r.probability) || 0) * (Number(r.impact) || 0);
    const prob = r.probabilityPct != null ? r.probabilityPct / 100 : P_PCT[r.probability] ?? 0;
    return { ...r, score, level: level(score), emv: r.costImpact != null ? round(prob * r.costImpact) : null };
  });
  const open = scored.filter((r) => r.status !== 'closed');

  // heatmap[probability-1][impact-1]
  const heatmap = Array.from({ length: 5 }, () => Array.from({ length: 5 }, () => ({ count: 0, ids: [] })));
  for (const r of open) {
    const cell = heatmap[r.probability - 1]?.[r.impact - 1];
    if (cell) {
      cell.count++;
      cell.ids.push(r.id);
    }
  }

  const top = [...open].sort((a, b) => b.score - a.score || (b.emv || 0) - (a.emv || 0)).slice(0, 5);

  return {
    counts: {
      open: open.length,
      closed: scored.length - open.length,
      high: open.filter((r) => r.level === 'high').length,
      medium: open.filter((r) => r.level === 'medium').length,
      low: open.filter((r) => r.level === 'low').length,
    },
    totalEmv: round(open.reduce((a, r) => a + (r.emv || 0), 0)),
    top,
    heatmap,
    risks: scored,
  };
}

module.exports = { analyze, level };
