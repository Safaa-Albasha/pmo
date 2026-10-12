---
name: change
description: Submit or review a change request — capture it, analyse impact on scope, schedule, cost, quality and risk with the engine, and queue it for the project manager's decision. Use for "change request", "scope change", "we need more time/budget". طلب تغيير.
---

# Change request / طلب تغيير

Write in `project.language`. Use the `change-control` agent (`pmo:change-control`) or follow its instructions and the `change-control` skill.

1. If the user describes a new change: capture requester, description, reason, urgency (one question at a time).
2. Check tailoring: for agile in-sprint backlog changes, explain that the product owner decides via the backlog and stop unless date/budget/contract are affected.
3. Impact analysis with engine outputs (`status`, `schedule`, `evm`, `risk`); show an impact table and 2+ options with a recommendation.
4. Propose `add` on `changes.json` (status `submitted`) and, if the user wants a decision now, the decision `update`. List APR ids → `/pmo:approvals`.
5. With no new change: list `changes.json` items by status with their impact and age.
