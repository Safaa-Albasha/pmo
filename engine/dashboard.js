#!/usr/bin/env node
'use strict';
// Local project dashboard: a small HTTP server on 127.0.0.1 that serves dashboard/
// (plain HTML/CSS/JS, no CDN) and JSON built by the engine itself (status, EVM, CPM,
// agile, risk — via buildReportData). Read-only by default. With --edit it also accepts
// POST requests carrying a per-session token, and every write goes through engine/edit.js
// (free records → validate → write; controlled records → propose; decisions → apply).
const fs = require('fs');
const http = require('http');
const path = require('path');
const crypto = require('crypto');
const { PmoError, loadProject, loadExtras, readJson } = require('./io');
const { validate } = require('./validate');
const { buildReportData } = require('./report');
const { PROTECTED } = require('./approvals');
const edit = require('./edit');
const { format } = require('./i18n');

const ROOT = path.join(__dirname, '..');
const STATIC_DIR = path.join(ROOT, 'dashboard');
const STATIC = {
  '/': ['index.html', 'text/html; charset=utf-8'],
  '/index.html': ['index.html', 'text/html; charset=utf-8'],
  '/app.js': ['app.js', 'text/javascript; charset=utf-8'],
  '/app.css': ['app.css', 'text/css; charset=utf-8'],
};
const MAX_FILE_BYTES = 2 * 1024 * 1024;
const MAX_BODY_BYTES = 64 * 1024;
const LOOPBACK = ['127.0.0.1', '::1', '::ffff:127.0.0.1'];
// Write endpoints (edit mode only) → engine/edit.js function.
const WRITES = { '/api/edit': 'submit', '/api/approvals/decide': 'decide', '/api/approvals/revise': 'revise' };
// Project data files an agent definition can mention, longest first so scope/… wins.
const DATA_FILES = [
  'scope/backlog.json', 'scope/wbs.json', 'project.json', 'charter.md', 'schedule.json', 'budget.json', 'risks.json',
  'changes.json', 'stakeholders.json', 'issues.json', 'quality.json', 'lessons.json', 'approvals.json', 'decisions.json',
  'audit.json', 'progress/', 'drafts/', 'reports/',
];

// ---------- agents (parsed from agents/*.md so the page follows the plugin) ----------

function frontmatter(text) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) return { meta: {}, body: text };
  const meta = {};
  for (const line of m[1].split(/\r?\n/)) {
    const kv = line.match(/^([\w-]+):\s*(.*)$/);
    if (kv) meta[kv[1]] = kv[2].trim();
  }
  return { meta, body: m[2] };
}

function sectionText(body, heading) {
  const re = new RegExp('^##\\s+' + heading + '\\b[^\\n]*\\n([\\s\\S]*?)(?=^##\\s|$(?![\\s\\S]))', 'm');
  const m = body.match(re);
  return m ? m[1].trim() : null;
}

// "🟢 a · 🟡 b · 🔴 c" → [{level:'auto',text:'a'}, …]; also reads "## Pull (🟢)" style headings.
function autonomy(body) {
  const LV = { '🟢': 'auto', '🟡': 'approval', '🔴': 'never' };
  const out = [];
  const sec = (sectionText(body, 'Autonomy') || '').split(/\r?\n\s*\r?\n/)[0];
  if (sec) {
    const parts = sec.split(/(🟢|🟡|🔴)/u);
    for (let i = 1; i < parts.length; i += 2) {
      const text = parts[i + 1].replace(/\s*·\s*$/, '').replace(/\s+/g, ' ').trim();
      if (text) out.push({ level: LV[parts[i]], text });
    }
    return out;
  }
  const re = /^##\s+(.+?)\s*\((🟢|🟡|🔴)\)\s*\n([\s\S]*?)(?=^##\s|$(?![\s\S]))/gmu;
  let m;
  while ((m = re.exec(body))) {
    const first = m[3].trim().split(/\r?\n/).find((l) => l.trim()) || '';
    out.push({ level: LV[m[2]], text: (m[1] + ': ' + first.replace(/^\d+\.\s*/, '')).replace(/\s+/g, ' ').trim() });
  }
  if (out.length) return out;
  // Inline marks ("Sending … is 🟡: …") and "Never …" sentences.
  for (const line of body.split(/\r?\n/)) {
    const mk = line.match(/^(.*?)\s+is\s+(🟢|🟡|🔴)[:\s]+(.*)$/u);
    if (mk) out.push({ level: LV[mk[2]], text: (mk[1] + ': ' + mk[3]).trim() });
    for (const s of line.split(/(?<=\.)\s+/)) if (/^Never\b/.test(s.trim())) out.push({ level: 'never', text: s.trim() });
  }
  return out;
}

