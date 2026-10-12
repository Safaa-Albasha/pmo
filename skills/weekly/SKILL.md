---
name: weekly
description: Run the full weekly PMO cycle — sync, EVM and schedule forecast, risk and quality review, change requests, status report — and brief the project manager with done/remaining work and decisions needed. Use for "weekly report", "weekly cycle", "run the PMO", "what happened this week". الدورة الأسبوعية.
---

# Weekly PMO cycle / الدورة الأسبوعية

Write in `project.language`. Follow the `approval-protocol` skill.

1. `node "${CLAUDE_PLUGIN_ROOT}/engine/cli.js" validate --dir .pmo` — on errors list them (project language) and stop.
2. Ask (one question) whether there is new progress to record since the last snapshot in `.pmo/progress/` — unless connectors will provide it. Write a snapshot `progress/<status date>.json` (free record, no approval needed):
   `{ "schemaVersion": 1, "percentComplete": <overall %>, "actualCost": <cumulative>, "pointsCompleted": <cumulative, agile/hybrid>, "activityProgress": { "<activity id>": <0-100>, ... }, "note": "" }`
   The newest snapshot becomes the status date automatically and its `activityProgress` drives the schedule forecast. Run `validate`. If the user has nothing new, use the latest data and say so.
3. Run the specialists — with the Agent tool in parallel when available (plugin agents `pmo:integrator`, `pmo:controller`, `pmo:risk-manager`, `pmo:quality-manager`, `pmo:change-control`, `pmo:agile-coach`), otherwise yourself following their instructions:
   - integrator — only if connectors are configured
   - controller — variance & forecast
   - risk-manager — review + proposals
   - quality-manager — scorecard
   - change-control — open CRs
   - agile-coach — agile/hybrid only
4. Reporter: write `.pmo/reports/<status date>-status.md` (structure in the `reporter` agent).
5. Brief the manager on one screen (pmo-lead format): health, done this period, remaining (% and points, forecast finish vs baseline/deadline), top risks & issues, **decisions needed** (pending APR ids with a recommendation each), next period focus.
6. Offer `/pmo:approvals` to decide the pending proposals, and to send the report (🟡, needs confirmation).

Numbers only from the engine. Do not apply proposals.
