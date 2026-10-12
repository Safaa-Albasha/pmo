---
name: import
description: Import a CSV, Excel (.xlsx) or JSON file into the project — backlog, risks, schedule, issues, stakeholders or activity progress — from Jira, MS Project, Planner, Asana, Linear, ClickUp, monday.com exports or any spreadsheet, with Arabic or English headers. Use for "import", "load this Excel", "update from the sheet". استيراد من Excel.
---

# Import / الاستيراد

Write in `project.language`.

1. Ask for the file (path) and what it contains if not obvious: `backlog` · `risks` · `schedule` · `issues` · `stakeholders` · `progress` (activity % complete for a status date).
2. Preview — nothing is written:

```bash
node "${CLAUDE_PLUGIN_ROOT}/engine/cli.js" import --dir .pmo --from "<file>" --type <type> [--sheet "<sheet name>"]
```

3. Show the user:
   - `mapping` — which column feeds which field (✗ for unmapped fields), and `unmappedHeaders`;
   - the first rows of `items` as a small table;
   - `warnings`.
   Ask them to confirm the mapping. To fix it, rerun with `--map '{"title":"Task Title","points":"Size"}'` (field → exact column header). Dates are read as day/month/year; add `--date-format mdy` for US files.
4. Write after confirmation:

```bash
node "${CLAUDE_PLUGIN_ROOT}/engine/cli.js" import --dir .pmo --from "<file>" --type <type> --write [--date YYYY-MM-DD]
```

   - `backlog`, `issues`, `stakeholders`: merged directly (matching ids are updated, new ids added); the whole project is validated and the file is restored if anything is invalid (`VALIDATION_FAILED` → show `details`).
   - `progress` needs `--date` (the status date): writes `activityProgress` into `progress/<date>.json`.
   - `risks`, `schedule` are controlled: each new or changed row becomes a proposal (`proposals` with APR ids; unchanged rows are skipped). Offer `/pmo:approvals` — the user can approve all import proposals in one step.
5. Summarise counts (added / updated / proposed / unchanged) and suggest `/pmo:status`.
