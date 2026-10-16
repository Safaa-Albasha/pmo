# pmo — AI Project Management Office for Claude Code

[العربية](README.ar.md)

A Claude Code plugin that works as a project management office aligned with the **PMI PMBOK® Guide, 8th Edition**. It supports **waterfall, agile and hybrid** projects, writes in **Arabic or English**, and keeps the project manager in control: agents analyse and draft, but every change to a controlled record waits for your approval.

- **11 specialist agents** — PMO lead, initiation, planner, controller (EVM), risk, quality, change control, agile coach, reporter, integrator, closer.
- **Deterministic engine** — EVM (SPI, CPI, EAC, ETC, VAC, TCPI), critical path with progress-based forecast, agile velocity and AgileEVM, risk scoring/EMV/heat map. Numbers are calculated, never guessed.
- **Interactive report** — one offline HTML file that is both a dashboard and a full-screen presentation, Arabic/English, light/dark, with what-if sliders.
- **Governance** — proposals, an approval queue and a decision log; a hook blocks direct edits to controlled records.
- **Connectors (optional)** — Jira/Confluence, Asana, Linear, monday.com, ClickUp, Slack, Microsoft 365, Google Drive, Gmail; Excel/CSV import from MS Project, Planner and others.

> Requires **Node.js 18+** (https://nodejs.org). No other dependencies.

## Install

```bash
claude plugin marketplace add Safaa-Albasha/pmo
claude plugin install pmo@pmo
```

Restart Claude Code, open your project folder and run `/pmo:setup`. Step-by-step guide (Node.js, Claude Code, first project, connectors, update, troubleshooting): **[INSTALL.md](INSTALL.md)**.

## Quick start

1. `/pmo:new` — answer a few questions (name, methodology, language, currency, dates, budget). Creates `.pmo/` in your folder.
2. Add your plan: build it with the planner (“plan the project”), or `/pmo:import` a Jira/MS Project/Excel file.
3. Each week: `/pmo:weekly` — records progress, runs every specialist, writes the status report and lists the decisions you need to take.
4. `/pmo:approvals` — approve, reject or edit what the agents proposed.
5. `/pmo:report` — the interactive report / steering-committee presentation.

Try it first on a sample: copy `examples/waterfall` (Arabic), `examples/agile` (English) or `examples/hybrid` to a folder and run `/pmo:status`. A generated sample report is in `examples/sample-report-waterfall.html`.

## Commands

| Command | What it does |
|---|---|
| `/pmo:setup` | Health check, connect tools |
| `/pmo:new` | Create a project (`.pmo/`) |
| `/pmo:status` | Health 🟢🟡🔴, SPI/CPI, forecast finish vs baseline, points done/remaining, top risks |
| `/pmo:weekly` | Full weekly cycle with all agents and a one-screen briefing |
| `/pmo:approvals` | Decide pending proposals; every decision is logged |
| `/pmo:report` | Interactive HTML report and presentation |
| `/pmo:dashboard` | Live local dashboard on localhost (read-only; `--edit` for opt-in edits through the approval flow) |
| `/pmo:risks` | Risk register, heat map, new/updated risks |
| `/pmo:change` | Change requests with impact analysis |
| `/pmo:sprint` | Sprint planning, review and close (agile/hybrid) |
| `/pmo:close` | Phase or project closure, lessons learned |
| `/pmo:import` | CSV / Excel / JSON import with Arabic or English headers |
| `/pmo:sync` | Pull from connected tools |

You can also just ask in plain language (“how is the project doing?”, “add a risk about permits”, “prepare the steering committee pack”).

## How approvals work

| Level | Who decides | Examples |
|---|---|---|
| 🟢 Automatic | agents | calculations, analysis, drafts, reports, backlog/issue/progress updates |
| 🟡 Your approval | you, in `/pmo:approvals` | risks, schedule, budget, baseline, charter, change requests, project closure, any write or message to an external tool |
| 🔴 Never | — | deleting records, inventing numbers, sending without your confirmation |

Agents submit a proposal (what changes, why, impact). You approve, reject or edit it. Approved changes are applied by the engine, validated against the whole project, and written to `.pmo/decisions.json` with who decided and when. A PreToolUse hook blocks direct edits to controlled files, and Claude Code asks for confirmation before every `apply` — this holds in bypass-permissions mode too (verified: the call is refused when no confirmation can be given).

## Project data (`.pmo/`)

| File | Content | Changes by |
|---|---|---|
| `project.json` | name, methodology, language, currency, dates, thresholds | approval |
| `charter.md` | project charter | approval (from `drafts/`) |
| `schedule.json` | activities, dependencies, baseline | approval |
| `budget.json` | BAC, reserves, planned value curve | approval |
| `risks.json` · `changes.json` · `scope/wbs.json` | registers | approval |
| `scope/backlog.json` | sprints and backlog items | direct |
| `progress/<date>.json` | % complete, actual cost, points done, `activityProgress` | direct |
| `issues.json` · `stakeholders.json` · `quality.json` · `lessons.json` | registers | direct |
| `approvals.json` · `decisions.json` | approval queue and decision log | engine only |
| `audit.json` | log of edits made from the dashboard | engine only |
| `drafts/` · `reports/` | drafts and generated reports | direct |

The newest progress snapshot sets the status date; its `activityProgress` drives the schedule forecast. All files are plain JSON/Markdown — keep `.pmo/` in Git for a full audit trail.

## Dashboard

A live dashboard of the project on your own machine — no internet, no CDN, no extra installs. Read-only by default; an opt-in edit mode is described below.

```bash
npm run dashboard -- --dir examples/waterfall/.pmo      # try it on a sample
node engine/dashboard.js --dir /path/to/project/.pmo --port 4173
```

Open **http://localhost:4173**. In Claude Code: `/pmo:dashboard`.

| Page | Shows |
|---|---|
| Project | RAG (overall, schedule, cost), % complete, SPI/CPI, PV/EV/AC, SV/CV, EAC (3 methods), ETC, VAC, TCPI, forecast finish vs baseline, budget and reserves, S-curve, CPI/SPI trend, top risks, decisions needed, next 30 days, progress snapshots |
| Schedule | Gantt baseline vs forecast, status date and deadline lines, critical path, activity table with float |
| Backlog & sprints | velocity, burnup, burndown, planned vs completed points, sprints, backlog items, AgileEVM (agile/hybrid) |
| Risks · Issues · Changes · Quality · Stakeholders · Lessons | the registers, risk heat map (click a cell to filter), EMV vs contingency, quality metrics vs target, defects, power/interest grid |
| Agents | the 11 agents read from `agents/*.md`: role, skills, data files (🔒 = controlled, via approval), what is automatic / needs your approval / never, last activity from `approvals.json` and `decisions.json` |
| Approvals & decisions | pending proposals with before/after, decision log (decide in `/pmo:approvals`) |
| Data explorer | every file in `.pmo/` with a JSON viewer |

- Every number is computed by the engine (`buildReportData` → the same `status`, EVM, CPM, agile and risk functions as the CLI and the report).
- Arabic/English toggle with right-to-left layout, light/dark theme, keyboard navigation.
- Refreshes by itself when anything in `.pmo/` changes.
- Read-only and local: listens on 127.0.0.1, answers only `GET`, serves only files inside the project folder.

### Edit mode (opt-in)

```bash
npm run dashboard -- --dir examples/waterfall/.pmo --edit
```

The Terminal prints a link with a session token, e.g. `http://localhost:4173/#token=3f9a…`. Open that link once; the page keeps the token for the tab (sessionStorage) and shows a red **Edit mode** badge. Without the token the buttons stay disabled.

| You do | Record | What happens |
|---|---|---|
| Add / edit an issue | `issues.json` (free) | saved now by the engine, then validated |
| Add a lesson learned | `lessons.json` (free) | saved now |
| Change a backlog item's status | `scope/backlog.json` (free) | saved now |
| Update an activity's % complete | `schedule.json` (controlled) | **proposal** in `approvals.json` |
| Propose a risk or a risk change | `risks.json` (controlled) | **proposal** |
| New change request | `changes.json` (controlled) | **proposal** |
| Propose a stakeholder | `stakeholders.json` | **proposal** (stricter than the protocol, on purpose) |
| Approve / Reject / Edit on the Approvals page | any proposal | engine `apply` → record changed + `decisions.json`; Edit = new proposal + reject the original as “superseded by …” |

- Every form shows whether it saves now or sends a proposal, and asks for confirmation before anything is sent. Proposals need a “why”.
- Undo: a proposal can be rejected before it is applied (nothing changes). Free-record edits keep their before/after in `audit.json`.
- Every action is logged in `audit.json` (engine-only, guarded) with `by: "PM via dashboard"` and the time; decisions also go to `decisions.json`. The page refreshes by itself after each change.
- The page never writes files and never sends paths: it sends a form (`kind` + fields) and `engine/edit.js` decides the file, checks every field (unknown fields refused), runs the engine's `validate`, and writes or proposes.
- Safety: binds 127.0.0.1 only (`--host` is refused in edit mode) and accepts writes only from the local machine; a random per-session token (header `X-PMO-Token`, never in `/api/state`); same-origin check on `Origin`/`Host`/`Sec-Fetch-Site`; JSON only (`Content-Type: application/json`); body limit 64 KB; errors come back as 400/401/403/404/409/413/415 with Arabic and English messages. Without `--edit` every write is `405`.

### Windows

Use backslashes or forward slashes, both work:

```bat
git pull
npm run dashboard -- --dir examples\waterfall\.pmo
npm run dashboard -- --dir examples\waterfall\.pmo --edit
```

In PowerShell, if npm swallows the arguments after `--`, call Node directly (works in every shell):

```powershell
node engine\dashboard.js --dir examples\waterfall\.pmo --edit
node engine\dashboard.js --dir C:\Projects\warehouse\.pmo --port 4180
```

`--dir` may point at the `.pmo` folder or at the project folder that contains it. Paths are resolved with Node's `path.resolve`, so relative, absolute and drive-letter paths all work.

## Connectors

All optional. Without them everything works from local files and imports.

| Tool | How |
|---|---|
| Jira + Confluence, Asana, Linear, monday.com, ClickUp | remote MCP server added to the project's `.mcp.json` by `/pmo:setup`; each user signs in with OAuth via `/mcp` |
| Slack, Microsoft 365, Google Drive, Gmail | claude.ai connectors (claude.ai → Settings → Connectors) |
| MS Project, Planner, any spreadsheet | export to Excel/CSV → `/pmo:import` |

Pulling data is automatic; any write or message to an external tool asks for confirmation.

## Engine CLI

Agents call the engine; you can too:

```bash
node <plugin>/engine/cli.js status   --dir .pmo [--date YYYY-MM-DD]
node <plugin>/engine/cli.js evm      --dir .pmo
node <plugin>/engine/cli.js schedule --dir .pmo
node <plugin>/engine/cli.js agile    --dir .pmo
node <plugin>/engine/cli.js risk     --dir .pmo
node <plugin>/engine/cli.js report   --dir .pmo [--lang ar|en] [--narrative file.json] [--out file.html]
node <plugin>/engine/cli.js import   --dir .pmo --from file.xlsx --type backlog|risks|schedule|issues|stakeholders|progress [--write]
node <plugin>/engine/cli.js validate | approvals | decisions | doctor --dir .pmo
```

Output is JSON; errors carry Arabic and English messages.

## Methodology notes

- PMBOK® Guide 8th Edition structure: 6 principles, 7 performance domains (governance, scope, schedule, finance, stakeholders, resources, risk), 5 focus areas (initiating, planning, executing, monitoring & controlling, closing). Skills follow this structure and tailor practices per methodology.
- Currency is chosen by the project manager: any ISO 4217 code (shown with its local symbol, e.g. KWD → د.ك) or any custom label. One currency per project; changing it later is an approved `set` on `project.json` and does not convert amounts.
- Schedule uses calendar days; finish dates are inclusive.
- EAC is reported with three PMI methods (typical BAC/CPI, atypical, CPI×SPI); `eacPrimary` is BAC/CPI.
- Risk score = probability × impact (1–5 scales); high ≥ 15, medium ≥ 6. EMV uses `probabilityPct` when given, otherwise 10/30/50/70/90%.

The narrative text in reports is written by the AI; all figures in tables and charts come from the engine. Review narrative text before sending it to stakeholders.

## Development

```bash
cd plugins/pmo
node --test        # engine tests
```

## License

MIT © 2026 Safaa Albasha. PMI and PMBOK are registered marks of the Project Management Institute, Inc. This plugin is not affiliated with or endorsed by PMI.
