---
name: backlog
description: Create and refine a product backlog and release plan (user stories, acceptance criteria, story points, prioritisation) in scope/backlog.json. Use for agile/hybrid scope, backlog grooming, story writing.
user-invocable: false
---

# Product backlog / قائمة المتطلبات

## File (`scope/backlog.json`, free record)
```json
{ "schemaVersion": 1,
  "releasePlan": { "totalPoints": 0, "plannedSprints": 0, "sprintLengthDays": 14 },
  "sprints": [ { "id": "S1", "start": "YYYY-MM-DD", "end": "YYYY-MM-DD", "state": "planned|active|closed", "goal": "", "plannedPoints": 0, "completedPoints": 0 } ],
  "items": [ { "id": "US-01", "title": "", "story": "As a <role> I want <goal> so that <benefit>",
               "acceptanceCriteria": ["Given … when … then …"], "points": 0, "priority": 1,
               "status": "todo|doing|done", "sprint": null, "epic": "" } ] }
```

## Writing items
- INVEST: independent, negotiable, valuable, estimable, small, testable.
- Acceptance criteria in Given/When/Then; Arabic projects may write criteria in Arabic.
- Estimate in Fibonacci points (1, 2, 3, 5, 8, 13, 21); split anything > 13.

## Prioritisation
Use MoSCoW (must/should/could/won't) or value ÷ effort; the product owner has the final say. `priority` 1 = highest.

## Release plan
`totalPoints` = sum of points in the release scope; `plannedSprints` = ceil(totalPoints / expected velocity); keep `releasePlan` consistent when scope changes (scope increase → note in the sprint review; date/budget impact → change request).

Run `validate` after editing.
