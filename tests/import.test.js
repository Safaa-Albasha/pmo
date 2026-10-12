'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const zlib = require('zlib');
const { parseCsv, readXlsx, readTable, importFile } = require('../engine/import');
const { readJson } = require('../engine/io');
const { run } = require('../engine/cli');

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'pmo-imp-'));
const write = (dir, name, text) => {
  const f = path.join(dir, name);
  fs.writeFileSync(f, text, 'utf8');
  return f;
};
const copyExample = (m) => {
  const dir = path.join(tmp(), '.pmo');
  fs.cpSync(path.join(__dirname, '..', 'examples', m, '.pmo'), dir, { recursive: true });
  return dir;
};

// Minimal .xlsx writer for tests (deflate entries, CRC not checked by the reader).
function makeXlsx(files) {
  const locals = [];
  const central = [];
  let offset = 0;
  for (const [name, text] of Object.entries(files)) {
    const data = zlib.deflateRawSync(Buffer.from(text, 'utf8'));
    const nameBuf = Buffer.from(name, 'utf8');
    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0);
    lh.writeUInt16LE(20, 4);
    lh.writeUInt16LE(8, 8);
    lh.writeUInt32LE(data.length, 18);
    lh.writeUInt32LE(Buffer.byteLength(text), 22);
    lh.writeUInt16LE(nameBuf.length, 26);
    locals.push(lh, nameBuf, data);
    const ch = Buffer.alloc(46);
    ch.writeUInt32LE(0x02014b50, 0);
    ch.writeUInt16LE(20, 6);
    ch.writeUInt16LE(8, 10);
    ch.writeUInt32LE(data.length, 20);
    ch.writeUInt32LE(Buffer.byteLength(text), 24);
    ch.writeUInt16LE(nameBuf.length, 28);
    ch.writeUInt32LE(offset, 42);
    central.push(ch, nameBuf);
    offset += 30 + nameBuf.length + data.length;
  }
  const cd = Buffer.concat(central);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(Object.keys(files).length, 8);
  eocd.writeUInt16LE(Object.keys(files).length, 10);
  eocd.writeUInt32LE(cd.length, 12);
  eocd.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, cd, eocd]);
}

test('parseCsv handles quotes, newlines, BOM and semicolons', () => {
  assert.deepStrictEqual(parseCsv('﻿a,b\n"x, y","line1\nline2"\n'), [['a', 'b'], ['x, y', 'line1\nline2']]);
  assert.deepStrictEqual(parseCsv('a;b\r\n1;"2""q"\r\n\r\n'), [['a', 'b'], ['1', '2"q']]);
});

test('readXlsx reads shared strings, inline strings and numbers', () => {
  const buf = makeXlsx({
    'xl/workbook.xml': '<workbook><sheets><sheet name="Risks" sheetId="1" r:id="rId1"/></sheets></workbook>',
    'xl/_rels/workbook.xml.rels': '<Relationships><Relationship Id="rId1" Type="x" Target="worksheets/sheet1.xml"/></Relationships>',
    'xl/sharedStrings.xml': '<sst><si><t>ID</t></si><si><r><t>Ti</t></r><r><t>tle</t></r></si><si><t>Flood &amp; rain</t></si></sst>',
    'xl/worksheets/sheet1.xml':
      '<worksheet><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c><c r="D1" t="inlineStr"><is><t>P</t></is></c></row>' +
      '<row r="2"><c r="A2" t="str"><v>R9</v></c><c r="B2" t="s"><v>2</v></c><c r="D2"><v>4</v></c></row></sheetData></worksheet>',
  });
  assert.deepStrictEqual(readXlsx(buf), [['ID', 'Title', '', 'P'], ['R9', 'Flood & rain', '', '4']]);
});

test('Jira CSV export → backlog preview with status mapping', () => {
  const d = tmp();
  const f = write(d, 'jira.csv', 'Issue key,Summary,Status,Custom field (Story Points),Sprint\nAPP-1,Login,Done,5,Sprint 1\nAPP-2,Search,In Progress,8,Sprint 2\nAPP-3,Pay,To Do,,\n');
  const r = importFile(copyExample('agile'), { from: f, type: 'backlog' });
  assert.strictEqual(r.action, 'preview');
  assert.deepStrictEqual(r.mapping, { id: 'Issue key', title: 'Summary', points: 'Custom field (Story Points)', status: 'Status', sprint: 'Sprint', priority: null, epic: null });
  assert.deepStrictEqual(r.items.map((i) => [i.id, i.status, i.points ?? null]), [['APP-1', 'done', 5], ['APP-2', 'doing', 8], ['APP-3', 'todo', null]]);
});

test('Arabic risk register with text and percent scales', () => {
  const d = tmp();
  const f = write(d, 'risks.csv', 'المعرف,الخطر,الاحتمال,الأثر,المالك,الأثر المالي\nR20,انقطاع الكهرباء,مرتفع,متوسط,المهندس,"12,000"\nR21,تأخر المورد,60%,5,المشتريات,\n');
  const r = importFile(copyExample('waterfall'), { from: f, type: 'risks' });
  assert.deepStrictEqual(r.items.map((i) => [i.id, i.probability, i.impact, i.costImpact ?? null, i.status]), [
    ['R20', 4, 3, 12000, 'open'],
    ['R21', 4, 5, null, 'open'],
  ]);
});

