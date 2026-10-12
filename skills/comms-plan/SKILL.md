---
name: comms-plan
description: Plan project communications — who gets what, when, in which language and channel, and which report formats — from the stakeholder register. Use for the communications plan, report cadence, meeting structure, or deciding how to send a report.
user-invocable: false
---

# Communications plan / خطة الاتصالات

## Matrix (`.pmo/drafts/comms-plan.md`)
| Audience | Information | Format | Language | Channel | Frequency | Owner |
|---|---|---|---|---|---|---|
| Sponsor / steering committee | health, EAC, top risks, decisions needed | interactive report (presentation mode) | ar/en | meeting + email | monthly / phase gate | PM |
| Project team | plan, priorities, blockers | stand-up / sprint review | | Teams/Slack | daily / per sprint | PM / SM |
| Functional managers | resource needs | email | | email | biweekly | PM |
| Customer / users | progress on deliverables, demos | demo + summary | | meeting | per release | PO |
| Suppliers | orders, deliveries, quality | | | email | as needed | Procurement |

Build rows from `stakeholders.json` (quadrant + `communication` + `language`).

## Rules
- Bilingual audiences: produce the report in both languages or the stakeholder's preferred one.
- Bad news early: amber/red status goes to the sponsor in the same week, with options.
- Every send through email/Teams/Slack is a 🟡 action confirmed by the PM.
- Meeting minutes: decisions, actions (owner, due date), risks raised → update registers.
