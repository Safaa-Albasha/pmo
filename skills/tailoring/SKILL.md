---
name: tailoring
description: Decide which PMI practices, artifacts and metrics apply to this project based on its methodology (waterfall, agile, hybrid), size and context — PMBOK 8 tailoring. Use when planning a new project, choosing artifacts, or when unsure whether a practice applies.
user-invocable: false
---

# Tailoring / التكييف

Read `methodology` from `.pmo/project.json`. PMBOK 8 expects tailoring inside every performance domain: use what adds value, skip what does not, and record the choice.

## What applies

| Area | Waterfall (تنبؤي) | Agile (رشيق) | Hybrid (هجين) |
|---|---|---|---|
| Scope | WBS + WBS dictionary (`scope/wbs.json`) | Backlog + release plan (`scope/backlog.json`) | WBS for phases; backlog inside agile phases |
| Schedule | Activities + dependencies + CPM (`schedule.json`), baseline | Sprints, velocity, release forecast | Phases with gates in `schedule.json`; sprints inside build phase |
| Cost | Time-phased PV curve (`budget.json.plannedValue`), classic EVM | Budget per sprint/release, AgileEVM (points-based) | Classic EVM at project level; AgileEVM for the agile phase |
| Progress | `percentComplete` per activity + snapshot | Points done per sprint + snapshot | Both |
| Change | Formal change requests → CCB (`changes.json`) | Backlog re-prioritisation by PO; change requests only for budget/date/contract | Formal for phase gates/budget; backlog for in-sprint scope |
| Quality | Quality plan, inspections, audits | Definition of done, automated tests, review/retro | Both, by phase |
| Reporting | Gantt, S-curve, SPI/CPI | Burnup/burndown, velocity, AgileEVM | Combined dashboard |
| Cadence | Weekly status, monthly steering | Sprint review, retro, daily stand-up | Weekly status + sprint ceremonies |

## Sizing
- **Small** (< 3 months, < 5 people): one-page charter, top-10 risks, weekly status only.
- **Medium**: full register set, monthly steering report.
- **Large / regulated**: add formal quality audits, procurement plan, stakeholder engagement plan, monthly baseline review.

## Choosing a methodology (for `/pmo:new`)
- Requirements stable and well understood, high cost of change (construction, fit-out, hardware) → **waterfall**.
- Requirements emerge, fast feedback possible (software, digital products) → **agile**.
- Fixed governance/contract with uncertain build content (enterprise IT, platforms) → **hybrid**.

Record tailoring decisions as a short section in the charter ("Tailoring / التكييف").
