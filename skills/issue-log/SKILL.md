---
name: issue-log
description: Log, prioritise, assign and track project issues (problems happening now) in issues.json, and escalate when needed. Use for issues, blockers, impediments, problems, action items.
user-invocable: false
---

# Issue log / سجل القضايا

Risk = may happen; **issue = happening now**. An occurred risk becomes an issue.

## Record (`issues.json → issues[]`, free record)
```json
{ "id": "I-001", "title": "", "description": "", "raised": "YYYY-MM-DD", "raisedBy": "",
  "priority": "critical|high|medium|low", "impactArea": "scope|schedule|cost|quality|resources|stakeholders",
  "owner": "", "due": "YYYY-MM-DD", "status": "open|in-progress|resolved|closed",
  "resolution": "", "relatedRisk": null, "escalated": false }
```

## Practice
- Every issue has one owner and a due date.
- Priority: critical = blocks critical path or safety/compliance; high = affects milestone or budget; medium/low otherwise.
- Escalate when resolution needs authority above the PM (scope, budget beyond reserves, contracts): set `escalated: true` and include in the status report's decisions section.
- Resolution that changes plan/scope/cost → change request.
- Review weekly; ageing issues (> 2 weeks open) are reported.

Run `validate` after editing.
