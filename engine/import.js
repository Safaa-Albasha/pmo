'use strict';
// Import tables (CSV, Excel .xlsx, JSON) from Jira, MS Project, Planner, Asana, Linear,
// ClickUp, Monday or hand-made sheets into the .pmo data model. Headers are matched in
// Arabic and English. Free records are merged directly; controlled records become proposals.
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { PmoError, readJson, writeJson, loadProject } = require('./io');
const { validate } = require('./validate');
const approvals = require('./approvals');
const { addDays, daysBetween, isDate } = require('./util');

// ---------- readers ----------

function parseCsv(text) {
  text = text.replace(/^﻿/, '');
  const firstLine = text.split(/\r?\n/, 1)[0] || '';
  const count = (ch) => firstLine.split(ch).length - 1;
  const delim = [',', ';', '\t'].reduce((best, ch) => (count(ch) > count(best) ? ch : best), ',');
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === delim) {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += c;
  }
  if (field !== '' || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((v) => v.trim() !== ''));
}

function unzip(buf) {
  let eocd = -1;
  for (let i = buf.length - 22; i >= 0; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new PmoError('IMPORT_FORMAT', { file: 'xlsx (not a zip file)' });
  const files = {};
  let p = buf.readUInt32LE(eocd + 16);
  const n = buf.readUInt16LE(eocd + 10);
  for (let k = 0; k < n; k++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) break;
    const method = buf.readUInt16LE(p + 10);
    const size = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const local = buf.readUInt32LE(p + 42);
    const name = buf.toString('utf8', p + 46, p + 46 + nameLen);
    const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
    const data = buf.subarray(start, start + size);
    if (method === 0) files[name] = data.toString('utf8');
    else if (method === 8) files[name] = zlib.inflateRawSync(data).toString('utf8');
    p += 46 + nameLen + extraLen + commentLen;
  }
  return files;
}

const decodeXml = (s) =>
  s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&amp;/g, '&');

function attrs(tag) {
  const out = {};
  for (const m of tag.matchAll(/([\w:]+)="([^"]*)"/g)) out[m[1]] = m[2];
  return out;
}

