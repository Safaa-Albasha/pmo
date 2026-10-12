---
name: wbs
description: Build a deliverable-oriented work breakdown structure and WBS dictionary (Scope domain) and connect work packages to schedule activities and budget. Use for scope decomposition in waterfall and hybrid projects.
user-invocable: false
---

# WBS / هيكل تجزئة العمل

## Rules
- Deliverable-oriented (nouns), not activities (verbs).
- **100% rule**: children add up to exactly the parent's scope; nothing outside scope.
- Decompose to work packages that can be estimated, assigned to one owner and finished in ≤ 1 reporting period (8/80 heuristic: 8–80 hours of effort, adapt to project size).
- Include project management as its own branch.
- 3–5 levels is typical.

## File (`scope/wbs.json`, controlled)
```json
{ "schemaVersion": 1, "elements": [
  { "id": "1", "name": "", "parent": null },
  { "id": "1.1", "name": "", "parent": "1", "workPackage": true, "owner": "", "budget": 0,
    "description": "", "acceptanceCriteria": "", "activities": ["A", "B"] } ] }
```

## Steps
1. Start from charter deliverables (level 2).
2. Decompose; check 100% rule at each level; record exclusions.
3. WBS dictionary per work package: description, acceptance criteria, owner, budget, linked activities.
4. Check: sum of work-package budgets = BAC minus reserves (flag differences).
5. Draft in `.pmo/drafts/wbs.json`; the `planner` submits each element as an `add` proposal on `scope/wbs.json` (collection `elements`).

Hybrid: phases are level 2; the agile build phase has one work package per release/epic and is detailed in the backlog.
