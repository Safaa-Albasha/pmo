'use strict';
// Edit mode of the dashboard: token, same-origin, body limits, and every write through the engine.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { createServer, buildState, inside, posixRel, resolveProjectDir, MAX_BODY_BYTES } = require('../engine/dashboard');
const edit = require('../engine/edit');
const { run } = require('../engine/cli');

const exDir = (m) => path.join(__dirname, '..', 'examples', m, '.pmo');
const tmpCopy = (m) => {
  const dir = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'pmo-edit-')), '.pmo');
  fs.cpSync(exDir(m), dir, { recursive: true });
  return dir;
};
const readJ = (dir, f) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
const TOKEN = 'a'.repeat(48);

function start(dir, opts = {}) {
  const server = createServer(dir, { editMode: true, token: TOKEN, ...opts });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
}

// POST helper; defaults are what the page sends (same origin, token header, JSON).
function post(server, pathname, body, { token = TOKEN, origin, host, type = 'application/json', method = 'POST', raw } = {}) {
  const port = server.address().port;
  const data = raw !== undefined ? raw : JSON.stringify(body);
  const headers = { Host: host || 'localhost:' + port, 'Content-Type': type, 'Content-Length': Buffer.byteLength(data) };
  if (origin !== null) headers.Origin = origin || 'http://localhost:' + port;
  if (token) headers['X-PMO-Token'] = token;
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port, path: pathname, method, headers }, (res) => {
      let buf = '';
      res.setEncoding('utf8');
      res.on('data', (d) => (buf += d));
      res.on('end', () => {
        let json = null;
        try {
          json = JSON.parse(buf);
        } catch {
          json = null;
        }
        resolve({ status: res.statusCode, headers: res.headers, json });
      });
    });
    req.on('error', reject);
    req.end(data);
  });
}

function snapshot(dir) {
  const out = {};
  const walk = (rel) => {
    for (const e of fs.readdirSync(path.join(dir, rel), { withFileTypes: true })) {
      const r = path.join(rel, e.name);
      if (e.isDirectory()) walk(r);
      else out[r] = fs.readFileSync(path.join(dir, r), 'utf8');
    }
  };
  walk('');
  return out;
}

const riskBody = {
  kind: 'risk.add',
  data: { title: 'فيضان طريق الوصول / Access road flooding', category: 'external', probability: 2, impact: 4, owner: 'Site manager', responseStrategy: 'mitigate', costImpact: 12000 },
  reason: 'موسم الأمطار / Rainy season forecast',
  impactNote: 'Up to 5 days delay',
};

test('edit mode is off by default: every write is 405 and nothing changes', async () => {
  const dir = tmpCopy('waterfall');
  const before = snapshot(dir);
  const server = createServer(dir);
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  try {
    for (const p of ['/api/edit', '/api/approvals/decide', '/api/approvals/revise']) {
      const r = await post(server, p, riskBody);
      assert.strictEqual(r.status, 405, p);
      assert.strictEqual(r.headers.allow, 'GET, HEAD');
    }
    const st = buildState(dir);
    assert.strictEqual(st.readOnly, true);
    assert.strictEqual(st.editMode, false);
    assert.strictEqual(st.edit, null);
  } finally {
    server.close();
  }
  assert.deepStrictEqual(snapshot(dir), before);
});

