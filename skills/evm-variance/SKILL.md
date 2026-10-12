---
name: evm-variance
description: Interpret earned value and variance analysis (PV, EV, AC, SV, CV, SPI, CPI) from the pmo engine, find root causes and thresholds breaches, and explain them in plain language. Use for variance analysis, cost/schedule performance, EVM questions.
user-invocable: false
---

# EVM & variance analysis / القيمة المكتسبة وتحليل الانحراف

All figures come from `evm` / `status` engine output. Never recompute.

## Meaning
| Metric | Formula | Read as |
|---|---|---|
| PV | planned value to date | work that should be done (in money) |
| EV | BAC × % complete | work actually done (in money) |
| AC | actual cost to date | money actually spent |
| SV = EV − PV | < 0 behind schedule | |
| CV = EV − AC | < 0 over budget | |
| SPI = EV / PV | < 1 behind | 0.91 → 91% of planned work done |
| CPI = EV / AC | < 1 over budget | 0.93 → each 1 spent earns 0.93 of work |

Thresholds come from `project.json.thresholds` (default green ≥ 0.95, amber ≥ 0.85, red below).

## Analysis steps
1. Current values vs thresholds → RAG.
2. Trend (`evm.trend`): direction over the last 3+ snapshots. A stable CPI after ~20% complete rarely improves much (state this as an empirical rule of thumb, not a certainty).
3. Root cause: which activities drive the variance — compare activity `percentComplete` vs plan, forecast `finishVarianceDays`, occurred risks, approved changes not yet re-baselined, cost booking timing (accruals) and % complete overstatement.
4. Distinguish **schedule** problems on the critical path from non-critical lateness (SPI can be low while the finish date is safe, and vice-versa — use the schedule forecast for dates).
5. SPI drifts to 1.0 near the end regardless of lateness; for late-stage date judgments rely on the forecast finish, not SPI.

## Explaining to stakeholders
One sentence per metric in plain language + the business consequence (e.g. "at the current cost efficiency the project will need about 37,500 SAR more than budgeted").