const textOf = (xml) => decodeXml([...xml.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map((m) => m[1]).join(''));

function colIndex(ref) {
  const letters = ref.replace(/\d+/g, '');
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

function readXlsx(buf, sheetName) {
  const files = unzip(buf);
  const sheets = [...(files['xl/workbook.xml'] || '').matchAll(/<sheet\b[^>]*>/g)].map((m) => attrs(m[0]));
  const rels = Object.fromEntries(
    [...(files['xl/_rels/workbook.xml.rels'] || '').matchAll(/<Relationship\b[^>]*>/g)].map((m) => {
      const a = attrs(m[0]);
      return [a.Id, a.Target];
    })
  );
  const sheet = sheetName ? sheets.find((s) => s.name === sheetName) : sheets[0];
  if (sheetName && !sheet) throw new PmoError('IMPORT_SHEET', { sheet: sheetName, sheets: sheets.map((s) => s.name).join(', ') });
  let target = sheet && rels[sheet['r:id']] ? rels[sheet['r:id']] : 'worksheets/sheet1.xml';
  target = target.replace(/^\/?xl\//, '');
  const xml = files['xl/' + target];
  if (!xml) throw new PmoError('IMPORT_FORMAT', { file: 'xlsx (sheet not found)' });
  const shared = [...(files['xl/sharedStrings.xml'] || '').matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => textOf(m[1]));

  const rows = [];
  for (const rm of xml.matchAll(/<row\b([^>]*)>([\s\S]*?)<\/row>/g)) {
    const r = Number(attrs(rm[1]).r) - 1;
    const row = [];
    for (const cm of rm[2].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const a = attrs(cm[1]);
      const inner = cm[2] || '';
      const v = (inner.match(/<v>([\s\S]*?)<\/v>/) || [])[1];
      let val = '';
      if (a.t === 's') val = shared[Number(v)] ?? '';
      else if (a.t === 'inlineStr') val = textOf(inner);
      else if (v !== undefined) val = decodeXml(v);
      row[colIndex(a.r)] = val;
    }
    rows[r] = Array.from(row, (x) => x ?? '');
  }
  const width = Math.max(0, ...rows.filter(Boolean).map((r) => r.length));
  return rows.filter(Boolean).map((r) => Array.from({ length: width }, (_, i) => r[i] ?? '')).filter((r) => r.some((v) => v !== ''));
}

function readTable(file, { sheet } = {}) {
  if (!fs.existsSync(file)) throw new PmoError('FILE_MISSING', { file }, file);
  const ext = path.extname(file).toLowerCase();
  let grid;
  if (['.csv', '.tsv', '.txt'].includes(ext)) grid = parseCsv(fs.readFileSync(file, 'utf8'));
  else if (ext === '.xlsx') grid = readXlsx(fs.readFileSync(file), sheet);
  else if (ext === '.json') {
    let j;
    try {
      j = JSON.parse(fs.readFileSync(file, 'utf8').replace(/^﻿/, ''));
    } catch (e) {
      throw new PmoError('JSON_INVALID', { file, detail: e.message });
    }
    const list = Array.isArray(j) ? j : j.rows || j.items || j.issues || j.tasks || j.data || [];
    const headers = [...new Set(list.flatMap((o) => Object.keys(o)))];
    return { headers, rows: list.map((o) => Object.fromEntries(headers.map((h) => [h, o[h] === null || o[h] === undefined ? '' : String(o[h])]))) };
  } else throw new PmoError('IMPORT_FORMAT', { file });
  if (!grid.length) return { headers: [], rows: [] };
  const headers = grid[0].map((h) => String(h).trim());
  const rows = grid.slice(1).map((r) => Object.fromEntries(headers.map((h, i) => [h, String(r[i] ?? '').trim()])));
  return { headers, rows };
}

// ---------- field matching ----------

const COMMON_ID = ['id', 'key', 'issue key', 'issue id', 'task id', 'unique id', 'المعرف', 'المعرّف', 'الرقم', 'رقم'];
const FIELDS = {
  backlog: {
    id: [...COMMON_ID, 'story id'],
    title: ['title', 'summary', 'name', 'task name', 'task', 'story', 'العنوان', 'الاسم', 'المهمة', 'القصة'],
    points: ['story points', 'custom field (story points)', 'story point estimate', 'points', 'estimate', 'نقاط القصة', 'النقاط', 'نقاط'],
    status: ['status', 'state', 'section/column', 'الحالة'],
    sprint: ['sprint', 'cycle', 'cycle name', 'iteration', 'السبرنت'],
    priority: ['priority', 'الأولوية'],
    epic: ['epic', 'epic link', 'parent', 'parent summary', 'الملحمة'],
  },
  risks: {
    id: [...COMMON_ID, 'risk id'],
    title: ['title', 'risk', 'risk title', 'name', 'summary', 'الخطر', 'المخاطرة', 'العنوان'],
    probability: ['probability', 'likelihood', 'p', 'الاحتمال', 'الاحتمالية'],
    impact: ['impact', 'severity', 'consequence', 'i', 'الأثر', 'التأثير'],
    owner: ['owner', 'risk owner', 'assignee', 'المالك', 'المسؤول', 'مالك المخاطرة'],
    status: ['status', 'state', 'الحالة'],
    responseStrategy: ['strategy', 'response strategy', 'الاستراتيجية', 'استراتيجية الاستجابة'],
    response: ['response', 'mitigation', 'response plan', 'action', 'الاستجابة', 'خطة الاستجابة', 'الإجراء'],
    costImpact: ['cost impact', 'financial impact', 'cost', 'الأثر المالي', 'التكلفة'],
    category: ['category', 'type', 'الفئة', 'التصنيف'],
  },
  schedule: {
    id: [...COMMON_ID, 'wbs', 'activity id'],
    name: ['name', 'task name', 'task', 'activity', 'title', 'اسم المهمة', 'النشاط', 'المهمة', 'الاسم'],
    duration: ['duration', 'days', 'المدة'],
    start: ['start', 'start date', 'begin', 'البداية', 'تاريخ البداية'],
    finish: ['finish', 'end', 'end date', 'due date', 'due', 'النهاية', 'تاريخ النهاية', 'تاريخ الاستحقاق'],
    predecessors: ['predecessors', 'depends on', 'dependencies', 'الأنشطة السابقة', 'السابق', 'الاعتمادات'],
    percentComplete: ['% complete', 'percent complete', 'progress', '% مكتمل', 'نسبة الإنجاز', 'الإنجاز'],
    budget: ['budget', 'cost', 'الميزانية', 'التكلفة'],
    owner: ['resource names', 'assigned to', 'assignee', 'owner', 'الموارد', 'المسؤول'],
  },
  issues: {
    id: COMMON_ID,
    title: ['title', 'summary', 'issue', 'name', 'القضية', 'العنوان'],
    priority: ['priority', 'الأولوية'],
    owner: ['owner', 'assignee', 'المالك', 'المسؤول'],
    due: ['due', 'due date', 'الاستحقاق', 'تاريخ الاستحقاق'],
    status: ['status', 'state', 'الحالة'],
    description: ['description', 'details', 'الوصف'],
  },
  stakeholders: {
    id: COMMON_ID,
    name: ['name', 'stakeholder', 'الاسم', 'صاحب المصلحة'],
    role: ['role', 'title', 'الدور', 'المنصب'],
    organization: ['organization', 'organisation', 'department', 'الجهة', 'الإدارة'],
    power: ['power', 'influence', 'القوة', 'التأثير', 'النفوذ'],
    interest: ['interest', 'الاهتمام'],
  },
  progress: {
    id: [...COMMON_ID, 'activity', 'activity id', 'النشاط'],
    percentComplete: ['% complete', 'percent complete', 'progress', 'complete', '% مكتمل', 'نسبة الإنجاز', 'الإنجاز'],
  },
};
const TARGET = {
  backlog: { file: 'scope/backlog.json', coll: 'items', controlled: false },
  issues: { file: 'issues.json', coll: 'issues', controlled: false },
  stakeholders: { file: 'stakeholders.json', coll: 'stakeholders', controlled: false },
  risks: { file: 'risks.json', coll: 'risks', controlled: true },
  schedule: { file: 'schedule.json', coll: 'activities', controlled: true },
  progress: { file: null, coll: null, controlled: false },
};

const norm = (s) => String(s).toLowerCase().replace(/[:_]/g, ' ').replace(/\s+/g, ' ').trim();

function mapHeaders(type, headers, override = {}) {
  const byNorm = new Map(headers.map((h) => [norm(h), h]));
  const mapping = {};
  for (const [field, syns] of Object.entries(FIELDS[type])) {
    if (override[field]) mapping[field] = headers.includes(override[field]) ? override[field] : null;
    else mapping[field] = syns.map((s) => byNorm.get(norm(s))).find(Boolean) || null;
  }
  return mapping;
}

// ---------- value converters ----------

function num(v) {
  if (v === undefined || v === null || !/\d/.test(String(v))) return undefined;
  const n = Number(String(v).replace(/[,\s%]/g, '').replace(/[^\d.+-]/g, ''));
  return Number.isFinite(n) ? n : undefined;
}

function pct(v) {
  const n = num(v);
  if (n === undefined) return undefined;
  return !String(v).includes('%') && n > 0 && n < 1 ? Math.round(n * 1000) / 10 : n;
}

const LEVEL_WORDS = [
  [5, ['very high', 'critical', 'extreme', 'مرتفع جدا', 'مرتفع جدًا', 'عالي جدا', 'عالٍ جدًا', 'حرج']],
  [1, ['very low', 'rare', 'منخفض جدا', 'منخفض جدًا', 'نادر']],
  [4, ['high', 'likely', 'major', 'مرتفع', 'عالي', 'عالٍ', 'كبير']],
  [2, ['low', 'unlikely', 'minor', 'منخفض', 'ضعيف', 'صغير']],
  [3, ['medium', 'moderate', 'possible', 'متوسط']],
];

function level(v) {
  if (v === undefined || String(v).trim() === '') return undefined;
  const s = norm(v);
  if (String(v).includes('%')) {
    const p = num(v);
    return p < 10 ? 1 : p < 30 ? 2 : p < 50 ? 3 : p < 70 ? 4 : 5;
  }
  const n = num(v);
  if (n !== undefined && /^[\d.\s]+$/.test(s)) return Math.min(5, Math.max(1, Math.round(n)));
  for (const [lv, words] of LEVEL_WORDS) if (words.some((w) => s === norm(w))) return lv;
  return undefined;
}

// Backlog priority: 1 = highest (Jira/Linear/Asana words, Arabic or English).
const PRIORITY_WORDS = [
  [1, ['highest', 'urgent', 'critical', 'blocker', 'p1', 'عاجل', 'حرج', 'الأعلى']],
  [2, ['high', 'major', 'p2', 'عالي', 'عالٍ', 'مرتفع', 'مرتفعة', 'عالية']],
  [3, ['medium', 'normal', 'p3', 'متوسط', 'متوسطة', 'عادي']],
  [4, ['low', 'minor', 'p4', 'منخفض', 'منخفضة']],
  [5, ['lowest', 'trivial', 'p5', 'الأدنى']],
];

function priority(v) {
  if (v === undefined || String(v).trim() === '') return undefined;
  const s = norm(v);
  for (const [p, words] of PRIORITY_WORDS) if (words.some((w) => s === norm(w))) return p;
  return num(v);
}

const STATUS = {
  backlog: [
    ['done', ['done', 'closed', 'resolved', 'complete', 'completed', 'finished', 'منجز', 'مكتمل', 'مغلق', 'تم']],
    ['doing', ['in progress', 'doing', 'in review', 'review', 'testing', 'in development', 'قيد التنفيذ', 'قيد العمل', 'جاري']],
  ],
  risks: [
    ['closed', ['closed', 'retired', 'مغلق', 'مغلقة']],
    ['occurred', ['occurred', 'realized', 'realised', 'issue', 'وقع', 'وقعت']],
  ],
  issues: [
    ['closed', ['closed', 'done', 'مغلق']],
    ['resolved', ['resolved', 'fixed', 'محلول']],
    ['in-progress', ['in progress', 'doing', 'قيد التنفيذ', 'قيد المعالجة']],
  ],
};
const STATUS_DEFAULT = { backlog: 'todo', risks: 'open', issues: 'open' };

function status(type, v) {
  if (v === undefined || String(v).trim() === '') return undefined;
  const s = norm(v);
  for (const [val, words] of STATUS[type] || []) if (words.some((w) => s === norm(w))) return val;
  return STATUS_DEFAULT[type];
}

function date(v, fmt = 'dmy') {
  if (v === undefined || String(v).trim() === '') return undefined;
  const s = String(v).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  if (/^\d{5}(\.\d+)?$/.test(s)) return addDays('1899-12-30', Math.floor(Number(s))); // Excel serial
  const m = s.replace(/^[A-Za-z؀-ۿ]+\s+/, '').match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/);
  if (!m) return undefined;
  let [a, b, y] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (y < 100) y += 2000;
  let [d, mo] = fmt === 'mdy' ? [b, a] : [a, b];
  if (mo > 12 && d <= 12) [d, mo] = [mo, d];
  const out = `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  return isDate(out) ? out : undefined;
}

function duration(v) {
  if (v === undefined || String(v).trim() === '') return undefined;
  const s = norm(v);
  const n = num(s.match(/[\d.]+/) ? s.match(/[\d.]+/)[0] : '');
  if (n === undefined) return undefined;
  if (/(w|wk|wks|week|weeks|أسبوع|أسابيع)\b/.test(s)) return Math.round(n * 7);
  if (/(mo|mon|mons|month|months|شهر|أشهر)\b/.test(s)) return Math.round(n * 30);
  return Math.round(n);
}

function predecessors(v) {
  if (v === undefined || String(v).trim() === '') return undefined;
  return String(v)
    .split(/[,;،]/)
    .map((t) => t.trim())
    .filter(Boolean)
    .map((t) => {
      const m = t.match(/^([^\s+-]+?)\s*(FS|SS|FF|SF)?\s*(?:([+-])\s*(\d+(?:\.\d+)?)\s*(?:ed|d|days?|أيام|يوم)?)?$/i);
      if (!m) return t;
      const lag = m[4] ? Number(m[4]) * (m[3] === '-' ? -1 : 1) : 0;
      if (!m[2] && !lag) return m[1];
      return { id: m[1], type: (m[2] || 'FS').toUpperCase(), lag };
    });
}

function convert(type, row, mapping, opts) {
  const get = (f) => (mapping[f] ? row[mapping[f]] : undefined);
  const s = (f) => {
    const v = get(f);
    return v === undefined || v === '' ? undefined : String(v);
  };
  const item = {};
  const set = (k, v) => {
    if (v !== undefined) item[k] = v;
  };
  if (type === 'backlog') {
    set('id', s('id'));
    set('title', s('title'));
    set('points', num(get('points')));
    set('status', status('backlog', get('status')));
    set('sprint', s('sprint'));
    set('priority', priority(get('priority')));
    set('epic', s('epic'));
  } else if (type === 'risks') {
    set('id', s('id'));
    set('title', s('title'));
    set('probability', level(get('probability')));
    set('impact', level(get('impact')));
    set('owner', s('owner'));
    set('status', status('risks', get('status')));
    set('responseStrategy', s('responseStrategy') && s('responseStrategy').toLowerCase());
    set('response', s('response'));
    set('costImpact', num(get('costImpact')));
    set('category', s('category'));
  } else if (type === 'schedule') {
    set('id', s('id'));
    set('name', s('name'));
    const start = date(get('start'), opts.dateFormat);
    const finish = date(get('finish'), opts.dateFormat);
    set('duration', duration(get('duration')) ?? (start && finish ? daysBetween(start, finish) + 1 : undefined));
    set('predecessors', predecessors(get('predecessors')));
    set('percentComplete', pct(get('percentComplete')));
    set('budget', num(get('budget')));
    set('owner', s('owner'));
  } else if (type === 'issues') {
    set('id', s('id'));
    set('title', s('title'));
    set('priority', s('priority') && s('priority').toLowerCase());
    set('owner', s('owner'));
    set('due', date(get('due'), opts.dateFormat));
    set('status', status('issues', get('status')));
    set('description', s('description'));
  } else if (type === 'stakeholders') {
    set('id', s('id'));
    set('name', s('name'));
    set('role', s('role'));
    set('organization', s('organization'));
    set('power', level(get('power')));
    set('interest', level(get('interest')));
  } else if (type === 'progress') {
    set('id', s('id'));
    set('percentComplete', pct(get('percentComplete')));
  }
  return item;
}

// ---------- import ----------

function nextId(existing, prefix) {
  let n = existing.length + 1;
  const ids = new Set(existing.map((x) => x.id));
  while (ids.has(`${prefix}${n}`)) n++;
  return `${prefix}${n}`;
}

const ID_PREFIX = { backlog: 'US-', risks: 'R', issues: 'I-', stakeholders: 'SH-' };

function importFile(dir, { from, type, map, sheet, write = false, date: snapDate, dateFormat = 'dmy' } = {}) {
  if (!from) throw new PmoError('ARG_MISSING', { arg: 'from' });
  if (!FIELDS[type]) throw new PmoError('ENUM_INVALID', { file: 'import', field: 'type', allowed: Object.keys(FIELDS).join(', ') });
  const { headers, rows } = readTable(from, { sheet });
  const mapping = mapHeaders(type, headers, map || {});
  const mapped = new Set(Object.values(mapping).filter(Boolean));
  const warnings = [];
  const items = [];
  const t = TARGET[type];
  const current = t.file ? readJson(dir, t.file, { optional: true }) || { schemaVersion: 1, [t.coll]: [] } : null;
  const list = current ? current[t.coll] || [] : [];
  const existing = new Map(list.map((x) => [x.id, x]));
  rows.forEach((row, i) => {
    const it = convert(type, row, mapping, { dateFormat });
    const label = it.title || it.name;
    if (!it.id && !label) return;
    if (!it.id && type === 'progress') return warnings.push({ row: i + 2, message: 'missing activity id' });
    if (type === 'schedule' && !it.id) return warnings.push({ row: i + 2, message: 'missing activity id' });
    // Defaults apply only to new records, never as a change to an existing one.
    if (!existing.has(it.id) && STATUS_DEFAULT[type] && !it.status) it.status = STATUS_DEFAULT[type];
    items.push(it);
  });
  const result = {
    type,
    file: from,
    mapping,
    unmappedHeaders: headers.filter((h) => !mapped.has(h)),
    count: items.length,
    items: write ? undefined : items.slice(0, 50),
    warnings,
  };
  if (!write) return { action: 'preview', ...result };

  if (type === 'progress') {
    if (!snapDate || !isDate(snapDate)) throw new PmoError('ARG_MISSING', { arg: 'date' });
    const rel = `progress/${snapDate}.json`;
    const snap = readJson(dir, rel, { optional: true }) || { schemaVersion: 1 };
    snap.activityProgress = { ...(snap.activityProgress || {}) };
    for (const it of items) if (it.percentComplete !== undefined) snap.activityProgress[it.id] = it.percentComplete;
    return { action: 'written', ...guardedWrite(dir, rel, snap), ...result, updated: items.length, added: 0 };
  }

  if (t.controlled) {
    const proposals = [];
    let unchanged = 0;
    const pending = [...list];
    for (const it of items) {
      const prev = it.id ? existing.get(it.id) : null;
      if (prev) {
        const changes = Object.fromEntries(Object.entries(it).filter(([k, v]) => k !== 'id' && JSON.stringify(prev[k]) !== JSON.stringify(v)));
        if (!Object.keys(changes).length) {
          unchanged++;
          continue;
        }
        proposals.push(
          approvals.propose(dir, { agent: 'integrator', title: `Import: update ${it.id}`, rationale: `Imported from ${path.basename(from)}`, operation: { op: 'update', file: t.file, id: it.id, changes } })
        );
      } else {
        const item = { ...it, id: it.id || nextId(pending, ID_PREFIX[type] || 'X-') };
        pending.push(item);
        proposals.push(
          approvals.propose(dir, { agent: 'integrator', title: `Import: add ${item.id}`, rationale: `Imported from ${path.basename(from)}`, operation: { op: 'add', file: t.file, item } })
        );
      }
    }
    return { action: 'proposed', ...result, proposals, unchanged };
  }

  let added = 0;
  let updated = 0;
  const next = list.map((x) => ({ ...x }));
  const idx = new Map(next.map((x, i) => [x.id, i]));
  for (const it of items) {
    if (it.id && idx.has(it.id)) {
      Object.assign(next[idx.get(it.id)], it);
      updated++;
    } else {
      const item = { ...it, id: it.id || nextId(next, ID_PREFIX[type] || 'X-') };
      idx.set(item.id, next.length);
      next.push(item);
      added++;
    }
  }
  return { action: 'written', ...guardedWrite(dir, t.file, { ...current, [t.coll]: next }), ...result, added, updated };
}

// Write, validate the whole project, restore the original file if invalid.
function guardedWrite(dir, rel, data) {
  const p = path.join(dir, rel);
  const original = fs.existsSync(p) ? fs.readFileSync(p) : null;
  writeJson(dir, rel, data);
  const v = validate(loadProject(dir));
  if (!v.ok) {
    if (original) fs.writeFileSync(p, original);
    else fs.unlinkSync(p);
    throw new PmoError('VALIDATION_FAILED', { count: v.errors.length }, null, v.errors);
  }
  return { path: rel };
}

module.exports = { parseCsv, readXlsx, readTable, mapHeaders, importFile, FIELDS };
