#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const { PmoError, loadProject, readJson } = require('./io');
const { format } = require('./i18n');
const { validate } = require('./validate');
const evm = require('./evm');
const agile = require('./agile');
const risk = require('./risk');
const approvals = require('./approvals');
const { cpm, withProgress } = require('./schedule');
const { status } = require('./status');
const { createProject } = require('./init');
const { writeReport } = require('./report');
const { importFile } = require('./import');

function parseArgs(argv) {
  const [cmd, ...rest] = argv;
  const opts = {};
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    if (!a.startsWith('--')) continue;
    const next = rest[i + 1];
    opts[a.slice(2)] = next !== undefined && !next.startsWith('--') ? rest[++i] : true;
  }
  return { cmd, opts };
}

function loadValid(dir) {
  const data = loadProject(dir);
  const v = validate(data);
  if (!v.ok) throw new PmoError('VALIDATION_FAILED', { count: v.errors.length }, null, v.errors);
  return data;
}

const need = (obj, file) => {
  if (!obj) throw new PmoError('FILE_MISSING', { file }, file);
  return obj;
};

function readProposal(o) {
  try {
    if (typeof o.json === 'string') return JSON.parse(o.json);
    if (typeof o.file === 'string') return JSON.parse(fs.readFileSync(o.file, 'utf8').replace(/^﻿/, ''));
  } catch (e) {
    throw new PmoError('JSON_INVALID', { file: o.file || '--json', detail: e.message });
  }
  throw new PmoError('ARG_MISSING', { arg: 'json | --file' });
}

const COMMANDS = {
  validate: (dir) => validate(loadProject(dir)),
  status: (dir, o) => status(loadValid(dir), o.date),
  evm: (dir, o) => {
    const d = loadValid(dir);
    return { current: evm.fromProject(d, o.date), trend: evm.trend(d) };
  },
  schedule: (dir, o) => {
    const d = loadValid(dir);
    const s = need(d.schedule, 'schedule.json');
    const at = o.date || evm.effectiveDate(d.project, d.progress);
    const snaps = d.progress.filter((p) => !at || p.date <= at);
    return {
      planned: cpm(s, d.project.startDate),
      forecast: at ? cpm(withProgress(s, snaps), d.project.startDate, { statusDate: at }) : null,
    };
  },
  agile: (dir) => {
    const d = loadValid(dir);
    const last = d.progress.length ? d.progress[d.progress.length - 1] : null;
    return agile.analyze(need(d.backlog, 'scope/backlog.json'), { bac: d.budget ? d.budget.bac : null, ac: last ? last.actualCost : null });
  },
  risk: (dir) => risk.analyze(need(loadValid(dir).risks, 'risks.json')),
  propose: (dir, o) => approvals.propose(dir, readProposal(o)),
  approvals: (dir, o) => approvals.list(dir, typeof o.status === 'string' ? o.status : 'pending'),
  apply: (dir, o) => {
    const opts = { by: typeof o.by === 'string' ? o.by : null, note: typeof o.note === 'string' ? o.note : null };
    if (typeof o.ids === 'string') {
      // Batch: one confirmation for several decisions; each id succeeds or fails on its own.
      const results = o.ids.split(',').map((s) => s.trim()).filter(Boolean).map((id) => {
        try {
          return { id, ok: true, decision: approvals.apply(dir, id, o.decision, opts).decision };
        } catch (e) {
          if (!(e instanceof PmoError)) throw e;
          const m = format(e.code, e.params);
          return { id, ok: false, error: { code: e.code, message_en: m.en, message_ar: m.ar } };
        }
      });
      return { results };
    }
    if (typeof o.id !== 'string') throw new PmoError('ARG_MISSING', { arg: 'id' });
    return approvals.apply(dir, o.id, o.decision, { by: typeof o.by === 'string' ? o.by : null, note: typeof o.note === 'string' ? o.note : null });
  },
  report: (dir, o) =>
    writeReport(dir, {
      date: typeof o.date === 'string' ? o.date : undefined,
      lang: typeof o.lang === 'string' ? o.lang : undefined,
      narrativeFile: typeof o.narrative === 'string' ? o.narrative : null,
      out: typeof o.out === 'string' ? path.resolve(o.out) : undefined,
    }),
  import: (dir, o) => {
    let map = null;
    if (typeof o.map === 'string') {
      try {
        map = JSON.parse(o.map);
      } catch (e) {
        throw new PmoError('JSON_INVALID', { file: '--map', detail: e.message });
      }
    }
    return importFile(dir, {
      from: typeof o.from === 'string' ? path.resolve(o.from) : null,
      type: o.type,
      map,
      sheet: typeof o.sheet === 'string' ? o.sheet : undefined,
      write: o.write === true,
      date: typeof o.date === 'string' ? o.date : undefined,
      dateFormat: o['date-format'] === 'mdy' ? 'mdy' : 'dmy',
    });
  },
  doctor: (dir) => {
    const root = path.dirname(dir);
    const exists = fs.existsSync(path.join(dir, 'project.json'));
    const project = { dir, exists, valid: null, errors: 0, pendingApprovals: 0 };
    if (exists) {
      try {
        const v = validate(loadProject(dir));
        project.valid = v.ok;
        project.errors = v.errors.length;
        project.pendingApprovals = approvals.list(dir).length;
      } catch {
        project.valid = false;
      }
    }
    let servers = {};
    try {
      servers = JSON.parse(fs.readFileSync(path.join(root, '.mcp.json'), 'utf8')).mcpServers || {};
    } catch {
      servers = {};
    }
    const catalog = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'connectors', 'catalog.json'), 'utf8')).connectors;
    return {
      node: { version: process.version, ok: Number(process.versions.node.split('.')[0]) >= 18 },
      project,
      connectors: catalog.map((c) => ({
        id: c.id,
        name: c.name,
        setup: c.setup,
        url: c.url || null,
        configured: c.id in servers || Object.values(servers).some((s) => c.url && s && s.url === c.url),
      })),
    };
  },
  decisions: (dir) => {
    const doc = readJson(dir, 'decisions.json', { optional: true });
    return doc ? doc.decisions : [];
  },
  init: (dir, o) =>
    createProject(dir, {
      name: o.name,
      methodology: o.methodology,
      language: o.language,
      currency: o.currency,
      startDate: o.start,
      endDate: o.end,
      bac: o.bac,
      sponsor: o.sponsor,
      projectManager: o.pm,
    }),
};

function run(argv) {
  try {
    const { cmd, opts } = parseArgs(argv);
    const fn = COMMANDS[cmd];
    if (!fn) throw new PmoError('UNKNOWN_COMMAND', { cmd: cmd || '', commands: Object.keys(COMMANDS).join(', ') });
    const dir = path.resolve(typeof opts.dir === 'string' ? opts.dir : '.pmo');
    return { code: 0, out: fn(dir, opts) };
  } catch (e) {
    if (!(e instanceof PmoError)) throw e;
    const m = format(e.code, e.params);
    return { code: 1, out: { error: { code: e.code, message_en: m.en, message_ar: m.ar, path: e.path, details: e.details } } };
  }
}

if (require.main === module) {
  const r = run(process.argv.slice(2));
  process.stdout.write(JSON.stringify(r.out, null, 2) + '\n');
  process.exitCode = r.code;
}

module.exports = { run, parseArgs };
