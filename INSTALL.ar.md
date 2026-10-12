<div dir="rtl">

# دليل التنزيل والتركيب: PMO لـ Claude Code

[English](INSTALL.md)

يستغرق التركيب حوالي **15 دقيقة**، ولا يحتاج خبرة برمجية. ستكتب بعض الأوامر في **الطرفية**:
- **في Windows:** افتح قائمة "ابدأ"، واكتب **PowerShell** أو **Terminal**، ثم افتحه.
- **في Mac:** افتح تطبيق **Terminal** من مجلد Utilities.

كل أمر مكتوب في مربع مستقل. انسخه كما هو، والصقه في الطرفية، ثم اضغط Enter.

---

## ما تحتاجه قبل البدء

| المتطلب | ملاحظة |
|---|---|
| اشتراك Claude | Pro أو Max أو Team أو Enterprise، أو حساب Claude Console |
| Node.js الإصدار 18 أو أحدث | مجاني، والخطوة 1 تشرح تثبيته |
| اتصال بالإنترنت | للتثبيت فقط، فالتقارير تعمل بعدها بدون إنترنت |
| Git (في Windows) | يُثبَّت عادةً مع Claude Code، وإن لم يوجد فثبّته من git-scm.com |

---

## الخطوة 1: تثبيت Node.js

1. ادخل إلى **https://nodejs.org**، ونزّل نسخة **LTS**، ثم ثبّتها بالضغط على "Next" حتى النهاية.
2. أغلق الطرفية وافتحها من جديد.
3. تأكد من نجاح التثبيت:

```bash
node --version
```

يجب أن يظهر رقم مثل `v22.x.x` أو أعلى، والمهم أن يكون أكبر من 18.

---

## الخطوة 2: تثبيت Claude Code

**في Windows** (داخل PowerShell):

```powershell
irm https://claude.ai/install.ps1 | iex
```

**في Mac أو Linux:**

```bash
curl -fsSL https://claude.ai/install.sh | bash
```

بعد اكتمال التثبيت، شغّل Claude Code:

```bash
claude
```

سيفتح المتصفح لتسجيل الدخول بحساب Claude. بعدها اكتب `/exit` للخروج.

> إذا كان Claude Code مثبتًا عندك مسبقًا، فانتقل مباشرة للخطوة 3.

---

## الخطوة 3: تنزيل وتركيب الـ plugin

في الطرفية، شغّل الأمرين التاليين بالترتيب:

```bash
claude plugin marketplace add Safaa-Albasha/pmo
```

```bash
claude plugin install pmo@pmo
```

**طريقة بديلة:** يمكنك كتابة الأمرين نفسيهما من داخل Claude Code، بعد تشغيل `claude`:

```
/plugin marketplace add Safaa-Albasha/pmo
/plugin install pmo@pmo
```

ثم **أغلق Claude Code وافتحه من جديد** حتى تُحمَّل الأوامر.

---

## الخطوة 4: التأكد من نجاح التركيب

```bash
claude plugin list
```

يجب أن ترى `pmo` في القائمة، وبجانبها حالة التفعيل (enabled).

---

## الخطوة 5: أول مشروع

1. أنشئ مجلدًا لمشروعك، مثلًا `Documents/مشروع-المستودع`.
2. افتح الطرفية داخل المجلد. في Windows: افتح المجلد، ثم اضغط بالزر الأيمن واختر **Open in Terminal**.
3. شغّل Claude Code:

```bash
claude
```

4. اكتب أمر الإعداد. يفحص جاهزية جهازك، ويعرض أدوات الربط المتاحة:

```
/pmo:setup
```

5. أنشئ المشروع، ثم أجب عن الأسئلة (الاسم، والمنهجية، واللغة، والعملة، والتواريخ، والميزانية):

```
/pmo:new
```

بعدها تستطيع استخدام بقية الأوامر:

