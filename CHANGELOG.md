# Changelog

## 1.1.0 — 2026-10-16

- Dashboard merged into `main` (was on the `claude/pmo-dashboard` branch); README and skill no longer ask for a branch checkout.

- **Dashboard edit mode** (`--edit`, opt-in; default stays read-only): issues (add/edit), lessons (add) and backlog item status are saved through the engine (`engine/edit.js` → `execute` → `validate` → write); activity progress, risks (add/change), change requests and stakeholders become proposals via `approvals.propose`; the Approvals page gets Approve / Reject / Edit (engine `apply`, decisions logged in `decisions.json`; Edit re-proposes and rejects the original as “superseded by”). Every action is logged in the new engine-only `audit.json` (`by: "PM via dashboard"`). Forms in a drawer, Arabic/English, confirmation step, inline field errors, «وضع التعديل» badge. Safety: 127.0.0.1 only, loopback peers only, per-session token (`X-PMO-Token`), same-origin check, JSON-only, 64 KB body limit, field whitelist per form. Tests in `tests/dashboard-edit.test.js`.
- Windows: `--dir examples\waterfall\.pmo` and drive-letter paths resolved with `path.resolve`; the inside-the-project check uses `path.relative` (tested with `path.win32`); backslash request paths normalised.
- `lessons.json` added to the engine collections; `audit.json` added to the controlled records.
- **Live dashboard** (`npm run dashboard -- --dir <project>/.pmo`, `node engine/dashboard.js`, skill `/pmo:dashboard`): local read-only web page on http://localhost:4173 with zero dependencies. Pages: project health (RAG, SPI/CPI, EVM, EAC methods, forecast vs baseline, S-curve, index trend), schedule (Gantt baseline vs forecast, critical path), backlog & sprints (velocity, burnup, burndown, AgileEVM), risks (heat map + register), issues, changes, quality, stakeholders, approvals queue with before/after and decision log, lessons, the 11 agents (read from `agents/*.md`: skills, data files, autonomy, last activity), and a data explorer. Arabic/English with RTL, light/dark, keyboard navigation; refreshes when `.pmo/` changes (server-sent events). All figures come from the engine (`buildReportData`). Server answers GET only, binds 127.0.0.1, checks the Host header, and serves only files inside the project folder. Tests in `tests/dashboard.test.js`.

## 1.0.1 — 2026-10-12

- Step-by-step download & install guide in Arabic and English (INSTALL.ar.md, INSTALL.md); published home moved to github.com/Safaa-Albasha/pmo.

- Currency is fully open: any ISO 4217 code or custom label chosen by the project manager; `/pmo:new` asks it as an open question; validation only requires short text. Reports format ISO codes with the local symbol and show custom labels as typed.

## 1.0.0 — 2026-10-12

First release.

- **Engine** (Node.js, zero dependencies): EVM with three EAC methods, ETC, VAC, TCPI and trend; CPM with FS/SS/FF/SF and lags, cycle detection and progress-based forecast from the status date; agile velocity, burnup/burndown, release forecast and AgileEVM; risk scoring, EMV and 5×5 heat map; aggregated RAG status; bilingual validation errors.
- **Governance**: proposals (`add`, `update`, `set`, `baseline`, `document`), approval queue with stale-check, batch decisions, decision log; PreToolUse guard that blocks direct edits to controlled records and asks before `apply` and external writes.
- **Agents**: pmo-lead, initiation, planner, controller, risk-manager, quality-manager, change-control, agile-coach, reporter, integrator, closer.
- **Skills**: 27 PMBOK 8 knowledge skills plus commands `setup`, `new`, `status`, `weekly`, `approvals`, `report`, `risks`, `change`, `sprint`, `close`, `import`, `sync`.
- **Interactive report**: offline HTML dashboard + presentation, Arabic/English with RTL, light/dark, print-to-PDF, S-curve, CPI/SPI trend, Gantt baseline vs forecast, burnup, velocity, clickable heat map, stakeholder grid, what-if sliders using the engine's own formulas.
- **Import**: CSV, `.xlsx` and JSON with Arabic/English header matching for Jira, MS Project, Planner, Asana, Linear, ClickUp and monday.com exports.
- **Connectors**: catalog and setup for Atlassian, Asana, Linear, monday.com, ClickUp (remote MCP) and Slack, Microsoft 365, Google Drive, Gmail (claude.ai connectors).
- Examples: waterfall (Arabic), agile (English), hybrid; sample report.
