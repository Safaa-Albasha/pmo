'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { createServer, buildState, readAgents, safeFile } = require('../engine/dashboard');
const { run } = require('../engine/cli');

const exDir = (m) => path.join(__dirname, '..', 'examples', m, '.pmo');
const tmpCopy = (m) => {
  const dir = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'pmo-dash-')), '.pmo');
  fs.cpSync(exDir(m), dir, { recursive: true });
  return dir;
};

function start(dir, opts) {
  const server = createServer(dir, opts);
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
}

function request(server, pathname, { method = 'GET', host } = {}) {
  const port = server.address().port;
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port, path: pathname, method, headers: { Host: host || 'localhost:' + port } }, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (d) => (body += d));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body }));
    });
    req.on('error', reject);
    req.end();
  });
}
const getJson = async (server, p) => {
  const r = await request(server, p);
  return { ...r, json: JSON.parse(r.body) };
};

// Snapshot of every file (path → content) to prove the server never writes.
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

test('agents are read from agents/*.md', () => {
  const agents = readAgents();
  assert.strictEqual(agents.length, 11);
  const ids = agents.map((a) => a.id);
  for (const id of ['pmo-lead', 'initiation', 'planner', 'controller', 'risk-manager', 'quality-manager', 'change-control', 'agile-coach', 'reporter', 'integrator', 'closer'])
    assert.ok(ids.includes(id), id);
  const risk = agents.find((a) => a.id === 'risk-manager');
  assert.ok(risk.skills.includes('risk-planning') && risk.skills.includes('risk-monitoring'));
  assert.ok(risk.files.some((f) => f.file === 'risks.json' && f.controlled));
  assert.deepStrictEqual(risk.autonomy.map((x) => x.level), ['auto', 'approval', 'never']);
  const controller = agents.find((a) => a.id === 'controller');
  assert.strictEqual(controller.canWrite, false);
  const lead = agents.find((a) => a.id === 'pmo-lead');
  assert.strictEqual(lead.orchestrates, true);
  assert.strictEqual(lead.peers.length, 10);
});

test('state carries the engine numbers for the waterfall example', () => {
  const s = buildState(exDir('waterfall'));
  const cli = run(['status', '--dir', exDir('waterfall')]).out;
  assert.strictEqual(s.error, null);
  assert.strictEqual(s.validation.ok, true);
  assert.deepStrictEqual(s.report.status.health, cli.health);
  assert.deepStrictEqual(s.report.status.evm, cli.evm);
  assert.strictEqual(s.report.sections.cost.current.cpi, 0.9302);
  assert.strictEqual(s.report.status.schedule.forecastFinish, '2026-06-23');
  assert.deepStrictEqual(s.report.status.schedule.criticalPath, cli.schedule.criticalPath);
  assert.strictEqual(s.registers.issues.length, 2);
  assert.strictEqual(s.registers.defects.length, 3);
  assert.ok(s.files.some((f) => f.path === 'risks.json' && f.controlled));
  assert.ok(s.files.some((f) => f.path === 'issues.json' && !f.controlled));
});

test('server endpoints return engine figures', async () => {
  const server = await start(exDir('hybrid'));
  try {
    const page = await request(server, '/');
    assert.strictEqual(page.status, 200);
    assert.match(page.headers['content-type'], /text\/html/);
    assert.match(page.headers['content-security-policy'], /default-src 'self'/);
    assert.match(page.body, /app\.js/);
    assert.strictEqual((await request(server, '/app.js')).status, 200);
    assert.strictEqual((await request(server, '/app.css')).status, 200);

    const ui = await getJson(server, '/i18n.json');
    assert.ok(ui.json.ar.nav_agents && ui.json.en.nav_agents && ui.json.ar.cpi);

    const st = await getJson(server, '/api/state');
    const cli = run(['status', '--dir', exDir('hybrid')]).out;
    assert.strictEqual(st.status, 200);
    assert.strictEqual(st.json.readOnly, true);
    assert.deepStrictEqual(st.json.report.status.evm, cli.evm);
    assert.deepStrictEqual(st.json.report.status.agile.burnup, cli.agile.burnup);
    assert.strictEqual(st.json.report.status.agile.velocity, cli.agile.velocity);
    assert.strictEqual(st.json.agents.length, 11);

    const files = await getJson(server, '/api/files');
    assert.ok(files.json.some((f) => f.path === 'scope/backlog.json'));
    const f = await getJson(server, '/api/file?path=scope%2Fbacklog.json');
    assert.strictEqual(f.status, 200);
    assert.strictEqual(f.json.json.releasePlan.totalPoints, 120);
    assert.strictEqual((await request(server, '/nope')).status, 404);
  } finally {
    server.close();
  }
});

