---
name: estimation
description: Estimate durations, effort and cost with PMI techniques — analogous, parametric, three-point (PERT/triangular), bottom-up, and story points — with confidence ranges. Use when estimating activities, work packages, stories or budgets.
user-invocable: false
---

# Estimation / التقدير

| Technique | When | How |
|---|---|---|
| Analogous (تقدير تناظري) | early, little detail | scale from a similar past project; state the reference and adjustment |
| Parametric (بارامتري) | a unit rate exists | quantity × rate (e.g. 2,000 m² × 25 SAR/m²) |
| Three-point PERT (ثلاثي) | uncertainty matters | E = (O + 4M + P) / 6, σ = (P − O) / 6 |
| Triangular | no reason to weight M | E = (O + M + P) / 3 |
| Bottom-up (من الأسفل للأعلى) | detailed WBS | sum work-package estimates |
| Story points (نقاط القصة) | agile | relative sizing, Fibonacci, team estimates (planning poker) |

## Ranges
- Activity: E ± σ (≈68%), E ± 2σ (≈95%).
- Path/project: E_path = Σ E; σ_path = √(Σ σ²) for independent activities on the critical path.
- Rough order of magnitude early on: −25% … +75%; definitive: −5% … +10%.

## Rules
- Compute with a short script (`node -e`) and show inputs; do not do arithmetic in your head.
- Record the technique, basis of estimate and assumptions next to each estimate (activity `notes` or WBS dictionary).
- Ask the owner of the work for O/M/P values; never invent them.
- Contingency reserve can be set from the risk EMV total (`risk` engine output) or from the P80 of the range — state which.
