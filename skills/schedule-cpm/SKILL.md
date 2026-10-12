---
name: schedule-cpm
description: Build and analyse an activity network schedule with the critical path method — activities, durations, FS/SS/FF/SF dependencies with lags, float, critical path, baseline and progress-based forecast. Use for schedule development and schedule analysis.
user-invocable: false
---

# Schedule & critical path / الجدول والمسار الحرج

## Activity (`schedule.json → activities[]`, controlled)
```json
{ "id": "D", "name": "Construction / التنفيذ", "duration": 60,
  "predecessors": ["B", { "id": "C", "type": "SS", "lag": 5 }],
  "budget": 200000, "owner": "", "wbs": "1.3.2", "milestone": false,
  "percentComplete": 0, "baselineStart": null, "baselineFinish": null }
```
Durations are calendar days; finish dates are inclusive. Milestones have `duration: 0`.

## Building
1. Derive activities from WBS work packages (verbs: "Install racking").
2. Dependencies: default FS; use SS/FF with lag for overlap (fast-tracking); avoid SF unless truly needed.
3. Every activity except the first needs a predecessor and every activity except the last a successor (no dangling ends).
4. Estimate durations with the `estimation` skill.
5. Propose activities (one `add` each) → engine validates ids, dependencies, cycles.
6. `schedule` engine output → `planned` (critical path, total float, finish). Review with the manager, then propose `baseline`.

Progress is recorded in progress snapshots (`activityProgress` map), not by editing `schedule.json`: the plan and baseline stay controlled, progress stays a free record.

## Analysing (engine output only)
- `planned` = plan without progress; `forecast` = from the status date using `percentComplete` (in-progress work continues from the status date; not-started work cannot start before it).
- Critical path = activities with zero total float in the forecast; slip on them moves the finish date.
- `finishVarianceDays` per activity vs its baseline; `slipDays` project-level in `status`.
- Compression options when late: **crashing** (add resources on critical activities, raises cost) and **fast-tracking** (overlap with SS/FF, raises risk). Present both with trade-offs; changes go through `change-control` / `planner` proposals.
