---
name: sprint
description: Plan, review or close a sprint for agile and hybrid projects — velocity, capacity, sprint goal, burndown, remaining points and release forecast. Use for "sprint planning", "sprint review", "close the sprint", "velocity". السبرنت.
---

# Sprint / السبرنت

Write in `project.language`. Agile/hybrid only — for waterfall say so and offer `/pmo:status`. Use the `agile-coach` agent (`pmo:agile-coach`) or follow its instructions and the `sprint-planning` / `agile-metrics` skills.

1. `node "${CLAUDE_PLUGIN_ROOT}/engine/cli.js" agile --dir .pmo`
2. Ask: plan the next sprint · review/close the active sprint · show metrics.
3. Plan: capacity question (team days, holidays), select ready items to ~velocity, sprint goal; write `scope/backlog.json`; `validate`.
4. Review/close: confirm which items met the definition of done; update items and the sprint; add the progress snapshot; re-run `agile` and report done/remaining points, velocity and forecast finish vs project end date; capture retro actions.
5. Release date or budget impact → offer `/pmo:change`.