test('edit mode: token, origin, content type and body size are enforced before anything is written', async () => {
  const dir = tmpCopy('waterfall');
  const before = snapshot(dir);
  const server = await start(dir);
  const port = server.address().port;
  try {
    assert.strictEqual((await post(server, '/api/edit', riskBody, { token: null })).status, 401);
    assert.strictEqual((await post(server, '/api/edit', riskBody, { token: 'b'.repeat(48) })).status, 401);
    assert.strictEqual((await post(server, '/api/edit', riskBody, { token: 'short' })).status, 401);
    // Cross-origin (another site in the browser), no Origin at all, and a foreign Host are refused.
    assert.strictEqual((await post(server, '/api/edit', riskBody, { origin: 'http://evil.example' })).status, 403);
    assert.strictEqual((await post(server, '/api/edit', riskBody, { origin: 'http://localhost:' + (port + 1) })).status, 403);
    assert.strictEqual((await post(server, '/api/edit', riskBody, { origin: null })).status, 403);
    assert.strictEqual((await post(server, '/api/edit', riskBody, { host: 'evil.example:' + port })).status, 403);
    // A plain HTML form (text/plain) cannot be used to forge a write.
    assert.strictEqual((await post(server, '/api/edit', riskBody, { type: 'text/plain' })).status, 415);
    assert.strictEqual((await post(server, '/api/edit', null, { raw: '{"kind":' })).status, 400);
    const big = await post(server, '/api/edit', { kind: 'issue.add', data: { title: 'x'.repeat(MAX_BODY_BYTES + 10) } });
    assert.strictEqual(big.status, 413);
    // Other methods and paths stay closed.
    assert.strictEqual((await post(server, '/api/edit', riskBody, { method: 'PUT' })).status, 405);
    assert.strictEqual((await post(server, '/api/state', riskBody)).status, 405);
    assert.strictEqual((await post(server, '/api/file?path=risks.json', riskBody)).status, 405);
    const st = (await post(server, '/api/edit', riskBody, { method: 'DELETE' })).headers.allow;
    assert.strictEqual(st, 'GET, HEAD, POST');
  } finally {
    server.close();
  }
  assert.deepStrictEqual(snapshot(dir), before);
});

test('edit mode: invalid payloads are 400 with field details, nothing written', async () => {
  const dir = tmpCopy('waterfall');
  const before = snapshot(dir);
  const server = await start(dir);
  try {
    const cases = [
      { kind: 'nope', data: {} },
      { kind: 'risk.add', data: { ...riskBody.data, probability: 9 }, reason: 'x' },
      { kind: 'risk.add', data: { ...riskBody.data, owner: '' }, reason: 'x' },
      { kind: 'risk.add', data: riskBody.data }, // no reason
      { kind: 'risk.add', data: { ...riskBody.data, file: '../../etc/passwd' }, reason: 'x' }, // unknown field
      { kind: 'issue.add', data: { title: 'T', priority: 'urgent', owner: 'A' } },
      { kind: 'issue.add', data: { title: 'T', priority: 'high', owner: 'A', due: '2026-02-30' } },
      { kind: 'activity.progress', id: 'D', data: { percentComplete: 140 }, reason: 'x' },
      { kind: 'issue.update', id: '../risks', data: { status: 'closed' } },
      { kind: 'issue.update', id: 'I-001', data: {} },
      { kind: 'lesson.add', data: { category: 'cost', type: 'improve', situation: 's', recommendation: 'r', date: 'yesterday' } },
      [],
    ];
    for (const c of cases) {
      const r = await post(server, '/api/edit', c);
      assert.strictEqual(r.status, 400, JSON.stringify(c));
      assert.ok(r.json.error.code && r.json.error.message_ar && r.json.error.message_en, JSON.stringify(r.json));
    }
    const r = await post(server, '/api/edit', { kind: 'risk.add', data: { ...riskBody.data, probability: 9 }, reason: 'x' });
    assert.deepStrictEqual(r.json.error.details, [{ field: 'probability', code: 'RANGE', min: 1, max: 5 }]);
    assert.strictEqual((await post(server, '/api/edit', { kind: 'issue.update', id: 'I-999', data: { status: 'closed' } })).status, 404);
    assert.strictEqual((await post(server, '/api/approvals/decide', { id: 'APR-0001', decision: 'maybe' })).status, 400);
    assert.strictEqual((await post(server, '/api/approvals/decide', { id: 'APR-0099', decision: 'approve' })).status, 404);
  } finally {
    server.close();
  }
  assert.deepStrictEqual(snapshot(dir), before);
});

