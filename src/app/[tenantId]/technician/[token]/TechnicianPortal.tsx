'use client';

import React, { useState, useRef, useEffect } from 'react';
import type { Technician } from '@/lib/db';
import { Package, Camera, Image as ImageIcon, Loader2, Send, CheckCircle2, Lock } from 'lucide-react';

interface Props {
  technician: Technician;
  tenantId: string;
  businessName: string;
  factories: string[];
}

export default function TechnicianPortal({ technician, tenantId, businessName, factories }: Props) {
  // Password gate — mirrors the sales-agent portal (plaintext compared client-side).
  const expectedPassword = technician.passwordPlain || technician.password || '';
  const [hasMounted, setHasMounted] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(!expectedPassword);
  const [inputPassword, setInputPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  useEffect(() => {
    setHasMounted(true);
    if (expectedPassword) {
      try {
        const stored = localStorage.getItem(`technician_auth_${technician.id}`);
        if (stored === 'true') setIsAuthenticated(true);
      } catch {}
    }
  }, [technician.id, expectedPassword]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!expectedPassword || inputPassword.trim() === expectedPassword.trim()) {
      setIsAuthenticated(true);
      setLoginError('');
      try {
        localStorage.setItem(`technician_auth_${technician.id}`, 'true');
      } catch {}
    } else {
      setLoginError('סיסמה שגויה, אנא נסה שוב');
    }
  };

  // Upload form state
  const [partName, setPartName] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [factory, setFactory] = useState(factories[0] || '');
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setPhoto(file);
      setPhotoPreview(URL.createObjectURL(file));
    }
  };

  const resetForm = () => {
    setPartName('');
    setQuantity('1');
    setFactory(factories[0] || '');
    setPhoto(null);
    setPhotoPreview(null);
    setFormError(null);
    setSubmitted(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!partName.trim()) {
      setFormError('אנא הזן את שם החלק');
      return;
    }
    const qty = parseInt(quantity, 10);
    if (!Number.isFinite(qty) || qty < 1) {
      setFormError('אנא הזן כמות תקינה');
      return;
    }

    setIsSubmitting(true);
    setFormError(null);
    try {
      const formData = new FormData();
      formData.append('partName', partName.trim());
      formData.append('quantity', String(qty));
      formData.append('factory', factory.trim());
      formData.append('technicianToken', technician.token);
      if (photo) formData.append('photo', photo);

      const res = await fetch(`/api/${tenantId}/china-orders`, {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (res.ok && data.order) {
        setSubmitted(true);
      } else {
        setFormError(data.error || 'שגיאה בשליחת הבקשה');
      }
    } catch {
      setFormError('שגיאה בתקשורת עם השרת');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Avoid a hydration mismatch: the password gate depends on localStorage.
  if (!hasMounted) {
    return <div className="min-h-screen bg-slate-950" dir="rtl" />;
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-4 sm:p-6" dir="rtl">
        <div className="w-full max-w-sm space-y-6">
          <div className="text-center space-y-3">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-red-500 to-rose-400 mx-auto flex items-center justify-center text-white">
              <Lock className="w-8 h-8" />
            </div>
            <div>
              <span className="text-[11px] font-black uppercase tracking-widest text-red-400 block mb-1">
                {businessName} • הזמנות חלקים מסין
              </span>
              <h1 className="text-2xl font-black text-white">כניסת טכנאי</h1>
              <p className="text-xs text-slate-400 mt-1">שלום {technician.name}, אנא הזן סיסמה להמשך</p>
            </div>
          </div>
          <form
            onSubmit={handleLogin}
            className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4"
          >
            {loginError && (
              <div className="p-3.5 bg-red-500/10 border border-red-500/30 text-red-400 rounded-2xl text-xs font-bold text-center">
                {loginError}
              </div>
            )}
            <input
              type="password"
              placeholder="סיסמה"
              value={inputPassword}
              onChange={(e) => setInputPassword(e.target.value)}
              className="w-full px-4 py-3.5 rounded-2xl bg-slate-950 border border-slate-800 focus:border-red-500 focus:outline-none text-white text-base"
            />
            <button
              type="submit"
              className="w-full py-4 bg-red-600 hover:bg-red-500 text-white rounded-2xl font-extrabold text-sm flex items-center justify-center gap-2 transition-all active:scale-[0.98] cursor-pointer"
            >
              <Lock className="w-5 h-5" />
              <span>כניסה</span>
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-4 sm:p-6" dir="rtl">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-3">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-red-500 to-rose-400 mx-auto flex items-center justify-center text-white">
            <Package className="w-8 h-8" />
          </div>
          <div>
            <span className="text-[11px] font-black uppercase tracking-widest text-red-400 block mb-1">
              {businessName} • הזמנות חלקים מסין
            </span>
            <h1 className="text-2xl font-black text-white">בקשת חלק מסין</h1>
            <p className="text-xs text-slate-400 mt-1">טכנאי: {technician.name}</p>
          </div>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-5">
          {formError && (
            <div className="p-3.5 bg-red-500/10 border border-red-500/30 text-red-400 rounded-2xl text-xs font-bold text-center">
              {formError}
            </div>
          )}

          {submitted ? (
            <div className="text-center py-6 space-y-5">
              <div className="w-16 h-16 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-10 h-10" />
              </div>
              <div>
                <h2 className="text-xl font-black text-white">הבקשה נשלחה בהצלחה!</h2>
                <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
                  תודה {technician.name}, הבקשה התקבלה וממתינה לאישור המנהל.
                </p>
              </div>
              <button
                type="button"
                onClick={resetForm}
                className="w-full py-4 bg-red-600 hover:bg-red-500 text-white rounded-2xl font-extrabold text-sm flex items-center justify-center gap-2 transition-all active:scale-[0.98] cursor-pointer"
              >
                <Package className="w-5 h-5" />
                <span>שליחת בקשה נוספת</span>
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-300">שם החלק *</label>
                <input
                  type="text"
                  placeholder="לדוגמה: בקר מהירות לקורקינט 48V"
                  value={partName}
                  onChange={(e) => setPartName(e.target.value)}
                  className="w-full px-4 py-3 rounded-2xl bg-slate-950 border border-slate-800 focus:border-red-500 focus:outline-none text-white text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-300">כמות *</label>
                  <input
                    type="number"
                    min={1}
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    className="w-full px-4 py-3 rounded-2xl bg-slate-950 border border-slate-800 focus:border-red-500 focus:outline-none text-white text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-300">מפעל מייצר</label>
                  <select
                    value={factory}
                    onChange={(e) => setFactory(e.target.value)}
                    className="w-full px-4 py-3 rounded-2xl bg-slate-950 border border-slate-800 focus:border-red-500 focus:outline-none text-white text-sm"
                  >
                    <option value="">ללא מפעל</option>
                    {factories.map((f) => (
                      <option key={f} value={f}>{f}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-300">תמונת החלק</label>
                <input type="file" accept="image/*" ref={fileInputRef} onChange={handlePhotoChange} className="hidden" />
                <input type="file" accept="image/*" capture="environment" ref={cameraInputRef} onChange={handlePhotoChange} className="hidden" />

                {photoPreview ? (
                  <div className="relative rounded-2xl overflow-hidden border border-red-500/50 bg-slate-950 aspect-video flex items-center justify-center">
                    <img src={photoPreview} alt="תצוגה מקדימה" className="w-full h-full object-contain" />
                    <div className="absolute top-2 right-2 flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => cameraInputRef.current?.click()}
                        className="px-2.5 py-1 bg-red-600/90 hover:bg-red-500 text-white rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer"
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
                        className="px-2 py-1 bg-red-700/90 text-white rounded-lg text-xs font-bold cursor-pointer"
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
                        className="px-4 py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-bold flex items-center gap-2 transition-all active:scale-95 cursor-pointer"
                      >
                        <Camera className="w-4 h-4" />
                        <span>צלם במצלמה</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold flex items-center gap-2 transition-all active:scale-95 cursor-pointer"
                      >
                        <ImageIcon className="w-4 h-4 text-slate-400" />
                        <span>בחר מהגלריה</span>
                      </button>
                    </div>
                    <span className="text-[10px] text-slate-500">PNG, JPG, WebP עד 8MB</span>
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-4 bg-red-600 hover:bg-red-500 text-white rounded-2xl font-extrabold text-sm flex items-center justify-center gap-2 transition-all active:scale-[0.98] cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                <span>שלח בקשה 🚀</span>
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
