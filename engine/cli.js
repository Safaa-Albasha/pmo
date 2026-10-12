#!/usr/bin/env node
'use strict';
const path = require('path');
const { PmoError, loadProject } = require('./io');
const { format } = require('./i18n');
const { validate } = require('./validate');
const evm = require('./evm');
const agile = require('./agile');
const risk = require('./risk');
const { cpm } = require('./schedule');
const { status } = require('./status');
const { createProject } = require('./init');

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

const COMMANDS = {
  validate: (dir) => validate(loadProject(dir)),
  status: (dir, o) => status(loadValid(dir), o.date),
  evm: (dir, o) => {
    const d = loadValid(dir);
    return { current: evm.fromProject(d, o.date), trend: evm.trend(d) };
  },
  schedule: (dir) => {
    const d = loadValid(dir);
    return cpm(need(d.schedule, 'schedule.json'), d.project.startDate);
  },
  agile: (dir) => {
    const d = loadValid(dir);
    const last = d.progress.length ? d.progress[d.progress.length - 1] : null;
    return agile.analyze(need(d.backlog, 'scope/backlog.json'), { bac: d.budget ? d.budget.bac : null, ac: last ? last.actualCost : null });
  },
  risk: (dir) => risk.analyze(need(loadValid(dir).risks, 'risks.json')),
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
