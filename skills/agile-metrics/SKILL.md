---
name: agile-metrics
description: Interpret agile metrics from the pmo engine — velocity, burndown/burnup, remaining points, release forecast, AgileEVM, predictability — and spot warning signs. Use for agile progress, "how many points are left", release forecast.
user-invocable: false
---

# Agile metrics / مقاييس Agile

Engine `agile` output: `velocity`, `totalPoints`, `donePoints`, `remainingPoints`, `percentDone`, `sprintsCompleted`, `sprintsRemaining`, `forecastFinish`, `activeSprint`, `burnup`, `burndown`, `agileEvm` (`ppc`, `apc`, PV/EV/AC, SPI/CPI, EAC…).

## Reading them
- **Velocity**: average of the last 3 closed sprints; watch variability (> ±20% sprint-to-sprint makes forecasts weak).
- **Burnup**: completed vs scope line — scope line rising = scope growth (report it); completed flattening = delivery problem.
- **Burndown**: remaining per sprint; plateaus = no done work (often work not meeting DoD).
- **Forecast**: `forecastFinish` vs project `endDate` → buffer or slip in days.
- **Predictability**: completed ÷ planned points per sprint (healthy 80–100%).
- **AgileEVM**: PPC = sprints done / planned sprints; APC = points done / total points; SPI = APC/PPC; CPI = EV/AC (needs `actualCost` in progress snapshots).

## Warning signs
Velocity falling 2+ sprints · predictability < 70% · scope growth > 10% of release · many items "doing" at sprint end · large carry-over · no actual cost recorded (AgileEVM CPI unavailable).

Report "done / remaining points" exactly from the engine.
