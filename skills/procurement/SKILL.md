---
name: procurement
description: Plan and control procurement — make-or-buy, contract types, source selection criteria, procurement schedule and supplier performance. Use for buying goods/services, tenders, contracts, supplier issues.
user-invocable: false
---

# Procurement / المشتريات

PMBOK 8 expands procurement coverage; treat it inside the Finance, Schedule and Risk domains.

## Plan (`.pmo/drafts/procurement-plan.md`)
1. Make-or-buy analysis per need (cost, capability, risk, time).
2. Contract type and why:
   - **Fixed price (FFP)** — clear scope, risk on seller (عقد بسعر ثابت)
   - **Cost-reimbursable (CPFF/CPIF)** — uncertain scope, risk on buyer (عقد التكلفة زائد)
   - **Time & material (T&M)** — staff augmentation, short work (عقد الوقت والمواد)
3. Source selection criteria with weights (price, technical, experience, delivery, local content).
4. Procurement schedule: RFQ/RFP → evaluation → award → delivery; link long-lead items as activities in `schedule.json` (they often sit on the critical path).
5. Supplier performance metrics: on-time delivery, quality defects, responsiveness.

## Control
- Track each procurement as an activity or milestone; late deliveries → risk/issue updates.
- Contract changes → change request through `change-control`.
- Payments and commitments feed `actualCost` in progress snapshots.
- Close procurements formally at closure (`closer`).

Single-source suppliers and import lead times are standard risk candidates.
