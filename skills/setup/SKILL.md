---
name: setup
description: First-time setup and health check for the PMO plugin — checks Node.js, the project folder and data, and connects optional tools (Jira/Confluence, Asana, Linear, monday.com, ClickUp, Slack, Microsoft 365, Google Drive, Gmail, MS Project/Planner files). Use when installing, "setup", "connect Jira", "connect tools", or when something does not work. الإعداد وربط الأدوات.
---

# Setup / الإعداد

Reply in the user's language. One question at a time.

1. Health check:

```bash
node "${CLAUDE_PLUGIN_ROOT}/engine/cli.js" doctor --dir .pmo
```

   - If the command fails because `node` is missing or `node.ok` is false: explain that the plugin needs Node.js 18+ and give the install link https://nodejs.org (LTS). Stop until installed.
   - `project.exists` false → offer `/pmo:new`.
   - `project.valid` false → run `validate` and help fix (show messages in the project language).
   - `project.pendingApprovals` > 0 → mention `/pmo:approvals`.

2. Show the connector list from `connectors` (name, how it connects, configured ✓/✗) and ask which tools the team uses (multi-select). Explain: all are optional; without them everything works from local files and Excel/CSV import.

3. For each chosen connector, by `setup` type:
   - **`http`** (Atlassian, Asana, Linear, monday.com, ClickUp): this adds the server to the project's `.mcp.json` so the whole team gets it. Ask for confirmation, then run:

     ```bash
     claude mcp add --transport http --scope project <id> <url>
     ```

     Then tell the user to run `/mcp` in Claude Code, pick the server and sign in with their own account (OAuth in the browser). Never ask for passwords or API tokens in chat.
   - **`claude-ai-connector`** (Slack, Microsoft 365, Google Drive, Gmail): tell the user to open claude.ai → Settings → Connectors, connect the tool, and use Claude Code signed in with the same account. Read the `notes` field from `${CLAUDE_PLUGIN_ROOT}/connectors/catalog.json` for specifics.
   - **`file`** (MS Project / Planner): explain the export steps from `notes` and offer `/pmo:import`.

4. Re-run `doctor` and summarise what is connected. Remind the user:
   - pulling data is automatic (🟢); any write or message to an external tool asks for confirmation (🟡);
   - use `/pmo:sync` to pull updates and `/pmo:weekly` for the weekly cycle.

Do not edit `~/.claude` user settings. Only add project-scoped servers after the user confirms.
