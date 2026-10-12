---
name: new
description: Create a new PMI-aligned project workspace (.pmo/) — waterfall, agile or hybrid, Arabic or English. Use when the user wants to start, set up or create a new project. إنشاء مشروع جديد.
---

# Create a project / إنشاء مشروع

Reply in the user's language (Arabic or English).

1. If `.pmo/project.json` already exists in the current folder, say so and stop — offer `/pmo:status` instead.
2. Ask, one question at a time (multiple choice where possible):
   - Project name / اسم المشروع
   - Methodology / المنهجية: **waterfall** (predictive / تنبؤي), **agile** (رشيق), **hybrid** (هجين). If unsure, explain in one line each and recommend based on how well scope is known.
   - Report language / لغة التقارير: `ar` or `en`
   - Currency / العملة — open question, the project manager decides. Recommend the 3-letter ISO 4217 code (e.g. SAR, AED, KWD, QAR, BHD, OMR, EGP, JOD, IQD, MAD, USD, EUR, GBP) because the report then shows the local symbol automatically (KWD → د.ك); any other label is also accepted as typed (e.g. «دينار», «Points», «man-days»). Use one currency for the whole project; convert amounts before entering them.
   - Start and end dates (YYYY-MM-DD)
   - Budget at completion (BAC) / الميزانية الإجمالية — number, may be 0 for now
   - Sponsor and project manager names (optional)
3. Show a one-screen summary and ask for confirmation.
4. Run:

```bash
node "${CLAUDE_PLUGIN_ROOT}/engine/cli.js" init --dir .pmo --name "<name>" --methodology <m> --language <ar|en> --currency <CUR> --start <YYYY-MM-DD> --end <YYYY-MM-DD> --bac <number> --sponsor "<sponsor>" --pm "<pm>"
```

5. If the output has `error`, show `message_ar` or `message_en` (project language) and fix the input with the user.
6. On success list what was created and suggest next steps by methodology:
   - waterfall: build the WBS and schedule (`schedule.json`), planned value curve (`budget.json`)
   - agile: release plan and backlog (`scope/backlog.json`)
   - hybrid: phases in `schedule.json` + backlog for agile phases
   - all: first risks in `risks.json`, then `/pmo:status`

Never invent numbers; leave unknown values empty and say so.