test('edit mode: a risk becomes a proposal, approve applies it through the engine and logs the decision', async () => {
  const dir = tmpCopy('waterfall');
  const risksBefore = fs.readFileSync(path.join(dir, 'risks.json'), 'utf8');
  const server = await start(dir);
  try {
    const r = await post(server, '/api/edit', riskBody);
    assert.strictEqual(r.status, 200, JSON.stringify(r.json));
    const a = r.json.result.approval;
    assert.strictEqual(r.json.result.mode, 'proposal');
    assert.strictEqual(a.id, 'APR-0001');
    assert.strictEqual(a.agent, 'PM via dashboard');
    assert.strictEqual(a.operation.item.id, 'R6');
    assert.strictEqual(a.title, 'إضافة خطر R6: فيضان طريق الوصول / Access road flooding');
    assert.strictEqual(a.rationale, riskBody.reason);
    // Controlled record untouched until approval; proposal visible to the CLI.
    assert.strictEqual(fs.readFileSync(path.join(dir, 'risks.json'), 'utf8'), risksBefore);
    assert.strictEqual(run(['approvals', '--dir', dir]).out[0].id, 'APR-0001');
    // A second risk reserves the next id, not R6 again.
    const r2 = await post(server, '/api/edit', { ...riskBody, data: { ...riskBody.data, title: 'Second' } });
    assert.strictEqual(r2.json.result.approval.operation.item.id, 'R7');

    const d = await post(server, '/api/approvals/decide', { id: 'APR-0001', decision: 'approve', note: 'ok' });
    assert.strictEqual(d.status, 200, JSON.stringify(d.json));
    assert.strictEqual(d.json.result.decision.by, 'PM via dashboard');
    assert.strictEqual(d.json.result.decision.decision, 'approved');
    const risks = readJ(dir, 'risks.json').risks;
    assert.ok(risks.some((x) => x.id === 'R6' && x.probability === 2 && x.status === 'open'));
    assert.strictEqual(readJ(dir, 'decisions.json').decisions[0].approvalId, 'APR-0001');
    assert.strictEqual(run(['validate', '--dir', dir]).out.ok, true);
    // The engine numbers now include the new risk.
    assert.ok(run(['risk', '--dir', dir]).out.risks.some((x) => x.id === 'R6'));

    // Deciding twice is a conflict, not a second write.
    assert.strictEqual((await post(server, '/api/approvals/decide', { id: 'APR-0001', decision: 'reject' })).status, 409);
    // Undo before applying = reject: R7 never reaches risks.json.
    const rej = await post(server, '/api/approvals/decide', { id: 'APR-0002', decision: 'reject', note: 'duplicate' });
    assert.strictEqual(rej.json.result.approval.status, 'rejected');
    assert.ok(!readJ(dir, 'risks.json').risks.some((x) => x.id === 'R7'));

    const log = readJ(dir, 'audit.json').entries;
    assert.deepStrictEqual(log.map((e) => e.action), ['propose', 'propose', 'approve', 'reject']);
    assert.ok(log.every((e) => e.by === 'PM via dashboard' && /^\d{4}-\d{2}-\d{2}T/.test(e.at)));
    const st = buildState(dir, { editMode: true });
    assert.strictEqual(st.registers.audit.length, 4);
  } finally {
    server.close();
  }
});

test('edit mode: free records (issues, lessons, backlog status) are written by the engine and validated', async () => {
  const dir = tmpCopy('waterfall');
  const server = await start(dir);
  try {
    const add = await post(server, '/api/edit', { kind: 'issue.add', data: { title: 'Crane booking clash', priority: 'high', impactArea: 'schedule', owner: 'Site manager', due: '2026-04-15' } });
    assert.strictEqual(add.status, 200, JSON.stringify(add.json));
    assert.strictEqual(add.json.result.mode, 'record');
    assert.strictEqual(add.json.result.id, 'I-003');
    const issue = readJ(dir, 'issues.json').issues.find((i) => i.id === 'I-003');
    assert.strictEqual(issue.status, 'open');
    assert.strictEqual(issue.raisedBy, 'PM via dashboard');

    const upd = await post(server, '/api/edit', { kind: 'issue.update', id: 'I-001', data: { status: 'resolved', resolution: 'Released by customs' } });
    assert.strictEqual(upd.status, 200);
    assert.strictEqual(upd.json.result.before.status, 'open');
    const i1 = readJ(dir, 'issues.json').issues.find((i) => i.id === 'I-001');
    assert.strictEqual(i1.status, 'resolved');
    assert.strictEqual(i1.relatedRisk, 'R1'); // untouched fields kept

    const les = await post(server, '/api/edit', { kind: 'lesson.add', data: { category: 'procurement', type: 'improve', situation: 'Customs hold', recommendation: 'Pre-clear imports' } });
    assert.strictEqual(les.status, 200);
    assert.strictEqual(readJ(dir, 'lessons.json').lessons[0].id, 'L-001');
    assert.ok(!fs.existsSync(path.join(dir, 'approvals.json'))); // no proposals for free records
    assert.strictEqual(readJ(dir, 'audit.json').entries.length, 3);
  } finally {
    server.close();
  }

  const hy = tmpCopy('hybrid');
  const s2 = await start(hy);
  try {
    const item = readJ(hy, 'scope/backlog.json').items.find((i) => i.status !== 'done');
    const r = await post(s2, '/api/edit', { kind: 'item.status', id: item.id, data: { status: 'done' } });
    assert.strictEqual(r.status, 200, JSON.stringify(r.json));
    assert.strictEqual(readJ(hy, 'scope/backlog.json').items.find((i) => i.id === item.id).status, 'done');
    // Activity progress is a controlled record (schedule.json) → proposal, not a write.
    const act = readJ(hy, 'schedule.json').activities[0];
    const p = await post(s2, '/api/edit', { kind: 'activity.progress', id: act.id, data: { percentComplete: 55 }, reason: 'Site walk' });
    assert.strictEqual(p.json.result.mode, 'proposal');
    assert.strictEqual(readJ(hy, 'schedule.json').activities[0].percentComplete, act.percentComplete);
    assert.strictEqual(p.json.result.approval.after.percentComplete, 55);
  } finally {
    s2.close();
  }
});

