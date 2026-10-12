---
name: report
description: Build the interactive project report — a single offline HTML file that works as a dashboard and as a full-screen presentation, with S-curve, CPI/SPI trend, Gantt (baseline vs forecast), burnup, risk heat map, quality, changes, stakeholders, decisions and what-if sliders, switchable Arabic/English. Use for "report", "dashboard", "presentation", "steering committee pack". التقرير التفاعلي.
---

# Interactive report / التقرير التفاعلي

Write in `project.language` unless the user asks for the other language.

1. `node "${CLAUDE_PLUGIN_ROOT}/engine/cli.js" status --dir .pmo` — on `error` relay it and stop.
2. Ask (one question): audience and language — e.g. steering committee in Arabic, sponsor in English. Default: project language.
3. Write the narrative (only text — every number in the report comes from the engine) to `.pmo/drafts/narrative.json`:

```json
{
  "summary": { "ar": "…", "en": "…" },
  "highlights": [ { "ar": "…", "en": "…" } ],
  "recommendations": [ { "ar": "…", "en": "…" } ],
  "decisions": [ { "ar": "…", "en": "…" } ]
}
```

   - Base it on the status output (and on the controller / risk-manager findings if they ran this session). Provide both languages so the report's language toggle works; a plain string is allowed when only one language is needed.
   - Any number, date, id or activity name you mention must be copied exactly from engine output (`status`, `evm`, `schedule`, `risk`) — no rounding into new figures, no renamed activities. Compare open-risk EMV with the **contingency** reserve only (management reserve is outside the cost baseline).
   - 2–3 sentence summary, 3–5 highlights, 2–4 recommendations. Decisions: only ones not already pending as APR ids (those are listed automatically).

4. Build:

```bash
node "${CLAUDE_PLUGIN_ROOT}/engine/cli.js" report --dir .pmo --lang <ar|en> --narrative .pmo/drafts/narrative.json
```

   Output: `path` of `.pmo/reports/<status date>-report.html`, `sections` included and `omitted` (with reasons — mention them, e.g. "quality section omitted: no data in quality.json").

5. Tell the user the file path and how to use it: open in any browser (works offline); **عرض / Present** for full-screen slides (arrow keys, Esc to exit); language and theme buttons; **Print / PDF** for a PDF copy; click heat-map cells to filter risks; move the what-if sliders.
6. Sending it to stakeholders is a 🟡 action (see `approval-protocol`): prepare recipients and message, ask for confirmation.
