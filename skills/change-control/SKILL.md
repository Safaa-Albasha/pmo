---
name: change-control
description: Integrated change control — intake, impact analysis on scope/schedule/cost/quality/risk, options, decision by PM or CCB, implementation and baseline update. Use for change requests and scope changes.
user-invocable: false
---

# Integrated change control / التحكم المتكامل بالتغيير

## When a change request (CR) is needed
- Waterfall: any change to approved scope, schedule baseline, cost baseline, or quality requirements.
- Agile: backlog reprioritisation is **not** a CR; a CR is needed for release date, budget, contract or regulatory scope.
- Hybrid: phase-gate scope, budget and dates → CR; in-sprint backlog → product owner.

## Impact analysis
| Dimension | How |
|---|---|
| Scope | WBS elements / backlog items added, removed, changed |
| Schedule | new/changed activities → forecast finish delta (engine `schedule` on the proposed network) |
| Cost | Δ BAC, reserve usage, EAC effect |
| Quality | acceptance criteria, testing effort |
| Risk | new/changed risks, secondary risks |
| Resources | people/equipment needed |
| Stakeholders | who must be informed/consulted |

Give at least two options (e.g. accept / accept with descoping elsewhere / defer / reject) with a recommendation.

## Decision authority
PM within delegated limits (charter: PM authority); above that → sponsor/CCB. State which applies; the PM records the decision through `/pmo:approvals`.

## After approval
1. `update` CR `status: "approved"`.
2. Planner proposes the plan changes (activities, budget) → then `baseline` if the baseline changes.
3. Risk register updates.
4. Communicate the decision (comms plan).
5. When done: `update` CR `status: "implemented"`.
