# Changelog

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
