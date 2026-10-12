'use strict';
const fs = require('fs');
const path = require('path');
const { PmoError, writeJson } = require('./io');
const { validate } = require('./validate');

const REQUIRED = ['name', 'methodology', 'language', 'currency', 'startDate', 'endDate'];

function createProject(dir, o) {
  for (const k of REQUIRED) if (!o[k]) throw new PmoError('ARG_MISSING', { arg: k });
  if (fs.existsSync(path.join(dir, 'project.json'))) throw new PmoError('PROJECT_EXISTS', { dir });

  const project = {
    schemaVersion: 1,
    name: o.name,
    methodology: o.methodology,
    language: o.language,
    currency: o.currency,
    startDate: o.startDate,
    endDate: o.endDate,
    statusDate: o.startDate,
    sponsor: o.sponsor || '',
    projectManager: o.projectManager || '',
    thresholds: { green: 0.95, amber: 0.85 },
  };
  const files = {
    'project.json': project,
    'budget.json': { schemaVersion: 1, bac: Number(o.bac) || 0, reserves: { contingency: 0, management: 0 }, plannedValue: [] },
    'risks.json': { schemaVersion: 1, risks: [] },
    'stakeholders.json': { schemaVersion: 1, stakeholders: [] },
    'issues.json': { schemaVersion: 1, issues: [] },
    'changes.json': { schemaVersion: 1, changes: [] },
    'quality.json': { schemaVersion: 1, metrics: [], defects: [], audits: [] },
    'lessons.json': { schemaVersion: 1, lessons: [] },
    'decisions.json': { schemaVersion: 1, decisions: [] },
    'approvals.json': { schemaVersion: 1, approvals: [] },
  };
  if (o.methodology !== 'agile') files['schedule.json'] = { schemaVersion: 1, activities: [] };
  if (o.methodology !== 'waterfall')
    files['scope/backlog.json'] = { schemaVersion: 1, releasePlan: { totalPoints: 0, plannedSprints: 0, sprintLengthDays: 14 }, sprints: [], items: [] };

  const v = validate({
    project,
    schedule: files['schedule.json'] || null,
    budget: files['budget.json'],
    backlog: files['scope/backlog.json'] || null,
    risks: files['risks.json'],
    progress: [],
  });
  if (!v.ok) throw new PmoError('VALIDATION_FAILED', { count: v.errors.length }, null, v.errors);

  for (const [rel, data] of Object.entries(files)) writeJson(dir, rel, data);
  for (const d of ['progress', 'reports']) {
    fs.mkdirSync(path.join(dir, d), { recursive: true });
    fs.writeFileSync(path.join(dir, d, '.gitkeep'), '');
  }
  return { dir, files: Object.keys(files) };
}

module.exports = { createProject };
