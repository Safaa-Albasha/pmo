'use strict';
const { parseDate, round } = require('./util');
const { PmoError } = require('./io');

function compute({ bac, pv, ev, ac }) {
  const sv = ev - pv;
  const cv = ev - ac;
  const spi = pv > 0 ? ev / pv : null;
  const cpi = ac > 0 ? ev / ac : null;
  const eac = {
    typical: cpi ? bac / cpi : null,
    atypical: ac + (bac - ev),
    cpiSpi: cpi && spi ? ac + (bac - ev) / (cpi * spi) : null,
  };
  const eacPrimary = eac.typical ?? eac.atypical;
  return {
    bac: round(bac),
    pv: round(pv),
    ev: round(ev),
    ac: round(ac),
    sv: round(sv),
    cv: round(cv),
    spi: round(spi, 4),
    cpi: round(cpi, 4),
    eac: { typical: round(eac.typical), atypical: round(eac.atypical), cpiSpi: round(eac.cpiSpi) },
    eacPrimary: round(eacPrimary),
    etc: round(eacPrimary - ac),
    vac: round(bac - eacPrimary),
    tcpi: {
      bac: bac - ac !== 0 ? round((bac - ev) / (bac - ac), 4) : null,
      eac: eacPrimary - ac !== 0 ? round((bac - ev) / (eacPrimary - ac), 4) : null,
    },
    percentComplete: bac > 0 ? round((ev / bac) * 100, 1) : null,
    percentSpent: bac > 0 ? round((ac / bac) * 100, 1) : null,
  };
}

// What-if: EAC if the remaining work is done at cpiFuture (embedded in the HTML report).
function whatIfCost({ bac, ev, ac }, cpiFuture) {
  if (!(cpiFuture > 0)) return null;
  return round(ac + (bac - ev) / cpiFuture);
}

function pvAt(budget, startDate, date) {
  const curve = [...(budget.plannedValue || [])].sort((a, b) => (a.date < b.date ? -1 : 1));
  const pts = [{ date: startDate, pv: 0 }, ...curve];
  const t = parseDate(date);
  if (t <= parseDate(pts[0].date)) return 0;
  for (let i = 1; i < pts.length; i++) {
    const t1 = parseDate(pts[i].date);
    if (t <= t1) {
      const t0 = parseDate(pts[i - 1].date);
      const f = t1 === t0 ? 1 : (t - t0) / (t1 - t0);
      return pts[i - 1].pv + f * (pts[i].pv - pts[i - 1].pv);
    }
  }
  return pts[pts.length - 1].pv;
}

function snapshotAt(progress, date) {
  let s = null;
  for (const p of progress) if (p.date <= date) s = p;
  return s;
}

// Status date = the later of project.statusDate and the latest progress snapshot.
function effectiveDate(project, progress) {
  const last = progress.length ? progress[progress.length - 1].date : null;
  const sd = project.statusDate || null;
  if (!sd) return last;
  if (!last) return sd;
  return last > sd ? last : sd;
}

function earned(bac, snap) {
  return snap.earnedValue ?? (bac * (snap.percentComplete || 0)) / 100;
}

function fromProject(data, date) {
  const { project, budget, progress } = data;
  if (!budget) throw new PmoError('FILE_MISSING', { file: 'budget.json' }, 'budget.json');
  const at = date || effectiveDate(project, progress);
  const snap = at ? snapshotAt(progress, at) : null;
  if (!snap) throw new PmoError('NO_PROGRESS', { date: at || '-' }, 'progress/');
  const bac = budget.bac;
  const m = compute({ bac, pv: pvAt(budget, project.startDate, at), ev: earned(bac, snap), ac: snap.actualCost || 0 });
  return { date: at, snapshotDate: snap.date, ...m };
}

function trend(data) {
  const { project, budget, progress } = data;
  if (!budget) return [];
  return progress.map((s) => {
    const m = compute({ bac: budget.bac, pv: pvAt(budget, project.startDate, s.date), ev: earned(budget.bac, s), ac: s.actualCost || 0 });
    return { date: s.date, pv: m.pv, ev: m.ev, ac: m.ac, spi: m.spi, cpi: m.cpi };
  });
}

module.exports = { compute, whatIfCost, pvAt, snapshotAt, effectiveDate, fromProject, trend };
