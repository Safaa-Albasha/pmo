---
name: stakeholder-analysis
description: Identify and analyse stakeholders (power/interest, attitude, engagement level) and maintain stakeholders.json — PMBOK 8 Stakeholders domain. Use when identifying stakeholders, planning engagement or communications.
user-invocable: false
---

# Stakeholder analysis / تحليل أصحاب المصلحة

## Record (`stakeholders.json → stakeholders[]`, free record)
```json
{ "id": "SH-01", "name": "", "role": "", "organization": "", "power": 1-5, "interest": 1-5,
  "attitude": "supporter|neutral|resistor", "current": "unaware|resistant|neutral|supportive|leading",
  "desired": "unaware|resistant|neutral|supportive|leading", "language": "ar|en",
  "communication": { "channel": "email|teams|slack|meeting", "frequency": "weekly|monthly|milestone" }, "notes": "" }
```

## Steps
1. Identify: sponsor, steering committee, customer/users, team leads, functional managers, suppliers, regulators, operations/support, finance, procurement, legal, community.
2. Score power and interest (1–5).
3. Classify on the power/interest grid:
   - power ≥ 3 & interest ≥ 3 → **Manage closely / إدارة عن قرب**
   - power ≥ 3 & interest < 3 → **Keep satisfied / إبقاء راضٍ**
   - power < 3 & interest ≥ 3 → **Keep informed / إبقاء على اطلاع**
   - otherwise → **Monitor / مراقبة**
4. Engagement gap: current vs desired level; for each gap ≥ 1 level write one engagement action.
5. Preferred language and channel feed the `comms-plan`.

Run `validate` after writing. Resistant high-power stakeholders are also risk candidates for `risk-manager`.
