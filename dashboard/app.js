/* PMO dashboard client — plain JS, no dependencies. Every figure comes from /api/state,
   which the server builds with the pmo engine (buildReportData → status, EVM, CPM, agile, risk).
   Chart helpers follow templates/report.html so the report and the dashboard read the same way. */
(function () {
  'use strict';

  var S = null; // state from the server
  var UI = { ar: {}, en: {} };
  var lang = null;
  var theme = null;
  var riskFilter = null;
  var fileCache = {};
  var store = {
    get: function (k) { try { return localStorage.getItem('pmo-dash:' + k); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem('pmo-dash:' + k, v); } catch (e) { /* private mode */ } }
  };

  // ---------- helpers ----------
  function t(k) { return (UI[lang] && UI[lang][k]) || UI.en[k] || k; }
  function locale() { return lang === 'ar' ? 'ar-SA-u-nu-latn-ca-gregory' : 'en-GB'; }
  function nf(n, d) {
    if (n === null || n === undefined || !isFinite(n)) return '—';
    d = d || 0;
    return new Intl.NumberFormat(locale(), { minimumFractionDigits: d, maximumFractionDigits: d }).format(n);
  }
  function money(n) {
    if (n === null || n === undefined || !isFinite(n)) return '—';
    var cur = S && S.project ? S.project.currency : '';
    try { return new Intl.NumberFormat(locale(), { style: 'currency', currency: cur, maximumFractionDigits: 0 }).format(n); }
    catch (e) { return nf(n) + ' ' + cur; }
  }
  function idx(n) { return nf(n, 2); }
  function pct(n) { return n === null || n === undefined ? '—' : nf(n, 1) + '%'; }
  function ms(s) { return Date.parse(s + 'T00:00:00Z'); }
  function fdate(s) {
    if (!s) return '—';
    var d = new Date(String(s).length > 10 ? s : s + 'T00:00:00Z');
    if (isNaN(d)) return String(s);
    return new Intl.DateTimeFormat(locale(), { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(d);
  }
  function fdatetime(s) {
    if (!s) return '—';
    var d = new Date(s);
    if (isNaN(d)) return String(s);
    return new Intl.DateTimeFormat(locale(), { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(d);
  }
  // Names written as "عربي / English" show the part that matches the language.
  function pick(s) {
    if (s === null || s === undefined) return '';
    if (typeof s !== 'string') return String(s);
    var parts = s.split(' / ');
    if (parts.length !== 2) return s;
    var firstAr = /[\u0600-\u06FF]/.test(parts[0]);
    return lang === 'ar' ? (firstAr ? parts[0] : parts[1]) : (firstAr ? parts[1] : parts[0]);
  }
  function word(prefix, v) { if (!v) return '—'; var k = prefix + v; var s = t(k); return s === k ? v : s; }
  function bytes(n) { return n < 1024 ? nf(n) + ' B' : nf(n / 1024, 1) + ' KB'; }
  function daysText(n) {
    if (n === null || n === undefined) return '—';
    if (n === 0) return '0 ' + t('days');
    return nf(Math.abs(n)) + ' ' + t('days') + ' ' + (n > 0 ? t('late') : t('early'));
  }
  function signCls(n) { return n === null || n === undefined ? '' : n < 0 ? 'neg' : 'pos'; }
  function idxCls(n) { return n === null || n === undefined ? '' : n < 1 ? 'neg' : 'pos'; }

  function el(tag, attrs) {
    var e = document.createElement(tag);
    attrs = attrs || {};
    Object.keys(attrs).forEach(function (k) {
      var v = attrs[k];
      if (v === null || v === undefined || v === false) return;
      if (k === 'class') e.className = v;
      else if (k === 'text') e.textContent = v;
      else if (k.slice(0, 2) === 'on') e.addEventListener(k.slice(2), v);
      else e.setAttribute(k, v);
    });
    for (var i = 2; i < arguments.length; i++) append(e, arguments[i]);
    return e;
  }
  function append(e, c) {
    if (c === null || c === undefined || c === false) return;
    if (Array.isArray(c)) { c.forEach(function (x) { append(e, x); }); return; }
    e.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  function svg(tag, attrs) {
    var e = document.createElementNS('http://www.w3.org/2000/svg', tag);
    Object.keys(attrs || {}).forEach(function (k) { e.setAttribute(k, attrs[k]); });
    return e;
  }
  function css(v) { return getComputedStyle(document.documentElement).getPropertyValue(v).trim(); }
  function rag(v) { return el('span', { class: 'rag rag-' + (v || 'null') }, t('rag_' + (v || 'null'))); }
  function kpi(label, value, sub, cls) {
    return el('div', { class: 'kpi' }, el('div', { class: 'label' }, label), el('div', { class: 'value num ' + (cls || '') }, value), sub ? el('div', { class: 'sub' }, sub) : null);
  }
  function card(title, kids) { return el('section', { class: 'card' }, title ? el('h2', {}, title) : null, kids); }
  function empty(msg) { return el('div', { class: 'empty' }, msg || t('noData')); }
  function table(headers, rows, caption) {
    if (!rows.length) return empty();
    return el('div', { class: 'table-wrap', tabindex: '0', role: 'region', 'aria-label': caption || headers.join(' · ') }, el('table', {},
      caption ? el('caption', { class: 'sr' }, caption) : null,
      el('thead', {}, el('tr', {}, headers.map(function (h) { return el('th', { scope: 'col' }, h); }))),
      el('tbody', {}, rows.map(function (r) { return el('tr', {}, r.map(function (c) { return el('td', {}, c); })); }))));
  }
  function idCell(id) { return el('span', { class: 'id num' }, id || '—'); }
  // "… /pmo:approvals." with the command kept left-to-right inside Arabic text.
  function hint() {
    var parts = t('decideHint').split('/pmo:approvals');
    return el('p', { class: 'note' }, parts[0], parts.length > 1 ? [el('code', { dir: 'ltr' }, '/pmo:approvals'), parts[1]] : null);
  }
  function pageHead(title, sub) {
    return el('div', { class: 'page-head' }, el('h1', { tabindex: '-1', id: 'page-title' }, title), sub ? el('div', { class: 'sub' }, sub) : null);
  }

  // JSON with token colours, built from text nodes (never innerHTML).
  function jsonBlock(value) {
    var text = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
    var pre = el('pre', { class: 'code', tabindex: '0' });
    if (typeof value === 'string') { pre.textContent = text; return pre; }
    var re = /("(?:\\.|[^"\\])*")(\s*:)?|\b(true|false|null)\b|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g;
    var last = 0, m;
    while ((m = re.exec(text))) {
      if (m.index > last) pre.append(document.createTextNode(text.slice(last, m.index)));
      if (m[1]) { pre.append(el('span', { class: m[2] ? 'k' : 's' }, m[1])); if (m[2]) pre.append(document.createTextNode(m[2])); }
      else if (m[3]) pre.append(el('span', { class: 'b' }, m[3]));
      else pre.append(el('span', { class: 'n' }, m[4]));
      last = re.lastIndex;
    }
    if (last < text.length) pre.append(document.createTextNode(text.slice(last)));
    return pre;
  }

  // ---------- charts (inline SVG, time axis always left-to-right) ----------
  function lineChart(opts) {
    var W = 640, H = opts.height || 260, L = 64, R = 14, T = 12, B = 30;
    var xs = [], ys = [];
    opts.series.forEach(function (s) { s.points.forEach(function (p) { xs.push(p[0]); ys.push(p[1]); }); });
    (opts.refY || []).forEach(function (r) { ys.push(r.y); });
    if (!xs.length) return null;
    var x0 = Math.min.apply(null, xs), x1 = Math.max.apply(null, xs);
    (opts.refX || []).forEach(function (r) { x0 = Math.min(x0, r.x); x1 = Math.max(x1, r.x); });
    var y0 = opts.yMin !== undefined ? opts.yMin : Math.min(0, Math.min.apply(null, ys));
    var y1 = Math.max.apply(null, ys); if (y1 === y0) y1 = y0 + 1; y1 = y1 + (y1 - y0) * 0.06;
    if (x1 === x0) x1 = x0 + 1;
    var sx = function (x) { return L + (x - x0) / (x1 - x0) * (W - L - R); };
    var sy = function (y) { return H - B - (y - y0) / (y1 - y0) * (H - T - B); };
    var g = svg('svg', { viewBox: '0 0 ' + W + ' ' + H, role: 'img', 'aria-label': opts.title || '' });
    for (var i = 0; i <= 4; i++) {
      var yv = y0 + (y1 - y0) * i / 4, yy = sy(yv);
      g.append(svg('line', { x1: L, x2: W - R, y1: yy, y2: yy, class: 'grid-line' }));
      var tx = svg('text', { x: L - 6, y: yy + 4, 'text-anchor': 'end' }); tx.textContent = opts.yFmt(yv); g.append(tx);
    }
    (opts.xTicks || []).forEach(function (tk) {
      var xt = svg('text', { x: sx(tk[0]), y: H - 10, 'text-anchor': 'middle' }); xt.textContent = tk[1]; g.append(xt);
    });
    (opts.refY || []).forEach(function (r) {
      g.append(svg('line', { x1: L, x2: W - R, y1: sy(r.y), y2: sy(r.y), stroke: r.color, 'stroke-dasharray': '4 4', 'stroke-width': 1.5 }));
    });
    (opts.refX || []).forEach(function (r) {
      g.append(svg('line', { x1: sx(r.x), x2: sx(r.x), y1: T, y2: H - B, stroke: r.color, 'stroke-dasharray': '4 4', 'stroke-width': 1.5 }));
    });
    opts.series.forEach(function (s) {
      if (!s.points.length) return;
      var d = s.points.map(function (p, k) { return (k ? 'L' : 'M') + sx(p[0]).toFixed(1) + ' ' + sy(p[1]).toFixed(1); }).join(' ');
      g.append(svg('path', { d: d, fill: 'none', stroke: s.color, 'stroke-width': s.width || 2.5, 'stroke-dasharray': s.dash || '' }));
      s.points.forEach(function (p) {
        var c = svg('circle', { cx: sx(p[0]), cy: sy(p[1]), r: s.dot === false ? 0 : 3.5, fill: s.color });
        var ti = svg('title', {}); ti.textContent = s.label + ' — ' + (opts.xFmt ? opts.xFmt(p[0]) : p[0]) + ': ' + opts.yFmt(p[1]);
        c.append(ti); g.append(c);
      });
    });
    var box = el('div', { class: 'chart ltr' });
    box.append(g);
    box.append(el('div', { class: 'legend', dir: lang === 'ar' ? 'rtl' : 'ltr' },
      opts.series.map(function (s) { return el('span', {}, el('i', { style: 'background:' + s.color }), s.label); }),
      (opts.refY || []).concat(opts.refX || []).filter(function (r) { return r.label; }).map(function (r) { return el('span', {}, el('i', { style: 'background:' + r.color }), r.label); })));
    return box;
  }
  function barChart(title, labels, series, fmt) {
    var W = 640, H = 220, L = 44, R = 10, T = 10, B = 28;
    var all = [1];
    series.forEach(function (s) { all = all.concat(s.values); });
    var max = Math.max.apply(null, all);
    var n = Math.max(labels.length, 1), bw = (W - L - R) / n, inner = bw * 0.7 / series.length;
    var g = svg('svg', { viewBox: '0 0 ' + W + ' ' + H, role: 'img', 'aria-label': title });
    for (var i = 0; i <= 4; i++) {
      var y = H - B - (H - T - B) * i / 4;
      g.append(svg('line', { x1: L, x2: W - R, y1: y, y2: y, class: 'grid-line' }));
      var tx = svg('text', { x: L - 6, y: y + 4, 'text-anchor': 'end' }); tx.textContent = fmt(max * i / 4); g.append(tx);
    }
    labels.forEach(function (lb, k) {
      series.forEach(function (s, j) {
        var v = s.values[k] || 0, h = (H - T - B) * v / max, x = L + k * bw + bw * 0.15 + j * inner;
        var r = svg('rect', { x: x, y: H - B - h, width: inner * 0.92, height: h, rx: 3, fill: s.color });
        var ti = svg('title', {}); ti.textContent = s.label + ' · ' + lb + ': ' + fmt(v); r.append(ti); g.append(r);
      });
      var lt = svg('text', { x: L + k * bw + bw / 2, y: H - 10, 'text-anchor': 'middle' }); lt.textContent = lb; g.append(lt);
    });
    var box = el('div', { class: 'chart ltr' }); box.append(g);
    if (series.length > 1) box.append(el('div', { class: 'legend', dir: lang === 'ar' ? 'rtl' : 'ltr' }, series.map(function (s) { return el('span', {}, el('i', { style: 'background:' + s.color }), s.label); })));
    return box;
  }
  function monthTicks(a, b) {
    var out = [], d = new Date(ms(a)); d.setUTCDate(1);
    var end = ms(b);
    var fmt = new Intl.DateTimeFormat(locale(), { month: 'short', timeZone: 'UTC' });
    while (d.getTime() <= end) {
      if (d.getTime() >= ms(a)) out.push([d.getTime(), fmt.format(d)]);
      d.setUTCMonth(d.getUTCMonth() + 1);
    }
    return out;
  }
  function sCurve(c, statusDate) {
    if (!c || c.agile || !c.pvCurve.length) return null;
    var x = function (d) { return ms(d); };
    return lineChart({
      title: t('sCurve'), yFmt: function (v) { return nf(v / 1000) + 'k'; }, xFmt: function (v) { return fdate(new Date(v).toISOString().slice(0, 10)); },
      xTicks: monthTicks(c.pvCurve[0].date, c.pvCurve[c.pvCurve.length - 1].date),
      refY: [{ y: c.current.bac, color: css('--grey'), label: t('bac') }],
      refX: statusDate ? [{ x: ms(statusDate), color: css('--amber-line'), label: t('legendStatus') }] : [],
      series: [
        { label: t('pv'), color: css('--pv'), dash: '6 4', points: c.pvCurve.map(function (p) { return [x(p.date), p.pv]; }) },
        { label: t('ev'), color: css('--ev'), points: c.trend.map(function (p) { return [x(p.date), p.ev]; }) },
        { label: t('ac'), color: css('--ac'), points: c.trend.map(function (p) { return [x(p.date), p.ac]; }) }
      ]
    });
  }
  function indexTrend(c, th) {
    if (!c) return null;
    var pts = c.trend.filter(function (p) { return p.spi !== null || p.cpi !== null; });
    if (pts.length < 2) return null;
    var x = function (d) { return ms(d); };
    return lineChart({
      title: t('indexTrend'), height: 220,
      yMin: Math.min(0.6, Math.min.apply(null, pts.map(function (p) { return Math.min(p.spi || 1, p.cpi || 1); }))),
      yFmt: function (v) { return nf(v, 2); }, xFmt: function (v) { return fdate(new Date(v).toISOString().slice(0, 10)); },
      xTicks: pts.map(function (p) { return [x(p.date), fdate(p.date)]; }),
      refY: [{ y: 1, color: css('--grey'), label: '1.00' }, { y: th.amber, color: css('--red') }],
      series: [
        { label: t('spi'), color: css('--amber-line'), points: pts.filter(function (p) { return p.spi !== null; }).map(function (p) { return [x(p.date), p.spi]; }) },
        { label: t('cpi'), color: css('--ev'), points: pts.filter(function (p) { return p.cpi !== null; }).map(function (p) { return [x(p.date), p.cpi]; }) }
      ]
    });
  }

  // ---------- data shortcuts ----------
  function R() { return S && S.report; }
  function sec(name) { return R() ? R().sections[name] : null; }
  function method() { return S && S.project ? S.project.methodology : null; }
  function reg(name) { return (S && S.registers && S.registers[name]) || []; }

  // ---------- pages ----------
  var PAGES = [
    { id: 'overview', group: 'grp_project' },
    { id: 'schedule', group: 'grp_delivery', when: function () { return method() !== 'agile'; } },
    { id: 'agile', group: 'grp_delivery', when: function () { return method() !== 'waterfall'; } },
    { id: 'risks', group: 'grp_registers', count: function () { var r = sec('risks'); return r ? r.counts.open : 0; } },
    { id: 'issues', group: 'grp_registers', count: function () { return reg('issues').filter(function (i) { return ['resolved', 'closed'].indexOf(i.status) < 0; }).length; } },
    { id: 'changes', group: 'grp_registers', count: function () { return reg('changes').filter(function (c) { return ['submitted', 'deferred'].indexOf(c.status) >= 0; }).length; } },
    { id: 'quality', group: 'grp_registers', count: function () { var q = sec('quality'); return q ? q.defects.open : 0; } },
    { id: 'stakeholders', group: 'grp_registers', count: function () { return reg('stakeholders').length; } },
    { id: 'lessons', group: 'grp_registers', count: function () { return reg('lessons').length; } },
    { id: 'agents', group: 'grp_gov', count: function () { return S.agents.length; } },
    { id: 'approvals', group: 'grp_gov', alert: true, count: function () { return reg('approvals').filter(function (a) { return a.status === 'pending'; }).length; } },
    { id: 'files', group: 'grp_system', count: function () { return S.files.length; } }
  ];

  function problems() {
    var box = [];
    if (S.error) box.push(el('div', { class: 'alert-box', role: 'alert' }, el('b', {}, t('loadError')), el('div', {}, S.error['message_' + lang] || S.error.message_en)));
    if (S.validation && !S.validation.ok) {
      box.push(el('div', { class: 'alert-box', role: 'alert' }, el('b', {}, t('validationErrors')),
        el('ul', {}, S.validation.errors.map(function (e) { return el('li', {}, e.message[lang] || e.message.en); }))));
    }
    return box;
  }

  function pOverview() {
    var r = R();
    var kids = [pageHead(t('nav_overview'), r ? t('statusDate') + ': ' + fdate(r.meta.statusDate) : null)].concat(problems());
    if (!r) return kids.concat(projectFacts());
    var st = r.status, p = st.progress || {}, c = r.sections.cost, ev = c ? c.current : null, sc = st.schedule, ag = st.agile;
    var finish = sc ? sc.forecastFinish : ag ? ag.forecastFinish : null;
    kids.push(el('div', { class: 'health' },
      el('span', {}, el('span', { class: 'lbl' }, t('overall')), rag(st.health.overall)),
      el('span', {}, el('span', { class: 'lbl' }, t('scheduleHealth')), rag(st.health.schedule)),
      el('span', {}, el('span', { class: 'lbl' }, t('costHealth')), rag(st.health.cost))));
    kids.push(el('div', { class: 'grid', style: 'margin-bottom:16px' },
      kpi(t('percentComplete'), pct(p.percentComplete)),
      ev ? kpi(t('spi'), idx(ev.spi), t('sv') + ': ' + money(ev.sv), idxCls(ev.spi)) : null,
      ev ? kpi(t('cpi'), idx(ev.cpi), t('cv') + ': ' + money(ev.cv), idxCls(ev.cpi)) : null,
      finish ? kpi(t('forecastFinish'), fdate(finish), sc ? t('baselineFinish') + ' ' + fdate(sc.baselineFinish) + ' · ' + daysText(sc.slipDays) : t('deadline') + ': ' + fdate(r.meta.endDate), sc && sc.slipDays > 0 ? 'neg' : '') : null,
      ev ? kpi(t('bac'), money(ev.bac), t('spent') + ' ' + money(ev.ac) + ' · ' + pct(ev.percentSpent)) : null,
      ev ? kpi(t('eac'), money(ev.eacPrimary), t('vac') + ': ' + money(ev.vac), signCls(ev.vac)) : null,
      p.pointsTotal ? kpi(t('pointsRemaining'), nf(p.pointsRemaining), nf(p.pointsDone) + ' / ' + nf(p.pointsTotal) + ' ' + t('done')) : null));
    if (p.percentComplete !== null && p.percentComplete !== undefined) {
      kids.push(el('div', { class: 'meter', style: 'margin-bottom:16px' },
        el('div', { class: 'progress', role: 'progressbar', 'aria-valuenow': String(p.percentComplete), 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-label': t('percentComplete') },
          el('span', { style: 'width:' + Math.min(100, p.percentComplete) + '%' })),
        el('div', { class: 'note num' }, t('done') + ' ' + pct(p.percentComplete) + ' · ' + t('remaining') + ' ' + pct(100 - p.percentComplete))));
    }
    if (ev) {
      kids.push(card(t('evmTitle') + (c.agile ? ' — ' + t('agileEvm') : ''), [
        el('div', { class: 'grid' },
          kpi(t('pv'), money(ev.pv)), kpi(t('ev'), money(ev.ev)), kpi(t('ac'), money(ev.ac)),
          kpi(t('sv'), money(ev.sv), null, signCls(ev.sv)), kpi(t('cv'), money(ev.cv), null, signCls(ev.cv)),
          kpi(t('etc'), money(ev.etc)), kpi(t('tcpi'), idx(ev.tcpi.bac), 'BAC'),
          kpi(t('eacMethods'), money(ev.eac.typical), t('eacAtypical') + ' ' + money(ev.eac.atypical) + (ev.eac.cpiSpi !== null ? ' · ' + t('eacCpiSpi') + ' ' + money(ev.eac.cpiSpi) : ''))),
        c.agile ? el('p', { class: 'note' }, t('agileEvmNote') + ' · ' + t('ppc') + ' ' + pct(ev.ppc * 100) + ' · ' + t('apc') + ' ' + pct(ev.apc * 100)) : null,
        !c.agile ? el('div', { class: 'grid two', style: 'margin-top:12px' },
          el('div', {}, el('h3', {}, t('sCurve')), sCurve(c, r.meta.statusDate)),
          el('div', {}, el('h3', {}, t('indexTrend')), indexTrend(c, r.meta.thresholds) || empty())) : null,
        el('p', { class: 'note' }, t('engineNote'))]));
    }
    var two = [];
    var rs = st.risks;
    two.push(card(t('topRisks'), rs && rs.top3.length ? table(['ID', t('nav_risks'), t('score'), t('owner')], rs.top3.map(function (x) {
      return [idCell(x.id), pick(x.title), el('span', { class: 'lv lv-' + x.level }, nf(x.score) + ' · ' + t('lv_' + x.level)), pick(x.owner) || '—'];
    })) : empty()));
    var pend = reg('approvals').filter(function (a) { return a.status === 'pending'; });
    two.push(card(t('decisionsNeeded'), [pend.length ? table(['ID', t('change'), t('agent')], pend.map(function (a) {
      return [idCell(a.id), pick(a.title) || '—', a.agent];
    })) : empty(t('noneYet')), hint()]));
    kids.push(el('div', { class: 'grid two' }, two));
    var N = r.sections.next;
    if (N && (N.activities.length || N.items.length)) {
      kids.push(card(t('s_next') + (N.horizon ? ' — ' + fdate(N.horizon) : ''), [
        N.activities.length ? table([t('activity'), t('start'), t('finish'), t('status')], N.activities.map(function (a) {
          return [el('span', { class: a.critical ? 'lv lv-high' : '' }, a.id + ' · ' + pick(a.name)), fdate(a.forecastStart), fdate(a.forecastFinish), word('st_', a.state)];
        })) : null,
        N.items.length ? [el('h3', {}, t('nextItems') + (N.activeSprint ? ' — ' + t('activeSprint') + ' ' + N.activeSprint : '')), table(['ID', t('items'), t('points'), t('status')], N.items.map(function (i) {
          return [idCell(i.id), pick(i.title), el('span', { class: 'num' }, nf(i.points)), word('st_', i.status)];
        }))] : null]));
    }
    return kids.concat(projectFacts());
  }

  function projectFacts() {
    var p = S.project || {}, r = R();
    var res = r && r.sections.cost ? r.sections.cost.reserves : null;
    var rk = r && r.sections.risks;
    var rows = [
      [t('methodology'), p.methodology ? t('m_' + p.methodology) : '—'],
      [t('period'), el('span', { class: 'num' }, fdate(p.startDate) + ' – ' + fdate(p.endDate))],
      [t('statusDate'), el('span', { class: 'num' }, fdate(r ? r.meta.statusDate : p.statusDate))],
      [t('sponsor'), pick(p.sponsor) || '—'],
      [t('pm'), pick(p.projectManager) || '—'],
      [t('currency'), p.currency || '—'],
      res ? [t('contingency'), el('span', { class: 'num' }, money(res.contingency))] : null,
      res ? [t('management'), el('span', { class: 'num' }, money(res.management))] : null,
      rk ? [t('totalEmv'), el('span', { class: 'num ' + (rk.contingency !== null && rk.totalEmv > rk.contingency ? 'neg' : '') }, money(rk.totalEmv) + (rk.contingency !== null ? ' · ' + (rk.totalEmv > rk.contingency ? t('reserveShortfall') : t('shortfallOk')) : ''))] : null,
      [t('dataFolder'), el('code', { class: 'ltr', dir: 'ltr' }, S.dir)]
    ].filter(Boolean);
    var dl = el('dl', { class: 'facts' });
    rows.forEach(function (x) { dl.append(el('dt', {}, x[0]), el('dd', {}, x[1])); });
    var snaps = reg('progress');
    return [card(t('projectDetails'), dl),
      card(t('progressSnapshots'), table([t('date'), t('percentComplete'), t('ac'), t('note')], snaps.slice().reverse().map(function (s) {
        return [el('span', { class: 'num' }, fdate(s.date)), s.percentComplete !== undefined ? el('span', { class: 'num' }, pct(s.percentComplete)) : '—',
          s.actualCost !== undefined ? el('span', { class: 'num' }, money(s.actualCost)) : '—', s.note || ''];
      }), t('progressSnapshots')))];
  }

  function pSchedule() {
    var kids = [pageHead(t('nav_schedule'), R() ? t('statusDate') + ': ' + fdate(R().meta.statusDate) : null)].concat(problems());
    if (method() === 'agile') return kids.concat(empty(t('waterfallOnly')));
    var sc = sec('schedule');
    if (!sc) return kids.concat(empty());
    var r = R(), sm = sc.summary, acts = sc.activities;
    kids.push(el('div', { class: 'grid', style: 'margin-bottom:16px' },
      kpi(t('baselineFinish'), fdate(sm.baselineFinish)),
      kpi(t('forecastFinish'), fdate(sm.forecastFinish), t('slip') + ': ' + daysText(sm.slipDays), sm.slipDays > 0 ? 'neg' : 'pos'),
      kpi(t('deadline'), fdate(sm.deadline), t('deadlineVar') + ': ' + daysText(sm.deadlineVarianceDays), sm.deadlineVarianceDays > 0 ? 'neg' : 'pos'),
      kpi(t('criticalPath'), el('span', { class: 'ltr', dir: 'ltr' }, sm.criticalPath.join(' → ') || '—'))));
    var dates = [r.meta.startDate, r.meta.endDate];
    acts.forEach(function (a) { [a.plannedStart, a.plannedFinish, a.baselineStart, a.baselineFinish, a.forecastStart, a.forecastFinish].forEach(function (d) { if (d) dates.push(d); }); });
    dates.sort();
    var a0 = ms(dates[0]), a1 = ms(dates[dates.length - 1]) + 86400000;
    var pos = function (d) { return (ms(d) - a0) / (a1 - a0) * 100; };
    var span = function (s, f) { return 'left:' + pos(s).toFixed(2) + '%;width:' + Math.max(0.6, pos(f) + 100 * 86400000 / (a1 - a0) - pos(s)).toFixed(2) + '%'; };
    var head = el('div', { class: 'head' }, monthTicks(dates[0], dates[dates.length - 1]).map(function (tk) {
      return el('span', { class: 'tick', style: 'left:' + ((tk[0] - a0) / (a1 - a0) * 100).toFixed(2) + '%' }, tk[1]);
    }));
    var lines = function () {
      return [r.meta.statusDate ? el('div', { class: 'vline', style: 'left:' + pos(r.meta.statusDate).toFixed(2) + '%' }) : null,
        el('div', { class: 'vline deadline', style: 'left:' + pos(r.meta.endDate).toFixed(2) + '%' })];
    };
    var rows = [el('div', { class: 'lbl' }), head];
    acts.forEach(function (a) {
      var bs = a.baselineStart || a.plannedStart, bf = a.baselineFinish || a.plannedFinish;
      var done = a.state === 'complete';
      var fs = done ? a.plannedStart : a.forecastStart, ff = done ? a.plannedFinish : a.forecastFinish;
      var tip = pick(a.name) + ' — ' + (done ? t('st_complete') : fdate(fs) + ' → ' + fdate(ff) + ' · ' + nf(a.percentComplete) + '%');
      rows.push(el('div', { class: 'lbl' + (a.critical ? ' crit' : ''), title: pick(a.name) }, a.id + ' · ' + pick(a.name)));
      rows.push(el('div', { class: 'track', 'aria-hidden': 'true' },
        bs && bf ? el('div', { class: 'bar base', style: span(bs, bf), title: t('legendBaseline') + ': ' + fdate(bs) + ' → ' + fdate(bf) }) : null,
        fs && ff ? el('div', { class: 'bar fc' + (done ? ' done' : a.critical ? ' crit' : ''), style: span(fs, ff), title: tip }, el('span', { style: 'width:' + (done ? 100 : a.percentComplete || 0) + '%' })) : null,
        lines()));
    });
    kids.push(card(t('gantt'), [el('div', { class: 'gantt' }, rows),
      el('div', { class: 'legend' },
        el('span', {}, el('i', { style: 'background:var(--grey)' }), t('legendBaseline')),
        el('span', {}, el('i', { style: 'background:var(--accent)' }), t('legendForecast')),
        el('span', {}, el('i', { style: 'background:var(--red)' }), t('legendCritical')),
        el('span', {}, el('i', { style: 'background:var(--green)' }), t('legendComplete')),
        el('span', {}, el('i', { style: 'background:var(--amber-line)' }), t('legendStatus')),
        el('span', {}, el('i', { style: 'background:var(--red);height:2px' }), t('legendDeadline')))]));
    kids.push(card(t('activities'), table(['ID', t('activity'), t('baselineFinish'), t('start'), t('forecastFinish'), '%', t('float'), t('critical'), t('state')], acts.map(function (a) {
      var varDays = a.baselineFinish && a.forecastFinish ? Math.round((ms(a.forecastFinish) - ms(a.baselineFinish)) / 86400000) : null;
      return [idCell(a.id), pick(a.name), el('span', { class: 'num' }, fdate(a.baselineFinish)), el('span', { class: 'num' }, fdate(a.forecastStart)),
        el('span', { class: 'num ' + (varDays > 0 ? 'neg' : '') }, fdate(a.forecastFinish) + (varDays ? ' (' + (varDays > 0 ? '+' : '') + nf(varDays) + ')' : '')),
        el('span', { class: 'num' }, nf(a.percentComplete) + '%'), el('span', { class: 'num' }, a.state === 'complete' ? '—' : nf(a.totalFloat)),
        a.critical ? el('span', { class: 'lv lv-high' }, t('yes')) : t('no'), word('st_', a.state)];
    }), t('activities'))));
    return kids;
  }

  function pAgile() {
    var kids = [pageHead(t('nav_agile'))].concat(problems());
    if (method() === 'waterfall') return kids.concat(empty(t('agileOnly')));
    var a = sec('agile'), bl = S.registers.backlog;
    if (!a) return kids.concat(empty());
    kids.push(el('div', { class: 'grid', style: 'margin-bottom:16px' },
      kpi(t('velocity'), nf(a.velocity, 1)),
      kpi(t('pointsDone'), nf(a.donePoints), pct(a.percentDone)),
      kpi(t('pointsRemaining'), nf(a.remainingPoints), t('pointsTotal') + ': ' + nf(a.totalPoints)),
      kpi(t('sprintsRemaining'), nf(a.sprintsRemaining)),
      kpi(t('forecastFinish'), fdate(a.forecastFinish), t('deadline') + ': ' + fdate(a.endDate), a.forecastFinish && a.endDate && a.forecastFinish > a.endDate ? 'neg' : ''),
      a.activeSprint ? kpi(t('activeSprint'), a.activeSprint) : null));
    var bu = a.burnup, bd = a.burndown;
    var sprints = (bl && bl.sprints) || [];
    kids.push(el('div', { class: 'grid two' },
      card(t('burnup'), bu.length ? lineChart({
        title: t('burnup'), yFmt: function (v) { return nf(v); }, xFmt: function (i) { return bu[i] ? bu[i].sprint : i; },
        xTicks: bu.map(function (b, i) { return [i, b.sprint]; }),
        series: [
          { label: t('completed'), color: css('--ev'), points: bu.map(function (b, i) { return [i, b.completed]; }) },
          { label: t('scope'), color: css('--scope'), dash: '6 4', points: bu.map(function (b, i) { return [i, b.scope]; }) }
        ]
      }) : empty()),
      card(t('burndown'), bd.length ? lineChart({
        title: t('burndown'), yFmt: function (v) { return nf(v); }, xFmt: function (i) { return bd[i] ? bd[i].sprint : i; },
        xTicks: bd.map(function (b, i) { return [i, b.sprint]; }),
        series: [{ label: t('pointsRemaining'), color: css('--amber-line'), points: bd.map(function (b, i) { return [i, b.remaining]; }) }]
      }) : empty()),
      card(t('velocityChart'), sprints.length ? barChart(t('velocityChart'), sprints.map(function (s) { return s.id; }), [
        { label: t('planned'), color: css('--scope'), values: sprints.map(function (s) { return s.plannedPoints || 0; }) },
        { label: t('completed'), color: css('--ev'), values: sprints.map(function (s) { return s.completedPoints || 0; }) }
      ], function (v) { return nf(v); }) : empty()),
      a.agileEvm ? card(t('agileEvm'), el('div', { class: 'grid' },
        kpi(t('ppc'), pct(a.agileEvm.ppc * 100)), kpi(t('apc'), pct(a.agileEvm.apc * 100)),
        kpi(t('spi'), idx(a.agileEvm.spi), null, idxCls(a.agileEvm.spi)), kpi(t('cpi'), idx(a.agileEvm.cpi), null, idxCls(a.agileEvm.cpi)),
        kpi(t('eac'), money(a.agileEvm.eacPrimary)))) : null));
    kids.push(card(t('sprints'), table([t('sprint'), t('start'), t('finish'), t('state'), t('planned'), t('completed')], sprints.map(function (s) {
      return [idCell(s.id), el('span', { class: 'num' }, fdate(s.start)), el('span', { class: 'num' }, fdate(s.end)), word('sst_', s.state),
        el('span', { class: 'num' }, nf(s.plannedPoints)), el('span', { class: 'num' }, s.completedPoints !== undefined ? nf(s.completedPoints) : '—')];
    }), t('sprints'))));
    var items = (bl && bl.items) || [];
    kids.push(card(t('items'), table(['ID', t('items'), t('points'), t('sprint'), t('status')], items.map(function (i) {
      return [idCell(i.id), pick(i.title), el('span', { class: 'num' }, nf(i.points)), i.sprint || '—', word('st_', i.status)];
    }), t('items'))));
    return kids;
  }

  function pRisks() {
    var kids = [pageHead(t('nav_risks'))].concat(problems());
    var Rk = sec('risks');
    if (!Rk) return kids.concat(empty());
    var lvl = function (sc) { return sc >= 15 ? 'high' : sc >= 6 ? 'medium' : 'low'; };
    var shortfall = Rk.contingency !== null && Rk.totalEmv > Rk.contingency;
    kids.push(el('div', { class: 'grid', style: 'margin-bottom:16px' },
      kpi(t('openRisks'), nf(Rk.counts.open), t('lv_high') + ' ' + nf(Rk.counts.high) + ' · ' + t('lv_medium') + ' ' + nf(Rk.counts.medium) + ' · ' + t('lv_low') + ' ' + nf(Rk.counts.low)),
      kpi(t('closedRisks'), nf(Rk.counts.closed)),
      kpi(t('totalEmv'), money(Rk.totalEmv), shortfall ? t('reserveShortfall') : Rk.contingency !== null ? t('shortfallOk') : null, shortfall ? 'neg' : ''),
      Rk.contingency !== null ? kpi(t('contingency'), money(Rk.contingency)) : null));
    var heat = el('div', { class: 'heat', role: 'group', 'aria-label': t('heatmap') });
    for (var p = 5; p >= 1; p--) {
      heat.append(el('div', { class: 'ax', 'aria-hidden': 'true' }, String(p)));
      for (var i = 1; i <= 5; i++) {
        (function (p, i) {
          var cell = Rk.heatmap[p - 1][i - 1];
          var sel = riskFilter && riskFilter[0] === p && riskFilter[1] === i;
          heat.append(el('button', {
            type: 'button', class: 'cell ' + lvl(p * i) + (sel ? ' sel' : ''), title: cell.ids.join(', ') || '0',
            'aria-pressed': sel ? 'true' : 'false',
            'aria-label': t('probability') + ' ' + p + ', ' + t('impact') + ' ' + i + ': ' + cell.count + (cell.ids.length ? ' (' + cell.ids.join(', ') + ')' : ''),
            onclick: function () { riskFilter = cell.count && !sel ? [p, i] : null; render(false); }
          }, cell.count ? String(cell.count) : ''));
        })(p, i);
      }
    }
    heat.append(el('div', {}));
    for (var k = 1; k <= 5; k++) heat.append(el('div', { class: 'ax', 'aria-hidden': 'true' }, String(k)));
    var rows = Rk.risks.slice()
      .filter(function (x) { return !riskFilter || (x.status !== 'closed' && x.probability === riskFilter[0] && x.impact === riskFilter[1]); })
      .sort(function (a, b) { return (a.status === 'closed') - (b.status === 'closed') || b.score - a.score; });
    kids.push(el('div', { class: 'grid two' },
      card(t('heatmap'), [heat, el('div', { class: 'note' }, '↑ ' + t('probability') + ' · → ' + t('impact'))]),
      card(t('topRisks'), table(['ID', t('nav_risks'), t('score'), t('owner')], (sec('risks').risks || []).filter(function (x) { return x.status !== 'closed'; })
        .sort(function (a, b) { return b.score - a.score; }).slice(0, 5).map(function (x) {
          return [idCell(x.id), pick(x.title), el('span', { class: 'lv lv-' + x.level }, nf(x.score)), pick(x.owner) || '—'];
        })))));
    kids.push(card(t('allRisks'), [
      riskFilter ? el('p', { class: 'note' }, t('filtered') + ' (' + t('probability') + ' ' + riskFilter[0] + ' × ' + t('impact') + ' ' + riskFilter[1] + ') ',
        el('button', { type: 'button', onclick: function () { riskFilter = null; render(false); } }, t('showAll'))) : null,
      table(['ID', t('nav_risks'), t('probability'), t('impact'), t('score'), t('level'), t('status'), t('owner'), t('response'), t('emv')], rows.map(function (x) {
        return [idCell(x.id), pick(x.title), el('span', { class: 'num' }, nf(x.probability)), el('span', { class: 'num' }, nf(x.impact)),
          el('span', { class: 'num' }, nf(x.score)), el('span', { class: 'lv lv-' + x.level }, t('lv_' + x.level)), word('st_', x.status),
          pick(x.owner) || '—', (x.responseStrategy ? word('rs_', x.responseStrategy) + (x.response ? ': ' : '') : '') + pick(x.response || ''),
          el('span', { class: 'num' }, money(x.emv))];
      }), t('allRisks'))]));
    return kids;
  }

  function pIssues() {
    var list = reg('issues');
    return [pageHead(t('nav_issues'))].concat(problems(), card(t('nav_issues'), table(['ID', t('nav_issues'), t('priority'), t('impactArea'), t('owner'), t('raised'), t('due'), t('status')], list.map(function (i) {
      var overdue = i.due && R() && R().meta.statusDate && i.due < R().meta.statusDate && ['resolved', 'closed'].indexOf(i.status) < 0;
      return [idCell(i.id), pick(i.title), el('span', { class: 'lv lv-' + (i.priority || '') }, word('lv_', i.priority)), word('ty_', i.impactArea), pick(i.owner) || '—',
        el('span', { class: 'num' }, fdate(i.raised)), el('span', { class: 'num ' + (overdue ? 'neg' : '') }, fdate(i.due)), word('st_', i.status)];
    }), t('nav_issues'))));
  }

  function pChanges() {
    var list = reg('changes');
    return [pageHead(t('nav_changes'))].concat(problems(), card(t('changeRequests'), table(['ID', t('change'), t('type'), t('requestedBy'), t('date'), t('scheduleImpact'), t('costImpact'), t('status')], list.map(function (c) {
      var im = c.impact || {};
      return [idCell(c.id), pick(c.title), word('ty_', c.type), pick(c.requestedBy) || '—', el('span', { class: 'num' }, fdate(c.date)),
        el('span', { class: 'num' }, im.scheduleDays !== undefined ? nf(im.scheduleDays) + ' ' + t('days') : '—'),
        el('span', { class: 'num' }, im.cost !== undefined ? money(im.cost) : '—'), word('st_', c.status)];
    }), t('changeRequests'))));
  }

  function pQuality() {
    var kids = [pageHead(t('nav_quality'))].concat(problems());
    var Q = sec('quality');
    if (!Q) return kids.concat(empty());
    kids.push(el('div', { class: 'grid', style: 'margin-bottom:16px' },
      kpi(t('openDefects'), nf(Q.defects.open), t('sev_critical') + ' ' + nf(Q.defects.bySeverity.critical) + ' · ' + t('sev_major') + ' ' + nf(Q.defects.bySeverity.major) + ' · ' + t('sev_minor') + ' ' + nf(Q.defects.bySeverity.minor), Q.defects.bySeverity.critical ? 'neg' : ''),
      kpi(t('closedDefects'), nf(Q.defects.closed)),
      kpi(t('metric'), nf(Q.metrics.filter(function (m) { return m.meets; }).length) + ' / ' + nf(Q.metrics.length), t('meets'))));
    kids.push(card(t('metric'), table([t('metric'), t('target'), t('actual'), t('trend'), t('status')], Q.metrics.map(function (m) {
      var u = m.unit ? ' ' + m.unit : '';
      return [pick(m.name), el('span', { class: 'num' }, (m.direction === 'max' ? '≤ ' : '≥ ') + nf(m.target) + u),
        el('span', { class: 'num' }, nf(m.latest) + u + (m.date ? ' · ' + fdate(m.date) : '')),
        el('span', { class: 'num ltr', dir: 'ltr' }, m.values.map(function (v) { return nf(v.value); }).join(' → ')),
        m.meets === null ? '—' : el('span', { class: m.meets ? 'pos' : 'neg' }, m.meets ? t('meets') : t('misses'))];
    }), t('metric'))));
    kids.push(card(t('defectList'), table(['ID', t('defects'), t('severity'), t('deliverable'), t('found'), t('status')], reg('defects').map(function (d) {
      return [idCell(d.id), pick(d.title), el('span', { class: 'lv lv-' + d.severity }, word('sev_', d.severity)), pick(d.deliverable) || '—', el('span', { class: 'num' }, fdate(d.found)), word('st_', d.status)];
    }), t('defectList'))));
    return kids;
  }

  function pStakeholders() {
    var kids = [pageHead(t('nav_stakeholders'))].concat(problems());
    var list = sec('stakeholders') || [];
    var raw = reg('stakeholders');
    if (!raw.length) return kids.concat(empty());
    var q = ['keep-satisfied', 'manage-closely', 'monitor', 'keep-informed'];
    kids.push(card(t('grid'), [el('div', { class: 'note' }, '↑ ' + t('power') + ' · → ' + t('interest')),
      el('div', { class: 'quad ltr' }, q.map(function (k) {
        return el('div', { dir: lang === 'ar' ? 'rtl' : 'ltr' }, el('h4', {}, t('q_' + k)),
          list.filter(function (s) { return s.quadrant === k; }).map(function (s) { return el('span', { class: 'pill', title: s.role || '' }, pick(s.name)); }));
      }))]));
    var quad = {}; list.forEach(function (s) { quad[s.id] = s.quadrant; });
    kids.push(card(t('register'), table(['ID', t('nav_stakeholders'), t('role'), t('power'), t('interest'), t('attitude'), t('engagement'), t('grid')], raw.map(function (s) {
      return [idCell(s.id), pick(s.name), s.role || '—', el('span', { class: 'num' }, nf(s.power)), el('span', { class: 'num' }, nf(s.interest)),
        word('at_', s.attitude), word('en_', s.current) + ' → ' + word('en_', s.desired), quad[s.id] ? t('q_' + quad[s.id]) : '—'];
    }), t('register'))));
    return kids;
  }

  function pApprovals() {
    var all = reg('approvals'), pend = all.filter(function (a) { return a.status === 'pending'; });
    var kids = [pageHead(t('nav_approvals')), hint()].concat(problems());
    kids.push(el('h2', { class: 'sr' }, t('pendingQueue')));
    kids.push(card(t('pendingQueue') + ' (' + nf(pend.length) + ')', pend.length ? pend.map(function (a) {
      var op = a.operation || {};
      return el('article', { class: 'card', style: 'box-shadow:none;margin:0 0 12px' },
        el('div', { class: 'page-head', style: 'margin:0 0 6px' }, el('h3', { style: 'margin:0;color:var(--text)' }, a.id + ' — ' + pick(a.title || '')),
          el('span', { class: 'note' }, a.agent + ' · ' + fdatetime(a.createdAt))),
        el('dl', { class: 'facts' },
          el('dt', {}, t('op')), el('dd', {}, el('code', { dir: 'ltr' }, (op.op || '') + ' ' + (a.file || op.file || '') + (op.id ? ' #' + op.id : op.path ? ' · ' + op.path : ''))),
          a.rationale ? [el('dt', {}, t('rationale')), el('dd', {}, a.rationale)] : null,
          a.impact ? [el('dt', {}, t('impact')), el('dd', {}, a.impact)] : null),
        el('div', { class: 'diff' },
          el('div', {}, el('h3', {}, t('before')), jsonBlock(a.before === undefined ? null : a.before)),
          el('div', {}, el('h3', {}, t('after')), jsonBlock(a.after === undefined ? null : a.after))));
    }) : empty(t('noneYet'))));
    var dec = reg('decisions').slice().reverse();
    kids.push(card(t('decisionLog'), table(['ID', 'APR', t('change'), t('status'), t('by'), t('date'), t('agent')], dec.map(function (d) {
      return [idCell(d.id), el('span', { class: 'num' }, d.approvalId || '—'), pick(d.title) || '—', el('span', { class: d.decision === 'approved' ? 'pos' : 'neg' }, t(d.decision)),
        d.by || '—', el('span', { class: 'num' }, fdatetime(d.at)), d.agent || '—'];
    }), t('decisionLog'))));
    var resolved = all.filter(function (a) { return a.status !== 'pending'; });
    if (resolved.length) kids.push(card(t('approved') + ' / ' + t('rejected'), table(['ID', t('change'), t('status'), t('agent')], resolved.map(function (a) {
      return [idCell(a.id), pick(a.title) || '—', word('st_', a.status), a.agent];
    }))));
    return kids;
  }

  function pLessons() {
    var list = reg('lessons');
    return [pageHead(t('nav_lessons'))].concat(problems(), card(null, list.length ? table(['ID', t('date'), t('category'), t('type'), t('situation'), t('recommendation'), t('owner'), t('status')], list.map(function (l) {
      return [idCell(l.id), el('span', { class: 'num' }, fdate(l.date)), word('ty_', l.category), word('lt_', l.type), pick(l.situation) + (l.impact ? ' — ' + pick(l.impact) : ''), pick(l.recommendation), pick(l.owner) || '—', word('st_', l.actionStatus)];
    }), t('nav_lessons')) : empty(t('lessonsEmpty'))));
  }

  function pAgents() {
    var kids = [pageHead(t('nav_agents'), t('agentsIntro'))];
    kids.push(el('div', { class: 'grid cards' }, S.agents.map(function (a) {
      var initials = a.id.split('-').map(function (w) { return w[0]; }).join('').toUpperCase();
      var title = UI[lang]['ag_' + a.id] || a.title;
      var desc = lang === 'ar' && UI.ar['ad_' + a.id] ? UI.ar['ad_' + a.id] : a.description;
      var mode = a.orchestrates ? t('orchestrator') : a.canWrite ? t('canWrite') : t('readOnlyAgent');
      var act = a.activity;
      return el('article', { class: 'card agent', 'aria-labelledby': 'ag-' + a.id },
        el('header', {}, el('span', { class: 'avatar', 'aria-hidden': 'true' }, initials),
          el('div', {}, el('h2', { id: 'ag-' + a.id }, title), el('div', { class: 'aid', dir: 'ltr' }, a.id), el('div', { class: 'note' }, mode))),
        el('p', {}, desc),
        a.scope ? el('div', { class: 'note' }, el('span', { dir: 'ltr' }, a.scope)) : null,
        el('div', {}, el('h3', {}, t('skillsUsed')), a.skills.length ? a.skills.map(function (s) { return el('span', { class: 'pill', dir: 'ltr' }, s); }) : '—'),
        el('div', {}, el('h3', {}, t('dataFiles')), a.files.length ? a.files.map(function (f) {
          return el('span', { class: 'pill' + (f.controlled ? ' ctl' : ''), dir: 'ltr', title: f.controlled ? t('controlledFile') : t('freeFile') }, (f.controlled ? '🔒 ' : '') + f.file);
        }) : '—'),
        a.peers.length ? el('div', {}, el('h3', {}, t('worksWith')), a.peers.map(function (p) { return el('span', { class: 'pill' }, UI[lang]['ag_' + p] || p); })) : null,
        el('div', {}, el('h3', {}, t('autonomy')), a.autonomy.length ? el('ul', { class: 'auto-list' }, a.autonomy.map(function (x) {
          return el('li', {}, el('span', { class: 'au au-' + x.level }, t('au_' + x.level)), el('span', { dir: 'ltr', style: 'text-align:start' }, x.text));
        })) : '—', lang === 'ar' && a.autonomy.length ? el('div', { class: 'quote' }, t('fromAgentFile')) : null),
        a.returns ? el('div', {}, el('h3', {}, t('returns')), el('div', { class: 'note', dir: 'ltr', style: 'text-align:start' }, a.returns)) : null,
        el('div', { class: 'activity' }, t('lastActivity') + ': ', act && act.last
          ? el('span', { class: 'num' }, fdatetime(act.last) + ' · ' + nf(act.proposals) + ' ' + t('proposals') + (act.pending ? ' · ' + nf(act.pending) + ' ' + t('pending') : ''))
          : t('noActivity')));
    })));
    return kids;
  }

  function pFiles(sel) {
    var kids = [pageHead(t('nav_files'), t('filesIntro'))];
    var listEl = el('ul', { class: 'file-list' }, S.files.map(function (f) {
      return el('li', {}, el('button', {
        type: 'button', 'aria-current': f.path === sel ? 'true' : 'false',
        onclick: function () { location.hash = '#files/' + encodeURIComponent(f.path); }
      }, el('span', { class: 'fname' }, (f.controlled ? '🔒 ' : '') + f.path), el('span', { class: 'fsize num' }, bytes(f.size))));
    }));
    var viewer = el('div', {});
    if (!sel) viewer.append(empty(t('selectFile')));
    else {
      var meta = S.files.filter(function (f) { return f.path === sel; })[0];
      viewer.append(el('div', { class: 'page-head', style: 'margin-bottom:8px' }, el('h2', { style: 'margin:0;font-size:1rem', dir: 'ltr' }, sel),
        meta ? el('span', { class: 'note num' }, bytes(meta.size) + ' · ' + t('modified') + ' ' + fdatetime(meta.mtime) + (meta.controlled ? ' · ' + t('controlled') : '')) : null));
      var c = fileCache[sel];
      if (c && c.error) viewer.append(empty(c.error));
      else if (c) {
        if (c.parseError) viewer.append(el('div', { class: 'alert-box' }, t('invalidJson') + ': ' + c.parseError));
        viewer.append(jsonBlock(c.json !== null ? c.json : c.text));
      } else {
        viewer.append(el('div', { class: 'note' }, '…'));
        loadFile(sel);
      }
    }
    kids.push(el('div', { class: 'explorer' }, card(t('nav_files'), listEl), card(null, viewer)));
    return kids;
  }

  function loadFile(rel) {
    fetch('/api/file?path=' + encodeURIComponent(rel)).then(function (r) {
      return r.json().then(function (j) { return { ok: r.ok, j: j }; });
    }).then(function (x) {
      fileCache[rel] = x.ok ? x.j : { error: (x.j.error && (x.j.error['message_' + lang] || x.j.error.code)) || 'Error' };
      if (route().page === 'files') render(false);
    }).catch(function () { fileCache[rel] = { error: t('offline') }; });
  }

  var RENDER = { overview: pOverview, agents: pAgents, schedule: pSchedule, agile: pAgile, risks: pRisks, issues: pIssues, changes: pChanges,
    quality: pQuality, stakeholders: pStakeholders, approvals: pApprovals, lessons: pLessons, files: pFiles };

  // ---------- shell ----------
  function route() {
    var h = decodeURIComponent(location.hash.replace(/^#\/?/, ''));
    var i = h.indexOf('/');
    var page = i < 0 ? h : h.slice(0, i);
    return { page: RENDER[page] ? page : 'overview', rest: i < 0 ? null : h.slice(i + 1) };
  }

  function renderNav(current) {
    var nav = document.getElementById('sidebar');
    nav.textContent = '';
    var groups = [];
    PAGES.forEach(function (p) {
      if (p.when && !p.when()) return;
      var g = groups.filter(function (x) { return x.id === p.group; })[0];
      if (!g) { g = { id: p.group, pages: [] }; groups.push(g); }
      g.pages.push(p);
    });
    groups.forEach(function (g) {
      nav.append(el('div', { class: 'nav-group' }, el('h2', {}, t(g.id)), g.pages.map(function (p) {
        var n = p.count ? p.count() : null;
        return el('a', { href: '#' + p.id, 'aria-current': p.id === current ? 'page' : null, onclick: closeMenu },
          el('span', {}, t('nav_' + p.id)), n ? el('span', { class: 'nav-count' + (p.alert ? ' alert' : '') }, nf(n)) : null);
      })));
    });
  }

  function render(moveFocus) {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    var r = route();
    var name = S && S.project ? pick(S.project.name) : t('noProject');
    document.title = t('nav_' + r.page) + ' — ' + name + ' · ' + t('appTitle');
    document.getElementById('project-name').textContent = name;
    var p = S && S.project;
    document.getElementById('project-meta').textContent = p ? [t('m_' + p.methodology), fdate(p.startDate) + ' – ' + fdate(p.endDate), R() ? t('statusDate') + ' ' + fdate(R().meta.statusDate) : null].filter(Boolean).join(' · ') : '';
    document.getElementById('badge-ro').textContent = t('readOnly');
    document.getElementById('btn-lang').textContent = t('langSwitch');
    document.getElementById('btn-lang').setAttribute('lang', lang === 'ar' ? 'en' : 'ar');
    document.getElementById('btn-theme').textContent = t('theme');
    document.getElementById('menu-label').textContent = t('menu');
    document.getElementById('skip-link').textContent = t('skip');
    document.getElementById('sidebar').setAttribute('aria-label', t('appTitle'));
    if (!S) return;
    renderNav(r.page);
    var main = document.getElementById('main');
    var y = window.scrollY;
    main.textContent = '';
    append(main, RENDER[r.page](r.rest));
    if (moveFocus) {
      window.scrollTo(0, 0);
      var h = document.getElementById('page-title');
      if (h) h.focus({ preventScroll: true });
    } else window.scrollTo(0, y);
  }

  function setLive(on) {
    var l = document.getElementById('live');
    l.classList.toggle('off', !on);
    document.getElementById('live-text').textContent = on ? t('live') : t('offline');
  }
  function toast(msg) {
    var e = document.getElementById('toast');
    e.textContent = msg;
    e.classList.add('show');
    clearTimeout(toast.tm);
    toast.tm = setTimeout(function () { e.classList.remove('show'); }, 2200);
  }

  function loadState(announce) {
    return fetch('/api/state').then(function (r) { return r.json(); }).then(function (s) {
      var first = !S;
      S = s;
      if (!lang) lang = store.get('lang') || (s.project && s.project.language) || 'en';
      fileCache = {};
      render(first);
      if (announce) toast(t('updated'));
    });
  }

  function connect() {
    if (!window.EventSource) { setInterval(function () { loadState(false); }, 5000); return; }
    var es = new EventSource('/api/events');
    var known = null;
    es.addEventListener('hello', function (e) {
      setLive(true);
      var v = JSON.parse(e.data).version;
      if (known && v && v !== known) loadState(true);
      known = v || known;
    });
    es.addEventListener('change', function (e) { known = JSON.parse(e.data).version; loadState(true); });
    es.onerror = function () { setLive(false); };
    es.onopen = function () { setLive(true); };
  }

  function applyTheme() {
    if (theme) document.documentElement.setAttribute('data-theme', theme);
    else document.documentElement.removeAttribute('data-theme');
  }
  function closeMenu() {
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('btn-menu').setAttribute('aria-expanded', 'false');
  }
  function syncTop() {
    document.documentElement.style.setProperty('--topbar-h', document.querySelector('.topbar').offsetHeight + 'px');
  }

  document.getElementById('btn-lang').addEventListener('click', function () { lang = lang === 'ar' ? 'en' : 'ar'; store.set('lang', lang); render(false); setLive(!document.getElementById('live').classList.contains('off')); syncTop(); });
  document.getElementById('btn-theme').addEventListener('click', function () {
    var dark = theme ? theme === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
    theme = dark ? 'light' : 'dark'; store.set('theme', theme); applyTheme(); render(false);
  });
  document.getElementById('btn-menu').addEventListener('click', function () {
    var nav = document.getElementById('sidebar');
    var open = !nav.classList.contains('open');
    nav.classList.toggle('open', open);
    this.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (open) { var a = nav.querySelector('a'); if (a) a.focus(); }
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeMenu(); });
  window.addEventListener('hashchange', function () { render(true); });
  window.addEventListener('resize', syncTop);

  theme = store.get('theme');
  applyTheme();
  fetch('/i18n.json').then(function (r) { return r.json(); }).then(function (u) {
    UI = u;
    return loadState(false);
  }).then(function () { setLive(true); syncTop(); connect(); }).catch(function (e) {
    document.getElementById('main').textContent = 'Could not load the dashboard: ' + e.message;
  });
})();
