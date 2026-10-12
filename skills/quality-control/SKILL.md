---
name: quality-control
description: Measure and analyse quality — metrics vs targets, defect trends, Pareto of causes, control limits — and recommend corrective/preventive actions from quality.json. Use for quality status, defect analysis, audits results.
user-invocable: false
---

# Quality control / ضبط الجودة

## Steps
1. Read `quality.json`. For each metric take the latest value: meets target if (`direction` = "max" and value ≤ target) or ("min" and value ≥ target).
2. Trend: last 3+ values improving / stable / worsening.
3. Defects: open by severity, opened vs closed this period, average age of open defects, reopen count.
4. Pareto: group defects by cause/deliverable; the top 20% causes usually explain ~80% of defects — focus actions there.
5. Control limits (optional, ≥ 8 values): mean ± 3σ; points outside or 7 in a row on one side signal a special cause.
6. Compute counts/means with a short script; show the numbers you used.

## Actions
- Corrective (fix the cause of an existing problem) vs preventive (stop it happening).
- Actions changing scope/schedule/cost → change request; others → issue with owner and due date.
- Critical defects on deliverables near acceptance → risk to milestone; inform `risk-manager`.

## Scorecard
| Metric | Target | Actual | Trend | Status |
Plus defect summary and top 3 actions.
