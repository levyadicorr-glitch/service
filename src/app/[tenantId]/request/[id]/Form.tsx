'use client';

import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Store, 
  User, 
  Phone, 
  Barcode, 
  ShieldCheck, 
  ShieldAlert, 
  UploadCloud, 
  Check, 
  AlertCircle, 
  Trash2, 
  Loader2,
  FileText
} from 'lucide-react';
import { Customer } from '@/lib/db';

interface FormProps {
  customer: Customer;
  tenantId: string;
  businessName: string;
  whatsappTemplate: string;
  logoUrl?: string;
}

export default function RequestForm({ customer, tenantId, businessName, whatsappTemplate, logoUrl = '' }: FormProps) {
  const [storeName, setStoreName] = useState(`${customer.firstName} ${customer.lastName}`.trim());
  const [toolOwnerName, setToolOwnerName] = useState('');
  const [toolOwnerPhone, setToolOwnerPhone] = useState('');
  const [issueDescription, setIssueDescription] = useState('');
  const [hasWarranty, setHasWarranty] = useState<string>('no');
  const [toolImages, setToolImages] = useState<File[]>([]);
  const [toolImagePreviews, setToolImagePreviews] = useState<string[]>([]);
  const [warrantyReceiptImage, setWarrantyReceiptImage] = useState<File | null>(null);
  const [warrantyReceiptPreview, setWarrantyReceiptPreview] = useState<string | null>(null);
  const [agreedToInspectionFee, setAgreedToInspectionFee] = useState(false);
  
  // New fields states
  const [comments, setComments] = useState('');
  const [repairLevel, setRepairLevel] = useState<'RIDE_ONLY' | 'SAFE_RIDE' | 'LIKE_NEW' | ''>('');
  const [isPreApprovedBudgetEnabled, setIsPreApprovedBudgetEnabled] = useState(false);
  const [preApprovedAmount, setPreApprovedAmount] = useState<string>('500');
  const [preApprovedNotes, setPreApprovedNotes] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [createdRequestNumber, setCreatedRequestNumber] = useState<number | null>(null);

  const toolImageInputRef = useRef<HTMLInputElement>(null);
  const warrantyImageInputRef = useRef<HTMLInputElement>(null);

  const handleToolImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      // Create object URLs only for the newly added files, so existing previews
      // stay valid and no blob URLs are leaked.
      const addedFiles = files.slice(0, 3 - toolImages.length);
      if (addedFiles.length === 0) return;
      setToolImages([...toolImages, ...addedFiles]);
      setToolImagePreviews([...toolImagePreviews, ...addedFiles.map(file => URL.createObjectURL(file))]);
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
    const newImages = toolImages.filter((_, i) => i !== index);
    setToolImages(newImages);
    
    URL.revokeObjectURL(toolImagePreviews[index]);
    const newPreviews = toolImagePreviews.filter((_, i) => i !== index);
    setToolImagePreviews(newPreviews);
    
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
    setSubmitError(null);

    if (toolImages.length === 0) {
      setSubmitError('חובה לצרף לפחות תמונה אחת של הכלי.');
      return;
    }
    if (hasWarranty === 'yes' && !warrantyReceiptImage) {
      setSubmitError('סימנת שיש אחריות - חובה לצרף צילום חשבונית או תעודת אחריות.');
      return;
    }
    if (!issueDescription.trim()) {
      setSubmitError('חובה לתאר את התקלה בכלי.');
      return;
    }
    if (!agreedToInspectionFee) {
      setSubmitError('חובה לאשר את תנאי הבדיקה בסך 150 ש"ח.');
      return;
    }
    if (!repairLevel) {
      setSubmitError('חובה לבחור לאיזו רמה תרצו שנגיע בתיקון הכלי.');
      return;
    }
    
    if (isPreApprovedBudgetEnabled) {
      const amount = Number(preApprovedAmount);
      if (isNaN(amount) || amount < 500) {
        setSubmitError('סכום האישור מראש חייב להיות לפחות 500 ₪.');
        return;
      }
    }

    setIsSubmitting(true);

    try {
      const formData = new FormData();
      formData.append('customerId', customer.id);
      formData.append('storeName', storeName.trim());
      formData.append('toolOwnerName', toolOwnerName.trim());
      if (toolOwnerPhone.trim()) {
        formData.append('toolOwnerPhone', toolOwnerPhone.trim());
      }
      formData.append('issueDescription', issueDescription.trim());
      formData.append('hasWarranty', hasWarranty === 'yes' ? 'true' : 'false');
      formData.append('agreedToInspectionFee', agreedToInspectionFee ? 'true' : 'false');
      
      // Append new fields
      formData.append('comments', comments.trim());
      formData.append('repairLevel', repairLevel);
      if (isPreApprovedBudgetEnabled) {
        formData.append('preApprovedAmount', preApprovedAmount);
        formData.append('preApprovedNotes', preApprovedNotes.trim());
      }

      toolImages.forEach(file => {
        formData.append('toolImages', file);
      });
      if (hasWarranty === 'yes' && warrantyReceiptImage) {
        formData.append('warrantyReceiptImage', warrantyReceiptImage);
      }

      const res = await fetch(`/api/${tenantId}/requests`, {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'ארעה שגיאה בשליחת הטופס.');
      }

      if (data.request?.requestNumber) {
        setCreatedRequestNumber(data.request.requestNumber);
      }
      setSubmitSuccess(true);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'שגיאה בחיבור לשרת, אנא נסה שנית.';
      setSubmitError(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  // SUCCESS SCREEN
  if (submitSuccess) {
    return (
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: 'spring', damping: 20, stiffness: 100 }}
        className="bg-white p-8 md:p-12 rounded-3xl shadow-xl border border-gray-100 text-center max-w-lg mx-auto mt-10"
      >
        <motion.div 
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2, type: 'spring', stiffness: 200, damping: 15 }}
          className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-6 border border-green-100 shadow-inner"
        >
          <Check className="w-10 h-10 text-green-500" strokeWidth={3} />
        </motion.div>
        
        <h2 className="text-3xl font-black text-gray-900 mb-3 tracking-tight">הקריאה התקבלה בהצלחה!</h2>
        <p className="text-gray-500 mb-8 text-base leading-relaxed">
          תודה, קריאת השירות שלך נרשמה במערכת {businessName}. נציג מטעמנו יטפל בפנייה בהקדם.
        </p>

        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="p-6 bg-gray-50/80 backdrop-blur rounded-2xl text-right text-sm text-gray-600 border border-gray-100 space-y-3.5 shadow-sm"
        >
          <div className="flex justify-between items-center border-b border-gray-100 pb-2">
            <span className="text-gray-400 font-medium">מספר קריאה סידורי:</span>
            <strong className="text-blue-600 font-mono text-base">
              #{tenantId.substring(0, 2).toUpperCase()}-{createdRequestNumber || 'נשמר בענן'}
            </strong>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-400 font-medium">שם הלקוח:</span>
            <strong className="text-gray-800">{customer.firstName} {customer.lastName}</strong>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-400 font-medium">שם החנות:</span>
            <strong className="text-gray-800">{storeName}</strong>
          </div>
          {customer.serialNumber && (
            <div className="flex justify-between items-center">
              <span className="text-gray-400 font-medium">מספר סריאלי של הכלי:</span>
              <strong className="text-gray-800 font-mono">{customer.serialNumber}</strong>
            </div>
          )}
        </motion.div>

        <div className="mt-8">
          <button 
            type="button"
            onClick={() => window.location.reload()}
            className="px-6 py-2.5 bg-gray-900 hover:bg-gray-800 text-white rounded-xl text-sm font-bold transition-all shadow active:scale-[0.98]"
          >
            פתח קריאה נוספת
          </button>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className="bg-white/80 backdrop-blur-md rounded-3xl shadow-xl border border-white/60 shadow-[0_8px_30px_rgb(0,0,0,0.02)] p-6 md:p-10 max-w-2xl mx-auto"
    >
      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Apple-grade Animated High-Tech Welcome Header Card */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 p-6 md:p-8 text-white border border-slate-800 shadow-xl">
          {/* Glowing background highlights */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl -mr-10 -mt-10 animate-pulse"></div>
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl -ml-10 -mb-10"></div>
          
          <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-500/20 border border-blue-500/30 text-blue-300 rounded-lg text-[10px] font-bold tracking-wider uppercase mb-3">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-ping"></span>
                {businessName} שירות לקוחות
              </div>
              <motion.h1 
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2, type: "spring", stiffness: 100 }}
                className="text-2xl md:text-3xl font-black tracking-tight"
              >
                שלום, <span className="text-transparent bg-clip-text bg-gradient-to-l from-blue-400 via-indigo-300 to-white">{customer.firstName} {customer.lastName}</span>
              </motion.h1>
              <p className="text-slate-400 text-xs md:text-sm mt-1.5 font-medium">
                מרכז השירות המורשה {businessName}. אנא מלא את פרטי הטיפול עבור הכלי שלך.
              </p>
            </div>
            
            {/* Glowing client initials badge or custom logo */}
            <motion.div 
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.3, type: "spring" }}
              className="w-12 h-12 md:w-14 md:h-14 rounded-2xl overflow-hidden bg-white flex items-center justify-center shadow-lg shadow-blue-500/30 border-2 border-white/20 select-none flex-shrink-0"
            >
              {logoUrl ? (
                <img src={logoUrl} alt="Logo" className="w-full h-full object-contain" />
              ) : (
                <div className="w-full h-full bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white font-extrabold text-lg md:text-xl">
                  {customer.firstName[0]}{customer.lastName[0]}
                </div>
              )}
            </motion.div>
          </div>
        </div>

        {/* Error message wrapper */}
        <AnimatePresence>
          {submitError && (
            <motion.div 
              initial={{ opacity: 0, height: 0, y: -10 }}
              animate={{ opacity: 1, height: 'auto', y: 0 }}
              exit={{ opacity: 0, height: 0, y: -10 }}
              className="p-4 bg-red-50 border border-red-100 rounded-2xl text-red-600 text-sm font-bold flex items-center gap-2"
            >
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <span>{submitError}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Input fields */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="block text-gray-700 text-sm font-bold flex items-center gap-1.5">
              <Store className="w-4 h-4 text-gray-400" />
              שם החנות <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={storeName}
              onChange={(e) => setStoreName(e.target.value)}
              placeholder="שם החנות שבה נקנה הכלי"
              className="w-full px-4 py-3.5 rounded-xl border border-gray-200 bg-gray-50/40 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 text-gray-800 transition-all duration-200 text-sm font-medium"
              required
            />
          </div>

          <div className="space-y-2">
            <label className="block text-gray-700 text-sm font-bold flex items-center gap-1.5">
              <User className="w-4 h-4 text-gray-400" />
              שם בעל הכלי <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={toolOwnerName}
              onChange={(e) => setToolOwnerName(e.target.value)}
              placeholder="השם המלא של בעל הכלי"
              className="w-full px-4 py-3.5 rounded-xl border border-gray-200 bg-gray-50/40 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 text-gray-800 transition-all duration-200 text-sm font-medium"
              required
            />
          </div>
          
          <div className="space-y-2 md:col-span-2">
            <label className="block text-gray-700 text-sm font-bold flex items-center gap-1.5">
              <Phone className="w-4 h-4 text-gray-400" />
              מספר טלפון בעל הכלי <span className="text-gray-400 font-normal text-xs">(אופציונלי)</span>
            </label>
            <input
              type="tel"
              value={toolOwnerPhone}
              onChange={(e) => setToolOwnerPhone(e.target.value)}
              placeholder="מספר טלפון ליצירת קשר"
              className="w-full px-4 py-3.5 rounded-xl border border-gray-200 bg-gray-50/40 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 text-gray-800 transition-all duration-200 text-sm font-medium text-right"
              dir="rtl"
            />
          </div>

          <div className="space-y-2 md:col-span-2">
            <label className="block text-gray-700 text-sm font-bold flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-gray-400" />
              מה התקלה בכלי? <span className="text-red-500">*</span>
            </label>
            <textarea
              value={issueDescription}
              onChange={(e) => setIssueDescription(e.target.value)}
              placeholder="תאר את הבעיה בכלי (לדוגמה: פנצ'ר בגלגל קדמי, המנוע לא נדלק, בעיה בבלמים...)"
              rows={3}
              className="w-full px-4 py-3.5 rounded-xl border border-gray-200 bg-gray-50/40 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 text-gray-800 transition-all duration-200 text-sm font-medium text-right resize-none"
              required
            />
          </div>

          {/* Desired Repair Level Selection */}
          <div className="space-y-3 md:col-span-2">
            <label className="block text-gray-700 text-sm font-bold flex items-center gap-1.5">
              <span className="text-gray-400 text-xs">⚡</span>
              לאיזו רמה תרצו שנגיע בתיקון? <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Option 1: Basic Ride */}
              <button
                type="button"
                onClick={() => setRepairLevel('RIDE_ONLY')}
                className={`py-4 px-4 rounded-2xl border text-right transition-all flex flex-col justify-between group active:scale-[0.98] cursor-pointer ${
                  repairLevel === 'RIDE_ONLY'
                    ? 'border-blue-500 bg-gradient-to-br from-blue-50/90 to-sky-50/50 text-blue-950 shadow-md shadow-blue-500/5 ring-4 ring-blue-500/10'
                    : 'border-gray-200 bg-white text-gray-500 hover:bg-gray-50 hover:border-gray-300 shadow-sm'
                }`}
              >
                <div className="flex justify-between items-center w-full mb-1.5">
                  <span className={`text-xs font-black transition-colors ${repairLevel === 'RIDE_ONLY' ? 'text-blue-600' : 'text-gray-700'}`}>מצב נסיעה בלבד 🛴</span>
                  <span className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center transition-all ${repairLevel === 'RIDE_ONLY' ? 'border-blue-500 bg-blue-500 scale-110' : 'border-gray-300 bg-white'}`}>
                    {repairLevel === 'RIDE_ONLY' && <span className="w-1.5 h-1.5 rounded-full bg-white"></span>}
                  </span>
                </div>
                <span className="block text-[10px] text-gray-400 font-medium leading-tight group-hover:text-gray-500 transition-colors">תיקון בסיסי שיחזיר את הכלי למצב נסיעה (ללא תוספות)</span>
              </button>

              {/* Option 2: Safe Ride */}
              <button
                type="button"
                onClick={() => setRepairLevel('SAFE_RIDE')}
                className={`py-4 px-4 rounded-2xl border text-right transition-all flex flex-col justify-between group active:scale-[0.98] cursor-pointer ${
                  repairLevel === 'SAFE_RIDE'
                    ? 'border-emerald-500 bg-gradient-to-br from-emerald-50/90 to-teal-50/50 text-emerald-950 shadow-md shadow-emerald-500/5 ring-4 ring-emerald-500/10'
                    : 'border-gray-200 bg-white text-gray-500 hover:bg-gray-50 hover:border-gray-300 shadow-sm'
                }`}
              >
                <div className="flex justify-between items-center w-full mb-1.5">
                  <span className={`text-xs font-black transition-colors ${repairLevel === 'SAFE_RIDE' ? 'text-emerald-600' : 'text-gray-700'}`}>נסיעה בטוחה 🛑</span>
                  <span className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center transition-all ${repairLevel === 'SAFE_RIDE' ? 'border-emerald-500 bg-emerald-500 scale-110' : 'border-gray-300 bg-white'}`}>
                    {repairLevel === 'SAFE_RIDE' && <span className="w-1.5 h-1.5 rounded-full bg-white"></span>}
                  </span>
                </div>
                <span className="block text-[10px] text-gray-400 font-medium leading-tight group-hover:text-gray-500 transition-colors">נסיעה תקינה כולל בדיקה קפדנית של בלמים וצמיגים (מומלץ)</span>
              </button>

              {/* Option 3: Like New */}
              <button
                type="button"
                onClick={() => setRepairLevel('LIKE_NEW')}
                className={`py-4 px-4 rounded-2xl border text-right transition-all flex flex-col justify-between group active:scale-[0.98] cursor-pointer ${
                  repairLevel === 'LIKE_NEW'
                    ? 'border-purple-500 bg-gradient-to-br from-purple-50/90 to-indigo-50/50 text-purple-950 shadow-md shadow-purple-500/5 ring-4 ring-purple-500/10'
                    : 'border-gray-200 bg-white text-gray-500 hover:bg-gray-50 hover:border-gray-300 shadow-sm'
                }`}
              >
                <div className="flex justify-between items-center w-full mb-1.5">
                  <span className={`text-xs font-black transition-colors ${repairLevel === 'LIKE_NEW' ? 'text-purple-600' : 'text-gray-700'}`}>כמו חדש! ✨</span>
                  <span className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center transition-all ${repairLevel === 'LIKE_NEW' ? 'border-purple-500 bg-purple-500 scale-110' : 'border-gray-300 bg-white'}`}>
                    {repairLevel === 'LIKE_NEW' && <span className="w-1.5 h-1.5 rounded-full bg-white"></span>}
                  </span>
                </div>
                <span className="block text-[10px] text-gray-400 font-medium leading-tight group-hover:text-gray-500 transition-colors">יישור קו מלא כולל הכל: תאורה, פלסטיקה, קוסמטיקה ושיפוץ כללי</span>
              </button>
            </div>
          </div>

          {/* Pre-approved Budget Section */}
          <div className="space-y-3.5 md:col-span-2 p-5 bg-blue-50/30 border border-blue-100/30 rounded-2xl shadow-sm text-right">
            <label className="flex items-start cursor-pointer select-none">
              <input
                type="checkbox"
                checked={isPreApprovedBudgetEnabled}
                onChange={(e) => setIsPreApprovedBudgetEnabled(e.target.checked)}
                className="w-5 h-5 mt-0.5 text-blue-600 border-gray-300 rounded cursor-pointer"
              />
              <div className="mr-3">
                <span className="block text-sm font-bold text-gray-800">אישור תקציב לתיקון מראש (מהיר יותר!) ⚡</span>
                <span className="block text-[11px] text-gray-500 font-medium">מאפשר לנו להתחיל לעבוד מיד ללא צורך בשיחת אישור טלפונית</span>
              </div>
            </label>

            <AnimatePresence>
              {isPreApprovedBudgetEnabled && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.25 }}
                  className="space-y-3 pt-3 border-t border-blue-100/30 overflow-hidden"
                >
                  <div className="space-y-1.5">
                    <label className="block text-gray-700 text-xs font-bold">
                      סכום אישור מקסימלי לתיקון (₪) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      value={preApprovedAmount}
                      onChange={(e) => setPreApprovedAmount(e.target.value)}
                      min="500"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 text-gray-800 text-xs font-bold text-right"
                      required
                    />
                    <p className="text-[10px] text-gray-400">מינימום 500 ₪. לא נחרוג מסכום זה ללא אישורכם מראש.</p>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-gray-700 text-xs font-bold">
                      הנחיות או דגשים לגבי התקציב <span className="text-gray-400 font-normal text-[10px]">(אופציונלי)</span>
                    </label>
                    <input
                      type="text"
                      value={preApprovedNotes}
                      onChange={(e) => setPreApprovedNotes(e.target.value)}
                      placeholder="לדוגמה: אל תחליפו סוללה בלי לדבר איתי קודם..."
                      className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 text-gray-800 text-xs font-medium text-right"
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* General Comments Section */}
          <div className="space-y-2 md:col-span-2">
            <label className="block text-gray-700 text-sm font-bold flex items-center gap-1.5">
              <span>📝</span>
              הערות נוספות לצוות המעבדה <span className="text-gray-400 font-normal text-xs">(אופציונלי)</span>
            </label>
            <textarea
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              placeholder="הערות או דגשים נוספים לצוות המעבדה..."
              rows={2}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50/40 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 text-gray-800 transition-all duration-200 text-sm font-medium text-right resize-none"
            />
          </div>
        </div>

        {/* Info Grid */}
        <div className="p-4 bg-slate-50/60 border border-slate-100/80 rounded-2xl grid grid-cols-2 gap-4 text-xs font-semibold text-gray-500 shadow-sm">
          <div className="flex items-center gap-2">
            <Phone className="w-4 h-4 text-gray-400" />
            <div>
              <span className="block text-gray-400 text-[10px]">טלפון:</span>
              <strong className="text-gray-700 font-mono text-sm">{customer.phone || 'לא מעודכן'}</strong>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Barcode className="w-4 h-4 text-gray-400" />
            <div>
              <span className="block text-gray-400 text-[10px]">מספר סריאלי:</span>
              <strong className="text-gray-700 font-mono text-sm">{customer.serialNumber || 'לא זמין'}</strong>
            </div>
          </div>
        </div>

        {/* Warranty Selection */}
        <div className="space-y-3.5">
          <label className="block text-gray-700 text-sm font-bold">
            האם יש אחריות לכלי? <span className="text-red-500">*</span>
          </label>
          <div className="grid grid-cols-2 gap-4">
            {/* Warranty - YES */}
            <button
              type="button"
              onClick={() => setHasWarranty('yes')}
              className={`py-4 px-5 rounded-2xl border text-right transition-all flex items-center justify-between group active:scale-[0.98] cursor-pointer ${
                hasWarranty === 'yes'
                  ? 'border-blue-500 bg-blue-50/40 text-blue-700 ring-4 ring-blue-500/10'
                  : 'border-gray-200 bg-white text-gray-500 hover:bg-gray-50 hover:border-gray-300 shadow-sm'
              }`}
            >
              <div>
                <span className="block text-base font-extrabold">כן</span>
                <span className="block text-[11px] text-gray-400 font-medium mt-0.5">יש לצרף תעודה/חשבונית</span>
              </div>
              <ShieldCheck className={`w-7 h-7 transition-all ${
                hasWarranty === 'yes' ? 'text-blue-500 scale-110' : 'text-gray-300 group-hover:text-gray-400'
              }`} />
            </button>

            {/* Warranty - NO */}
            <button
              type="button"
              onClick={() => {
                setHasWarranty('no');
                setWarrantyReceiptImage(null);
                setWarrantyReceiptPreview(null);
              }}
              className={`py-4 px-5 rounded-2xl border text-right transition-all flex items-center justify-between group active:scale-[0.98] cursor-pointer ${
                hasWarranty === 'no'
                  ? 'border-blue-500 bg-blue-50/40 text-blue-700 ring-4 ring-blue-500/10'
                  : 'border-gray-200 bg-white text-gray-500 hover:bg-gray-50 hover:border-gray-300 shadow-sm'
              }`}
            >
              <div>
                <span className="block text-base font-extrabold">לא</span>
                <span className="block text-[11px] text-gray-400 font-medium mt-0.5">כלי ללא תקופת אחריות</span>
              </div>
              <ShieldAlert className={`w-7 h-7 transition-all ${
                hasWarranty === 'no' ? 'text-blue-500 scale-110' : 'text-gray-300 group-hover:text-gray-400'
              }`} />
            </button>
          </div>
        </div>

        {/* Warranty Upload (Conditional) */}
        <AnimatePresence>
          {hasWarranty === 'yes' && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3 }}
              className="space-y-2.5 overflow-hidden"
            >
              <label className="block text-gray-700 text-sm font-bold flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-gray-400" />
                צילום חשבונית או תעודת אחריות <span className="text-red-500">*</span>
              </label>
              
              <div 
                onClick={() => warrantyImageInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all flex flex-col items-center justify-center min-h-[140px] relative group ${
                  warrantyReceiptPreview 
                    ? 'border-solid border-gray-200 bg-gray-50/50' 
                    : 'border-gray-200 hover:bg-blue-50/10 hover:border-blue-400'
                }`}
              >
                <input
                  type="file"
                  accept="image/*"
                  ref={warrantyImageInputRef}
                  onChange={handleWarrantyImageChange}
                  className="hidden"
                />

                {warrantyReceiptPreview ? (
                  <div className="relative group/preview w-full max-w-[240px] aspect-[4/3] rounded-xl overflow-hidden border bg-white shadow-sm">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={warrantyReceiptPreview} alt="Receipt preview" className="w-full h-full object-contain" />
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover/preview:opacity-100 transition-opacity gap-2">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          warrantyImageInputRef.current?.click();
                        }}
                        className="p-2 bg-white text-gray-800 rounded-lg hover:scale-105 transition-all text-xs font-bold shadow cursor-pointer"
                      >
                        החלף תמונה
                      </button>
                      <button
                        type="button"
                        onClick={removeWarrantyImage}
                        className="p-2 bg-red-600 text-white rounded-lg hover:scale-105 transition-all shadow cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="w-11 h-11 rounded-full bg-blue-50 border border-blue-100/50 flex items-center justify-center text-blue-600 mb-2.5 transition-transform group-hover:scale-110">
                      <UploadCloud className="w-5 h-5" />
                    </div>
                    <span className="text-blue-600 font-extrabold text-sm">לחץ כאן להעלאת צילום התעודה / החשבונית</span>
                    <span className="text-gray-400 text-xs mt-1">(קבצי תמונות בלבד)</span>
                  </>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Tool Image upload (Mandatory, Up to 3) */}
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <label className="block text-gray-700 text-sm font-bold flex items-center gap-1.5">
              <UploadCloud className="w-4 h-4 text-gray-400" />
              צילומים של הכלי <span className="text-red-500">*</span>
            </label>
            <span className="text-xs text-gray-400 font-bold bg-gray-100 px-2 py-0.5 rounded-lg border border-gray-200/20">({toolImages.length}/3 תמונות)</span>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Render Previews */}
            {toolImagePreviews.map((preview, idx) => (
              <div key={idx} className="relative group/preview aspect-[4/3] rounded-xl overflow-hidden border border-gray-200 bg-white shadow-sm flex items-center justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={preview} alt={`Tool preview ${idx + 1}`} className="w-full h-full object-contain" />
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover/preview:opacity-100 transition-opacity gap-2">
                  <button
                    type="button"
                    onClick={(e) => removeToolImage(idx, e)}
                    className="p-2 bg-red-600 text-white rounded-lg hover:scale-105 transition-all shadow cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
            
            {/* Upload Button Slot (if < 3) */}
            {toolImages.length < 3 && (
              <div 
                onClick={() => toolImageInputRef.current?.click()}
                className="border-2 border-dashed border-gray-200 rounded-xl aspect-[4/3] text-center cursor-pointer transition-all flex flex-col items-center justify-center hover:bg-blue-50/10 hover:border-blue-400 group min-h-[120px]"
              >
                <input
                  type="file"
                  accept="image/*"
                  ref={toolImageInputRef}
                  onChange={handleToolImageChange}
                  className="hidden"
                  multiple
                />
                <div className="w-9 h-9 rounded-full bg-blue-50 border border-blue-100/50 flex items-center justify-center text-blue-600 mb-1.5 transition-transform group-hover:scale-110">
                  <UploadCloud className="w-4 h-4" />
                </div>
                <span className="text-blue-600 font-extrabold text-xs">הוסף תמונה</span>
                <span className="text-gray-400 text-[10px] mt-0.5">עד 3 תמונות</span>
              </div>
            )}
          </div>
        </div>

        {/* Personal Items Disclaimer */}
        <div className="p-4 bg-indigo-50/40 border border-indigo-100/50 rounded-2xl flex items-start gap-3 text-indigo-900 text-xs shadow-sm text-right" dir="rtl">
          <span className="text-xl flex-shrink-0 select-none">🎒</span>
          <div className="leading-relaxed">
            <strong className="block text-indigo-950 font-bold mb-0.5">קחו איתכם ציוד אישי!</strong>
            מטענים, תיקים, קסדות או כל חפץ אישי אחר שנשארים על הכלי הם באחריותכם בלבד. מומלץ לקחת אותם כדי לשמור עליהם מכל משמר! ❤️
          </div>
        </div>

        {/* Cost acceptance checkbox */}
        <div className="p-5 bg-amber-50/40 border border-amber-100/80 rounded-2xl transition-all hover:bg-amber-50/60 shadow-sm">
          <label className="flex items-start cursor-pointer select-none">
            <input
              type="checkbox"
              checked={agreedToInspectionFee}
              onChange={(e) => setAgreedToInspectionFee(e.target.checked)}
              className="w-5 h-5 mt-0.5 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
              required
            />
            <span className="mr-3 text-sm text-gray-600 leading-relaxed font-bold">
              אני מאשר/ת ומסכים/ה לשלם <strong className="text-amber-800">150 ש&quot;ח דמי בדיקה</strong> במידה ויימצאו בכלי דברים שאינם קשורים לאחריות, ואבחר שלא לבצע את התיקון.
            </span>
          </label>
        </div>

        {/* Submit button */}
        <motion.button
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.99 }}
          type="submit"
          disabled={isSubmitting}
          className={`w-full py-4 rounded-2xl text-white text-base font-extrabold shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer ${
            isSubmitting
              ? 'bg-blue-400 cursor-not-allowed shadow-none'
              : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-blue-500/25 active:scale-[0.98]'
          }`}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>שולח קריאה לענן...</span>
            </>
          ) : (
            <>
              <Check className="w-5 h-5" />
              <span>שלח קריאת שירות</span>
            </>
          )}
        </motion.button>
      </form>
    </motion.div>
  );
}
