---
name: approval-protocol
description: Shared rules every PMO agent follows — what it may do alone, what needs the project manager's approval, how to submit a proposal to the engine, and how to call the engine. Load before changing any project record.
user-invocable: false
---

# Approval protocol / بروتوكول الموافقات

## Engine

All numbers and all controlled changes go through the engine:

```bash
node "${CLAUDE_PLUGIN_ROOT}/engine/cli.js" <command> --dir .pmo [options]
```

If `${CLAUDE_PLUGIN_ROOT}` is not expanded in your context, find the engine with Glob `**/pmo/engine/cli.js` under `~/.claude/plugins/` and use that absolute path.

Commands: `validate` · `status [--date]` · `evm [--date]` · `schedule [--date]` · `agile` · `risk` · `propose --json '<json>' | --file <path>` · `approvals [--status pending|approved|rejected|all]` · `decisions` · `apply` (project manager only, via `/pmo:approvals`).

Errors come back as `{"error":{"code","message_ar","message_en","details"}}`. Relay the message in the project language; never work around a validation error by editing files by hand.

## Autonomy levels

| Level | You may | Examples |
|---|---|---|
| 🟢 Automatic | read, compute, analyse, draft, recommend | run the engine, write analysis, create files in `.pmo/drafts/` and `.pmo/reports/` |
| 🟡 Needs approval | change a controlled record or act outside the project | risks, schedule, budget, baseline, project.json, change requests, charter, pushing to Jira, sending email/Teams/Slack |
| 🔴 Never | — | delete records or files, invent numbers, send anything externally without an approved decision, run `apply` yourself |

Controlled records (guarded by a hook — direct edits are refused): `project.json`, `charter.md`, `schedule.json`, `budget.json`, `risks.json`, `changes.json`, `scope/wbs.json`, `decisions.json`, `approvals.json`.

Free records (you may write directly, then run `validate`): `issues.json`, `stakeholders.json`, `quality.json`, `lessons.json`, `scope/backlog.json`, `progress/<YYYY-MM-DD>.json`, `drafts/*`, `reports/*`.

## Submitting a proposal

Proposal shape:

```json
{
  "agent": "risk-manager",
  "title": "Add risk: flooding of site access road",
  "rationale": "Rainy season forecast; access road floods 2–3 days/year",
  "impact": "Up to 5 days delay on Construction (critical path); EMV 12,000 SAR",
  "operation": { "op": "add", "file": "risks.json", "item": { "id": "R6", "title": "...", "probability": 2, "impact": 4, "status": "open", "owner": "Site manager", "responseStrategy": "mitigate", "response": "...", "costImpact": 40000 } }
}
```

Operations:

| op | fields | use |
|---|---|---|
| `add` | `file`, `item` (with unique `id`) | new risk, change request, activity, stakeholder, issue, backlog item |
| `update` | `file`, `id`, `changes` | re-score/close a risk, decide a change request, edit an activity |
| `set` | `file` (`project.json` or `budget.json`), `path` (dot path), `value` | BAC, reserves, project status, currency (relabels only — amounts are not converted; say so in the impact) |
| `baseline` | optional `date` | set the schedule baseline from the current plan |
| `document` | `file` (`charter.md`), `source` (`drafts/…`) | publish an approved document |

Collections: `risks.json → risks`, `changes.json → changes`, `schedule.json → activities`, `stakeholders.json → stakeholders`, `issues.json → issues`, `scope/backlog.json → items`, `scope/wbs.json → elements`.

On Windows shells quoting JSON is fragile: write the proposal to `.pmo/drafts/proposal-<short-name>.json` and use `propose --file`.

Rules:
- One proposal per decision. Several related risks → several proposals.
- `title`, `rationale` and `impact` are written in the project language and must be understandable without opening files.
- The engine validates the whole project before queuing; fix and resubmit if it returns `VALIDATION_FAILED`.
- After proposing, tell the user the APR id(s) and that they decide with `/pmo:approvals`.

## Language

Read `language` from `.pmo/project.json` and write everything (analysis, titles, drafts) in that language. Use the `bilingual-glossary` skill for PMI terms.
