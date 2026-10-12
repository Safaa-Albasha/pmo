---
name: risk-planning
description: Plan risk management and identify/assess risks — risk statements, categories (RBS), probability-impact scales, EMV, response strategies for threats and opportunities, owners and triggers. Use when creating the risk register or adding new risks.
user-invocable: false
---

# Risk planning & identification / تخطيط وتحديد المخاطر

## Risk record (`risks.json → risks[]`, controlled)
```json
{ "id": "R7", "type": "threat|opportunity", "title": "",
  "statement": "Because <cause>, <event> may occur, which would lead to <effect>",
  "category": "technical|external|organizational|project-management|procurement|regulatory|resources|cost|scope",
  "probability": 1-5, "impact": 1-5, "probabilityPct": null, "costImpact": null, "scheduleImpactDays": null,
  "status": "open|occurred|closed", "owner": "", "trigger": "",
  "responseStrategy": "avoid|mitigate|transfer|accept|escalate|exploit|enhance|share",
  "response": "", "contingencyPlan": "", "history": [] }
```

## Scales (default — record any change in the charter)
| Score | Probability | Impact (cost or time, whichever is worse) |
|---|---|---|
| 1 | < 10% | < 1% of BAC · < 1 week |
| 2 | 10–30% | 1–3% · 1–2 weeks |
| 3 | 30–50% | 3–5% · 2–4 weeks |
| 4 | 50–70% | 5–10% · 1–2 months |
| 5 | > 70% | > 10% · > 2 months |

Score = P × I. Level (engine): **high ≥ 15**, medium 6–14, low ≤ 5. EMV = probability × costImpact (engine uses `probabilityPct` if given, otherwise 10/30/50/70/90%).

## Identification sources
Charter assumptions & constraints · WBS/schedule (low float, long lead items, single-source suppliers) · stakeholder register (resistors) · lessons learned · checklists by category · expert interviews · SWOT.

## Responses
- Threats: avoid (change plan), mitigate (reduce P or I), transfer (contract/insurance), accept (active: contingency reserve; passive), escalate (outside PM authority).
- Opportunities: exploit, enhance, share, accept.
- Each high risk: owner, trigger, response with cost and date, contingency plan.

Every new risk is an `add` proposal (see `approval-protocol`).
