// Single source of truth for the tenant-configurable service-request form.
// Shared by the server (settings route, requests routes) and the client
// (the shared ServiceRequestForm renderer + the admin form builder).
//
// The whole point: an admin decides — per field — whether it shows, whether it
// is required, what its label says, in what order fields appear, plus any extra
// custom fields and the inspection-fee amount. A tenant that has never saved a
// config gets DEFAULT_SERVICE_FORM_CONFIG, which reproduces the current form
// exactly, so existing businesses are unaffected until they change something.

export type BuiltinFieldKey =
  | 'storeName'
  | 'toolOwnerName'
  | 'toolOwnerPhone'
  | 'issueDescription'
  | 'repairLevel'
  | 'warranty'
  | 'preApprovedBudget'
  | 'comments'
  | 'toolImages'
  | 'inspectionFee';

export type CustomFieldType = 'text' | 'textarea' | 'tel';

export type FormFieldType = 'builtin' | CustomFieldType;

export interface FormField {
  /** Stable id. Built-in fields use their BuiltinFieldKey; custom fields use a generated id. */
  id: string;
  builtin: boolean;
  /** For built-ins this equals the BuiltinFieldKey. For custom fields it equals the id. */
  key: string;
  type: FormFieldType;
  /** Admin-editable label shown on the form. */
  label: string;
  /** Show/hide toggle. */
  enabled: boolean;
  /** Required/optional toggle (only meaningful where the field takes free input). */
  required: boolean;
  /** Custom fields only: optional placeholder text. */
  placeholder?: string;
}

export interface ServiceFormConfig {
  /** Ordered — the array order is the display order. */
  fields: FormField[];
  /** Inspection-fee amount (₪) shown in the agreement text. */
  inspectionFeeAmount: number;
}

/** Metadata for each built-in field: default label + whether the required/label toggles apply. */
export const BUILTIN_FIELD_META: Record<
  BuiltinFieldKey,
  { defaultLabel: string; hasRequiredToggle: boolean; canEditLabel: boolean; canDisable: boolean }
> = {
  storeName: { defaultLabel: 'שם החנות', hasRequiredToggle: true, canEditLabel: true, canDisable: true },
  toolOwnerName: { defaultLabel: 'שם בעל הכלי', hasRequiredToggle: true, canEditLabel: true, canDisable: true },
  toolOwnerPhone: { defaultLabel: 'מספר טלפון בעל הכלי', hasRequiredToggle: true, canEditLabel: true, canDisable: true },
  issueDescription: { defaultLabel: 'מה התקלה בכלי?', hasRequiredToggle: true, canEditLabel: true, canDisable: true },
  repairLevel: { defaultLabel: 'לאיזו רמה תרצו שנגיע בתיקון?', hasRequiredToggle: true, canEditLabel: true, canDisable: true },
  warranty: { defaultLabel: 'האם יש אחריות לכלי?', hasRequiredToggle: false, canEditLabel: true, canDisable: true },
  preApprovedBudget: { defaultLabel: 'אישור תקציב לתיקון מראש', hasRequiredToggle: false, canEditLabel: true, canDisable: true },
  comments: { defaultLabel: 'הערות נוספות לצוות המעבדה', hasRequiredToggle: true, canEditLabel: true, canDisable: true },
  toolImages: { defaultLabel: 'צילומים של הכלי', hasRequiredToggle: true, canEditLabel: true, canDisable: true },
  inspectionFee: { defaultLabel: 'אישור דמי בדיקה', hasRequiredToggle: false, canEditLabel: true, canDisable: true },
};

/** Canonical order of built-in fields in a fresh config. */
const BUILTIN_ORDER: BuiltinFieldKey[] = [
  'storeName',
  'toolOwnerName',
  'toolOwnerPhone',
  'issueDescription',
  'repairLevel',
  'warranty',
  'preApprovedBudget',
  'comments',
  'toolImages',
  'inspectionFee',
];

/** Default enabled/required per built-in — mirrors the current hard-coded forms. */
const BUILTIN_DEFAULTS: Record<BuiltinFieldKey, { enabled: boolean; required: boolean }> = {
  storeName: { enabled: true, required: true },
  toolOwnerName: { enabled: true, required: true },
  toolOwnerPhone: { enabled: true, required: false },
  issueDescription: { enabled: true, required: true },
  repairLevel: { enabled: true, required: true },
  warranty: { enabled: true, required: false },
  preApprovedBudget: { enabled: true, required: false },
  comments: { enabled: true, required: false },
  toolImages: { enabled: true, required: true },
  inspectionFee: { enabled: true, required: true },
};