test('path traversal and foreign hosts are refused', async () => {
  const dir = tmpCopy('waterfall');
  const outside = path.join(path.dirname(dir), 'secret.txt');
  fs.writeFileSync(outside, 'secret');
  let linked = true;
  try {
    fs.symlinkSync(outside, path.join(dir, 'link.json'));
  } catch {
    linked = false; // symlinks may be unavailable (e.g. Windows without privilege)
  }
  const server = await start(dir);
  try {
    for (const p of ['../secret.txt', '..%2Fsecret.txt', '%2E%2E/secret.txt', '/etc/passwd', 'progress/../../secret.txt', '', 'progress']) {
      const r = await request(server, '/api/file?path=' + encodeURIComponent(decodeURIComponent(p)));
      assert.strictEqual(r.status, 404, p);
      assert.doesNotMatch(r.body, /secret/);
    }
    if (linked) assert.strictEqual((await request(server, '/api/file?path=link.json')).status, 404);
    assert.strictEqual((await request(server, '/../engine/cli.js')).status, 404);
    assert.strictEqual((await request(server, '/api/state', { host: 'evil.example:80' })).status, 403);
    assert.strictEqual(safeFile(dir, '../secret.txt'), null);
    assert.ok(safeFile(dir, 'project.json'));
  } finally {
    server.close();
  }
});

test('server is read-only', async () => {
  const dir = tmpCopy('waterfall');
  const before = snapshot(dir);
  const server = await start(dir);
  try {
    for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
      for (const p of ['/api/state', '/api/file?path=risks.json', '/']) {
        const r = await request(server, p, { method });
        assert.strictEqual(r.status, 405, method + ' ' + p);
        assert.strictEqual(r.headers.allow, 'GET, HEAD');
      }
    }
    await getJson(server, '/api/state');
    await getJson(server, '/api/file?path=risks.json');
  } finally {
    server.close();
  }
  assert.deepStrictEqual(snapshot(dir), before);
});

test('live refresh: a change in .pmo is pushed over /api/events', async () => {
  const dir = tmpCopy('waterfall');
  const server = await start(dir, { pollMs: 50 });
  const port = server.address().port;
  try {
    let timer;
    const got = await new Promise((resolve, reject) => {
      timer = setTimeout(() => reject(new Error('no change event')), 4000);
      const req = http.get({ host: '127.0.0.1', port, path: '/api/events', headers: { Host: 'localhost:' + port } }, (res) => {
        let buf = '';
        res.setEncoding('utf8');
        res.on('data', (d) => {
          buf += d;
          if (buf.includes('event: hello') && !buf.includes('wrote')) {
            buf += 'wrote';
            setTimeout(() => fs.writeFileSync(path.join(dir, 'lessons.json'), JSON.stringify({ schemaVersion: 1, lessons: [] })), 120);
          }
          if (buf.includes('event: change')) {
            req.destroy();
            resolve(buf);
          }
        });
      });
      req.on('error', (e) => (e.code === 'ECONNRESET' ? null : reject(e)));
    }).finally(() => clearTimeout(timer));
    assert.match(got, /event: change\ndata: \{"version":"[0-9a-f]+"\}/);
    const st = await getJson(server, '/api/state');
    assert.ok(st.json.files.some((f) => f.path === 'lessons.json'));
  } finally {
    server.close();
  }
});

test('invalid project data is reported, not crashed on', async () => {
  const dir = tmpCopy('waterfall');
  const p = JSON.parse(fs.readFileSync(path.join(dir, 'project.json'), 'utf8'));
  p.methodology = 'spiral';
  fs.writeFileSync(path.join(dir, 'project.json'), JSON.stringify(p));
  const s = buildState(dir);
  assert.strictEqual(s.validation.ok, false);
  assert.strictEqual(s.report, null);
  assert.ok(s.validation.errors[0].message.ar && s.validation.errors[0].message.en);
  assert.strictEqual(s.agents.length, 11);
});