test('edit mode: Edit on a proposal re-proposes and rejects the original as superseded', async () => {
  const dir = tmpCopy('waterfall');
  const server = await start(dir);
  try {
    await post(server, '/api/edit', { kind: 'stakeholder.add', data: { name: 'Fire marshal', power: 4, interest: 2 }, reason: 'Inspection' });
    const st = buildState(dir, { editMode: true });
    assert.strictEqual(st.registers.approvals[0].kind, 'stakeholder.add');
    const r = await post(server, '/api/approvals/revise', { id: 'APR-0001', data: { name: 'Fire marshal', power: 5, interest: 3 } });
    assert.strictEqual(r.status, 200, JSON.stringify(r.json));
    assert.strictEqual(r.json.result.approval.id, 'APR-0002');
    assert.strictEqual(r.json.result.approval.operation.item.id, 'SH-06');
    assert.strictEqual(r.json.result.approval.operation.item.power, 5);
    const aprs = readJ(dir, 'approvals.json').approvals;
    assert.strictEqual(aprs[0].status, 'rejected');
    assert.strictEqual(aprs[0].note, 'superseded by APR-0002');
    // Raw edit of an agent proposal must keep its target.
    run(['propose', '--dir', dir, '--json', JSON.stringify({ agent: 'controller', title: 'BAC', operation: { op: 'set', file: 'budget.json', path: 'bac', value: 520000 } })]);
    assert.strictEqual(buildState(dir, { editMode: true }).registers.approvals[2].kind, null);
    const moved = await post(server, '/api/approvals/revise', { id: 'APR-0003', operation: { op: 'set', file: 'project.json', path: 'name', value: 'x' } });
    assert.strictEqual(moved.status, 400);
    const ok = await post(server, '/api/approvals/revise', { id: 'APR-0003', operation: { op: 'set', file: 'budget.json', path: 'bac', value: 510000 } });
    assert.strictEqual(ok.status, 200, JSON.stringify(ok.json));
    const ap = await post(server, '/api/approvals/decide', { id: ok.json.result.approval.id, decision: 'approve' });
    assert.strictEqual(ap.status, 200);
    assert.strictEqual(readJ(dir, 'budget.json').bac, 510000);
  } finally {
    server.close();
  }
});