export const DEFAULT_INSPECTION_FEE_AMOUNT = 150;
export const PRE_APPROVED_MIN_AMOUNT = 500;

function makeBuiltinField(key: BuiltinFieldKey): FormField {
  return {
    id: key,
    builtin: true,
    key,
    type: 'builtin',
    label: BUILTIN_FIELD_META[key].defaultLabel,
    enabled: BUILTIN_DEFAULTS[key].enabled,
    required: BUILTIN_DEFAULTS[key].required,
  };
}

export function defaultServiceFormConfig(): ServiceFormConfig {
  return {
    fields: BUILTIN_ORDER.map(makeBuiltinField),
    inspectionFeeAmount: DEFAULT_INSPECTION_FEE_AMOUNT,
  };
}

/** A stable default object for read-only consumers. Do not mutate. */
export const DEFAULT_SERVICE_FORM_CONFIG: ServiceFormConfig = defaultServiceFormConfig();

const CUSTOM_TYPES: CustomFieldType[] = ['text', 'textarea', 'tel'];

/**
 * Merge an untrusted raw value (from Mongo or a form POST) with the defaults so
 * every built-in exists exactly once, order is preserved, custom fields survive,
 * and every value is type-safe. Critical for backward compatibility.
 */
export function normalizeServiceFormConfig(raw: unknown): ServiceFormConfig {
  const base = defaultServiceFormConfig();
  if (!raw || typeof raw !== 'object') return base;

  const obj = raw as Partial<ServiceFormConfig>;
  const rawFields = Array.isArray(obj.fields) ? obj.fields : [];

  // Index built-in defaults so we can fill in missing props from partial data.
  const builtinDefaultById = new Map(base.fields.map((f) => [f.id, f]));

  const seenBuiltins = new Set<string>();
  const result: FormField[] = [];

  for (const rf of rawFields) {
    if (!rf || typeof rf !== 'object') continue;
    const f = rf as Partial<FormField>;

    if (f.builtin && typeof f.key === 'string' && builtinDefaultById.has(f.key)) {
      if (seenBuiltins.has(f.key)) continue; // dedupe
      seenBuiltins.add(f.key);
      const def = builtinDefaultById.get(f.key)!;
      result.push({
        ...def,
        label: typeof f.label === 'string' && f.label.trim() ? f.label : def.label,
        enabled: typeof f.enabled === 'boolean' ? f.enabled : def.enabled,
        required: typeof f.required === 'boolean' ? f.required : def.required,
      });
    } else if (!f.builtin) {
      // Custom field.
      const type: CustomFieldType = CUSTOM_TYPES.includes(f.type as CustomFieldType)
        ? (f.type as CustomFieldType)
        : 'text';
      const id = typeof f.id === 'string' && f.id.trim() ? f.id : `custom_${Math.random().toString(36).slice(2, 10)}`;
      result.push({
        id,
        builtin: false,
        key: id,
        type,
        label: typeof f.label === 'string' && f.label.trim() ? f.label : 'שדה חדש',
        enabled: typeof f.enabled === 'boolean' ? f.enabled : true,
        required: typeof f.required === 'boolean' ? f.required : false,
        placeholder: typeof f.placeholder === 'string' ? f.placeholder : undefined,
      });
    }
  }

  // Append any built-in that the saved config never mentioned (e.g. a newly
  // introduced field), so upgrades don't silently drop fields.
  for (const def of base.fields) {
    if (!seenBuiltins.has(def.id)) result.push({ ...def });
  }

  const fee = Number((obj as ServiceFormConfig).inspectionFeeAmount);
  const inspectionFeeAmount =
    Number.isFinite(fee) && fee >= 0 ? Math.round(fee) : DEFAULT_INSPECTION_FEE_AMOUNT;

  return { fields: result, inspectionFeeAmount };
}

/** Convenience lookups used by renderers and validators. */
export function getField(config: ServiceFormConfig, key: string): FormField | undefined {
  return config.fields.find((f) => f.key === key);
}

export function isFieldEnabled(config: ServiceFormConfig, key: BuiltinFieldKey): boolean {
  const f = getField(config, key);
  return f ? f.enabled : true;
}

export function isFieldRequired(config: ServiceFormConfig, key: BuiltinFieldKey): boolean {
  const f = getField(config, key);
  return f ? f.enabled && f.required : false;
}
