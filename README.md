# pmo — AI Project Management Office / مكتب إدارة مشاريع ذكي

Claude Code plugin aligned with the PMI PMBOK® Guide 8th Edition. Arabic & English. Waterfall, agile, hybrid.

plugin لـ Claude Code متوافقة مع دليل PMBOK الإصدار الثامن. عربي وإنجليزي. تنبؤي ورشيق وهجين.

## Commands / الأوامر
- `/pmo:new` — create a project / إنشاء مشروع
- `/pmo:status` — project health / صحة المشروع
- `/pmo:report` — interactive report & presentation / التقرير التفاعلي والعرض
- `/pmo:weekly` — full weekly PMO cycle / الدورة الأسبوعية الكاملة
- `/pmo:approvals` — decide pending proposals / الموافقات المعلّقة
- `/pmo:risks` — risk register / سجل المخاطر
- `/pmo:change` — change requests / طلبات التغيير
- `/pmo:sprint` — sprint planning & review / السبرنت
- `/pmo:close` — phase or project closure / الإغلاق

## Agents / الوكلاء
pmo-lead · initiation · planner · controller · risk-manager · quality-manager · change-control · agile-coach · reporter · integrator · closer

## Governance / الحوكمة
Agents analyse and draft freely, but controlled records (charter, schedule, budget, risks, changes, baseline) change only through proposals that the project manager approves in `/pmo:approvals`. A hook blocks direct edits; every decision is logged in `.pmo/decisions.json`.

يحلل الوكلاء ويكتبون المسودات بحرية، لكن السجلات المحمية لا تتغير إلا عبر مقترحات يوافق عليها مدير المشروع. يمنع Hook التعديل المباشر، ويُسجَّل كل قرار في `.pmo/decisions.json`.

Requires Node.js 18+ / يتطلب Node.js 18 أو أحدث.
