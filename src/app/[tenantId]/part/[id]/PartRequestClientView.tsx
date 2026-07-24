'use client';

import React, { useState } from 'react';
import { PartRequest } from '@/lib/db';
import { Package, Phone, CheckCircle2, Clock, MapPin, Calendar, ExternalLink, ZoomIn, X, ChevronRight } from 'lucide-react';
import Link from 'next/link';

interface Props {
  partRequest: PartRequest;
  tenantId: string;
  businessName: string;
  logoUrl?: string;
}

export default function PartRequestClientView({ partRequest, tenantId, businessName, logoUrl }: Props) {
  const [status, setStatus] = useState<'NEW' | 'FULFILLED' | 'READY_FOR_DISPATCH'>(partRequest.status || 'NEW');
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [isZoomOpen, setIsZoomOpen] = useState(false);

  const customer = partRequest.customer;

  // Format Israeli phone for WhatsApp (e.g., 0521234567 -> 972521234567)
  const getCleanPhone = (phone?: string) => {
    if (!phone) return '';
    let digits = phone.replace(/\D/g, '');
    if (digits.startsWith('0')) {
      digits = '972' + digits.slice(1);
    }
    return digits;
  };

  const cleanPhone = getCleanPhone(customer?.phone);

  const customerFirstName = customer?.firstName || 'לקוח';
  const customerFullName = customer ? `${customer.firstName} ${customer.lastName}`.trim() : 'לקוח יקר';

  const whatsappMessage = encodeURIComponent(
    `שלום ${customerFirstName}, קיבלנו את בקשת החלק שלך: "${partRequest.description}" ב-${businessName}.\nאשמח לסייע לך בהמשך ההזמנה!`
  );

  const whatsappUrl = cleanPhone ? `https://wa.me/${cleanPhone}?text=${whatsappMessage}` : null;

  const handleToggleStatus = async () => {
    const nextStatus = status === 'NEW' ? 'FULFILLED' : 'NEW';
    setIsUpdatingStatus(true);
    try {
      const res = await fetch(`/api/${tenantId}/parts-requests/${partRequest.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (res.ok) {
        setStatus(nextStatus);
      } else {
        alert('שגיאה בעדכון הסטטוס');
      }
    } catch {
      alert('שגיאה בתקשורת עם השרת');
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('he-IL', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-start p-4 sm:p-6 lg:p-8" dir="rtl">
      {/* Container */}
      <div className="w-full max-w-2xl space-y-6">
        
        {/* Top Header Navigation */}
        <div className="flex items-center justify-between">
          <Link
            href={`/${tenantId}/admin`}
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors bg-slate-900/60 px-3 py-2 rounded-xl border border-slate-800"
          >
            <ChevronRight className="w-4 h-4" />
            <span>חזרה לפאנל ניהול</span>
          </Link>

          <div className="flex items-center gap-2">
            {logoUrl && (
              <img src={logoUrl} alt={businessName} className="w-7 h-7 object-contain rounded-lg bg-white/10 p-0.5" />
            )}
            <span className="text-xs font-bold text-slate-300">{businessName}</span>
          </div>
        </div>

        {/* Hero Request Card */}
        <div className="bg-slate-900/80 backdrop-blur-2xl border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 relative overflow-hidden">
          {/* Subtle Ambient Blur */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>

          {/* Title & Status */}
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-800/80 pb-5">
            <div>
              <div className="flex items-center gap-2 text-blue-400 text-xs font-extrabold uppercase tracking-wider mb-1">
                <Package className="w-4 h-4" />
                <span>בקשת חלק #{partRequest.requestNumber || ''}</span>
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-white leading-tight">
                {partRequest.description}
              </h1>
            </div>

            {/* Status Pill */}
            <div>
              {status === 'FULFILLED' ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-green-500/20 text-green-400 border border-green-500/30">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>טופל / סופק</span>
                </span>
              ) : status === 'READY_FOR_DISPATCH' ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                  <Package className="w-3.5 h-3.5" />
                  <span>מוכן וממתין לשילוח 📦</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-blue-500/20 text-blue-400 border border-blue-500/30">
                  <Clock className="w-3.5 h-3.5 animate-pulse" />
                  <span>חדש - ממתין לטיפול</span>
                </span>
              )}
            </div>
          </div>

          {/* Image Display */}
          {partRequest.photoImage ? (
            <div className="space-y-2">
              <span className="text-xs font-bold text-slate-400 block">תמונת החלק המבוקש:</span>
              <div
                onClick={() => setIsZoomOpen(true)}
                className="relative group cursor-pointer rounded-2xl overflow-hidden border border-slate-800 bg-slate-950/60 aspect-video flex items-center justify-center max-h-96"
              >
                <img
                  src={partRequest.photoImage}
                  alt={partRequest.description}
                  className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300"
                />
                <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 text-white font-bold text-sm">
                  <ZoomIn className="w-5 h-5" />
                  <span>לחץ לצפייה במסך מלא</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-6 bg-slate-950/40 rounded-2xl border border-slate-800 text-center text-xs text-slate-500">
              לא צורפה תמונה לבקשה זו.
            </div>
          )}

          {/* Customer Details Section */}
          <div className="bg-slate-950/60 rounded-2xl p-5 border border-slate-800/80 space-y-4">
            <span className="text-xs font-bold text-slate-400 block uppercase tracking-wider">
              פרטי הלקוח המזמין:
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div className="space-y-1">
                <span className="text-xs text-slate-500 block">שם הלקוח</span>
                <strong className="text-white font-bold block">{customerFullName}</strong>
              </div>

              <div className="space-y-1">
                <span className="text-xs text-slate-500 block">מספר טלפון</span>
                {customer?.phone ? (
                  <a
                    href={`tel:${customer.phone}`}
                    className="text-blue-400 hover:underline font-mono font-bold flex items-center gap-1.5"
                  >
                    <Phone className="w-3.5 h-3.5" />
                    <span>{customer.phone}</span>
                  </a>
                ) : (
                  <span className="text-slate-400 font-mono">לא מצוין</span>
                )}
              </div>

              {customer?.address && (
                <div className="space-y-1 sm:col-span-2">
                  <span className="text-xs text-slate-500 block">כתובת</span>
                  <div className="flex items-center gap-1.5 text-slate-300 font-medium">
                    <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                    <span>{customer.address}</span>
                  </div>
                </div>
              )}

              <div className="space-y-1 sm:col-span-2 pt-2 border-t border-slate-800/50 flex items-center justify-between text-xs text-slate-500">
                <span className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>תאריך הגשה:</span>
                </span>
                <span className="font-mono text-slate-300">{formatDate(partRequest.createdAt)}</span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-3 pt-2">
            {/* Primary Action: WhatsApp Conversation Button */}
            {whatsappUrl ? (
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl text-base font-extrabold flex items-center justify-center gap-2.5 shadow-xl shadow-emerald-900/30 transition-all active:scale-[0.98] cursor-pointer"
              >
                <svg className="w-6 h-6 fill-current" viewBox="0 0 24 24">
                  <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.003 5.37 5.378 0 12.003 0a11.94 11.94 0 0 1 8.484 3.513 11.94 11.94 0 0 1 3.51 8.49c-.003 6.63-5.378 12-12.003 12-1.996-.001-3.957-.502-5.709-1.455L0 24zm6.59-14.859c-.12-.2-.24-.2-.35-.2-.11 0-.24-.03-.36-.03-.13 0-.34.05-.52.25-.18.2-.68.66-.68 1.6s.69 1.86.78 2.06c.1.13 1.36 2.07 3.29 2.91.46.2.82.32 1.1.41.47.15.89.13 1.22.08.38-.06 1.15-.47 1.31-.93.16-.46.16-.86.11-.93-.05-.08-.18-.13-.38-.23-.19-.1-.1.38-.1.74-.11.16-.36.23-.74.13-.38-.11-1.42-.52-2.71-1.68-.96-.86-1.61-1.92-1.8-2.25-.19-.33-.02-.51.15-.68.15-.15.33-.36.5-.54.17-.18.23-.3.33-.5.1-.2.05-.38-.03-.48z" />
                </svg>
                <span>דבר עם {customerFirstName} בוואטסאפ לגבי ההזמנה</span>
                <ExternalLink className="w-4 h-4 opacity-70" />
              </a>
            ) : (
              <div className="p-3 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-xl text-xs text-center font-bold">
                לא ניתן לפתוח שיחת WhatsApp (מספר טלפון חסר).
              </div>
            )}

            {/* Secondary Actions Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {customer?.phone && (
                <a
                  href={`tel:${customer.phone}`}
                  className="py-3 px-4 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all"
                >
                  <Phone className="w-4 h-4 text-blue-400" />
                  <span>חייג ללקוח</span>
                </a>
              )}

              <button
                onClick={handleToggleStatus}
                disabled={isUpdatingStatus}
                className="py-3 px-4 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-50 cursor-pointer"
              >
                <CheckCircle2 className={`w-4 h-4 ${status === 'FULFILLED' ? 'text-amber-400' : 'text-green-400'}`} />
                <span>{status === 'FULFILLED' ? 'סמן מחדש כחדש' : 'סמן כטופל / סופק'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Lightbox Modal for Photo Zoom */}
      {isZoomOpen && partRequest.photoImage && (
        <div
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4"
          onClick={() => setIsZoomOpen(false)}
        >
          <button
            onClick={() => setIsZoomOpen(false)}
            className="absolute top-4 right-4 p-3 bg-slate-800/80 hover:bg-slate-700 text-white rounded-full transition-all cursor-pointer"
          >
            <X className="w-6 h-6" />
          </button>
          <img
            src={partRequest.photoImage}
            alt={partRequest.description}
            className="max-w-full max-h-[90vh] object-contain rounded-2xl shadow-2xl"
          />
        </div>
      )}
    </div>
  );
}
