# Download & install — PMO for Claude Code

[العربية](INSTALL.ar.md)

About **15 minutes**, no programming experience needed. You will paste a few commands into a **terminal** (Windows: open **PowerShell** or **Terminal** from the Start menu · Mac: **Terminal** in Utilities). Copy each command, paste it, press Enter.

## What you need

| Requirement | Note |
|---|---|
| A Claude plan | Pro, Max, Team, Enterprise, or a Claude Console account |
| Node.js 18 or newer | free — step 1 |
| Internet | only for installation; reports work offline |
| Git (Windows) | usually installed with Claude Code; otherwise git-scm.com |

## Step 1 — Install Node.js

1. Go to **https://nodejs.org**, download the **LTS** version and install it (Next → Next → Finish).
2. Close and reopen the terminal, then check:

```bash
node --version
```

You should see `v22.x.x` or similar (anything 18 or higher).

## Step 2 — Install Claude Code

Windows (PowerShell):

```powershell
irm https://claude.ai/install.ps1 | iex
```

Mac / Linux:

```bash
curl -fsSL https://claude.ai/install.sh | bash
```

Then start it once and sign in with your Claude account (a browser window opens), and type `/exit`:

```bash
claude
```

Already have Claude Code? Skip to step 3.

## Step 3 — Download and install the plugin

```bash
claude plugin marketplace add Safaa-Albasha/pmo
```

```bash
claude plugin install pmo@pmo
```

Or, inside Claude Code: `/plugin marketplace add Safaa-Albasha/pmo` then `/plugin install pmo@pmo`.

**Restart Claude Code** so the commands load.

## Step 4 — Check

```bash
claude plugin list
```

`pmo` should be listed as enabled.

## Step 5 — First project

1. Create a folder for your project and open a terminal in it (Windows: right-click inside the folder → **Open in Terminal**).
2. Run `claude`.
3. Type `/pmo:setup` — checks your computer and lists the optional tool connections.
4. Type `/pmo:new` — answer the questions (name, methodology, language, currency, dates, budget).

Then: `/pmo:status`, `/pmo:weekly`, `/pmo:approvals`, `/pmo:report`, `/pmo:import` — or just ask in plain language.

**Try a sample first:** on https://github.com/Safaa-Albasha/pmo click **Code → Download ZIP**, unzip, copy `examples/waterfall` (Arabic) or `examples/agile` (English) somewhere, open a terminal there, run `claude`, then `/pmo:status`. A ready-made interactive report: `examples/sample-report-waterfall.html` (open in any browser).

## Step 6 (optional) — Connect your tools

Run `/pmo:setup` and choose:

- **Jira + Confluence, Asana, Linear, monday.com, ClickUp** — added to the project after you confirm; then type `/mcp` in Claude Code, pick the tool and sign in with your account.
- **Slack, Microsoft 365, Google Drive, Gmail** — connect them at claude.ai → **Settings → Connectors**, and use Claude Code with the same account.
- **MS Project / Planner** — export to Excel or CSV and use `/pmo:import`.

You will never be asked for a password or API key in the chat.

## Update

```bash
claude plugin marketplace update pmo
```

```bash
claude plugin update pmo@pmo
```

Restart Claude Code.

## Uninstall

```bash
claude plugin uninstall pmo@pmo
```

Your project data in `.pmo` folders is **not** deleted.

## Troubleshooting

| Problem | Fix |
|---|---|
| `node` not recognised | Reinstall Node.js, then close and reopen the terminal |
| `/pmo:...` commands missing | Restart Claude Code; check `claude plugin list`; `claude plugin enable pmo@pmo` |
| `marketplace add` fails | Check internet and that Git is installed (Windows: git-scm.com) |
| A confirmation appears when approving | Expected — the approval guard makes sure the decision is yours |
| Editing `risks.json` is refused | Expected — controlled records change only through `/pmo:approvals` |
| A connector asks to sign in | Type `/mcp` in Claude Code, or connect it in claude.ai Connectors |
| Arabic looks broken in the terminal | Use **Windows Terminal**; reports in the browser are fine |
| A report section is missing | See "Sections not included" in the report — usually no data yet |

Help: https://github.com/Safaa-Albasha/pmo/issues
