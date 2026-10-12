---
name: sync
description: Pull the latest tasks, story points, sprints, progress and defects from connected tools (Jira, Linear, Asana, monday.com, ClickUp, Microsoft 365, Google Drive) into the project, and push updates back only with confirmation. Use for "sync", "pull from Jira", "update from Asana". المزامنة مع الأدوات.
---

# Sync / المزامنة

Write in `project.language`. Use the `integrator` agent (`pmo:integrator`) or follow its instructions.

1. `node "${CLAUDE_PLUGIN_ROOT}/engine/cli.js" doctor --dir .pmo` → which connectors are configured. None → offer `/pmo:setup` or `/pmo:import` and stop.
2. Ask which project/board/space to read the first time (Jira project key, Linear team, Asana project…) and remember it in `.pmo/drafts/sync-config.json` (`{ "<connector>": { "project": "…", "lastSync": "…" } }`).
3. Pull with the connector's **read/search** tools only. Save what you fetched as a JSON array of flat rows to `.pmo/drafts/sync-<connector>-<date>.json`, one object per task/issue with readable keys (e.g. `key`, `summary`, `status`, `story points`, `sprint`, `priority`, `assignee`, `% complete`).
4. Load it through the import engine (same validation and governance as file imports):

```bash
node "${CLAUDE_PLUGIN_ROOT}/engine/cli.js" import --dir .pmo --from .pmo/drafts/sync-<connector>-<date>.json --type <backlog|issues|schedule|progress|risks>
```

   Preview, confirm mapping (use `--map` if needed), then rerun with `--write`.
5. Agile: update sprint states/points in `scope/backlog.json` and add a progress snapshot with `pointsCompleted` (and `actualCost` if the user provides it). Waterfall: import task % complete as `--type progress --date <status date>`.
6. Update `lastSync` and write `.pmo/reports/sync-<date>.md`: source, items read, added/updated/proposed, mapping gaps, failures.
7. Push (🟡): creating or updating tickets, comments or messages in external tools only after the user confirms the exact content; Claude Code will also ask before every external write.

If a connector fails, continue with local data and say which source failed and the last successful sync date. Never invent imported values.