test('edit mode: path traversal is still blocked and state exposes the form specs, never the token', async () => {
  const dir = tmpCopy('waterfall');
  fs.writeFileSync(path.join(path.dirname(dir), 'secret.txt'), 'secret');
  const server = await start(dir);
  const port = server.address().port;
  try {
    for (const p of ['../secret.txt', '..\\secret.txt', 'progress/../../secret.txt', 'C:\\Windows\\win.ini', '\\\\server\\share\\x']) {
      const r = await new Promise((resolve) => http.get({ host: '127.0.0.1', port, path: '/api/file?path=' + encodeURIComponent(p), headers: { Host: 'localhost:' + port } }, (res) => {
        let b = '';
        res.on('data', (d) => (b += d));
        res.on('end', () => resolve({ status: res.statusCode, body: b }));
      }));
      assert.strictEqual(r.status, 404, p);
      assert.doesNotMatch(r.body, /secret/);
    }
    const body = await new Promise((resolve) => http.get({ host: '127.0.0.1', port, path: '/api/state', headers: { Host: 'localhost:' + port } }, (res) => {
      let b = '';
      res.on('data', (d) => (b += d));
      res.on('end', () => resolve(b));
    }));
    assert.ok(!body.includes(TOKEN));
    const st = JSON.parse(body);
    assert.strictEqual(st.editMode, true);
    assert.strictEqual(st.readOnly, false);
    assert.strictEqual(st.edit.kinds['risk.add'].mode, 'propose');
    assert.strictEqual(st.edit.kinds['issue.add'].mode, 'record');
    for (const k of Object.values(st.edit.kinds)) if (k.mode === 'record') assert.strictEqual(k.controlled, false);
    assert.ok(st.files.length);
  } finally {
    server.close();
  }
});

test('a random token is created when none is given', () => {
  const s = createServer(exDir('waterfall'), { editMode: true });
  assert.match(s.token, /^[0-9a-f]{48}$/);
  assert.strictEqual(createServer(exDir('waterfall')).token, null);
});

test('Windows paths: --dir and the inside-folder check follow win32 rules', () => {
  const w = path.win32;
  const cwd = 'C:\\Users\\safaa\\pmo';
  const has = (set) => (f) => set.includes(f);
  const pmo = 'C:\\Users\\safaa\\pmo\\examples\\waterfall\\.pmo';
  assert.deepStrictEqual(resolveProjectDir('examples\\waterfall\\.pmo', { cwd, p: w, exists: has([pmo + '\\project.json']) }), { dir: pmo, found: true });
  assert.deepStrictEqual(resolveProjectDir('examples/waterfall/.pmo', { cwd, p: w, exists: has([pmo + '\\project.json']) }), { dir: pmo, found: true });
  assert.deepStrictEqual(resolveProjectDir('examples\\waterfall', { cwd, p: w, exists: has([pmo + '\\project.json']) }), { dir: pmo, found: true });
  assert.deepStrictEqual(resolveProjectDir('D:\\work\\site\\.pmo', { cwd, p: w, exists: has(['D:\\work\\site\\.pmo\\project.json']) }), { dir: 'D:\\work\\site\\.pmo', found: true });
  assert.strictEqual(resolveProjectDir(null, { cwd, p: w, exists: () => false }).dir, 'C:\\Users\\safaa\\pmo\\.pmo');

  assert.strictEqual(inside(pmo, pmo + '\\risks.json', w), true);
  assert.strictEqual(inside(pmo, pmo + '\\scope\\backlog.json', w), true);
  assert.strictEqual(inside(pmo, w.resolve(pmo, '..\\secret.txt'), w), false);
  assert.strictEqual(inside(pmo, w.resolve(pmo, 'progress\\..\\..\\secret.txt'), w), false);
  assert.strictEqual(inside(pmo, pmo + '-evil\\x.json', w), false);
  assert.strictEqual(inside(pmo, 'D:\\x.json', w), false);
  assert.strictEqual(inside(pmo, pmo, w), false);
  assert.strictEqual(posixRel('scope\\backlog.json'), 'scope/backlog.json');
  // POSIX keeps working the same way.
  assert.strictEqual(inside('/p/.pmo', '/p/.pmo/risks.json', path.posix), true);
  assert.strictEqual(inside('/p/.pmo', '/p/secret', path.posix), false);
});

test('engine edit helpers: next ids follow each file pattern', () => {
  const dir = tmpCopy('waterfall');
  assert.strictEqual(edit.nextItemId(dir, 'risks.json', 'R1'), 'R6');
  assert.strictEqual(edit.nextItemId(dir, 'issues.json', 'I-001'), 'I-003');
  assert.strictEqual(edit.nextItemId(dir, 'changes.json', 'CR-001'), 'CR-002');
  assert.strictEqual(edit.nextItemId(dir, 'stakeholders.json', 'SH-01'), 'SH-06');
  assert.strictEqual(edit.nextItemId(dir, 'lessons.json', 'L-001'), 'L-001');
  for (const f of edit.FREE) assert.ok(!require('../engine/approvals').PROTECTED.includes(f), f);
});
