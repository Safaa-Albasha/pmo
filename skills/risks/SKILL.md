---
name: risks
description: Risk register workspace — show the heat map and top risks, review and re-score risks, identify new threats or opportunities, and propose register changes for approval. Use for "risks", "risk register", "add a risk", "risk review". سجل المخاطر.
---

# Risks / المخاطر

Write in `project.language`. Use the `risk-manager` agent (`pmo:risk-manager`) or follow its instructions and the `risk-planning` / `risk-monitoring` skills.

1. `node "${CLAUDE_PLUGIN_ROOT}/engine/cli.js" risk --dir .pmo`
2. Show:
   - counts (open/closed, high/medium/low) and open-risk EMV vs contingency reserve (`budget.json`);
   - a 5×5 text heat map from `heatmap` (rows probability 5→1, columns impact 1→5, cell = count);
   - top 5: id, title, score, level, owner, response.
3. Ask what the user wants: review all · add a risk · update a specific risk · close a risk.
4. For each change create one proposal (see `approval-protocol`) and list the APR ids; offer `/pmo:approvals`.

Never edit `risks.json` directly.
