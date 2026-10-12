---
name: resource-plan
description: Plan team and physical resources — roles, RACI, capacity, loading and levelling — PMBOK 8 Resources domain. Use for staffing, RACI, capacity planning, over-allocation.
user-invocable: false
---

# Resource plan / خطة الموارد

## Contents (`.pmo/drafts/resource-plan.md`)
1. Roles & responsibilities — الأدوار والمسؤوليات
2. RACI matrix (Responsible, Accountable, Consulted, Informed — منفّذ، مساءل، مستشار، مُطّلع): rows = work packages/deliverables, columns = roles. Exactly **one A** per row.
3. Capacity: per person/role — availability % and days per period; agile: team days per sprint × focus factor (0.6–0.8).
4. Loading: sum of assigned activity effort per period vs capacity → over-allocation list.
5. Physical resources: equipment, materials, facilities, lead times (feed `procurement`).
6. Onboarding, training and release of resources.

## Levelling
When over-allocated: first use **float** (move non-critical activities within total float — no finish change); if insufficient, levelling extends the critical path → schedule impact → change request. Show both options.

Assign owners on activities (`owner` field) and risks (`owner`) consistently with RACI.
