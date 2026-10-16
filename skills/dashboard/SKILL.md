---
name: dashboard
description: Open the local live PMO dashboard on localhost — agents and their jobs, project health (RAG, SPI/CPI, EVM, forecast vs baseline), schedule, backlog/sprints, risks, issues, changes, quality, stakeholders, approvals queue, lessons and a raw data explorer, Arabic/English, read-only by default with an opt-in edit mode that goes through the approval flow, refreshes when .pmo/ changes. Use for "dashboard", "open the dashboard", "show me the project on localhost", "edit from the dashboard". لوحة المتابعة.
---

# Live dashboard / لوحة المتابعة المباشرة

1. Check the project: `node "${CLAUDE_PLUGIN_ROOT}/engine/cli.js" validate --dir .pmo` — if it reports errors, say so (the dashboard still opens and lists them).
2. Start the server **in the background** (it keeps running until stopped):

```bash
node "${CLAUDE_PLUGIN_ROOT}/engine/dashboard.js" --dir .pmo --port 4173
```

3. Tell the user to open **http://localhost:4173** (another port with `--port` if 4173 is busy).
   - Read-only by default: nothing can be changed from the page. Decisions stay in `/pmo:approvals`.
   - Every figure comes from the engine (same numbers as `/pmo:status` and `/pmo:report`).
   - The page updates by itself when files in `.pmo/` change (agents writing progress, approvals, imports).
   - It listens on 127.0.0.1 only; nothing is sent anywhere.
4. To stop it, stop the background command.

## Edit mode (only when the user asks to edit from the page)

```bash
node "${CLAUDE_PLUGIN_ROOT}/engine/dashboard.js" --dir .pmo --port 4173 --edit
```

- The command prints a link with `#token=…`. Give the user **that exact link** (open once; the token stays in that tab). Do not paste the token anywhere else.
- What the page can do: issues (add/edit), lessons (add) and backlog item status are saved now through the engine; activity % complete, risks, change requests and stakeholders are sent as proposals; on the Approvals page the user can Approve / Reject / Edit. Decisions are logged in `decisions.json` and every action in `audit.json` as `PM via dashboard`.
- You never use the page's API yourself and never send its requests: decisions in edit mode are the project manager's clicks. Your own proposals still go through `propose` and `/pmo:approvals`.
- It always binds 127.0.0.1; `--host` is refused in edit mode.
- If the user asks whether edits are possible from the dashboard: yes with `--edit`, and controlled records still need their approval.

## Windows

- If `npm run dashboard` says `Missing script: "dashboard"`, your copy is older than 1.1.0: run `git pull` (or update the plugin) first.
- `npm run dashboard -- --dir examples\waterfall\.pmo --edit` works in cmd; in PowerShell prefer `node engine\dashboard.js --dir examples\waterfall\.pmo --edit` (npm can drop arguments after `--`).
