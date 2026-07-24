'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Phone, ArrowRight, ShieldCheck, MessageSquare, Loader2, AlertCircle, Sparkles, Store, MapPin, CheckCircle2, UserPlus } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface CustomerLoginProps {
  tenantId: string;
  businessName: string;
  logoUrl?: string;
  partsRequestPhone?: string;
}

export default function CustomerLogin({ tenantId, businessName, logoUrl, partsRequestPhone }: CustomerLoginProps) {
  const router = useRouter();
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Registration Mode States
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [storeName, setStoreName] = useState('');
  const [city, setCity] = useState('');
  const [address, setAddress] = useState('');

  // Registration Complete Approval Screen State
  const [regSuccessData, setRegSuccessData] = useState<{
    customerId: string;
    customerName: string;
    adminWhatsappPhone: string;
    autoNotifySent: boolean;
  } | null>(null);

  const [baseUrl, setBaseUrl] = useState('');

  useEffect(() => {
    setBaseUrl(window.location.origin);
    // Check if customer previously logged in on this device
    const savedCustomerId = localStorage.getItem(`sherut_cust_${tenantId}`);
    if (savedCustomerId) {
      const savedPhone = localStorage.getItem(`sherut_phone_${tenantId}`);
      if (savedPhone) setPhone(savedPhone);
    }
  }, [tenantId]);

  const formatPhoneNumber = (val: string) => {
    const digits = val.replace(/\D/g, '');
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    const formatted = formatPhoneNumber(e.target.value);
    setPhone(formatted);
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone || phone.replace(/\D/g, '').length < 9) {
      setError('אנא הזן מספר טלפון תקין (לפחות 9 ספרות)');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/${tenantId}/customers/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.notFound) {
          // Switch to registration mode
          setIsRegisterMode(true);
          setError(null);
          return;
        }
        throw new Error(data.error || 'שגיאה בהתחברות');
      }

      if (data.success && data.customerId) {
        localStorage.setItem(`sherut_cust_${tenantId}`, data.customerId);
        localStorage.setItem(`sherut_phone_${tenantId}`, phone);
        router.push(`/${tenantId}/portal/${data.customerId}`);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'אירעה שגיאה. אנא נסה שוב.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!storeName.trim()) {
      setError('אנא הזן שם חנות');
      return;
    }
    if (!phone || phone.replace(/\D/g, '').length < 9) {
      setError('מספר טלפון אינו תקין');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/${tenantId}/customers/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storeName: storeName.trim(),
          phone,
          city: city.trim(),
          address: address.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'שגיאה בהרשמה');
      }

      if (data.success && data.customerId) {
        localStorage.setItem(`sherut_cust_${tenantId}`, data.customerId);
        localStorage.setItem(`sherut_phone_${tenantId}`, phone);

        setRegSuccessData({
          customerId: data.customerId,
          customerName: data.customerName || storeName,
          adminWhatsappPhone: data.adminWhatsappPhone || partsRequestPhone || '',
          autoNotifySent: !!data.autoNotifySent,
        });
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'אירעה שגיאה בהרשמה. אנא נסה שוב.');
    } finally {
      setLoading(false);
    }
  };

  // Compute WhatsApp link for admin approval
  const targetAdminPhone = regSuccessData?.adminWhatsappPhone || partsRequestPhone || '';
  const cleanAdminPhone = targetAdminPhone.replace(/\D/g, '');
  const formattedAdminPhone = cleanAdminPhone.startsWith('0') ? '972' + cleanAdminPhone.slice(1) : cleanAdminPhone;
  
  const portalUrl = regSuccessData ? `${baseUrl}/${tenantId}/portal/${regSuccessData.customerId}` : '';
  const approvalWhatsappUrl = formattedAdminPhone
    ? `https://wa.me/${formattedAdminPhone}?text=${encodeURIComponent(
        `שלום, נרשמתי כלקוח חדש ב-${businessName}.\nשם החנות: ${storeName || regSuccessData?.customerName}\nטלפון: ${phone}\nאשמח לאישור הגישה שלי בפורטל קריאות השירות:\n${portalUrl}`
      )}`
    : '';

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between p-4 sm:p-6 dir-rtl" dir="rtl">
      {/* Background gradients */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-blue-600/20 rounded-full blur-3xl" />
        <div className="absolute top-1/2 -left-40 w-96 h-96 bg-emerald-600/15 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 right-1/4 w-96 h-96 bg-purple-600/20 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-md mx-auto my-auto pt-6 pb-10">
        {/* Business Branding Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          {logoUrl ? (
            <div className="w-24 h-24 mx-auto mb-4 p-2 bg-slate-900/80 rounded-3xl border border-slate-800 shadow-2xl flex items-center justify-center backdrop-blur-md">
              <img src={logoUrl} alt={businessName} className="max-w-full max-h-full object-contain rounded-2xl" />
            </div>
          ) : (
            <div className="w-20 h-20 mx-auto mb-4 bg-gradient-to-tr from-blue-600 to-indigo-500 rounded-3xl flex items-center justify-center shadow-xl shadow-blue-500/20">
              <Store className="w-10 h-10 text-white" />
            </div>
          )}

          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-slate-900/80 border border-slate-800 text-slate-400 text-xs font-medium mb-2 backdrop-blur-md">
            <Sparkles className="w-3.5 h-3.5 text-blue-400" />
            פורטל לקוחות אישי
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            {businessName}
          </h1>
          <p className="text-slate-400 text-sm mt-1.5">
            {regSuccessData
              ? 'הרשמתך התקבלה בהצלחה!'
              : isRegisterMode
              ? 'טופס הרשמה ללקוח חדש'
              : 'הזן את מספר הטלפון שלך לצפייה ופתיחת קריאות שירות'}
          </p>
        </motion.div>

        {/* 1. REGISTRATION COMPLETE & WHATSAPP APPROVAL SCREEN */}
        {regSuccessData ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-slate-900/80 backdrop-blur-xl border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl text-center space-y-6"
          >
            <div className="w-16 h-16 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/10">
              <CheckCircle2 className="w-10 h-10" />
            </div>

            <div>
              <h2 className="text-xl font-bold text-white mb-2">נרשמת בהצלחה, {regSuccessData.customerName}!</h2>
              <p className="text-slate-300 text-xs sm:text-sm leading-relaxed">
                הרשמת החנות שלך למערכת קריאות השירות של <strong>{businessName}</strong> בוצעה בהצלחה.
              </p>
            </div>

            <div className="bg-emerald-950/40 border border-emerald-500/30 rounded-2xl p-4 space-y-3 text-right">
              {regSuccessData.autoNotifySent ? (
                <div className="flex items-start gap-2.5 text-emerald-300 text-xs">
                  <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5 text-emerald-400" />
                  <p className="leading-relaxed">
                    <strong>הודעת אישור נשלחה אוטומטית</strong> לצוות העסק ב-WhatsApp, כולל קישור ישיר לפורטל שלך. תוכל להמשיך לפורטל בינתיים.
                  </p>
                </div>
              ) : (
                <>
                  <div className="flex items-start gap-2.5 text-emerald-300 text-xs">
                    <MessageSquare className="w-5 h-5 shrink-0 mt-0.5 text-emerald-400" />
                    <p className="leading-relaxed">
                      <strong>שלב אחרון לאישור:</strong> לחץ על הכפתור למטה לשליחת הודעת אישור ב-WhatsApp למנהל העסק. ההודעה כוללת קישור ישיר לפורטל הלקוח שלך!
                    </p>
                  </div>

                  {approvalWhatsappUrl ? (
                    <a
                      href={approvalWhatsappUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3.5 px-4 rounded-xl flex items-center justify-center gap-2.5 shadow-lg shadow-emerald-600/30 transition-all active:scale-[0.98]"
                    >
                      <MessageSquare className="w-5 h-5" />
                      <span>לחץ לשליחת הודעת אישור ב-WhatsApp</span>
                    </a>
                  ) : null}
                </>
              )}
            </div>

            <button
              type="button"
              onClick={() => router.push(`/${tenantId}/portal/${regSuccessData.customerId}`)}
              className="w-full bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold py-3.5 px-6 rounded-2xl border border-slate-700 flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
            >
              <span>המשך לפורטל האישי שלי</span>
              <ArrowRight className="w-4 h-4 rotate-180" />
            </button>
          </motion.div>
        ) : isRegisterMode ? (
          /* 2. REGISTRATION FORM MODE */
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-slate-900/70 backdrop-blur-xl border border-slate-800/80 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-black/50"
          >
            <div className="mb-6 p-4 bg-blue-500/10 border border-blue-500/20 rounded-2xl flex items-center gap-3">
              <UserPlus className="w-6 h-6 text-blue-400 shrink-0" />
              <div>
                <h3 className="text-xs font-bold text-blue-300">מספר הנייד לא נמצא - הרשמה מהירה</h3>
                <p className="text-[11px] text-blue-200/70">מלא את הפרטים וכנס מיד לפורטל לפתיחת קריאה</p>
              </div>
            </div>

            <form onSubmit={handleRegisterSubmit} className="space-y-4">
              <div>
                <label className="block text-slate-300 text-xs font-semibold mb-1">שם חנות *</label>
                <div className="relative">
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-slate-500">
                    <Store className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    value={storeName}
                    onChange={(e) => setStoreName(e.target.value)}
                    placeholder="שם החנות שלך"
                    required
                    className="w-full bg-slate-950/80 border border-slate-800 rounded-xl py-3 pr-10 pl-3 text-white text-sm focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 text-xs font-semibold mb-1">מספר טלפון נייד</label>
                <div className="relative">
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-slate-500">
                    <Phone className="w-4 h-4" />
                  </div>
                  <div
                    dir="ltr"
                    className="w-full bg-slate-950/50 border border-slate-800 rounded-xl py-3 pr-10 pl-3 text-slate-400 text-left text-sm font-mono"
                  >
                    {phone}
                  </div>
                </div>
                <p className="text-[10px] text-slate-500 mt-1">המספר שהזנת במסך הקודם — לא ניתן לשינוי כאן.</p>
              </div>

              <div>
                <label className="block text-slate-300 text-xs font-semibold mb-1">עיר (אופציונלי)</label>
                <div className="relative">
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-slate-500">
                    <MapPin className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="עיר"
                    className="w-full bg-slate-950/80 border border-slate-800 rounded-xl py-3 pr-10 pl-3 text-white text-sm focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 text-xs font-semibold mb-1">כתובת (אופציונלי)</label>
                <div className="relative">
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-slate-500">
                    <MapPin className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="רחוב ומספר"
                    className="w-full bg-slate-950/80 border border-slate-800 rounded-xl py-3 pr-10 pl-3 text-white text-sm focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <AnimatePresence>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -5 }}
                    className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 flex items-center gap-2 text-red-400 text-xs"
                  >
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{error}</span>
                  </motion.div>
                )}
              </AnimatePresence>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold py-3.5 px-6 rounded-2xl shadow-xl shadow-blue-600/25 flex items-center justify-center gap-2 transition-all transform active:scale-[0.98] disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>רושם לקוח...</span>
                  </>
                ) : (
                  <>
                    <span>סיום הרשמה וכניסה לפורטל</span>
                    <ArrowRight className="w-4 h-4 rotate-180" />
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsRegisterMode(false);
                  setError(null);
                }}
                className="w-full text-slate-400 hover:text-slate-200 text-xs text-center py-1 font-medium transition-colors"
              >
                חזרה למסך התחברות
              </button>
            </form>
          </motion.div>
        ) : (
          /* 3. NORMAL PHONE LOGIN MODE */
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.25 }}
            className="bg-slate-900/70 backdrop-blur-xl border border-slate-800/80 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-black/50"
          >
            <form onSubmit={handleLoginSubmit} className="space-y-6">
              <div>
                <label className="block text-slate-300 text-xs font-semibold uppercase tracking-wider mb-2.5">
                  מספר טלפון נייד
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none text-slate-500">
                    <Phone className="w-5 h-5" />
                  </div>
                  <input
                    type="tel"
                    dir="ltr"
                    value={phone}
                    onChange={handlePhoneChange}
                    placeholder="050-000-0000"
                    maxLength={13}
                    className="w-full bg-slate-950/80 border border-slate-800 rounded-2xl py-4 pr-12 pl-4 text-white placeholder-slate-600 text-left text-lg font-mono focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 transition-all"
                    autoFocus
                  />
                </div>
                <p className="text-xs text-slate-500 mt-2 text-right">
                  המערכת תאמת את המספר מול רשימת הלקוחות הרשומים
                </p>
              </div>

              <AnimatePresence>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 flex items-start gap-3 text-red-400 text-sm"
                  >
                    <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                    <span>{error}</span>
                  </motion.div>
                )}
              </AnimatePresence>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold py-4 px-6 rounded-2xl shadow-xl shadow-blue-600/25 flex items-center justify-center gap-3 transition-all transform active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>מאמת מספר טלפון...</span>
                  </>
                ) : (
                  <>
                    <span>כניסה לפורטל שלי</span>
                    <ArrowRight className="w-5 h-5 rotate-180" />
                  </>
                )}
              </button>
            </form>

            <div className="mt-6 pt-6 border-t border-slate-800/80 flex items-center justify-center gap-2 text-xs text-slate-500">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>אזור אישי מוגן ומאובטח ע"י {businessName}</span>
            </div>
          </motion.div>
        )}
      </div>

      <footer className="relative z-10 text-center text-slate-600 text-xs py-2">
        WiseWheel &copy; {new Date().getFullYear()} - מערכת ניהול קריאות שירות
      </footer>
    </div>
  );
}
