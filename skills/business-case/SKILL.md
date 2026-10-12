---
name: business-case
description: Structure a business case with options, costs, benefits, NPV/ROI/payback and recommendation — PMBOK 8 focus on value. Use when justifying a project or comparing investment options.
user-invocable: false
---

# Business case / دراسة الجدوى

## Structure
1. Problem / opportunity — المشكلة أو الفرصة
2. Strategic alignment — الارتباط بالاستراتيجية
3. Options (always include "do nothing") — الخيارات
4. For each option: costs (capex/opex), benefits (tangible with values, intangible), risks, timeline
5. Financial comparison — المقارنة المالية
6. Recommendation and conditions — التوصية
7. Benefits realisation: owner, measure, target, date — تحقيق المنافع

## Financial measures
- ROI = (total benefits − total costs) / total costs
- Payback period = time until cumulative net cash flow ≥ 0
- NPV = Σ (net cash flow_t / (1 + r)^t), t = 0…n, r = discount rate given by finance
- Benefit/cost ratio = PV(benefits) / PV(costs)

Compute these with a short script (e.g. `node -e`) from the cash-flow table the user confirms, show the table and the formula used, and state the discount rate. Never assume cash flows — ask.

Save to `.pmo/drafts/business-case.md`. It is an input to the charter, not a controlled record.