function readAgents(root = ROOT) {
  const adir = path.join(root, 'agents');
  const sdir = path.join(root, 'skills');
  const skills = fs.existsSync(sdir) ? fs.readdirSync(sdir).filter((s) => fs.existsSync(path.join(sdir, s, 'SKILL.md'))) : [];
  if (!fs.existsSync(adir)) return [];
  const mdFiles = fs.readdirSync(adir).filter((f) => f.endsWith('.md')).sort();
  const agentIds = mdFiles.map((f) => f.replace(/\.md$/, ''));
  return mdFiles.map((f) => {
      const { meta, body } = frontmatter(fs.readFileSync(path.join(adir, f), 'utf8'));
      const name = meta.name || f.replace(/\.md$/, '');
      const tools = (meta.tools || '').split(',').map((t) => t.trim()).filter(Boolean);
      // Skills are named in "Use …", "Follow …" or "… skill" sentences; other backticks are engine commands.
      const ticks = body
        .split(/(?<=\.)\s+|\r?\n/)
        .filter((s) => /\b(Use|Follow|using|with|skills)\s+(the\s+)?`|`\s+skills?\b/.test(s))
        .flatMap((s) => [...s.matchAll(/`([^`\n]+)`/g)].map((m) => m[1].trim()));
      const usedSkills = [...new Set(ticks.filter((t) => skills.includes(t)))];
      const peers = [...new Set([...body.matchAll(/`([a-z-]+)`/g)].map((m) => m[1]).filter((t) => agentIds.includes(t) && t !== name && !usedSkills.includes(t)))];
      const files = [];
      for (const df of DATA_FILES) {
        const esc = df.replace(/[./]/g, (c) => '\\' + c);
        if (new RegExp('(?:^|[^\\w./]|\\.pmo/)' + esc + (df.endsWith('/') ? '' : '(?![\\w])')).test(body))
          files.push({ file: df, controlled: PROTECTED.includes(df) });
      }
      const roleLine = (body.match(/^You are (?:the |a |an )?\*\*(.+?)\*\*(.*)$/m) || []);
      const ret = body.match(/^Return(?:s)?:?\s*(.+)$/m);
      return {
        id: name,
        file: 'agents/' + f,
        title: roleLine[1] || name,
        scope: ((roleLine[2] || '').match(/^\s*(?:\w+\s+)?\((.+)\)/) || [])[1] || null,
        description: meta.description || '',
        tools,
        canWrite: tools.includes('Write'),
        orchestrates: tools.includes('Agent'),
        skills: usedSkills,
        peers,
        files,
        autonomy: autonomy(body),
        returns: ret ? ret[1].trim() : null,
      };
    });
}

function agentActivity(approvals, decisions) {
  const act = {};
  const touch = (agent, at, kind) => {
    if (!agent) return;
    const a = (act[agent] = act[agent] || { proposals: 0, pending: 0, decided: 0, last: null, lastKind: null });
    if (kind === 'proposal') a.proposals++;
    if (kind === 'decision') a.decided++;
    if (at && (!a.last || at > a.last)) {
      a.last = at;
      a.lastKind = kind;
    }
  };
  for (const p of approvals) {
    touch(p.agent, p.createdAt, 'proposal');
    if (p.status === 'pending') act[p.agent].pending++;
  }
  for (const d of decisions) touch(d.agent, d.at, 'decision');
  return act;
}

// ---------- project files ----------

function walk(dir, rel = '', out = []) {
  let entries = [];
  try {
    entries = fs.readdirSync(path.join(dir, rel), { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const r = rel ? rel + '/' + e.name : e.name;
    if (e.isDirectory()) walk(dir, r, out);
    else if (e.isFile() && e.name !== '.gitkeep') {
      const st = fs.statSync(path.join(dir, r));
      out.push({ path: r, size: st.size, mtime: st.mtime.toISOString(), controlled: PROTECTED.includes(r) });
    }
  }
  return out;
}

function signature(dir) {
  const h = crypto.createHash('sha1');
  for (const f of walk(dir)) h.update(f.path + ':' + f.size + ':' + f.mtime + ';');
  return h.digest('hex').slice(0, 12);
}

// True when target is strictly inside base. p = path module (path.win32 in tests, so Windows rules are checked on any OS).
function inside(base, target, p = path) {
  const rel = p.relative(base, target);
  return rel !== '' && !rel.startsWith('..') && !p.isAbsolute(rel);
}

// "scope\\backlog.json" (Windows) and "scope/backlog.json" name the same record.
const posixRel = (rel) => String(rel).replace(/\\/g, '/');

// Resolve a requested path strictly inside the project folder (no traversal, no symlink escape).
function safeFile(dir, rel) {
  if (typeof rel !== 'string' || !rel || rel.includes('\0') || path.isAbsolute(rel) || path.win32.isAbsolute(rel) || /^[a-zA-Z]:/.test(rel)) return null;
  if (posixRel(rel).split('/').includes('..')) return null;
  const base = fs.realpathSync(dir);
  const target = path.resolve(base, rel);
  if (!inside(base, target)) return null;
  let real;
  try {
    real = fs.realpathSync(target);
  } catch {
    return null;
  }
  if (!inside(base, real)) return null;
  const st = fs.statSync(real);
  return st.isFile() ? { real, size: st.size } : null;
}

function errorOut(e) {
  if (!(e instanceof PmoError)) return { code: 'INTERNAL', message_en: String(e && e.message), message_ar: String(e && e.message) };
  const m = format(e.code, e.params);
  return { code: e.code, message_en: m.en, message_ar: m.ar, path: e.path, details: e.details };
}

const list = (doc, key) => (doc && Array.isArray(doc[key]) ? doc[key] : []);

function buildState(dir, { root = ROOT, editMode = false } = {}) {
  const out = {
    dir,
    generatedAt: new Date().toISOString(),
    version: signature(dir),
    readOnly: !editMode,
    editMode,
    edit: editMode ? edit.describe() : null,
    project: null,
    validation: null,
    report: null,
    error: null,
    registers: {},
    agents: [],
    files: walk(dir),
    protected: PROTECTED,
  };
  let data = null;
  let extras = {};
  try {
    data = loadProject(dir);
    extras = loadExtras(dir);
    out.project = data.project;
    const v = validate(data);
    out.validation = v;
    if (v.ok) out.report = buildReportData({ ...data, ...extras });
  } catch (e) {
    out.error = errorOut(e);
  }
  const opt = (f) => {
    try {
      return readJson(dir, f, { optional: true });
    } catch {
      return null;
    }
  };
  const quality = extras.quality || opt('quality.json');
  const approvals = list(extras.approvals || opt('approvals.json'), 'approvals');
  const decisions = list(extras.decisions || opt('decisions.json'), 'decisions');
  out.registers = {
    backlog: data ? data.backlog : opt('scope/backlog.json'),
    issues: list(extras.issues || opt('issues.json'), 'issues'),
    risks: list(data ? data.risks : opt('risks.json'), 'risks'),
    changes: list(extras.changes || opt('changes.json'), 'changes'),
    stakeholders: list(extras.stakeholders || opt('stakeholders.json'), 'stakeholders'),
    lessons: list(opt('lessons.json'), 'lessons'),
    defects: list(quality, 'defects'),
    approvals: approvals.map((a) => (editMode && a.status === 'pending' ? { ...a, kind: edit.kindOf(a.operation) } : a)),
    decisions,
    audit: list(opt('audit.json'), 'entries'),
    progress: data ? data.progress.map((p) => ({ ...p })) : [],
  };
  const activity = agentActivity(approvals, decisions);
  out.agents = readAgents(root).map((a) => ({ ...a, activity: activity[a.id] || null }));
  return out;
}

// ---------- HTTP ----------

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'X-Frame-Options': 'DENY',
  'Cache-Control': 'no-store',
  'Content-Security-Policy': "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
};

function send(res, code, body, type = 'application/json; charset=utf-8', extra = {}) {
  const buf = Buffer.isBuffer(body) ? body : Buffer.from(typeof body === 'string' ? body : JSON.stringify(body));
  res.writeHead(code, { 'Content-Type': type, 'Content-Length': buf.length, ...SECURITY_HEADERS, ...extra });
  res.end(buf);
}

const STATUS = {
  INPUT_INVALID: 400, VALIDATION_FAILED: 400, ARG_MISSING: 400, ENUM_INVALID: 400, ID_DUPLICATE: 400, OP_INVALID: 400, FILE_NOT_ALLOWED: 400,
  JSON_INVALID: 400, ITEM_NOT_FOUND: 404, FILE_MISSING: 404, APPROVAL_RESOLVED: 409, PROPOSAL_STALE: 409,
};
const fail = (code, en, ar) => ({ error: { code, message_en: en, message_ar: ar } });

function sameToken(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

// Reads a JSON body up to MAX_BODY_BYTES; calls back with (status, error) or (null, value).
function readBody(req, cb) {
  const declared = Number(req.headers['content-length']);
  if (declared > MAX_BODY_BYTES) {
    req.resume();
    return cb(413);
  }
  const chunks = [];
  let size = 0;
  let over = false;
  req.on('data', (c) => {
    if (over) return;
    size += c.length;
    if (size > MAX_BODY_BYTES) over = true;
    else chunks.push(c);
  });
  req.on('end', () => {
    if (over) return cb(413);
    try {
      return cb(null, JSON.parse(Buffer.concat(chunks).toString('utf8').replace(/^﻿/, '')));
    } catch {
      return cb(400);
    }
  });
  req.on('error', () => cb(400));
}

function createServer(dir, { pollMs = 1000, root = ROOT, port = 0, editMode = false, token = null } = {}) {
  dir = path.resolve(dir);
  if (editMode && !token) token = crypto.randomBytes(24).toString('hex');
  const clients = new Set();
  let version = null;
  let timer = null;
  const allowedHosts = () => {
    const p = server.address() ? server.address().port : port;
    return ['localhost', '127.0.0.1', '[::1]'].map((h) => h + ':' + p);
  };

  const poll = () => {
    let v;
    try {
      v = signature(dir);
    } catch {
      return;
    }
    if (version !== null && v !== version) for (const c of clients) c.write('event: change\ndata: ' + JSON.stringify({ version: v }) + '\n\n');
    version = v;
  };

  // Edit mode: loopback peer → same Origin → session token → JSON body ≤ 64 KB → engine/edit.js.
  const write = (req, res, fn) => {
    if (!LOOPBACK.includes(req.socket.remoteAddress)) return send(res, 403, fail('NOT_LOCAL', 'Edits are accepted from this machine only', 'التعديل مسموح من هذا الجهاز فقط'));
    const origin = String(req.headers.origin || '').toLowerCase();
    const site = req.headers['sec-fetch-site'];
    if (!allowedHosts().map((h) => 'http://' + h).includes(origin) || (site && site !== 'same-origin'))
      return send(res, 403, fail('ORIGIN_NOT_ALLOWED', 'Request must come from the dashboard page itself', 'يجب أن يأتي الطلب من صفحة اللوحة نفسها'));
    if (!sameToken(req.headers['x-pmo-token'], token))
      return send(res, 401, fail('TOKEN_REQUIRED', 'Missing or wrong session token: open the link printed in the Terminal', 'رمز الجلسة مفقود أو غير صحيح: افتح الرابط المطبوع في الـTerminal'));
    if (!/^application\/json\b/i.test(String(req.headers['content-type'] || '')))
      return send(res, 415, fail('JSON_REQUIRED', 'Send JSON (Content-Type: application/json)', 'أرسل JSON (Content-Type: application/json)'));
    return readBody(req, (status, body) => {
      if (status === 413) return send(res, 413, fail('BODY_TOO_LARGE', 'Request is larger than 64 KB', 'الطلب أكبر من 64 KB'), undefined, { Connection: 'close' });
      if (status) return send(res, 400, fail('JSON_INVALID', 'Request body is not valid JSON', 'محتوى الطلب ليس JSON صالحًا'));
      try {
        return send(res, 200, { ok: true, result: edit[fn](dir, body) });
      } catch (e) {
        if (!(e instanceof PmoError)) return send(res, 500, { error: errorOut(e) });
        return send(res, STATUS[e.code] || 400, { error: errorOut(e) });
      }
    });
  };

  const server = http.createServer((req, res) => {
    // DNS-rebinding guard: only answer requests addressed to this machine.
    if (!allowedHosts().includes(String(req.headers.host || '').toLowerCase())) return send(res, 403, { error: { code: 'HOST_NOT_ALLOWED' } });
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      if (!editMode)
        return send(res, 405, { error: { code: 'READ_ONLY', message_en: 'The dashboard is read-only', message_ar: 'لوحة المتابعة للقراءة فقط' } }, undefined, { Allow: 'GET, HEAD' });
      const wp = String(req.url || '').split('?')[0];
      if (req.method === 'POST' && WRITES[wp]) return write(req, res, WRITES[wp]);
      return send(res, 405, fail('METHOD_NOT_ALLOWED', 'Use GET, or POST on the edit endpoints', 'استخدم GET، أو POST على مسارات التعديل'), undefined, { Allow: WRITES[wp] ? 'GET, HEAD, POST' : 'GET, HEAD' });
    }
    let url;
    try {
      url = new URL(req.url, 'http://localhost');
    } catch {
      return send(res, 400, { error: { code: 'BAD_URL' } });
    }
    const p = url.pathname;

    if (STATIC[p]) {
      const [file, type] = STATIC[p];
      return send(res, 200, fs.readFileSync(path.join(STATIC_DIR, file)), type);
    }
    if (p === '/i18n.json') {
      const report = JSON.parse(fs.readFileSync(path.join(root, 'templates', 'report-i18n.json'), 'utf8'));
      const dash = JSON.parse(fs.readFileSync(path.join(STATIC_DIR, 'i18n.json'), 'utf8'));
      return send(res, 200, { ar: { ...report.ar, ...dash.ar }, en: { ...report.en, ...dash.en } });
    }
    if (p === '/favicon.ico') return send(res, 204, '');
    if (p === '/api/state') return send(res, 200, buildState(dir, { root, editMode }));
    if (p === '/api/files') return send(res, 200, walk(dir));
    if (p === '/api/file') {
      const rel = url.searchParams.get('path');
      let f = null;
      try {
        f = safeFile(dir, rel);
      } catch {
        f = null;
      }
      if (!f) return send(res, 404, { error: { code: 'FILE_NOT_FOUND', message_en: 'File not found in the project folder', message_ar: 'الملف غير موجود داخل مجلد المشروع' } });
      if (f.size > MAX_FILE_BYTES) return send(res, 413, { error: { code: 'FILE_TOO_LARGE' } });
      const text = fs.readFileSync(f.real, 'utf8').replace(/^\uFEFF/, '');
      let json = null;
      let parseError = null;
      if (/\.json$/i.test(rel)) {
        try {
          json = JSON.parse(text);
        } catch (e) {
          parseError = e.message;
        }
      }
      return send(res, 200, { path: posixRel(rel), size: f.size, controlled: PROTECTED.includes(posixRel(rel)), json, text: json ? null : text, parseError });
    }
    if (p === '/api/events') {
      res.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8', Connection: 'keep-alive', ...SECURITY_HEADERS });
      res.write('retry: 2000\nevent: hello\ndata: ' + JSON.stringify({ version }) + '\n\n');
      clients.add(res);
      req.on('close', () => clients.delete(res));
      return undefined;
    }
    return send(res, 404, { error: { code: 'NOT_FOUND' } });
  });

  server.on('listening', () => {
    poll();
    timer = setInterval(poll, pollMs);
    timer.unref();
  });
  server.on('close', () => clearInterval(timer));
  server.token = token;
  server.editMode = editMode;
  const close = server.close.bind(server);
  server.close = (cb) => {
    for (const c of clients) c.end();
    clients.clear();
    clearInterval(timer);
    return close(cb);
  };
  return server;
}

function parseArgs(argv) {
  const o = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const next = argv[i + 1];
    o[a.slice(2)] = next !== undefined && !next.startsWith('--') ? argv[++i] : true;
  }
  return o;
}

// --dir may point at the .pmo folder or at the project folder that contains it; relative paths are
// resolved against cwd with the platform's rules (p = path.win32 in tests: "examples\waterfall\.pmo").
function resolveProjectDir(arg, { cwd = process.cwd(), p = path, exists = (f) => fs.existsSync(f) } = {}) {
  const dir = p.resolve(cwd, typeof arg === 'string' && arg ? arg : '.pmo');
  if (exists(p.join(dir, 'project.json'))) return { dir, found: true };
  const nested = p.join(dir, '.pmo');
  if (exists(p.join(nested, 'project.json'))) return { dir: nested, found: true };
  return { dir, found: false };
}

const USAGE = 'Usage: npm run dashboard -- --dir <project>/.pmo [--port 4173] [--edit]\n       node engine/dashboard.js --dir <project>/.pmo [--port 4173] [--edit]\n';

function main(argv) {
  const o = parseArgs(argv);
  const { dir: finalDir, found } = resolveProjectDir(typeof o.dir === 'string' ? o.dir : typeof o.project === 'string' ? o.project : null);
  if (!found) {
    const m = format('FILE_MISSING', { file: path.join(finalDir, 'project.json') });
    process.stderr.write(m.ar + '\n' + m.en + '\n' + USAGE);
    process.exitCode = 1;
    return null;
  }
  const editMode = o.edit === true || o.edit === 'true';
  const port = o.port === undefined ? 4173 : Number(o.port);
  const host = typeof o.host === 'string' ? o.host : '127.0.0.1';
  if (editMode && !['127.0.0.1', 'localhost'].includes(host)) {
    process.stderr.write('Edit mode listens on 127.0.0.1 only · وضع التعديل يعمل على 127.0.0.1 فقط\n');
    process.exitCode = 1;
    return null;
  }
  const server = createServer(finalDir, { port, editMode });
  server.listen(port, editMode ? '127.0.0.1' : host, () => {
    const p = server.address().port;
    const lines = editMode
      ? [
          'PMO dashboard — EDIT MODE · لوحة متابعة PMO — وضع التعديل',
          `  Open this link once (it carries the session token) · افتح هذا الرابط مرة واحدة (فيه رمز الجلسة):`,
          `  http://localhost:${p}/#token=${server.token}`,
          '  Controlled records become proposals; you approve them on the Approvals page.',
          '  السجلات المحمية تصبح اقتراحات، وتوافق عليها من صفحة الموافقات.',
        ]
      : ['PMO dashboard (read-only) · لوحة متابعة PMO (قراءة فقط)', `  http://localhost:${p}`];
    process.stdout.write(lines.join('\n') + `\n  project: ${finalDir}\n  Ctrl+C to stop · Ctrl+C للإيقاف\n`);
  });
  server.on('error', (e) => {
    process.stderr.write((e.code === 'EADDRINUSE' ? `Port ${port} is in use; try --port ${port + 1}` : e.message) + '\n');
    process.exitCode = 1;
  });
  return server;
}

if (require.main === module) main(process.argv.slice(2));

module.exports = { createServer, buildState, readAgents, safeFile, inside, posixRel, resolveProjectDir, signature, walk, main, MAX_BODY_BYTES };
