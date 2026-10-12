---
name: approvals
description: Review and decide pending PMO proposals (new or changed risks, baselines, budget, change requests) — approve, reject or edit; every decision is logged in decisions.json. Use when the user asks what needs approval, wants to approve or reject agent proposals, or says "approvals", "pending decisions". الموافقات والقرارات المعلّقة.
---

# Approvals / الموافقات

Write in `project.language` from `.pmo/project.json`.

1. List pending proposals:

```bash
node "${CLAUDE_PLUGIN_ROOT}/engine/cli.js" approvals --dir .pmo
```

   Empty list → say there is nothing pending and stop.

2. Present each proposal as a short card:
   - **ID · title** — proposing agent
   - **Why:** `rationale` · **Impact:** `impact`
   - **Change:** `file`, then before → after (only the fields that differ; for `add` show the new item; for `baseline` show the number of activities and the new baseline finish).

3. Ask the project manager to decide each one (use AskUserQuestion when available; up to 4 proposals per question): **Approve ✅ / Reject ❌ / Edit ✏️**. Ask for an optional note on rejections.

4. Find the approver name: `projectManager` in project.json; if empty ask once.

5. For approve / reject run one command per proposal:

```bash
node "${CLAUDE_PLUGIN_ROOT}/engine/cli.js" apply --dir .pmo --id <APR-id> --decision <approve|reject> --by "<name>" --note "<note>"
```

   Several proposals with the same decision (e.g. "approve all import proposals") → one command: `apply --dir .pmo --ids APR-0003,APR-0004,APR-0005 --decision approve --by "<name>"`; it returns `results` per id (some may fail, e.g. stale — report those).

   Claude Code shows a confirmation prompt for every `apply`; this is the PMO guard and is expected — tell the user before the first one.

6. For edit: ask what to change, write a corrected proposal (same shape: `agent`, `title`, `rationale`, `impact`, `operation`) and submit it with `propose --json '<json>'`, then reject the original with note `superseded by <new id>`. Show the new card and ask again.

7. Errors: `PROPOSAL_STALE` → explain the data changed since the proposal, reject it and ask the proposing agent's area to re-propose. `VALIDATION_FAILED` → show `details` in the project language.

8. Finish with a summary table: id, title, decision, by. Never apply anything the user did not explicitly decide.
