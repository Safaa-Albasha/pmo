---
name: lessons-learned
description: Capture, categorise and reuse lessons learned throughout the project (not only at closure) in lessons.json. Use for retrospectives, post-mortems, phase reviews, closure.
user-invocable: false
---

# Lessons learned / الدروس المستفادة

## Record (`lessons.json → lessons[]`, free record)
```json
{ "id": "L-001", "date": "YYYY-MM-DD", "phase": "", "category": "scope|schedule|cost|quality|risk|stakeholders|resources|procurement|governance|technical",
  "type": "went-well|improve", "situation": "", "impact": "", "recommendation": "", "owner": "", "actionStatus": "open|done|n/a" }
```

## Capture
- Continuously: after milestones, sprint retros, major issues, occurred risks, approved CRs.
- Prompts: What did we expect? What happened? Why the difference? What will we do the same / differently?
- Write facts and recommendations, not blame; no personal judgements about individuals.

## Use
- At planning: read lessons from the project and similar past projects (ask the user for any organisational register) and convert to risks or plan items.
- At closure: summarise top 5 "keep" and top 5 "change" for the organisation (`closure-report`).
