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
};

function format(code, params = {}) {
  const m = MESSAGES[code] || { en: code, ar: code };
  const fill = (t) => t.replace(/\{(\w+)\}/g, (_, k) => (params[k] !== undefined ? String(params[k]) : `{${k}}`));
  return { en: fill(m.en), ar: fill(m.ar) };
}

module.exports = { MESSAGES, format };
