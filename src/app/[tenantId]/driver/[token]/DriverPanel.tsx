'use client';

import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Phone,
  MessageSquare,
  Truck,
  Search,
  RefreshCw,
  MapPin,
  User,
  Loader2,
  CheckCircle,
  X,
  Camera,
  FileText
} from 'lucide-react';
import { ServiceRequest, Driver } from '@/lib/db';
import { formatRequestNumber } from '@/lib/format';
import SignatureCanvas from './SignatureCanvas';

interface DriverPanelProps {
  driver: Driver;
  initialRequests: ServiceRequest[];
  tenantId: string;
  businessName: string;
}

const STATUS_GROUPS: { status: ServiceRequest['status']; label: string }[] = [
  { status: 'WAITING_FOR_PICKUP', label: 'ממתין לאיסוף' },
  { status: 'NEW', label: 'חדש' },
  { status: 'PICKED_UP_BY_DRIVER', label: 'נאסף' },
];

export default function DriverPanel({ driver, initialRequests, tenantId, businessName }: DriverPanelProps) {
  const [requests, setRequests] = useState<ServiceRequest[]>(initialRequests);
  const [searchQuery, setSearchQuery] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // Handover form (digital signature) state
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isHandoverOpen, setIsHandoverOpen] = useState(false);
  const [signerName, setSignerName] = useState('');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [hasDrawn, setHasDrawn] = useState(false);
  const [isSubmittingHandover, setIsSubmittingHandover] = useState(false);
  const [handoverError, setHandoverError] = useState<string | null>(null);
  const signatureCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [conditionNotes, setConditionNotes] = useState<Record<string, string>>({});

  const toggleSelected = (reqId: string) => {
    setSelectedIds(prev => prev.includes(reqId) ? prev.filter(id => id !== reqId) : [...prev, reqId]);
  };

  const handleSubmitHandover = async () => {
    const canvas = signatureCanvasRef.current;
    if (!canvas || !hasDrawn || !signerName.trim() || selectedIds.length === 0) return;
    setIsSubmittingHandover(true);
    setHandoverError(null);
    try {
      const blob: Blob = await new Promise((resolve, reject) =>
        canvas.toBlob(b => b ? resolve(b) : reject(new Error('empty signature')), 'image/png'));
      const fd = new FormData();
      fd.append('requestIds', JSON.stringify(selectedIds));
      fd.append('driverToken', driver.id);
      fd.append('signerName', signerName.trim());
      fd.append('signature', blob, 'signature.png');
      fd.append('conditionNotes', JSON.stringify(conditionNotes));
      if (photoFile) fd.append('photo', photoFile);

      const res = await fetch(`/api/${tenantId}/requests/driver-pickup`, { method: 'POST', body: fd });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || 'שגיאה בשליחת הטופס');
      }

      setRequests(prev => prev.map(r => selectedIds.includes(r.id) ? { ...r, status: 'PICKED_UP_BY_DRIVER' } : r));
      setSelectedIds([]);
      setIsHandoverOpen(false);
      setSignerName('');
      setPhotoFile(null);
      setHasDrawn(false);
      setConditionNotes({});
      handleRefresh();
    } catch (err) {
      setHandoverError(err instanceof Error ? err.message : 'שגיאה בשליחת הטופס');
    } finally {
      setIsSubmittingHandover(false);
    }
  };

  const handleMarkAsPickedUp = async (reqId: string) => {
    setUpdatingId(reqId);
    try {
      const res = await fetch(`/api/${tenantId}/requests/${reqId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'PICKED_UP_BY_DRIVER', driverToken: driver.id }),
      });

      if (!res.ok) throw new Error('Failed to update status');

      setRequests(prev => prev.map(r => r.id === reqId ? { ...r, status: 'PICKED_UP_BY_DRIVER' } : r));
    } catch {
      alert('שגיאה בעדכון סטטוס הקריאה');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      const res = await fetch(`/api/${tenantId}/requests/by-driver/${driver.id}`);
      if (res.ok) {
        const data = await res.json();
        if (data.requests) {
          setRequests(data.requests);
        }
      }
    } catch (err) {
      console.error('Error refreshing requests:', err);
    } finally {
      setIsRefreshing(false);
    }
  };

  const matchesSearch = (req: ServiceRequest) => {
    const customerName = `${req.customer?.firstName || ''} ${req.customer?.lastName || ''}`.toLowerCase();
    const storeName = (req.storeName || '').toLowerCase();
    const address = (req.customer?.address || '').toLowerCase();
    const query = searchQuery.toLowerCase();
    return customerName.includes(query) || storeName.includes(query) || address.includes(query);
  };

  const groups = STATUS_GROUPS.map(g => ({
    ...g,
    requests: requests.filter(req => req.status === g.status && matchesSearch(req)),
  }));

  const waitingCount = groups[0].requests.length;
  const totalVisible = groups.reduce((sum, g) => sum + g.requests.length, 0);

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#fbfbfd] to-[#f5f5f7] text-[#1d1d1f] pb-24 font-sans antialiased" dir="rtl">
      {/* Premium Apple Header */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-gray-100/60 px-4 py-4 shadow-sm">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
              <Truck className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-md font-black tracking-tight">שלום, {driver.name}</h1>
              <span className="text-[9px] text-blue-600 font-bold uppercase tracking-wider block -mt-0.5">{businessName} Logistics</span>
            </div>
          </div>

          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="p-2.5 hover:bg-gray-100 rounded-xl text-gray-500 active:scale-95 transition-all flex items-center justify-center cursor-pointer border border-gray-100 bg-white shadow-sm"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-blue-600' : ''}`} />
          </button>
        </div>
      </header>

      <main className="max-w-md mx-auto px-4 mt-6 space-y-6">
        {/* Quick Summary Info Card */}
        <div className="bg-white rounded-3xl border border-gray-100 p-5 shadow-sm">
          <span className="text-xs text-gray-400 font-bold block">הקריאות שלי</span>
          <span className="text-xl font-extrabold text-gray-800 mt-1 block">
            {waitingCount} כלים ממתינים לאיסוף
          </span>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <input
            type="text"
            placeholder="חפש חנות, לקוח או כתובת..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-4 pr-11 py-3.5 rounded-2xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-gray-800 text-sm transition-all shadow-sm"
          />
          <Search className="w-5 h-5 text-gray-400 absolute right-4 top-4" />
        </div>

        {totalVisible === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="py-20 text-center bg-white rounded-3xl border border-gray-100 p-8 shadow-sm space-y-4"
          >
            <div className="w-16 h-16 rounded-full bg-blue-50 flex items-center justify-center mx-auto text-blue-500 shadow-inner">
              <CheckCircle className="w-7 h-7" />
            </div>
            <div>
              <h3 className="text-md font-bold text-gray-800">אין קריאות משויכות אליך כרגע</h3>
              <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                כשהאדמין ישייך אליך קריאות הן יופיעו כאן.
              </p>
            </div>
          </motion.div>
        )}

        {groups.map(group => group.requests.length > 0 && (
          <div key={group.status} className="space-y-4">
            <div className="text-xs text-gray-400 font-bold px-1 uppercase tracking-wider">
              {group.label} ({group.requests.length})
            </div>
            <AnimatePresence mode="popLayout">
              {group.requests.map((req) => (
                <motion.div
                  key={req.id}
                  layout
                  initial={{ opacity: 0, scale: 0.95, y: 15 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9, x: -100 }}
                  transition={{ type: 'spring', damping: 25, stiffness: 150 }}
                  className="bg-white border border-gray-100 rounded-3xl p-5 shadow-sm space-y-4 relative overflow-hidden"
                >
                  {/* Indigo gradient line indicator on card top */}
                  <div className="absolute top-0 right-0 left-0 h-[3px] bg-gradient-to-r from-blue-500 to-indigo-500"></div>

                  <div className="flex gap-3">
                    {req.status === 'WAITING_FOR_PICKUP' && (
                      <div className="pt-1.5 flex-shrink-0">
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(req.id)}
                          onChange={() => toggleSelected(req.id)}
                          className="w-5 h-5 rounded-lg border-gray-350 text-blue-600 focus:ring-blue-500 focus:ring-offset-0 cursor-pointer"
                        />
                      </div>
                    )}
                    
                    <div className="flex-1 space-y-4">
                      {/* Header Row */}
                      <div className="flex items-start justify-between">
                        <div>
                          <span className="text-[9px] text-gray-400 font-bold uppercase tracking-wider block">
                            קריאת שירות
                          </span>
                          <strong className="text-md text-gray-800 font-extrabold font-mono tracking-tight block mt-0.5">
                            {formatRequestNumber(tenantId, req.requestNumber)}
                          </strong>
                        </div>

                        <div className="text-left">
                          <span className="text-[9px] text-gray-400 font-bold uppercase tracking-wider block">
                            חנות
                          </span>
                          <span className="text-sm text-blue-600 font-extrabold block mt-0.5">
                            {req.storeName}
                          </span>
                        </div>
                      </div>

                      {/* Info blocks */}
                      <div className="space-y-3 pt-3 border-t border-gray-50 text-sm">
                        <div className="flex items-center gap-2.5 text-gray-600">
                          <User className="w-4 h-4 text-gray-400 flex-shrink-0" />
                          <span className="font-medium">{req.toolOwnerName}</span>
                        </div>

                        {req.customer?.address && (
                          <div className="flex items-start gap-2.5 text-gray-600">
                            <MapPin className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                            <span className="font-semibold text-gray-800 leading-relaxed">
                              {req.customer.address}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Actions Grid */}
                      <div className="grid grid-cols-3 gap-2.5 pt-3 border-t border-gray-50">
                        {/* Waze Navigation Button */}
                        {req.customer?.address ? (
                          <a
                            href={`https://waze.com/ul?q=${encodeURIComponent(req.customer.address)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="col-span-1 py-3 bg-gradient-to-br from-[#05C2DF] to-[#0091FF] text-white rounded-2xl flex flex-col items-center justify-center gap-1 shadow-sm active:scale-[0.96] transition-all cursor-pointer font-bold"
                            title="נווט בוויז"
                          >
                            <svg className="w-5 h-5 fill-current" viewBox="0 0 512 512">
                              <path d="M508.8 255.4C508.8 322 479 383.5 425 417.8v45.1c0 24-21 44-46.7 44-24.8 0-45.3-18.7-46.7-42.3-43.1 11.5-89 11.5-131.7 0-1.4 23.6-21.8 42.3-46.7 42.3-25.7 0-46.7-20-46.7-44v-46C49 378.1 12 316.3 12 248.8c0-83 67-150.3 149.7-150.3h2.3c27.1-51.2 84.7-86.5 149.5-86.5 89 0 161.4 69.3 162.7 156.4 19.8 19 32.6 44.5 32.6 73zM250 185c-16.6 0-30 13.4-30 30s13.4 30 30 30 30-13.4 30-30-13.4-30-30-30zm-87.8 0c-16.6 0-30 13.4-30 30s13.4 30 30 30 30-13.4 30-30-13.4-30-30-30zm136 122.5c-4 5.3-11.6 6.3-16.9 2.3-14.7-11.2-34.5-16.5-54.8-16.5s-40.1 5.3-54.8 16.5c-5.3 4-12.9 3-16.9-2.3-4-5.3-3-12.9 2.3-16.9 18.2-13.8 42.6-20.7 69.4-20.7s51.2 6.9 69.4 20.7c5.3 4 6.3 11.6 2.3 16.9z" />
                            </svg>
                            <span className="text-[9px] font-black">ניווט בוויז</span>
                          </a>
                        ) : (
                          <div
                            className="col-span-1 py-3 bg-gray-50 border border-gray-100 text-gray-400 rounded-2xl flex flex-col items-center justify-center gap-1 opacity-60 cursor-not-allowed select-none"
                            title="אין כתובת לניווט"
                          >
                            <svg className="w-5 h-5 fill-current" viewBox="0 0 512 512">
                              <path d="M508.8 255.4C508.8 322 479 383.5 425 417.8v45.1c0 24-21 44-46.7 44-24.8 0-45.3-18.7-46.7-42.3-43.1 11.5-89 11.5-131.7 0-1.4 23.6-21.8 42.3-46.7 42.3-25.7 0-46.7-20-46.7-44v-46C49 378.1 12 316.3 12 248.8c0-83 67-150.3 149.7-150.3h2.3c27.1-51.2 84.7-86.5 149.5-86.5 89 0 161.4 69.3 162.7 156.4 19.8 19 32.6 44.5 32.6 73zM250 185c-16.6 0-30 13.4-30 30s13.4 30 30 30 30-13.4 30-30-13.4-30-30-30zm-87.8 0c-16.6 0-30 13.4-30 30s13.4 30 30 30 30-13.4 30-30-13.4-30-30-30zm136 122.5c-4 5.3-11.6 6.3-16.9 2.3-14.7-11.2-34.5-16.5-54.8-16.5s-40.1 5.3-54.8 16.5c-5.3 4-12.9 3-16.9-2.3-4-5.3-3-12.9 2.3-16.9 18.2-13.8 42.6-20.7 69.4-20.7s51.2 6.9 69.4 20.7c5.3 4 6.3 11.6 2.3 16.9z" />
                            </svg>
                            <span className="text-[9px] font-black">ניווט בוויז</span>
                          </div>
                        )}

                        {/* WhatsApp Chat */}
                        {req.customer?.phone ? (
                          <a
                            href={`https://wa.me/${req.customer.phone.startsWith('0') ? '972' + req.customer.phone.slice(1) : req.customer.phone}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="col-span-1 py-3 bg-green-50 hover:bg-green-100/80 text-green-600 rounded-2xl flex flex-col items-center justify-center gap-1 border border-green-100 active:scale-[0.96] transition-all cursor-pointer font-bold"
                            title="שלח הודעה"
                          >
                            <MessageSquare className="w-5 h-5" />
                            <span className="text-[9px] font-black">וואטסאפ</span>
                          </a>
                        ) : (
                          <div className="col-span-1 bg-gray-50 rounded-2xl flex flex-col items-center justify-center gap-1 opacity-50 text-gray-300">
                            <MessageSquare className="w-5 h-5" />
                            <span className="text-[9px] font-bold">ללא טלפון</span>
                          </div>
                        )}

                        {/* Phone Call */}
                        {req.customer?.phone ? (
                          <a
                            href={`tel:${req.customer.phone}`}
                            className="col-span-1 py-3 bg-blue-50 hover:bg-blue-100/80 text-blue-600 rounded-2xl flex flex-col items-center justify-center gap-1 border border-blue-100 active:scale-[0.96] transition-all cursor-pointer font-bold"
                            title="חיוג טלפוני"
                          >
                            <Phone className="w-5 h-5" />
                            <span className="text-[9px] font-black">חיוג</span>
                          </a>
                        ) : (
                          <div className="col-span-1 bg-gray-50 rounded-2xl flex flex-col items-center justify-center gap-1 opacity-50 text-gray-300">
                            <Phone className="w-5 h-5" />
                            <span className="text-[9px] font-bold">ללא טלפון</span>
                          </div>
                        )}
                      </div>

                      {/* Actions — only for requests waiting for pickup */}
                      {req.status === 'WAITING_FOR_PICKUP' && (
                        <div className="pt-2 flex flex-col sm:flex-row gap-2">
                          <button
                            onClick={() => handleMarkAsPickedUp(req.id)}
                            disabled={updatingId === req.id}
                            className="flex-grow py-3.5 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white rounded-2xl text-xs font-black flex items-center justify-center gap-1.5 shadow-md shadow-green-500/10 transition-all active:scale-[0.98] cursor-pointer"
                          >
                            {updatingId === req.id ? (
                              <Loader2 className="w-4 h-4 animate-spin text-white" />
                            ) : (
                              <CheckCircle className="w-4 h-4 text-white" />
                            )}
                            סימנתי כנאסף
                          </button>
                          
                          <button
                            onClick={() => {
                              setSelectedIds([req.id]);
                              setIsHandoverOpen(true);
                            }}
                            className="flex-grow py-3.5 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl text-xs font-black flex items-center justify-center gap-1.5 shadow-md shadow-blue-500/10 transition-all active:scale-[0.98] cursor-pointer"
                          >
                            <FileText className="w-4 h-4 text-white" />
                            החתם נציג חנות
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        ))}
      </main>

      {/* Floating Bar */}
      <AnimatePresence>
        {selectedIds.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-4 inset-x-4 z-40 max-w-md mx-auto bg-gray-900/95 backdrop-blur text-white px-5 py-4 rounded-3xl flex items-center justify-between shadow-2xl border border-gray-800"
          >
            <div className="flex items-center gap-3">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-xs font-black text-white">
                {selectedIds.length}
              </span>
              <span className="text-xs font-black">קריאות שנבחרו למסירה</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsHandoverOpen(true)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-xl text-xs font-black transition-colors cursor-pointer text-white"
              >
                טופס מסירה
              </button>
              <button
                onClick={() => setSelectedIds([])}
                className="p-2 hover:bg-gray-800 rounded-xl text-gray-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Handover Modal */}
      <AnimatePresence>
        {isHandoverOpen && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl max-w-sm w-full shadow-2xl border border-gray-100 flex flex-col overflow-hidden max-h-[90vh]"
            >
              {/* Header */}
              <div className="p-5 border-b border-gray-100 flex items-center justify-between bg-white sticky top-0 z-10">
                <div>
                  <h2 className="text-md font-black text-gray-900">טופס מסירה דיגיטלי</h2>
                  <p className="text-[10px] text-gray-400 font-bold mt-0.5">אישור מסירה ומילוי פרטי נציג החנות</p>
                </div>
                <button
                  onClick={() => {
                    setIsHandoverOpen(false);
                    setSignerName('');
                    setPhotoFile(null);
                    setHasDrawn(false);
                  }}
                  className="p-2 hover:bg-gray-100 rounded-full text-gray-400 hover:text-gray-700 transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Body */}
              <div className="p-5 space-y-5 overflow-y-auto flex-1 text-right" dir="rtl">
                {handoverError && (
                  <div className="p-3 bg-red-50 text-red-650 text-xs font-bold rounded-xl border border-red-100">
                    {handoverError}
                  </div>
                )}

                {/* Selected Requests List */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-gray-400">הכלים שנבחרו למסירה והערות מצב:</label>
                  <div className="max-h-48 overflow-y-auto space-y-3 border border-gray-100 p-3 rounded-2xl bg-gray-50/50">
                    {selectedIds.map(id => {
                      const req = requests.find(r => r.id === id);
                      if (!req) return null;
                      return (
                        <div key={id} className="space-y-1.5 border-b border-gray-200/50 pb-3 last:border-0 last:pb-0">
                          <div className="flex justify-between items-center text-[11px] font-bold">
                            <span className="font-mono text-gray-500">{formatRequestNumber(tenantId, req.requestNumber)}</span>
                            <span className="text-gray-800 text-left">{req.storeName} | {req.toolOwnerName}</span>
                          </div>
                          <input
                            type="text"
                            value={conditionNotes[id] || ''}
                            onChange={e => setConditionNotes(prev => ({ ...prev, [id]: e.target.value }))}
                            placeholder="הערות מצב (סריטות, מכות, שלמות החלקים)..."
                            className="w-full px-3 py-2 rounded-xl border border-gray-200 text-[11px] bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Signer Name Input */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-gray-700">שם נציג החנות (המוסר) <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    value={signerName}
                    onChange={e => setSignerName(e.target.value)}
                    placeholder="הקלד שם נציג החנות..."
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    required
                  />
                </div>

                {/* Signature Canvas */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-gray-700">חתימת המוסר דיגיטלית <span className="text-red-500">*</span></label>
                  <SignatureCanvas
                    canvasRef={signatureCanvasRef}
                    onDrawnChange={setHasDrawn}
                  />
                </div>

                {/* Handover Photo File */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-gray-700">צילום מסירה (אופציונלי)</label>
                  <div className="flex items-center gap-2.5">
                    <label className="flex items-center gap-1.5 px-3 py-2 bg-gray-50 hover:bg-gray-150 border border-gray-200 rounded-xl cursor-pointer transition-colors text-[11px] font-bold text-gray-600">
                      <Camera className="w-3.5 h-3.5 text-gray-500" />
                      <span>צלם / בחר תמונה</span>
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        onChange={e => setPhotoFile(e.target.files?.[0] || null)}
                        className="hidden"
                      />
                    </label>
                    {photoFile && (
                      <span className="text-[10px] text-green-600 font-bold truncate max-w-[150px]">
                        {photoFile.name}
                      </span>
                    )}
                  </div>
                </div>

                {/* Submit Action Buttons */}
                <div className="flex gap-2.5 pt-3">
                  <button
                    type="button"
                    onClick={() => {
                      setIsHandoverOpen(false);
                      setSignerName('');
                      setPhotoFile(null);
                      setHasDrawn(false);
                    }}
                    className="flex-1 py-3 bg-gray-50 hover:bg-gray-100 text-gray-700 rounded-2xl text-xs font-black transition-all cursor-pointer border"
                  >
                    ביטול
                  </button>
                  <button
                    type="button"
                    onClick={handleSubmitHandover}
                    disabled={isSubmittingHandover || !hasDrawn || !signerName.trim()}
                    className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl text-xs font-black transition-all shadow-md shadow-blue-500/20 disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    {isSubmittingHandover ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
                    ) : (
                      <span>שלח טופס</span>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
