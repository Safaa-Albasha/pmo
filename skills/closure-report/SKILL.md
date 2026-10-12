---
name: closure-report
description: Prepare a phase or project closure report — objectives achieved, final scope/schedule/cost/quality performance from the engine, acceptance, benefits handover, open items and lessons learned. Use at phase gates and project closure.
user-invocable: false
---

# Closure report / تقرير الإغلاق

## Template (`.pmo/drafts/closure-<phase|project>.md`, project language)
1. ملخص تنفيذي / Executive summary
2. الأهداف مقابل النتائج / Objectives vs results (from charter: target vs actual, met?)
3. النطاق / Scope: deliverables accepted (by whom, when), descoped items with CR ids
4. الجدول / Schedule: baseline vs actual finish (engine `status.schedule`), main slip causes
5. التكلفة / Cost: BAC, final AC, final CPI, VAC; reserves used (engine `evm`)
6. الجودة / Quality: metrics vs targets, open defects and their handover
7. المخاطر والقضايا / Risks & issues: closed, transferred to operations (with owner)
8. التغييرات / Changes: approved CRs and their effect
9. المنافع وتسليمها / Benefits & transition: benefits owner, measures, when to measure
10. الدروس المستفادة / Lessons learned: top 5 keep / top 5 change
11. التوصيات / Recommendations
12. الاعتماد / Sign-off table

## Rules
- Final figures only from the engine at the closing status date.
- List every unaccepted deliverable and open item explicitly.
- Closure is approved by proposal (`set project.json status "closed"`); after approval save the report to `.pmo/reports/`.
