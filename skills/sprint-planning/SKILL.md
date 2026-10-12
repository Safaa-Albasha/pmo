---
name: sprint-planning
description: Plan a sprint from velocity and capacity, select ready backlog items, set a sprint goal, and run sprint review and closure in scope/backlog.json. Use for sprint planning, sprint review, closing a sprint.
user-invocable: false
---

# Sprint planning & review / تخطيط ومراجعة السبرنت

## Planning
1. Engine `agile` → `velocity` (average of last 3 closed sprints). First sprints: use team estimate.
2. Capacity adjustment: planned points ≈ velocity × (available team days ÷ normal team days). Account for holidays (e.g. Eid, national days, Ramadan working hours).
3. Select items by `priority` that are **ready** (estimated, acceptance criteria, no blockers) until the planned points are reached; do not exceed by more than ~10%.
4. Sprint goal: one sentence of value.
5. Write the sprint (`state: "active"`, `plannedPoints`, `goal`) and set `sprint` on the selected items; `validate`.

## During the sprint
Scope changes after start: only by team + PO agreement; anything affecting release date/budget → change request.

## Review & close
1. Items meeting DoD → `status: "done"`; others back to `todo` (carry-over) with `sprint: null`.
2. Sprint: `state: "closed"`, `completedPoints` = sum of done items in the sprint.
3. Progress snapshot `progress/<sprint end>.json`: `{ "pointsCompleted": <cumulative>, "actualCost": <cumulative if known> }`.
4. Run `agile` → report velocity, burnup, remaining points, forecast finish vs project end date.
5. Retro actions → `lessons.json`; impediments → `issues.json`.
