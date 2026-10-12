'use strict';

const MESSAGES = {
  FILE_MISSING: { en: 'Required file is missing: {file}', ar: 'ملف مطلوب غير موجود: {file}' },
  JSON_INVALID: { en: 'File {file} is not valid JSON: {detail}', ar: 'الملف {file} ليس JSON صالحًا: {detail}' },
  FIELD_REQUIRED: { en: '{file}: field "{field}" is required', ar: '{file}: الحقل "{field}" مطلوب' },
  ENUM_INVALID: { en: '{file}: "{field}" must be one of: {allowed}', ar: '{file}: قيمة "{field}" يجب أن تكون إحدى: {allowed}' },
  DATE_INVALID: { en: '{file}: "{field}" must be a valid date YYYY-MM-DD', ar: '{file}: "{field}" يجب أن يكون تاريخًا صحيحًا بصيغة YYYY-MM-DD' },
  DATE_ORDER: { en: '{file}: "{start}" must be on or before "{end}"', ar: '{file}: "{start}" يجب أن يكون في أو قبل "{end}"' },
  NUMBER_RANGE: { en: '{file}: "{field}" must be a number between {min} and {max}', ar: '{file}: "{field}" يجب أن يكون رقمًا بين {min} و{max}' },
  ID_DUPLICATE: { en: '{file}: duplicate id "{id}"', ar: '{file}: المعرّف "{id}" مكرر' },
  PRED_UNKNOWN: { en: '{file}: activity "{id}" depends on unknown activity "{pred}"', ar: '{file}: النشاط "{id}" يعتمد على نشاط غير موجود "{pred}"' },
  DEP_TYPE_INVALID: { en: '{file}: activity "{id}" has invalid dependency type "{type}" (use FS, SS, FF, SF)', ar: '{file}: النشاط "{id}" فيه نوع اعتماد غير صحيح "{type}" (استخدم FS أو SS أو FF أو SF)' },
  CYCLE: { en: '{file}: circular dependency between activities: {ids}', ar: '{file}: اعتماد دائري بين الأنشطة: {ids}' },
  PV_DECREASING: { en: 'budget.json: cumulative plannedValue must not decrease (at {date})', ar: 'budget.json: القيمة المخططة التراكمية لا يجب أن تنقص (عند {date})' },
  NO_PROGRESS: { en: 'No progress snapshot on or before {date} in progress/', ar: 'لا توجد لقطة تقدم في أو قبل {date} داخل progress/' },
  VALIDATION_FAILED: { en: 'Project data has {count} error(s); run validate for details', ar: 'بيانات المشروع فيها {count} خطأ؛ شغّل validate للتفاصيل' },
  PROJECT_EXISTS: { en: 'A project already exists in {dir}', ar: 'يوجد مشروع مسبقًا في {dir}' },
  ARG_MISSING: { en: 'Missing argument --{arg}', ar: 'المعامل --{arg} مفقود' },
  UNKNOWN_COMMAND: { en: 'Unknown command "{cmd}". Available: {commands}', ar: 'أمر غير معروف "{cmd}". الأوامر المتاحة: {commands}' },
  EVM_UNAVAILABLE: { en: 'EVM not computed: budget.json or progress snapshots are missing', ar: 'لم يُحسب EVM: ملف budget.json أو لقطات التقدم غير موجودة' },
  SCHEDULE_EMPTY: { en: 'Schedule has no activities yet', ar: 'الجدول لا يحتوي على أنشطة بعد' },
  OP_INVALID: { en: 'Unknown operation "{op}". Use add, update, set, baseline or document', ar: 'عملية غير معروفة "{op}". استخدم add أو update أو set أو baseline أو document' },
  FILE_NOT_ALLOWED: { en: 'Operation "{op}" is not allowed on {file}', ar: 'العملية "{op}" غير مسموحة على {file}' },
  ITEM_NOT_FOUND: { en: '{file}: no item with id "{id}"', ar: '{file}: لا يوجد عنصر بالمعرّف "{id}"' },
  APPROVAL_RESOLVED: { en: 'Approval {id} is already {status}', ar: 'طلب الموافقة {id} تمت معالجته مسبقًا ({status})' },
  PROPOSAL_STALE: { en: 'Approval {id} is stale: the data changed since it was proposed. Reject it and propose again', ar: 'طلب الموافقة {id} قديم: تغيّرت البيانات بعد اقتراحه. ارفضه واقترحه من جديد' },
  IMPORT_FORMAT: { en: 'Cannot import {file}: use .csv, .xlsx or .json (save old .xls files as .xlsx or .csv)', ar: 'لا يمكن استيراد {file}: استخدم ‎.csv أو ‎.xlsx أو ‎.json (احفظ ملفات ‎.xls القديمة بصيغة ‎.xlsx أو ‎.csv)' },
  IMPORT_SHEET: { en: 'Sheet "{sheet}" not found. Sheets: {sheets}', ar: 'الورقة "{sheet}" غير موجودة. الأوراق المتاحة: {sheets}' },
  GUARD_DENY_FILE: { en: 'PMO guard: {file} is a controlled record. Propose the change (engine propose) and approve it with /pmo:approvals', ar: 'حارس PMO: الملف {file} سجل محمي. اقترح التغيير (engine propose) ووافق عليه عبر /pmo:approvals' },
  GUARD_DENY_SHELL: { en: 'PMO guard: shell commands may not modify or delete controlled .pmo records. Use the engine and /pmo:approvals', ar: 'حارس PMO: لا يُسمح لأوامر الطرفية بتعديل أو حذف سجلات .pmo المحمية. استخدم المحرّك و/pmo:approvals' },
  GUARD_ASK_APPLY: { en: 'PMO approval: confirm that the project manager decided this ({cmd})', ar: 'موافقة PMO: أكّد أن مدير المشروع اتخذ هذا القرار ({cmd})' },
  GUARD_ASK_MCP: { en: 'PMO: {tool} writes to or sends via an external tool. Confirm before it runs', ar: 'PMO: الأداة {tool} تكتب أو ترسل عبر نظام خارجي. أكّد قبل التنفيذ' },
};

function format(code, params = {}) {
  const m = MESSAGES[code] || { en: code, ar: code };
  const fill = (t) => t.replace(/\{(\w+)\}/g, (_, k) => (params[k] !== undefined ? String(params[k]) : `{${k}}`));
  return { en: fill(m.en), ar: fill(m.ar) };
}

module.exports = { MESSAGES, format };
