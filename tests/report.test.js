'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { loadProject } = require('../engine/io');
const { buildReportData, renderHtml, writeReport } = require('../engine/report');
const { whatIfCost } = require('../engine/evm');
const { whatIfVelocity } = require('../engine/agile');
const { run } = require('../engine/cli');

const exDir = (m) => path.join(__dirname, '..', 'examples', m, '.pmo');
const tmpCopy = (m) => {
  const dir = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'pmo-')), '.pmo');
  fs.cpSync(exDir(m), dir, { recursive: true });
  return dir;
};
const dataFromHtml = (html) => JSON.parse(html.match(/<script id="pmo-data" type="application\/json">([\s\S]*?)<\/script>/)[1]);

test('what-if formulas', () => {
  assert.strictEqual(whatIfCost({ bac: 500000, ev: 200000, ac: 215000 }, 1), 515000);
  assert.strictEqual(whatIfCost({ bac: 500000, ev: 200000, ac: 215000 }, 0.8), 590000);
  assert.deepStrictEqual(whatIfVelocity({ remainingPoints: 112, lastEnd: '2026-04-25', sprintLengthDays: 14 }, 28), {
    sprintsRemaining: 4,
    forecastFinish: '2026-06-20',
  });
  assert.deepStrictEqual(whatIfVelocity({ remainingPoints: 10, lastEnd: null, sprintLengthDays: 14 }, 0), { sprintsRemaining: null, forecastFinish: null });
});

test('waterfall report data', () => {
  const r = buildReportData(loadProject(exDir('waterfall')));
  assert.strictEqual(r.meta.statusDate, '2026-03-31');
  assert.strictEqual(r.meta.lang, 'ar');
  assert.strictEqual(r.sections.cost.current.cpi, 0.9302);
  assert.strictEqual(r.sections.cost.trend.length, 3);
  assert.deepStrictEqual(r.sections.cost.pvCurve[0], { date: '2026-01-01', pv: 0 });
  const acts = r.sections.schedule.activities;
  assert.strictEqual(acts.length, 6);
  const d = acts.find((a) => a.id === 'D');
  assert.deepStrictEqual([d.plannedStart, d.forecastFinish, d.critical, d.percentComplete], ['2026-03-02', '2026-05-24', true, 10]);
  assert.strictEqual(acts.find((a) => a.id === 'A').state, 'complete');
  assert.strictEqual(r.sections.risks.heatmap[3][3].count, 1);
  assert.strictEqual(r.sections.risks.contingency, 25000);
  assert.strictEqual(r.sections.agile, undefined);
  assert.ok(r.omitted.some((o) => o.section === 'quality' && o.reason === 'NO_DATA'));
  assert.ok(r.sections.next.activities.some((a) => a.id === 'D'));
});

test('agile report data uses AgileEVM and burnup', () => {
  const r = buildReportData(loadProject(exDir('agile')));
  assert.strictEqual(r.sections.schedule, undefined);
  assert.strictEqual(r.sections.agile.burnup.length, 6);
  assert.strictEqual(r.sections.cost.current.cpi, 0.96);
  assert.strictEqual(r.sections.cost.agile, true);
  assert.strictEqual(r.sections.next.activeSprint, 'S7');
});

test('extras: quality, changes, issues, stakeholders, decisions, approvals', () => {
  const dir = tmpCopy('waterfall');
  fs.writeFileSync(
    path.join(dir, 'quality.json'),
    JSON.stringify({
      metrics: [{ id: 'Q1', name: 'Punch items', target: 20, direction: 'max', values: [{ date: '2026-02-28', value: 30 }, { date: '2026-03-31', value: 18 }] }],
      defects: [{ id: 'D1', severity: 'major', status: 'open' }, { id: 'D2', severity: 'minor', status: 'closed' }],
    })
  );
  fs.writeFileSync(path.join(dir, 'stakeholders.json'), JSON.stringify({ stakeholders: [{ id: 'S1', name: 'Sponsor', power: 5, interest: 5 }, { id: 'S2', name: 'Users', power: 2, interest: 4 }] }));
  fs.writeFileSync(path.join(dir, 'issues.json'), JSON.stringify({ issues: [{ id: 'I1', title: 'x', status: 'open' }, { id: 'I2', title: 'y', status: 'closed' }] }));
  const r = buildReportData({ ...loadProject(dir), ...require('../engine/io').loadExtras(dir) });
  assert.deepStrictEqual(r.sections.quality.metrics[0], { id: 'Q1', name: 'Punch items', unit: null, target: 20, direction: 'max', latest: 18, date: '2026-03-31', meets: true, values: [{ date: '2026-02-28', value: 30 }, { date: '2026-03-31', value: 18 }] });
  assert.deepStrictEqual(r.sections.quality.defects, { open: 1, closed: 1, bySeverity: { critical: 0, major: 1, minor: 0 } });
  assert.deepStrictEqual(r.sections.stakeholders.map((s) => s.quadrant), ['manage-closely', 'keep-informed']);
  assert.deepStrictEqual(r.sections.issues.map((i) => i.id), ['I1']);
});

test('narrative is chosen by language and safely embedded', () => {
  const evil = '</script><img src=x onerror=alert(1)>';
  const r = buildReportData(loadProject(exDir('waterfall')), { lang: 'en', narrative: { summary: { ar: 'ملخص', en: evil }, highlights: ['ok'] } });
  assert.strictEqual(r.meta.lang, 'en');
  assert.strictEqual(r.narrative.summary.en, evil);
  const html = renderHtml(r);
  assert.ok(html.startsWith('<!doctype html>'));
  assert.ok(!html.includes('</script><img'));
  assert.strictEqual(dataFromHtml(html).narrative.summary.en, evil);
  assert.match(html, /function whatIfCost/);
});

test('writeReport and CLI report command', () => {
  const dir = tmpCopy('hybrid');
  const out = writeReport(dir, {});
  assert.strictEqual(path.basename(out.path), '2026-05-31-report.html');
  assert.ok(fs.existsSync(out.path));
  const nf = path.join(path.dirname(dir), 'n.json');
  fs.writeFileSync(nf, JSON.stringify({ summary: 'ملخص' }));
  const r = run(['report', '--dir', dir, '--lang', 'en', '--narrative', nf, '--out', path.join(path.dirname(dir), 'r.html')]);
  assert.strictEqual(r.code, 0, JSON.stringify(r.out));
  const data = dataFromHtml(fs.readFileSync(r.out.path, 'utf8'));
  assert.strictEqual(data.meta.lang, 'en');
  assert.strictEqual(data.narrative.summary.ar, 'ملخص');
  assert.ok(data.sections.agile && data.sections.schedule);
});
