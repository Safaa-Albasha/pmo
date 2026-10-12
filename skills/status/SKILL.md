---
name: status
description: Show project health — RAG status, SPI/CPI, EVM forecast, forecast finish vs baseline, points done and remaining, critical path and top risks — computed by the pmo engine. Use when the user asks how the project is doing, for status, health, progress or a quick summary. حالة المشروع.
---

# Project status / حالة المشروع

1. Run:

```bash
node "${CLAUDE_PLUGIN_ROOT}/engine/cli.js" status --dir .pmo
```

   Add `--date YYYY-MM-DD` if the user asks about a specific date.

2. If the output has `error`:
   - `FILE_MISSING` for project.json → no project here; offer `/pmo:new`.
   - `VALIDATION_FAILED` → list each item in `details` using the message in the project language, and offer to help fix.
   - otherwise show the message in the project language.

3. Write the summary in `project.language` (`ar` → Arabic; `en` → English). Use only numbers from the output — never compute or estimate figures yourself. Format money with the project currency.

   Structure:
   - **Overall health** with 🟢/🟡/🔴 from `health.overall` (null → "insufficient data" and why, from `notes`).
   - **Progress:** `progress.percentComplete`%; for agile/hybrid also points done / remaining / total.
   - **Schedule:** SPI, SV. Waterfall/hybrid: `schedule.forecastFinish` (forecast from actual progress at the status date) vs `schedule.baselineFinish` → `slipDays` late (negative = early), and vs `schedule.deadline` → `deadlineVarianceDays`; forecast critical path `schedule.criticalPath`. Agile: velocity, sprints remaining, `agile.forecastFinish`.
   - **Cost:** CPI, CV, EAC (`eacPrimary`), VAC, TCPI.
   - **Top 3 risks** with score, level and owner; open-risk EMV total.
   - **What this means:** 2–3 sentences of plain interpretation (e.g. CPI 0.93 means each 1 SAR spent earns 0.93 SAR of planned work).

   Glossary (keep consistent): Earned Value = القيمة المكتسبة · Planned Value = القيمة المخططة · Actual Cost = التكلفة الفعلية · SPI = مؤشر أداء الجدول · CPI = مؤشر أداء التكلفة · EAC = التقدير عند الإنجاز · VAC = الانحراف عند الإنجاز · TCPI = مؤشر الأداء المطلوب للإنجاز · Critical path = المسار الحرج · Baseline = خط الأساس · Forecast finish = تاريخ الانتهاء المتوقع · Velocity = سرعة الفريق.

4. Do not change any project file in this command. If pending approvals exist (`node "${CLAUDE_PLUGIN_ROOT}/engine/cli.js" approvals --dir .pmo` returns items), mention the count and suggest `/pmo:approvals`.