test('MS Project schedule export: durations, predecessors, % complete', () => {
  const d = tmp();
  const f = write(d, 'plan.csv', 'ID,Name,Duration,Predecessors,% Complete\n1,Design,5 days,,100%\n2,Build,2 wks,1FS+2 days,50%\n3,Test,3d,"1,2SS",0%\n');
  const r = importFile(copyExample('waterfall'), { from: f, type: 'schedule' });
  assert.deepStrictEqual(r.items[1], { id: '2', name: 'Build', duration: 14, predecessors: [{ id: '1', type: 'FS', lag: 2 }], percentComplete: 50 });
  assert.deepStrictEqual(r.items[2].predecessors, ['1', { id: '2', type: 'SS', lag: 0 }]);
});

test('write merges free records and validates', () => {
  const dir = copyExample('agile');
  const f = write(tmp(), 'b.csv', 'id,title,points,status\nUS-12,Insurance check,13,Done\nUS-99,New item,3,todo\n');
  const r = importFile(dir, { from: f, type: 'backlog', write: true });
  assert.deepStrictEqual([r.action, r.added, r.updated], ['written', 1, 1]);
  const items = readJson(dir, 'scope/backlog.json').items;
  assert.strictEqual(items.find((i) => i.id === 'US-12').status, 'done');
  assert.strictEqual(items.find((i) => i.id === 'US-12').sprint, undefined);
  assert.ok(items.find((i) => i.id === 'US-99'));
});

test('invalid write is rolled back', () => {
  const dir = copyExample('agile');
  const before = fs.readFileSync(path.join(dir, 'scope', 'backlog.json'), 'utf8');
  const f = write(tmp(), 'b.csv', 'id,title,points,status\nUS-12,x,-5,todo\n');
  assert.throws(() => importFile(dir, { from: f, type: 'backlog', write: true }), (e) => e.code === 'VALIDATION_FAILED');
  assert.strictEqual(fs.readFileSync(path.join(dir, 'scope', 'backlog.json'), 'utf8'), before);
});

test('controlled records become proposals; unchanged rows are skipped', () => {
  const dir = copyExample('waterfall');
  const f = write(tmp(), 'r.csv', 'id,title,probability,impact,owner\nR1,تأخر توريد الرفوف / Racking supplier delay,5,4,Procurement lead\nR3,ارتفاع أسعار الحديد / Steel price increase,3,3,Finance\nR9,Flood,2,4,PM\n');
  const r = importFile(dir, { from: f, type: 'risks', write: true });
  assert.strictEqual(r.action, 'proposed');
  assert.deepStrictEqual(r.proposals.map((p) => [p.id, p.operation.op]), [['APR-0001', 'update'], ['APR-0002', 'add']]);
  assert.deepStrictEqual(r.proposals[0].operation.changes, { probability: 5 });
  assert.strictEqual(r.unchanged, 1);
  assert.strictEqual(readJson(dir, 'risks.json').risks.length, 5);
});

test('progress import writes activityProgress snapshot', () => {
  const dir = copyExample('waterfall');
  const f = write(tmp(), 'p.csv', 'Activity,% complete\nC,100\nD,0.4\n');
  assert.throws(() => importFile(dir, { from: f, type: 'progress', write: true }), (e) => e.code === 'ARG_MISSING');
  importFile(dir, { from: f, type: 'progress', write: true, date: '2026-04-30', map: { id: 'Activity' } });
  const snap = readJson(dir, 'progress/2026-04-30.json');
  assert.deepStrictEqual(snap.activityProgress, { C: 100, D: 40 });
});

test('readTable rejects unsupported formats', () => {
  const f = write(tmp(), 'old.xls', 'x');
  assert.throws(() => readTable(f), (e) => e.code === 'IMPORT_FORMAT');
});

test('CLI import and batch apply', () => {
  const dir = copyExample('waterfall');
  const f = write(tmp(), 'r.csv', 'id,title,probability,impact\nR10,A,2,2\nR11,B,3,3\n');
  const r = run(['import', '--dir', dir, '--from', f, '--type', 'risks', '--write']);
  assert.strictEqual(r.code, 0, JSON.stringify(r.out));
  const b = run(['apply', '--dir', dir, '--ids', 'APR-0001,APR-0002,APR-0099', '--decision', 'approve', '--by', 'PM']);
  assert.deepStrictEqual(b.out.results.map((x) => [x.id, x.ok]), [['APR-0001', true], ['APR-0002', true], ['APR-0099', false]]);
  assert.strictEqual(readJson(dir, 'risks.json').risks.length, 7);
});

test('doctor reports environment and connectors', () => {
  const root = tmp();
  fs.cpSync(path.join(__dirname, '..', 'examples', 'waterfall', '.pmo'), path.join(root, '.pmo'), { recursive: true });
  fs.writeFileSync(path.join(root, '.mcp.json'), JSON.stringify({ mcpServers: { atlassian: { type: 'http', url: 'https://mcp.atlassian.com/v1/mcp' } } }));
  const r = run(['doctor', '--dir', path.join(root, '.pmo')]).out;
  assert.strictEqual(r.node.ok, true);
  assert.strictEqual(r.project.exists, true);
  assert.strictEqual(r.project.valid, true);
  assert.deepStrictEqual(r.connectors.find((c) => c.id === 'atlassian').configured, true);
  assert.strictEqual(r.connectors.find((c) => c.id === 'linear').configured, false);
});

test('text priorities map to numbers and non-numeric text never becomes 0', () => {
  const f = write(tmp(), 'p.csv', 'key,summary,priority,story points\nA-1,a,Highest,abc\nA-2,b,High,\nA-3,c,متوسط,3\nA-4,d,Low,\nA-5,e,Whatever,\n');
  const r = importFile(copyExample('agile'), { from: f, type: 'backlog' });
  assert.deepStrictEqual(r.items.map((i) => [i.priority ?? null, i.points ?? null]), [[1, null], [2, null], [3, 3], [4, null], [null, null]]);
});
