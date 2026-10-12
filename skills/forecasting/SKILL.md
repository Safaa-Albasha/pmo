---
name: forecasting
description: Choose and explain cost and schedule forecasts — EAC methods, ETC, VAC, TCPI, progress-based finish date, agile release forecast — from pmo engine output. Use for "when will we finish", "how much will it cost", estimate at completion.
user-invocable: false
---

# Forecasting / التنبؤ

## Cost (engine `evm` → `eac`, `eacPrimary`, `etc`, `vac`, `tcpi`)
| EAC method | Formula | Use when |
|---|---|---|
| `typical` | BAC / CPI | current cost performance will continue (default) |
| `atypical` | AC + (BAC − EV) | variance was one-off; remaining work at planned rate |
| `cpiSpi` | AC + (BAC − EV) / (CPI × SPI) | schedule pressure will also drive cost (late and must catch up) |
| bottom-up | AC + new ETC estimate | the plan is no longer valid — re-estimate remaining work |

Present the range (lowest–highest of the three) and recommend one with a reason.

- ETC = EAC − AC; VAC = BAC − EAC (negative = overrun).
- TCPI(BAC) = (BAC − EV) / (BAC − AC): efficiency needed on remaining work to finish on budget. If TCPI(BAC) − CPI > 0.05, finishing on budget is unlikely → recommend re-forecast/approved EAC (TCPI(EAC)).

## Schedule
- Waterfall/hybrid: `status.schedule.forecastFinish` (progress-based CPM from the status date) vs `baselineFinish` (`slipDays`) and `deadline` (`deadlineVarianceDays`); name the forecast critical path.
- Agile: `agile.forecastFinish` = last sprint end + sprints remaining × sprint length, where sprints remaining = ceil(remaining points / velocity). Give a range using min/max velocity of recent sprints if asked (compute with a short script and show it).
- Uncertainty: for three-point estimates use the `estimation` skill (σ path).

Always state the status date and the assumptions behind each forecast.
