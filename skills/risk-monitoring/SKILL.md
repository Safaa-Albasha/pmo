---
name: risk-monitoring
description: Monitor risks — review triggers, re-score, track response actions, detect occurred risks and emerging ones, use the engine heat map and EMV, and decide escalations. Use for periodic risk reviews.
user-invocable: false
---

# Risk monitoring / مراقبة المخاطر

## Review cycle (weekly or per sprint)
1. Engine `risk` → counts, `heatmap` (`heatmap[p-1][i-1]`), `top`, `totalEmv`.
2. For each open risk: trigger fired? response done/late? probability or impact changed? still relevant?
3. Link to performance: a slipping critical activity raises impact/probability of schedule risks; CPI trend affects cost risks; new issues may reveal unidentified risks.
4. Compare `totalEmv` with remaining contingency reserve (`budget.json.reserves.contingency`): if EMV > reserve, report a reserve shortfall.
5. Propose changes (one proposal each):
   - re-score: `update` with new `probability`/`impact` and append to `history` `{ "date", "probability", "impact", "note" }`
   - occurred: `update status: "occurred"` + new issue in `issues.json`
   - closed: `update status: "closed"` + reason in `history`
6. Escalate to sponsor: high risks outside PM authority, or response needing budget beyond reserves.

## Report
Heat map summary (count per level), top 5 with owner and response status, risks changed this period, EMV vs reserve, escalations.