| الأمر | الوظيفة |
|---|---|
| `/pmo:status` | حالة المشروع |
| `/pmo:weekly` | الدورة الأسبوعية الكاملة |
| `/pmo:approvals` | القرارات التي تنتظر موافقتك |
| `/pmo:report` | التقرير التفاعلي والعرض |
| `/pmo:import` | الاستيراد من Excel أو Jira أو MS Project |

أو اكتب طلبك بلغة عادية، مثل: «كيف حال المشروع؟»

### تريد التجربة قبل البدء بمشروعك؟

1. من صفحة المستودع على GitHub ‏(https://github.com/Safaa-Albasha/pmo)، اضغط **Code** ثم **Download ZIP**، وفك الضغط عن الملف.
2. انسخ مجلد `examples/waterfall` إلى أي مكان على جهازك.
3. افتح الطرفية داخله، وشغّل `claude`، ثم اكتب `/pmo:status`.
4. لرؤية التقرير التفاعلي جاهزًا، افتح الملف `examples/sample-report-waterfall.html` في المتصفح.

---

## الخطوة 6 (اختيارية): ربط أدواتك

شغّل `/pmo:setup` واختر الأدوات التي يستخدمها فريقك:

- **Jira وConfluence، وAsana، وLinear، وmonday.com، وClickUp:** يضيفها الإعداد بعد موافقتك. بعدها اكتب `/mcp` داخل Claude Code، واختر الأداة، وسجّل الدخول بحسابك في المتصفح.
- **Slack، وMicrosoft 365، وGoogle Drive، وGmail:** فعّلها من موقع claude.ai: **الإعدادات** ثم **الموصلات (Connectors)**، واستخدم نفس الحساب في Claude Code.
- **MS Project وPlanner:** صدّر الخطة إلى Excel أو CSV، ثم استخدم `/pmo:import`.

> لن يُطلب منك أبدًا كتابة كلمة مرور أو مفتاح API داخل المحادثة.

---

## التحديث لإصدار جديد

```bash
claude plugin marketplace update pmo
```

```bash
claude plugin update pmo@pmo
```

ثم أعد تشغيل Claude Code.

## إزالة الـ plugin

```bash
claude plugin uninstall pmo@pmo
```

بيانات مشاريعك في مجلدات `.pmo` **لا تُحذف**، وتبقى ملكك.

---

## حل المشاكل الشائعة

| المشكلة | الحل |
|---|---|
| `node` غير معروف | أعد تثبيت Node.js من nodejs.org، ثم أغلق الطرفية وافتحها من جديد |
| الأوامر `/pmo:...` لا تظهر | أعد تشغيل Claude Code. تأكد أن `claude plugin list` يعرض pmo مفعّلة، وإلا شغّل `claude plugin enable pmo@pmo` |
| `marketplace add` فشل | تأكد من الاتصال بالإنترنت ووجود Git (في Windows ثبّته من git-scm.com)، ثم أعد المحاولة |
| يظهر طلب تأكيد عند الموافقة على القرارات | هذا متعمّد: هو حارس الموافقات الذي يتأكد أن القرار قرارك أنت |
| رفض تعديل ملف مثل `risks.json` | هذا متعمّد أيضًا: السجلات المحمية تتغير فقط عبر `/pmo:approvals` |
| أداة الربط تطلب تسجيل دخول | اكتب `/mcp` داخل Claude Code وسجّل الدخول، أو فعّلها من موصلات claude.ai |
| الحروف العربية تظهر مقطّعة في الطرفية | استخدم **Windows Terminal** بدل الطرفية القديمة. التقارير نفسها تظهر سليمة في المتصفح |
| التقرير لا يحتوي أقسامًا معينة | التقرير يذكر السبب في قسم "أقسام غير مضمّنة"، وغالبًا تكون البيانات غير موجودة بعد |

**تحتاج مساعدة؟** افتح Issue على GitHub ‏(https://github.com/Safaa-Albasha/pmo/issues).

</div>
