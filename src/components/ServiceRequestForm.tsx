'use client';

import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Store, User, Phone, ShieldCheck, ShieldAlert, UploadCloud,
  Check, AlertCircle, Trash2, Loader2, FileText, Camera, Image,
} from 'lucide-react';
import { Customer, ServiceRequest } from '@/lib/db';
import {
  ServiceFormConfig, FormField, PRE_APPROVED_MIN_AMOUNT,
} from '@/lib/serviceFormConfig';

type FormContext = 'portal' | 'public' | 'admin' | 'preview';

interface ServiceRequestFormProps {
  config: ServiceFormConfig;
  customer: Customer;
  tenantId: string;
  context: FormContext;
  /** Defaults to `/api/${tenantId}/requests`. Admin passes the direct endpoint. */
  endpoint?: string;
  /** Extra string fields appended to the payload (e.g. driverId for admin). */
  extraPayload?: Record<string, string>;
  /** Rendered above the fields (e.g. admin customer/driver selectors). */
  headerSlot?: React.ReactNode;
  /** Called with the created request on success; parent shows its own success UI. */
  onSuccess?: (request: ServiceRequest) => void;
  /** Preview mode — inputs disabled, no submit. Used by the admin form builder. */
  readOnly?: boolean;
  submitLabel?: string;
}

const inputClass =
  'w-full px-4 py-3.5 rounded-xl border border-gray-200 bg-gray-50/40 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 text-gray-800 transition-all duration-200 text-sm font-medium';

function RequiredMark({ required }: { required: boolean }) {
  return required ? <span className="text-red-500">*</span> : <span className="text-gray-400 font-normal text-xs">(אופציונלי)</span>;
}

