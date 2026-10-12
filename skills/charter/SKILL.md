---
name: charter
description: How to write a PMI project charter (PMBOK 8, Initiating / Governance) with a bilingual template. Use when drafting or reviewing a project charter.
user-invocable: false
---

# Project charter / ميثاق المشروع

The charter formally authorises the project and the project manager's authority. Keep it short (2–4 pages); detail belongs in plans.

## Inputs to ask for (one at a time)
Business need & link to strategy · objectives (SMART: specific, measurable, achievable, relevant, time-bound) · high-level scope **and exclusions** · key deliverables · summary milestones · summary budget (BAC + reserves) · high-level risks · assumptions & constraints · success / acceptance criteria · sponsor · PM and authority level (budget, staffing, decisions) · key stakeholders · methodology & tailoring.

## Template (write in the project language)

```markdown
# ميثاق المشروع — <name> / Project Charter

| | |
|---|---|
| الراعي / Sponsor | |
| مدير المشروع / Project manager | |
| التاريخ / Date · الإصدار / Version | |
| المنهجية / Methodology | waterfall · agile · hybrid |

## 1. الغرض والمبرر / Purpose & business justification
## 2. الأهداف القابلة للقياس / Measurable objectives
| # | Objective | Measure | Target | Date |
## 3. النطاق عالي المستوى / High-level scope
### داخل النطاق / In scope
### خارج النطاق / Out of scope
## 4. المخرجات الرئيسية / Key deliverables
## 5. المعالم الرئيسية / Summary milestones
| Milestone | Target date |
## 6. الميزانية الإجمالية / Summary budget
BAC · contingency reserve · management reserve · funding source
## 7. المخاطر عالية المستوى / High-level risks
## 8. الافتراضات والقيود / Assumptions & constraints
## 9. معايير النجاح والقبول / Success & acceptance criteria
## 10. أصحاب المصلحة الرئيسيون / Key stakeholders
## 11. صلاحيات مدير المشروع / Project manager authority
## 12. التكييف / Tailoring
## 13. الاعتماد / Approval
| Name | Role | Signature | Date |
```

## Quality checks
- Every objective has a measure and a target date.
- Exclusions are explicit (prevents scope creep).
- Budget and dates match `project.json` / `budget.json`; if not, flag the difference.
- No invented figures — mark unknowns as «يُحدَّد لاحقًا / TBD» and list them as open questions.

Save the draft to `.pmo/drafts/charter.md`; publish through a `document` proposal (see `approval-protocol`).
