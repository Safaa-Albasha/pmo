---
name: quality-planning
description: Plan quality — standards, acceptance criteria, quality metrics with targets, reviews/audits and definition of done — and set up quality.json. Use for the quality management plan, metrics, acceptance criteria.
user-invocable: false
---

# Quality planning / تخطيط الجودة

PMBOK 8 principle: **embed quality** in processes and deliverables, not inspect it in at the end.

## Quality plan (`.pmo/drafts/quality-plan.md`)
1. Applicable standards and regulations (e.g. ISO 9001, building codes, accessibility, data-protection laws).
2. Acceptance criteria per deliverable (from WBS dictionary / backlog).
3. Metrics with operational definition, target, unit, direction, frequency, owner.
4. Assurance activities: reviews, audits, test strategy, inspections, supplier quality.
5. Control activities: how measurements are collected and reported.
6. Agile: definition of done (DoD) and definition of ready.
7. Cost of quality: prevention + appraisal vs internal/external failure.

## `quality.json` (free record)
```json
{ "schemaVersion": 1,
  "metrics": [ { "id": "Q1", "name": "Defect density", "unit": "defects/KLOC", "target": 0.5, "direction": "max", "frequency": "sprint", "owner": "", "values": [ { "date": "YYYY-MM-DD", "value": 0.4 } ] } ],
  "defects": [ { "id": "D-001", "title": "", "severity": "critical|major|minor", "status": "open|fixed|closed", "found": "YYYY-MM-DD", "fixed": null, "deliverable": "" } ],
  "audits": [ { "id": "AU-01", "date": "YYYY-MM-DD", "scope": "", "findings": [], "status": "open|closed" } ] }
```
`direction: "max"` means the value must stay ≤ target; `"min"` means ≥ target.

Typical metrics: on-time milestone rate, defect density, first-pass yield, rework %, test pass rate, customer satisfaction, punch-list items (construction).
