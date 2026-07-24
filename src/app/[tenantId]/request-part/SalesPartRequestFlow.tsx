'use client';

import React, { useState, useRef } from 'react';
import type { Customer, PartRequest } from '@/lib/db';
import { Package, Phone, User, MapPin, Camera, ArrowRight, CheckCircle2, Loader2, Sparkles, Send, Image } from 'lucide-react';

function normalizePhone(phone: string): string {
  if (!phone) return '';
  let digits = phone.replace(/\D/g, '');
  if (digits.startsWith('972')) {
    digits = '0' + digits.slice(3);
  }
  return digits;
}

interface Props {
  tenantId: string;
  businessName: string;
  logoUrl?: string;
  partsRequestPhone?: string;
}

export default function SalesPartRequestFlow({ tenantId, businessName, logoUrl, partsRequestPhone }: Props) {
  // Step: 'phone' | 'register' | 'part_form' | 'success'
  const [step, setStep] = useState<'phone' | 'register' | 'part_form' | 'success'>('phone');
  
  // Phone State
  const [phoneInput, setPhoneInput] = useState('');
  const [isVerifyingPhone, setIsVerifyingPhone] = useState(false);
  const [phoneError, setPhoneError] = useState<string | null>(null);

  // Customer State
  const [customer, setCustomer] = useState<Customer | null>(null);

  // Registration State
  const [storeName, setStoreName] = useState('');
  const [address, setAddress] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);

  // Part Form State
  const [description, setDescription] = useState('');
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [isSubmittingPart, setIsSubmittingPart] = useState(false);
  const [createdPartRequest, setCreatedPartRequest] = useState<PartRequest | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // 1. Verify Phone Number
  const handleVerifyPhone = async (e: React.FormEvent) => {
    e.preventDefault();
    setPhoneError(null);
    const cleaned = normalizePhone(phoneInput);
    if (!cleaned || cleaned.length < 9) {
      setPhoneError('אנא הזן מספר טלפון תקין (לדוגמה: 0501234567)');
      return;
    }

    setIsVerifyingPhone(true);
    try {
      const res = await fetch(`/api/${tenantId}/customers/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: cleaned }),
      });
      const data = await res.json();
      if (res.ok && data.customer) {
        setCustomer(data.customer);
        setStep('part_form');
      } else {
        // Customer does not exist in database, proceed to registration
        setStep('register');
      }
    } catch {
      setPhoneError('שגיאה בחיבור לשרת, אנא נסה שנית');
    } finally {
      setIsVerifyingPhone(false);
    }
  };

  // 2. Register New Customer
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setPhoneError(null);
    if (!storeName.trim()) {
      setPhoneError('שם חנות הוא שדה חובה');
      return;
    }
    if (!phoneInput.trim()) {
      setPhoneError('מספר טלפון הוא שדה חובה');
      return;
    }

    setIsRegistering(true);
    try {
      const res = await fetch(`/api/${tenantId}/customers/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storeName: storeName.trim(),
          phone: phoneInput.trim(),
          address: address.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (res.ok && data.customer) {
        setCustomer(data.customer);
        setStep('part_form');
      } else {
        setPhoneError(data.error || 'שגיאה בהרשמה במערכת');
      }
    } catch {
      setPhoneError('שגיאה בתקשורת עם השרת');
    } finally {
      setIsRegistering(false);
    }
  };

  // 3. Handle Photo Upload
  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setPhoto(file);
      setPhotoPreview(URL.createObjectURL(file));
    }
  };

  // 4. Submit Part Request
  const handleSubmitPartRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customer) return;
    if (!description.trim()) {
      setPhoneError('אנא תאר את החלק המבוקש');
      return;
    }
    if (!photo) {
      setPhoneError('חובה לצרף תמונה של החלק המבוקש');
      return;
    }

    setIsSubmittingPart(true);
    setPhoneError(null);

    try {
      const formData = new FormData();
      formData.append('customerId', customer.id);
      formData.append('description', description.trim());
      formData.append('photo', photo);

      const res = await fetch(`/api/${tenantId}/parts-requests`, {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (res.ok && data.request) {
        setCreatedPartRequest(data.request);
        setStep('success');
      } else {
        setPhoneError(data.error || 'שגיאה בשליחת בקשת החלק');
      }
    } catch {
      setPhoneError('שגיאה בתקשורת עם השרת');
    } finally {
      setIsSubmittingPart(false);
    }
  };

  const getCleanWhatsAppPhone = (p?: string) => {
    if (!p) return '';
    let digits = p.replace(/\D/g, '');
    if (digits.startsWith('0')) digits = '972' + digits.slice(1);
    return digits;
  };

  const targetWhatsappPhone = getCleanWhatsAppPhone(partsRequestPhone);

  const whatsappMessage = encodeURIComponent(
    `היי, ${customer?.firstName} ${customer?.lastName} מבקש/ת חלק ב-${businessName}:\n"${description}"\n\nלצפייה בבקשה ובבתמונה:\n${typeof window !== 'undefined' ? window.location.origin : ''}/${tenantId}/part/${createdPartRequest?.id || ''}`
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-4 sm:p-6" dir="rtl">
      <div className="w-full max-w-md space-y-6">
        
        {/* Header */}
        <div className="text-center space-y-3">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-green-500 to-emerald-400 p-0.5 shadow-xl shadow-green-500/20 mx-auto flex items-center justify-center">
            {logoUrl ? (
              <img src={logoUrl} alt={businessName} className="w-full h-full object-contain rounded-[14px] bg-slate-900 p-1" />
            ) : (
              <div className="w-full h-full bg-slate-900 rounded-[14px] flex items-center justify-center text-emerald-400 font-black text-2xl">
                <Package className="w-8 h-8" />
              </div>
            )}
          </div>

          <div>
            <span className="text-[11px] font-black uppercase tracking-widest text-emerald-400 block mb-1">
              {businessName} • שירות חלקים
            </span>
            <h1 className="text-2xl font-black text-white">בקשת חלק חדשה</h1>
            <p className="text-xs text-slate-400 mt-1">טופס מהיר לבקשת חלקים וחלפים</p>
          </div>
        </div>

        {/* Card Container */}
        <div className="bg-slate-900/90 backdrop-blur-2xl border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-5 relative overflow-hidden">
          
          {phoneError && (
            <div className="p-3.5 bg-red-500/10 border border-red-500/30 text-red-400 rounded-2xl text-xs font-bold text-center animate-shake">
              {phoneError}
            </div>
          )}

          {/* STEP 1: Phone Entry */}
          {step === 'phone' && (
            <form onSubmit={handleVerifyPhone} className="space-y-4">
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-300">הזן את מספר הטלפון שלך להמשך:</label>
                <div className="relative">
                  <input
                    type="tel"
                    placeholder="050-1234567"
                    value={phoneInput}
                    onChange={(e) => setPhoneInput(e.target.value)}
                    required
                    className="w-full px-4 py-3.5 pl-11 rounded-2xl bg-slate-950 border border-slate-800 focus:border-emerald-500 focus:outline-none text-white font-mono text-base tracking-wider placeholder-slate-600 transition-all"
                    dir="ltr"
                  />
                  <Phone className="w-5 h-5 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                </div>
              </div>

              <button
                type="submit"
                disabled={isVerifyingPhone}
                className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl font-extrabold text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/30 transition-all active:scale-[0.98] cursor-pointer disabled:opacity-50"
              >
                {isVerifyingPhone ? <Loader2 className="w-5 h-5 animate-spin" /> : <ArrowRight className="w-5 h-5" />}
                <span>להמשך לבקשת חלק</span>
              </button>
            </form>
          )}

          {/* STEP 2: Self Registration */}
          {step === 'register' && (
            <form onSubmit={handleRegister} className="space-y-4">
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-xs text-emerald-300 font-bold flex items-center gap-2">
                <Sparkles className="w-4 h-4 shrink-0 text-emerald-400" />
                <span>הקמה מהירה: אנא הזן את פרטי החנות כדי שנוכל לקשר את הבקשה אליך.</span>
              </div>

              <div className="space-y-3">
                {/* שם חנות */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-300">שם חנות *</label>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="חנות אופניים/קורקינטים"
                      value={storeName}
                      onChange={(e) => setStoreName(e.target.value)}
                      required
                      className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 focus:border-emerald-500 focus:outline-none text-white text-sm"
                    />
                    <User className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  </div>
                </div>

                {/* מספר טלפון */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-300">מספר טלפון *</label>
                  <div className="relative">
                    <input
                      type="tel"
                      placeholder="050-1234567"
                      value={phoneInput}
                      onChange={(e) => setPhoneInput(e.target.value)}
                      required
                      className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 focus:border-emerald-500 focus:outline-none text-white font-mono text-sm"
                      dir="ltr"
                    />
                    <Phone className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  </div>
                </div>

                {/* כתובת */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-300">כתובת</label>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="הרצל 10, תל אביב"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 focus:border-emerald-500 focus:outline-none text-white text-sm"
                    />
                    <MapPin className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={isRegistering}
                className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl font-extrabold text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/30 transition-all active:scale-[0.98] cursor-pointer disabled:opacity-50"
              >
                {isRegistering ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
                <span>סים הרשמה ועבור לבקשת חלק</span>
              </button>
            </form>
          )}

          {/* STEP 3: Part Request Form */}
          {step === 'part_form' && customer && (
            <form onSubmit={handleSubmitPartRequest} className="space-y-4">
              <div className="pb-3 border-b border-slate-800 flex items-center justify-between text-xs">
                <span className="text-slate-400 font-medium">מבקש: <strong className="text-white">{customer.firstName} {customer.lastName}</strong></span>
                <span className="font-mono text-emerald-400 font-bold">{customer.phone}</span>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-300">תיאור החלק המבוקש *</label>
                <textarea
                  rows={3}
                  placeholder="לדוגמה: רפידות בלם קדמיות לקורקינט שיאומי PRO2..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  required
                  className="w-full px-4 py-3 rounded-2xl bg-slate-950 border border-slate-800 focus:border-emerald-500 focus:outline-none text-white text-sm resize-none"
                />
              </div>

              {/* Photo Upload Area */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-300">תמונת החלק *</label>

                <input
                  type="file"
                  accept="image/*"
                  ref={fileInputRef}
                  onChange={handlePhotoChange}
                  className="hidden"
                />
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  ref={cameraInputRef}
                  onChange={handlePhotoChange}
                  className="hidden"
                />

                {photoPreview ? (
                  <div className="relative rounded-2xl overflow-hidden border border-emerald-500/50 bg-slate-950 aspect-video flex items-center justify-center">
                    <img src={photoPreview} alt="תצוגה מקדימה" className="w-full h-full object-contain" />
                    <div className="absolute top-2 right-2 flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => cameraInputRef.current?.click()}
                        className="px-2.5 py-1 bg-emerald-600/90 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <Camera className="w-3.5 h-3.5" /> צלם
                      </button>
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="px-2.5 py-1 bg-slate-800/90 text-slate-200 rounded-lg text-xs font-bold cursor-pointer"
                      >
                        גלריה
                      </button>
                      <button
                        type="button"
                        onClick={() => { setPhoto(null); setPhotoPreview(null); }}
                        className="px-2 py-1 bg-red-600/90 text-white rounded-lg text-xs font-bold cursor-pointer"
                      >
                        הסר
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="border-2 border-dashed border-slate-800 rounded-2xl p-5 flex flex-col items-center justify-center bg-slate-950/50 gap-3">
                    <span className="text-xs font-bold text-slate-300">צלם במצלמה או העלה מהגלריה</span>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => cameraInputRef.current?.click()}
                        className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-2 transition-all active:scale-95 cursor-pointer shadow-lg shadow-emerald-900/30"
                      >
                        <Camera className="w-4 h-4" />
                        <span>צלם במצלמה</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold flex items-center gap-2 transition-all active:scale-95 cursor-pointer"
                      >
                        <Image className="w-4 h-4 text-slate-400" />
                        <span>בחר מהגלריה</span>
                      </button>
                    </div>
                    <span className="text-[10px] text-slate-500">PNG, JPG, WebP עד 10MB</span>
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={isSubmittingPart}
                className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl font-extrabold text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/30 transition-all active:scale-[0.98] cursor-pointer disabled:opacity-50"
              >
                {isSubmittingPart ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                <span>שלח בקשת חלק 🚀</span>
              </button>
            </form>
          )}

          {/* STEP 4: Success Screen */}
          {step === 'success' && (
            <div className="text-center py-6 space-y-5">
              <div className="w-16 h-16 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-10 h-10 animate-bounce" />
              </div>

              <div>
                <h2 className="text-xl font-black text-white">בקשת החלק נשלחה בהצלחה!</h2>
                <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
                  תודה {customer?.firstName}, הבקשה התקבלה ב-{businessName}. ניצור איתך קשר בהקדם!
                </p>
              </div>

              {targetWhatsappPhone && (
                <a
                  href={`https://wa.me/${targetWhatsappPhone}?text=${whatsappMessage}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl font-extrabold text-sm flex items-center justify-center gap-2.5 shadow-xl shadow-emerald-900/30 transition-all active:scale-[0.98] cursor-pointer"
                >
                  <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                    <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.003 5.37 5.378 0 12.003 0a11.94 11.94 0 0 1 8.484 3.513 11.94 11.94 0 0 1 3.51 8.49c-.003 6.63-5.378 12-12.003 12-1.996-.001-3.957-.502-5.709-1.455L0 24zm6.59-14.859c-.12-.2-.24-.2-.35-.2-.11 0-.24-.03-.36-.03-.13 0-.34.05-.52.25-.18.2-.68.66-.68 1.6s.69 1.86.78 2.06c.1.13 1.36 2.07 3.29 2.91.46.2.82.32 1.1.41.47.15.89.13 1.22.08.38-.06 1.15-.47 1.31-.93.16-.46.16-.86.11-.93-.05-.08-.18-.13-.38-.23-.19-.1-.1.38-.1.74-.11.16-.36.23-.74.13-.38-.11-1.42-.52-2.71-1.68-.96-.86-1.61-1.92-1.8-2.25-.19-.33-.02-.51.15-.68.15-.15.33-.36.5-.54.17-.18.23-.3.33-.5.1-.2.05-.38-.03-.48z" />
                  </svg>
                  <span>לחץ לשליחת הודעת WhatsApp לעסק</span>
                </a>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
