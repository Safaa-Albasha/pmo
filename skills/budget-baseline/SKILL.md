---
name: budget-baseline
description: Build the cost baseline — BAC, time-phased planned value (S-curve), contingency and management reserves — in budget.json. Use for budgeting, cost baseline, planned value curve, reserves.
user-invocable: false
---

# Cost baseline / خط أساس التكلفة

## File (`budget.json`, controlled)
```json
{ "schemaVersion": 1, "bac": 500000,
  "reserves": { "contingency": 25000, "management": 25000 },
  "plannedValue": [ { "date": "2026-01-31", "pv": 40000 }, { "date": "2026-02-28", "pv": 120000 } ] }
```
- `bac` = sum of activity/work-package budgets (cost baseline **excludes** management reserve; contingency is part of the cost baseline at project level — state the convention used in the charter).
- `plannedValue` is **cumulative** and must never decrease; last point = BAC at the planned finish.

## Building the PV curve
1. Take activity budgets and the planned schedule (`schedule` → `planned` early start/finish).
2. Spread each activity's budget linearly across its days (or by a profile the owner gives).
3. Sum per reporting period end (month-end or week-end) and accumulate.
4. Do the spreading with a short script reading the engine's `schedule` output; show the resulting table.
5. Propose `set budget.json plannedValue` (and `bac`, `reserves`) for approval.

Agile: PV can be per sprint (BAC × sprints planned so far / total planned sprints); AgileEVM in the engine uses this logic automatically.

Using reserves later is a 🟡 decision: propose `set reserves.contingency` with the reason and the risk it covers.
