'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Navigation, 
  Phone, 
  MessageSquare, 
  Truck, 
  Search, 
  RefreshCw, 
  MapPin, 
  User, 
  Plus,
  X,
  FileText,
  Loader2,
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import { ServiceRequest, Customer } from '@/lib/db';
import { formatRequestNumber } from '@/lib/format';

interface DriverDashboardProps {
  initialRequests: ServiceRequest[];
  tenantId: string;
  businessName: string;
}

export default function DriverDashboard({ initialRequests, tenantId, businessName }: DriverDashboardProps) {
  const [requests, setRequests] = useState<ServiceRequest[]>(initialRequests);
  const [searchQuery, setSearchQuery] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // Status handler to update request status in MongoDB to PICKED_UP_BY_DRIVER
  const handleMarkAsPickedUp = async (reqId: string) => {
    setUpdatingId(reqId);
    try {
      const res = await fetch(`/api/${tenantId}/requests/${reqId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'PICKED_UP_BY_DRIVER' }),
      });

      if (!res.ok) throw new Error('Failed to update status');
      
      setRequests(prev => prev.map(r => r.id === reqId ? { ...r, status: 'PICKED_UP_BY_DRIVER' } : r));
    } catch (err) {
      alert('שגיאה בעדכון סטטוס הקריאה');
    } finally {
      setUpdatingId(null);
    }
  };

  // Manual refresh logic
  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      const res = await fetch(`/api/${tenantId}/requests`);
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

  // Filter requests to display ONLY WAITING_FOR_PICKUP and search match
  const filteredRequests = requests.filter(req => {
    const isWaiting = req.status === 'WAITING_FOR_PICKUP';
    if (!isWaiting) return false;

    const customerName = `${req.customer?.firstName || ''} ${req.customer?.lastName || ''}`.toLowerCase();
    const storeName = (req.storeName || '').toLowerCase();
    const address = (req.customer?.address || '').toLowerCase();
    const query = searchQuery.toLowerCase();

    return customerName.includes(query) || storeName.includes(query) || address.includes(query);
  });

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
              <h1 className="text-md font-black tracking-tight">נסיעות נהגים</h1>
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
          <span className="text-xs text-gray-400 font-bold block">סטטוס איסופים</span>
          <span className="text-xl font-extrabold text-gray-800 mt-1 block">
            {filteredRequests.length} כלים ממתינים לאיסוף
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

        {/* Requests List */}
        <div className="space-y-4">
          <div className="text-xs text-gray-400 font-bold px-1 uppercase tracking-wider">
            רשימת איסוף (כלים הממתינים לאיסוף בלבד)
          </div>
          <AnimatePresence mode="popLayout">
            {filteredRequests.length > 0 ? (
              filteredRequests.map((req) => (
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
                    {/* Customer details */}
                    <div className="flex items-center gap-2.5 text-gray-600">
                      <User className="w-4 h-4 text-gray-400 flex-shrink-0" />
                      <span className="font-medium">{req.toolOwnerName}</span>
                    </div>

                    {/* Address details */}
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

                  {/* Huge Mark as Picked Up Status Action Button */}
                  <div className="pt-2">
                    <button
                      onClick={() => handleMarkAsPickedUp(req.id)}
                      disabled={updatingId === req.id}
                      className="w-full py-3.5 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white rounded-2xl text-xs font-black flex items-center justify-center gap-2 shadow-md shadow-green-500/10 transition-all active:scale-[0.98] cursor-pointer"
                    >
                      {updatingId === req.id ? (
                        <Loader2 className="w-4 h-4 animate-spin text-white" />
                      ) : (
                        <CheckCircle className="w-4 h-4 text-white" />
                      )}
                      סימנתי כנאסף (נהג אסף כלי)
                    </button>
                  </div>
                </motion.div>
              ))
            ) : (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="py-20 text-center bg-white rounded-3xl border border-gray-100 p-8 shadow-sm space-y-4"
              >
                <div className="w-16 h-16 rounded-full bg-blue-50 flex items-center justify-center mx-auto text-blue-500 shadow-inner">
                  <CheckCircle className="w-7 h-7" />
                </div>
                <div>
                  <h3 className="text-md font-bold text-gray-800">אין כלים הממתינים לאיסוף</h3>
                  <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                    כל הכלים נאספו בהצלחה או שלא רשומים איסופים חדשים כעת.
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

    </div>
  );
}
