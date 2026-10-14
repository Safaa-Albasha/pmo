---
name: dashboard
description: Open the local live PMO dashboard on localhost — agents and their jobs, project health (RAG, SPI/CPI, EVM, forecast vs baseline), schedule, backlog/sprints, risks, issues, changes, quality, stakeholders, approvals queue, lessons and a raw data explorer, Arabic/English, read-only, refreshes when .pmo/ changes. Use for "dashboard", "open the dashboard", "show me the project on localhost". لوحة المتابعة.
---

# Live dashboard / لوحة المتابعة المباشرة

1. Check the project: `node "${CLAUDE_PLUGIN_ROOT}/engine/cli.js" validate --dir .pmo` — if it reports errors, say so (the dashboard still opens and lists them).
2. Start the server **in the background** (it keeps running until stopped):

```bash
node "${CLAUDE_PLUGIN_ROOT}/engine/dashboard.js" --dir .pmo --port 4173
```

3. Tell the user to open **http://localhost:4173** (another port with `--port` if 4173 is busy).
   - Read-only: nothing can be changed from the page. Decisions stay in `/pmo:approvals`.
   - Every figure comes from the engine (same numbers as `/pmo:status` and `/pmo:report`).
   - The page updates by itself when files in `.pmo/` change (agents writing progress, approvals, imports).
   - It listens on 127.0.0.1 only; nothing is sent anywhere.
4. To stop it, stop the background command.
