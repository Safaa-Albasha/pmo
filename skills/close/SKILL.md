---
name: close
description: Close a phase or the whole project — closure checklist, final performance, acceptance, lessons learned, closure report, and the closing decision for approval. Use for "close the project", "phase gate", "handover", "lessons learned". إغلاق المشروع.
---

# Close / الإغلاق

Write in `project.language`. Use the `closer` agent (`pmo:closer`) or follow its instructions and the `lessons-learned` / `closure-report` skills.

1. Ask: close a phase (which one) or the project.
2. Run the closure checklist and show gaps (incomplete activities/items, unaccepted deliverables, open risks/issues/CRs, open procurements).
3. Final figures: `status`, `evm`, `schedule` at the closing date.
4. Lessons learned session (short, one question at a time) → `lessons.json`.
5. Draft the closure report in `.pmo/drafts/`; show the summary.
6. Propose the closure (`set project.json status "closed"` or the phase) and any risk/CR closures → `/pmo:approvals`. Gaps must be listed in the rationale.