export default function ServiceRequestForm({
  config,
  customer,
  tenantId,
  context,
  endpoint,
  extraPayload,
  headerSlot,
  onSuccess,
  readOnly = false,
  submitLabel = 'שלח קריאת שירות',
}: ServiceRequestFormProps) {
  const derivedStoreName = `${customer.firstName} ${customer.lastName}`.trim();

  const [storeName, setStoreName] = useState(derivedStoreName);
  const [toolOwnerName, setToolOwnerName] = useState('');
  const [toolOwnerPhone, setToolOwnerPhone] = useState('');
  const [issueDescription, setIssueDescription] = useState('');
  const [hasWarranty, setHasWarranty] = useState<'yes' | 'no'>('no');
  const [toolImages, setToolImages] = useState<File[]>([]);
  const [toolImagePreviews, setToolImagePreviews] = useState<string[]>([]);
  const [warrantyReceiptImage, setWarrantyReceiptImage] = useState<File | null>(null);
  const [warrantyReceiptPreview, setWarrantyReceiptPreview] = useState<string | null>(null);
  const [agreedToInspectionFee, setAgreedToInspectionFee] = useState(false);
  const [comments, setComments] = useState('');
  const [repairLevel, setRepairLevel] = useState<'RIDE_ONLY' | 'SAFE_RIDE' | 'LIKE_NEW' | ''>('');
  const [isPreApprovedBudgetEnabled, setIsPreApprovedBudgetEnabled] = useState(false);
  const [preApprovedAmount, setPreApprovedAmount] = useState<string>(String(PRE_APPROVED_MIN_AMOUNT));
  const [preApprovedNotes, setPreApprovedNotes] = useState('');
  const [customValues, setCustomValues] = useState<Record<string, string>>({});

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const toolImageInputRef = useRef<HTMLInputElement>(null);
  const toolCameraInputRef = useRef<HTMLInputElement>(null);
  const warrantyImageInputRef = useRef<HTMLInputElement>(null);
  const warrantyCameraInputRef = useRef<HTMLInputElement>(null);

  // In portal/admin the store name is derived from the customer, never shown as input.
  const showStoreNameInput = context === 'public' || context === 'preview';

  const enabled = (key: string) => {
    const f = config.fields.find((x) => x.key === key);
    return f ? f.enabled : false;
  };
  const requiredOf = (key: string) => {
    const f = config.fields.find((x) => x.key === key);
    return f ? f.enabled && f.required : false;
  };
  const labelOf = (key: string, fallback: string) => {
    const f = config.fields.find((x) => x.key === key);
    return f && f.label.trim() ? f.label : fallback;
  };

  const handleToolImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      const addedFiles = files.slice(0, 3 - toolImages.length);
      if (addedFiles.length === 0) return;
      setToolImages([...toolImages, ...addedFiles]);
      setToolImagePreviews([...toolImagePreviews, ...addedFiles.map((f) => URL.createObjectURL(f))]);
    }
  };

  const handleWarrantyImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (warrantyReceiptPreview) URL.revokeObjectURL(warrantyReceiptPreview);
      setWarrantyReceiptImage(file);
      setWarrantyReceiptPreview(URL.createObjectURL(file));
    }
  };

  const removeToolImage = (index: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setToolImages(toolImages.filter((_, i) => i !== index));
    URL.revokeObjectURL(toolImagePreviews[index]);
    setToolImagePreviews(toolImagePreviews.filter((_, i) => i !== index));
    if (toolImageInputRef.current) toolImageInputRef.current.value = '';
  };

  const removeWarrantyImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (warrantyReceiptPreview) URL.revokeObjectURL(warrantyReceiptPreview);
    setWarrantyReceiptImage(null);
    setWarrantyReceiptPreview(null);
    if (warrantyImageInputRef.current) warrantyImageInputRef.current.value = '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (readOnly) return;
    setSubmitError(null);

    // --- Validation, driven by the config (required only when enabled && required) ---
    if (showStoreNameInput && requiredOf('storeName') && !storeName.trim()) {
      setSubmitError('חובה להזין את שם החנות.');
      return;
    }
    if (enabled('toolOwnerName') && requiredOf('toolOwnerName') && !toolOwnerName.trim()) {
      setSubmitError('חובה להזין את שם בעל הכלי.');
      return;
    }
    if (enabled('toolOwnerPhone') && requiredOf('toolOwnerPhone') && !toolOwnerPhone.trim()) {
      setSubmitError('חובה להזין את מספר הטלפון.');
      return;
    }
    if (enabled('issueDescription') && requiredOf('issueDescription') && !issueDescription.trim()) {
      setSubmitError('חובה לתאר את התקלה בכלי.');
      return;
    }
    if (enabled('repairLevel') && requiredOf('repairLevel') && !repairLevel) {
      setSubmitError('חובה לבחור לאיזו רמה תרצו שנגיע בתיקון הכלי.');
      return;
    }
    if (enabled('warranty') && hasWarranty === 'yes' && !warrantyReceiptImage) {
      setSubmitError('סימנת שיש אחריות - חובה לצרף צילום חשבונית או תעודת אחריות.');
      return;
    }
    if (enabled('comments') && requiredOf('comments') && !comments.trim()) {
      setSubmitError('חובה למלא את שדה ההערות.');
      return;
    }
    if (enabled('toolImages') && requiredOf('toolImages') && toolImages.length === 0) {
      setSubmitError('חובה לצרף לפחות תמונה אחת של הכלי.');
      return;
    }
    if (enabled('inspectionFee') && !agreedToInspectionFee) {
      setSubmitError(`חובה לאשר את תנאי הבדיקה בסך ${config.inspectionFeeAmount} ש"ח.`);
      return;
    }
    if (enabled('preApprovedBudget') && isPreApprovedBudgetEnabled) {
      const amount = Number(preApprovedAmount);
      if (isNaN(amount) || amount < PRE_APPROVED_MIN_AMOUNT) {
        setSubmitError(`סכום האישור מראש חייב להיות לפחות ${PRE_APPROVED_MIN_AMOUNT} ₪.`);
        return;
      }
    }
    // Custom required fields.
    for (const f of config.fields) {
      if (!f.builtin && f.enabled && f.required && !(customValues[f.id] || '').trim()) {
        setSubmitError(`חובה למלא את השדה "${f.label}".`);
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const fd = new FormData();
      fd.append('customerId', customer.id);
      fd.append('storeName', (showStoreNameInput ? storeName : derivedStoreName).trim() || derivedStoreName);

      // toolOwnerName is required server-side; fall back to the store/customer name when hidden.
      const ownerName = enabled('toolOwnerName') && toolOwnerName.trim()
        ? toolOwnerName.trim()
        : derivedStoreName;
      fd.append('toolOwnerName', ownerName);

      if (enabled('toolOwnerPhone') && toolOwnerPhone.trim()) {
        fd.append('toolOwnerPhone', toolOwnerPhone.trim());
      }
      if (enabled('issueDescription')) fd.append('issueDescription', issueDescription.trim());
      fd.append('hasWarranty', enabled('warranty') && hasWarranty === 'yes' ? 'true' : 'false');
      fd.append('agreedToInspectionFee', !enabled('inspectionFee') || agreedToInspectionFee ? 'true' : 'false');
      if (enabled('comments')) fd.append('comments', comments.trim());
      if (enabled('repairLevel') && repairLevel) fd.append('repairLevel', repairLevel);
      if (enabled('preApprovedBudget') && isPreApprovedBudgetEnabled) {
        fd.append('preApprovedAmount', preApprovedAmount);
        fd.append('preApprovedNotes', preApprovedNotes.trim());
      }
      if (enabled('toolImages')) {
        toolImages.forEach((file) => fd.append('toolImages', file));
      }
      if (enabled('warranty') && hasWarranty === 'yes' && warrantyReceiptImage) {
        fd.append('warrantyReceiptImage', warrantyReceiptImage);
      }
      // Custom fields — value keyed by id; the server maps id → label from the tenant config.
      for (const f of config.fields) {
        if (!f.builtin && f.enabled) {
          const v = (customValues[f.id] || '').trim();
          if (v) fd.append(`custom_${f.id}`, v);
        }
      }
      if (extraPayload) {
        for (const [k, v] of Object.entries(extraPayload)) fd.append(k, v);
      }

      const res = await fetch(endpoint || `/api/${tenantId}/requests`, { method: 'POST', body: fd });
      let data: { error?: string; request?: ServiceRequest };
      try {
        data = await res.json();
      } catch {
        throw new Error('שגיאת שרת זמנית, אנא נסה שנית בעוד רגע.');
      }
      if (!res.ok) throw new Error(data.error || 'ארעה שגיאה בשליחת הטופס.');
      onSuccess?.(data.request as ServiceRequest);
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : 'שגיאה בחיבור לשרת, אנא נסה שנית.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ---------- Per-field renderers ----------
  const renderField = (field: FormField) => {
    if (!field.enabled) return null;

    if (!field.builtin) {
      // Custom text / textarea / tel field.
      return (
        <div key={field.id} className="space-y-2">
          <label className="block text-gray-700 text-sm font-bold flex items-center gap-1.5">
            {field.label} <RequiredMark required={field.required} />
          </label>
          {field.type === 'textarea' ? (
            <textarea
              value={customValues[field.id] || ''}
              onChange={(e) => setCustomValues((p) => ({ ...p, [field.id]: e.target.value }))}
              placeholder={field.placeholder || ''}
              rows={3}
              className={`${inputClass} text-right resize-none`}
            />
          ) : (
            <input
              type={field.type === 'tel' ? 'tel' : 'text'}
              value={customValues[field.id] || ''}
              onChange={(e) => setCustomValues((p) => ({ ...p, [field.id]: e.target.value }))}
              placeholder={field.placeholder || ''}
              dir="rtl"
              className={`${inputClass} text-right`}
            />
          )}
        </div>
      );
    }

    switch (field.key) {
      case 'storeName':
        if (!showStoreNameInput) return null;
        return (
          <div key={field.id} className="space-y-2">
            <label className="block text-gray-700 text-sm font-bold flex items-center gap-1.5">
              <Store className="w-4 h-4 text-gray-400" />
              {labelOf('storeName', 'שם החנות')} <RequiredMark required={field.required} />
            </label>
            <input type="text" value={storeName} onChange={(e) => setStoreName(e.target.value)}
              placeholder="שם החנות שבה נקנה הכלי" className={inputClass} />
          </div>
        );

      case 'toolOwnerName':
        return (
          <div key={field.id} className="space-y-2">
            <label className="block text-gray-700 text-sm font-bold flex items-center gap-1.5">
              <User className="w-4 h-4 text-gray-400" />
              {labelOf('toolOwnerName', 'שם בעל הכלי')} <RequiredMark required={field.required} />
            </label>
            <input type="text" value={toolOwnerName} onChange={(e) => setToolOwnerName(e.target.value)}
              placeholder="השם המלא של בעל הכלי" className={inputClass} />
          </div>
        );

      case 'toolOwnerPhone':
        return (
          <div key={field.id} className="space-y-2">
            <label className="block text-gray-700 text-sm font-bold flex items-center gap-1.5">
              <Phone className="w-4 h-4 text-gray-400" />
              {labelOf('toolOwnerPhone', 'מספר טלפון בעל הכלי')} <RequiredMark required={field.required} />
            </label>
            <input type="tel" value={toolOwnerPhone} onChange={(e) => setToolOwnerPhone(e.target.value)}
              placeholder="מספר טלפון ליצירת קשר" dir="rtl" className={`${inputClass} text-right`} />
          </div>
        );

      case 'issueDescription':
        return (
          <div key={field.id} className="space-y-2">
            <label className="block text-gray-700 text-sm font-bold flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-gray-400" />
              {labelOf('issueDescription', 'מה התקלה בכלי?')} <RequiredMark required={field.required} />
            </label>
            <textarea value={issueDescription} onChange={(e) => setIssueDescription(e.target.value)}
              placeholder="תאר את הבעיה בכלי (לדוגמה: פנצ'ר בגלגל קדמי, המנוע לא נדלק...)" rows={3}
              className={`${inputClass} text-right resize-none`} />
          </div>
        );

      case 'repairLevel':
        return (
          <div key={field.id} className="space-y-3">
            <label className="block text-gray-700 text-sm font-bold flex items-center gap-1.5">
              <span className="text-gray-400 text-xs">⚡</span>
              {labelOf('repairLevel', 'לאיזו רמה תרצו שנגיע בתיקון?')} <RequiredMark required={field.required} />
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {([
                { key: 'RIDE_ONLY', title: 'מצב נסיעה בלבד 🛴', desc: 'תיקון בסיסי שיחזיר את הכלי למצב נסיעה (ללא תוספות)',
                  activeCard: 'border-blue-500 bg-gradient-to-br from-blue-50/90 to-sky-50/50 text-blue-950 shadow-md shadow-blue-500/5 ring-4 ring-blue-500/10',
                  activeText: 'text-blue-600', activeDot: 'border-blue-500 bg-blue-500 scale-110' },
                { key: 'SAFE_RIDE', title: 'נסיעה בטוחה 🛑', desc: 'נסיעה תקינה כולל בדיקה קפדנית של בלמים וצמיגים (מומלץ)',
                  activeCard: 'border-emerald-500 bg-gradient-to-br from-emerald-50/90 to-teal-50/50 text-emerald-950 shadow-md shadow-emerald-500/5 ring-4 ring-emerald-500/10',
                  activeText: 'text-emerald-600', activeDot: 'border-emerald-500 bg-emerald-500 scale-110' },
                { key: 'LIKE_NEW', title: 'כמו חדש! ✨', desc: 'יישור קו מלא כולל הכל: תאורה, פלסטיקה, קוסמטיקה ושיפוץ כללי',
                  activeCard: 'border-purple-500 bg-gradient-to-br from-purple-50/90 to-indigo-50/50 text-purple-950 shadow-md shadow-purple-500/5 ring-4 ring-purple-500/10',
                  activeText: 'text-purple-600', activeDot: 'border-purple-500 bg-purple-500 scale-110' },
              ] as const).map((opt) => {
                const active = repairLevel === opt.key;
                return (
                  <button key={opt.key} type="button" onClick={() => setRepairLevel(opt.key)}
                    className={`py-4 px-4 rounded-2xl border text-right transition-all flex flex-col justify-between group active:scale-[0.98] cursor-pointer ${
                      active ? opt.activeCard : 'border-gray-200 bg-white text-gray-500 hover:bg-gray-50 hover:border-gray-300 shadow-sm'
                    }`}>
                    <div className="flex justify-between items-center w-full mb-1.5">
                      <span className={`text-xs font-black ${active ? opt.activeText : 'text-gray-700'}`}>{opt.title}</span>
                      <span className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center transition-all ${active ? opt.activeDot : 'border-gray-300 bg-white'}`}>
                        {active && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                      </span>
                    </div>
                    <span className="block text-[10px] text-gray-400 font-medium leading-tight">{opt.desc}</span>
                  </button>
                );
              })}
            </div>
          </div>
        );

      case 'warranty':
        return (
          <div key={field.id} className="space-y-3.5">
            <label className="block text-gray-700 text-sm font-bold">
              {labelOf('warranty', 'האם יש אחריות לכלי?')} <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-2 gap-4">
              <button type="button" onClick={() => setHasWarranty('yes')}
                className={`py-4 px-5 rounded-2xl border text-right transition-all flex items-center justify-between group active:scale-[0.98] cursor-pointer ${
                  hasWarranty === 'yes' ? 'border-blue-500 bg-blue-50/40 text-blue-700 ring-4 ring-blue-500/10' : 'border-gray-200 bg-white text-gray-500 hover:bg-gray-50 hover:border-gray-300 shadow-sm'
                }`}>
                <div>
                  <span className="block text-base font-extrabold">כן</span>
                  <span className="block text-[11px] text-gray-400 font-medium mt-0.5">יש לצרף תעודה/חשבונית</span>
                </div>
                <ShieldCheck className={`w-7 h-7 ${hasWarranty === 'yes' ? 'text-blue-500 scale-110' : 'text-gray-300'}`} />
              </button>
              <button type="button" onClick={() => { setHasWarranty('no'); setWarrantyReceiptImage(null); setWarrantyReceiptPreview(null); }}
                className={`py-4 px-5 rounded-2xl border text-right transition-all flex items-center justify-between group active:scale-[0.98] cursor-pointer ${
                  hasWarranty === 'no' ? 'border-blue-500 bg-blue-50/40 text-blue-700 ring-4 ring-blue-500/10' : 'border-gray-200 bg-white text-gray-500 hover:bg-gray-50 hover:border-gray-300 shadow-sm'
                }`}>
                <div>
                  <span className="block text-base font-extrabold">לא</span>
                  <span className="block text-[11px] text-gray-400 font-medium mt-0.5">כלי ללא תקופת אחריות</span>
                </div>
                <ShieldAlert className={`w-7 h-7 ${hasWarranty === 'no' ? 'text-blue-500 scale-110' : 'text-gray-300'}`} />
              </button>
            </div>
            <AnimatePresence>
              {hasWarranty === 'yes' && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.3 }} className="space-y-2.5 overflow-hidden">
                  <label className="block text-gray-700 text-sm font-bold flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-gray-400" /> צילום חשבונית או תעודת אחריות <span className="text-red-500">*</span>
                  </label>
                  <div className={`border-2 border-dashed rounded-2xl p-5 text-center transition-all flex flex-col items-center justify-center min-h-[140px] relative group ${warrantyReceiptPreview ? 'border-solid border-gray-200 bg-gray-50/50' : 'border-gray-200 bg-gray-50/30'}`}>
                    <input type="file" accept="image/*" ref={warrantyImageInputRef} onChange={handleWarrantyImageChange} className="hidden" />
                    <input type="file" accept="image/*" capture="environment" ref={warrantyCameraInputRef} onChange={handleWarrantyImageChange} className="hidden" />
                    {warrantyReceiptPreview ? (
                      <div className="relative group/preview w-full max-w-[240px] aspect-[4/3] rounded-xl overflow-hidden border bg-white shadow-sm">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={warrantyReceiptPreview} alt="Receipt preview" className="w-full h-full object-contain" />
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover/preview:opacity-100 transition-opacity gap-2">
                          <button type="button" onClick={() => warrantyCameraInputRef.current?.click()} className="p-2 bg-blue-600 text-white rounded-lg text-xs font-bold shadow cursor-pointer flex items-center gap-1"><Camera className="w-3.5 h-3.5" /> צלם</button>
                          <button type="button" onClick={() => warrantyImageInputRef.current?.click()} className="p-2 bg-white text-gray-800 rounded-lg text-xs font-bold shadow cursor-pointer">גלריה</button>
                          <button type="button" onClick={removeWarrantyImage} className="p-2 bg-red-600 text-white rounded-lg shadow cursor-pointer"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-3 w-full">
                        <div className="flex items-center justify-center gap-3">
                          <button
                            type="button"
                            onClick={() => warrantyCameraInputRef.current?.click()}
                            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-sm flex items-center gap-2 transition-all active:scale-95 cursor-pointer"
                          >
                            <Camera className="w-4 h-4" />
                            <span>צלם במצלמה</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => warrantyImageInputRef.current?.click()}
                            className="px-4 py-2.5 bg-white hover:bg-gray-100 text-gray-700 font-bold text-xs rounded-xl border border-gray-200 flex items-center gap-2 transition-all active:scale-95 cursor-pointer"
                          >
                            <Image className="w-4 h-4 text-gray-500" />
                            <span>בחר מהגלריה</span>
                          </button>
                        </div>
                        <span className="text-gray-400 text-xs block font-medium">(צלם תמונה ברורה של החשבונית/התעודה)</span>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );

      case 'preApprovedBudget':
        return (
          <div key={field.id} className="space-y-3.5 p-5 bg-blue-50/30 border border-blue-100/30 rounded-2xl shadow-sm text-right">
            <label className="flex items-start cursor-pointer select-none">
              <input type="checkbox" checked={isPreApprovedBudgetEnabled} onChange={(e) => setIsPreApprovedBudgetEnabled(e.target.checked)} className="w-5 h-5 mt-0.5 text-blue-600 border-gray-300 rounded cursor-pointer" />
              <div className="mr-3">
                <span className="block text-sm font-bold text-gray-800">{labelOf('preApprovedBudget', 'אישור תקציב לתיקון מראש')} (מהיר יותר!) ⚡</span>
                <span className="block text-[11px] text-gray-500 font-medium">מאפשר לנו להתחיל לעבוד מיד ללא צורך בשיחת אישור טלפונית</span>
              </div>
            </label>
            <AnimatePresence>
              {isPreApprovedBudgetEnabled && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.25 }} className="space-y-3 pt-3 border-t border-blue-100/30 overflow-hidden">
                  <div className="space-y-1.5">
                    <label className="block text-gray-700 text-xs font-bold">סכום אישור מקסימלי לתיקון (₪) <span className="text-red-500">*</span></label>
                    <input type="number" value={preApprovedAmount} onChange={(e) => setPreApprovedAmount(e.target.value)} min={PRE_APPROVED_MIN_AMOUNT}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 text-gray-800 text-xs font-bold text-right" />
                    <p className="text-[10px] text-gray-400">מינימום {PRE_APPROVED_MIN_AMOUNT} ₪. לא נחרוג מסכום זה ללא אישורכם מראש.</p>
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-gray-700 text-xs font-bold">הנחיות או דגשים לגבי התקציב <span className="text-gray-400 font-normal text-[10px]">(אופציונלי)</span></label>
                    <input type="text" value={preApprovedNotes} onChange={(e) => setPreApprovedNotes(e.target.value)} placeholder="לדוגמה: אל תחליפו סוללה בלי לדבר איתי קודם..."
                      className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 text-gray-800 text-xs font-medium text-right" />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );

      case 'comments':
        return (
          <div key={field.id} className="space-y-2">
            <label className="block text-gray-700 text-sm font-bold flex items-center gap-1.5">
              <span>📝</span> {labelOf('comments', 'הערות נוספות לצוות המעבדה')} <RequiredMark required={field.required} />
            </label>
            <textarea value={comments} onChange={(e) => setComments(e.target.value)} placeholder="הערות או דגשים נוספים לצוות המעבדה..." rows={2}
              className={`${inputClass} text-right resize-none`} />
          </div>
        );

      case 'toolImages':
        return (
          <div key={field.id} className="space-y-3">
            <div className="flex justify-between items-center">
              <label className="block text-gray-700 text-sm font-bold flex items-center gap-1.5">
                <UploadCloud className="w-4 h-4 text-gray-400" /> {labelOf('toolImages', 'צילומים של הכלי')} <RequiredMark required={field.required} />
              </label>
              <span className="text-xs text-gray-400 font-bold bg-gray-100 px-2 py-0.5 rounded-lg border border-gray-200/20">({toolImages.length}/3 תמונות)</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {toolImagePreviews.map((preview, idx) => (
                <div key={idx} className="relative group/preview aspect-[4/3] rounded-xl overflow-hidden border border-gray-200 bg-white shadow-sm flex items-center justify-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={preview} alt={`Tool preview ${idx + 1}`} className="w-full h-full object-contain" />
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover/preview:opacity-100 transition-opacity gap-2">
                    <button type="button" onClick={(e) => removeToolImage(idx, e)} className="p-2 bg-red-600 text-white rounded-lg shadow cursor-pointer"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>
              ))}
              {toolImages.length < 3 && (
                <div className="border-2 border-dashed border-gray-200 rounded-xl aspect-[4/3] text-center p-3 transition-all flex flex-col items-center justify-center bg-gray-50/50 hover:bg-blue-50/10 hover:border-blue-400 min-h-[130px]">
                  <input type="file" accept="image/*" ref={toolImageInputRef} onChange={handleToolImageChange} className="hidden" multiple />
                  <input type="file" accept="image/*" capture="environment" ref={toolCameraInputRef} onChange={handleToolImageChange} className="hidden" />
                  <span className="text-gray-700 font-bold text-xs mb-2">הוסף תמונת כלי</span>
                  <div className="flex items-center gap-1.5 w-full justify-center">
                    <button
                      type="button"
                      onClick={() => toolCameraInputRef.current?.click()}
                      className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-[11px] rounded-lg shadow-sm flex items-center gap-1 transition-all active:scale-95 cursor-pointer"
                      title="צלם במצלמה"
                    >
                      <Camera className="w-3.5 h-3.5" />
                      <span>צלם</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => toolImageInputRef.current?.click()}
                      className="px-2.5 py-1.5 bg-white hover:bg-gray-100 text-gray-700 border border-gray-200 font-bold text-[11px] rounded-lg flex items-center gap-1 transition-all active:scale-95 cursor-pointer"
                      title="בחר מהגלריה"
                    >
                      <Image className="w-3.5 h-3.5 text-gray-500" />
                      <span>גלריה</span>
                    </button>
                  </div>
                  <span className="text-gray-400 text-[10px] mt-1.5">עד 3 תמונות</span>
                </div>
              )}
            </div>
          </div>
        );

      case 'inspectionFee':
        return (
          <div key={field.id} className="p-5 bg-amber-50/40 border border-amber-100/80 rounded-2xl transition-all hover:bg-amber-50/60 shadow-sm">
            <label className="flex items-start cursor-pointer select-none">
              <input type="checkbox" checked={agreedToInspectionFee} onChange={(e) => setAgreedToInspectionFee(e.target.checked)} className="w-5 h-5 mt-0.5 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer" />
              <span className="mr-3 text-sm text-gray-600 leading-relaxed font-bold">
                אני מאשר/ת ומסכים/ה לשלם <strong className="text-amber-800">{config.inspectionFeeAmount} ש&quot;ח דמי בדיקה</strong> במידה ויימצאו בכלי דברים שאינם קשורים לאחריות, ואבחר שלא לבצע את התיקון.
              </span>
            </label>
          </div>
        );

      default:
        return null;
    }
  };

  const body = (
    <form onSubmit={handleSubmit} className="space-y-6">
      {headerSlot}

      <AnimatePresence>
        {submitError && (
          <motion.div initial={{ opacity: 0, height: 0, y: -10 }} animate={{ opacity: 1, height: 'auto', y: 0 }} exit={{ opacity: 0, height: 0, y: -10 }}
            className="p-4 bg-red-50 border border-red-100 rounded-2xl text-red-600 text-sm font-bold flex items-center gap-2">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span>{submitError}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {config.fields.map((field) => renderField(field))}

      {/* Personal items disclaimer — shown whenever tool images are collected. */}
      {enabled('toolImages') && (
        <div className="p-4 bg-indigo-50/40 border border-indigo-100/50 rounded-2xl flex items-start gap-3 text-indigo-900 text-xs shadow-sm text-right" dir="rtl">
          <span className="text-xl flex-shrink-0 select-none">🎒</span>
          <div className="leading-relaxed">
            <strong className="block text-indigo-950 font-bold mb-0.5">קחו איתכם ציוד אישי!</strong>
            מטענים, תיקים, קסדות או כל חפץ אישי אחר שנשארים על הכלי הם באחריותכם בלבד. מומלץ לקחת אותם כדי לשמור עליהם מכל משמר! ❤️
          </div>
        </div>
      )}

      {!readOnly && (
        <motion.button whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }} type="submit" disabled={isSubmitting}
          className={`w-full py-4 rounded-2xl text-white text-base font-extrabold shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer ${
            isSubmitting ? 'bg-blue-400 cursor-not-allowed shadow-none' : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-blue-500/25 active:scale-[0.98]'
          }`}>
          {isSubmitting ? (<><Loader2 className="w-5 h-5 animate-spin" /><span>שולח קריאה לענן...</span></>) : (<><Check className="w-5 h-5" /><span>{submitLabel}</span></>)}
        </motion.button>
      )}
    </form>
  );

  // In preview mode, disable all controls so the admin only *sees* the layout.
  if (readOnly) {
    return <fieldset disabled className="pointer-events-none opacity-95">{body}</fieldset>;
  }
  return body;
}
