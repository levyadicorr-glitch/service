'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Customer, ServiceRequest } from '@/lib/db';
import { buildWhatsAppMessage, formatRequestNumber } from '@/lib/format';
import {
  FileText, Clock, AlertCircle, CheckCircle2, Search, Plus,
  RotateCw, Trash2, Calendar, Phone, Copy, Printer, Eye,
  Store, User, Barcode, ShieldCheck, ShieldAlert, UploadCloud, Check, Loader2, X
} from 'lucide-react';

interface CustomerPortalProps {
  customer: Customer;
  tenantId: string;
  initialRequests: ServiceRequest[];
  businessName: string;
  whatsappTemplate: string;
}

export default function CustomerPortal({ customer, initialRequests, tenantId, businessName, whatsappTemplate }: CustomerPortalProps) {
  const [requests, setRequests] = useState<ServiceRequest[]>(initialRequests);
  const [activeView, setActiveView] = useState<'requests' | 'qr'>('requests');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [baseUrl, setBaseUrl] = useState('');

  useEffect(() => {
    setBaseUrl(window.location.origin);
  }, []);

  // Details Modal state
  const [selectedRequest, setSelectedRequest] = useState<ServiceRequest | null>(null);

  // Create Request Modal state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [storeName, setStoreName] = useState(`${customer.firstName} ${customer.lastName}`);
  const [toolOwnerName, setToolOwnerName] = useState(`${customer.firstName} ${customer.lastName}`);
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

  const openCreateModal = () => {
    setStoreName(`${customer.firstName} ${customer.lastName}`);
    setToolOwnerName(`${customer.firstName} ${customer.lastName}`);
    setToolOwnerPhone('');
    setIssueDescription('');
    setHasWarranty('no');
    setToolImages([]);
    setToolImagePreviews([]);
    setWarrantyReceiptImage(null);
    setWarrantyReceiptPreview(null);
    setAgreedToInspectionFee(false);
    setComments('');
    setRepairLevel('');
    setIsPreApprovedBudgetEnabled(false);
    setPreApprovedAmount('500');
    setPreApprovedNotes('');
    setSubmitError(null);
    setSubmitSuccess(false);
    setCreatedRequestNumber(null);
    setIsCreateModalOpen(true);
  };

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
      
      // Update local state live!
      setRequests(prev => [data.request, ...prev]);
      setSubmitSuccess(true);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'שגיאה בחיבור לשרת, אנא נסה שנית.';
      setSubmitError(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Status mapping
  const statuses = [
    { key: 'NEW', label: 'חדש', bg: 'bg-blue-50/70', text: 'text-blue-600', border: 'border-blue-100', dot: 'bg-blue-500' },
    { key: 'WAITING_FOR_PICKUP', label: 'ממתין לאיסוף', bg: 'bg-amber-50/70', text: 'text-amber-600', border: 'border-amber-100', dot: 'bg-amber-500' },
    { key: 'PICKED_UP_BY_DRIVER', label: 'נהג אסף כלי', bg: 'bg-purple-50/70', text: 'text-purple-600', border: 'border-purple-100', dot: 'bg-purple-500' },
    { key: 'COMPLETED', label: 'טיפול הסתיים', bg: 'bg-green-50/70', text: 'text-green-600', border: 'border-green-100', dot: 'bg-green-500' },
  ];

  // Stats
  const stats = {
    total: requests.length,
    new: requests.filter(r => r.status === 'NEW').length,
    waitingPickup: requests.filter(r => r.status === 'WAITING_FOR_PICKUP').length,
    pickedUp: requests.filter(r => r.status === 'PICKED_UP_BY_DRIVER').length,
    completed: requests.filter(r => r.status === 'COMPLETED').length,
  };

  // Filter & Sort (Newest first)
  const filteredRequests = requests
    .filter(req => {
      const toolOwner = (req.toolOwnerName || '').toLowerCase();
      const storeName = (req.storeName || '').toLowerCase();
      const searchLower = searchQuery.toLowerCase();
      const matchesSearch = toolOwner.includes(searchLower) || storeName.includes(searchLower);
      const matchesStatus = statusFilter === 'ALL' || req.status === statusFilter;
      return matchesSearch && matchesStatus;
    })
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  // Refresh
  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      const res = await fetch(`/api/${tenantId}/requests/by-customer/${customer.id}`);
      if (res.ok) {
        const data = await res.json();
        if (data.requests) setRequests(data.requests);
      }
    } catch (err) {
      console.error('Error refreshing:', err);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Delete service request
  const handleDeleteRequest = async (requestId: string) => {
    if (!window.confirm('האם אתה בטוח שברצונך למחוק קריאת שירות זו?')) return;
    
    try {
      const res = await fetch(`/api/${tenantId}/requests/${requestId}?customerId=${customer.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('שגיאה במחיקת קריאת השירות');
      
      setRequests(prev => prev.filter(r => r.id !== requestId));
    } catch (err: unknown) {
      alert('שגיאה במחיקת קריאת השירות');
    }
  };

  const formUrl = `${baseUrl}/${tenantId}/request/${customer.id}`;
  const portalUrl = `${baseUrl}/${tenantId}/portal/${customer.id}`;

  return (
    <div className="min-h-screen bg-[#f5f5f7] text-[#1d1d1f] font-sans antialiased pb-20" dir="rtl">
      {/* Top Navbar */}
      <nav className="sticky top-0 z-40 bg-white/70 backdrop-blur-xl border-b border-gray-200/50 transition-all duration-300">
        <div className="max-w-5xl mx-auto px-4 md:px-6 py-3.5 md:h-16 flex flex-col md:flex-row items-center justify-between gap-3 md:gap-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white font-black text-lg shadow-lg shadow-blue-500/20 active:scale-95 transition-all select-none">
              {customer.firstName[0]}
            </div>
            <div>
              <span className="text-lg font-black tracking-tight block leading-none text-gray-900">{customer.firstName} {customer.lastName}</span>
              <span className="text-[10px] text-blue-600 font-bold uppercase tracking-wider mt-1 block">{businessName} פורטל לקוח</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Refresh */}
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="p-2.5 hover:bg-gray-100 rounded-xl text-gray-500 active:scale-95 transition-all border border-gray-200/50 bg-white/80 shadow-sm cursor-pointer"
              title="רענן נתונים"
            >
              <RotateCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-blue-600' : ''}`} />
            </button>

            {/* New Request */}
            <button
              onClick={openCreateModal}
              className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg shadow-blue-500/10 transition-all active:scale-[0.98] cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              פתח קריאה חדשה
            </button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto px-4 md:px-6 pt-6 md:pt-10">
        <div className="space-y-8">

          {/* Stats + QR Section */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Stats Cards */}
            <div className="lg:col-span-2 grid grid-cols-2 sm:grid-cols-5 gap-4">
              <div className="bg-white/75 backdrop-blur-md p-5 rounded-3xl border border-white/60 shadow-[0_8px_30px_rgb(0,0,0,0.02)] transition-all duration-300 hover:shadow-[0_8px_30px_rgb(0,0,0,0.06)] hover:scale-[1.01] hover:bg-white flex flex-col justify-between">
                <span className="text-gray-400 text-xs font-bold block">סה&quot;כ קריאות</span>
                <div className="flex items-end justify-between mt-3">
                  <span className="block text-3xl font-black text-gray-900 font-mono leading-none">{stats.total}</span>
                  <div className="p-2 bg-blue-50 rounded-xl text-blue-600 border border-blue-100/50">
                    <FileText className="w-5 h-5" />
                  </div>
                </div>
              </div>
              {statuses.map(st => {
                let count = 0;
                let IconComponent = Clock;
                let colorClass = 'text-blue-600 bg-blue-50 border-blue-100/50';

                if (st.key === 'NEW') {
                  count = stats.new;
                  IconComponent = Clock;
                  colorClass = 'text-blue-600 bg-blue-50 border-blue-100/50';
                }
                if (st.key === 'WAITING_FOR_PICKUP') {
                  count = stats.waitingPickup;
                  IconComponent = AlertCircle;
                  colorClass = 'text-amber-600 bg-amber-50 border-amber-100/50';
                }
                if (st.key === 'PICKED_UP_BY_DRIVER') {
                  count = stats.pickedUp;
                  IconComponent = CheckCircle2;
                  colorClass = 'text-purple-600 bg-purple-50 border-purple-100/50';
                }
                if (st.key === 'COMPLETED') {
                  count = stats.completed;
                  IconComponent = Check;
                  colorClass = 'text-green-600 bg-green-50 border-green-100/50';
                }
                return (
                  <div key={st.key} className="bg-white/75 backdrop-blur-md p-5 rounded-3xl border border-white/60 shadow-[0_8px_30px_rgb(0,0,0,0.02)] transition-all duration-300 hover:shadow-[0_8px_30px_rgb(0,0,0,0.06)] hover:scale-[1.01] hover:bg-white flex flex-col justify-between">
                    <span className="text-gray-400 text-xs font-bold block">{st.label}</span>
                    <div className="flex items-end justify-between mt-3">
                      <span className="block text-3xl font-black text-gray-900 font-mono leading-none">{count}</span>
                      <div className={`p-2 rounded-xl border ${colorClass}`}>
                        <IconComponent className="w-5 h-5" />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* QR Card */}
            <div className="bg-white/75 backdrop-blur-md rounded-3xl border border-white/60 shadow-[0_8px_30px_rgb(0,0,0,0.02)] p-6 flex flex-col items-center text-center space-y-4">
              <span className="text-xs text-gray-400 font-bold uppercase tracking-wider">קוד QR לפתיחת קריאות</span>
              <div className="p-3.5 bg-white rounded-2xl border border-gray-200/50 shadow-inner">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(formUrl)}`}
                  alt="QR Code"
                  className="w-32 h-32"
                />
              </div>
              <p className="text-[11px] text-gray-400 leading-relaxed">
                הדפיסו והציגו בחנות — לקוחות שיסרקו יגיעו<br/>ישירות לטופס פתיחת קריאת שירות
              </p>
              <div className="flex flex-col gap-2 w-full">
                <a
                  href={`https://wa.me/?text=${encodeURIComponent(buildWhatsAppMessage(whatsappTemplate, formUrl, businessName))}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-2.5 bg-green-500 hover:bg-green-600 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-md shadow-green-500/10 active:scale-[0.98] cursor-pointer"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.027 6.988 2.895a9.82 9.82 0 012.893 6.994c-.002 5.45-4.437 9.888-9.885 9.888m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                  </svg>
                  שליחה בוואטסאפ ללקוח
                </a>
                <div className="flex gap-2 w-full">
                  <button
                    onClick={() => window.print()}
                    className="flex-1 py-2 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-xl text-xs font-bold flex items-center justify-center gap-1 transition-all active:scale-[0.98] border border-blue-100/50 cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    הדפס
                  </button>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(formUrl);
                      alert('הקישור הועתק!');
                    }}
                    className="flex-1 py-2 bg-gray-50 hover:bg-gray-100 text-gray-600 rounded-xl text-xs font-bold flex items-center justify-center gap-1 border border-gray-200 transition-all active:scale-[0.98] cursor-pointer"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    העתק
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Search & Filter Bar */}
          <div className="bg-white/80 backdrop-blur-md p-4 rounded-3xl border border-white/60 shadow-[0_8px_30px_rgb(0,0,0,0.02)] flex flex-col lg:flex-row gap-4 items-center justify-between">
            <div className="relative w-full lg:w-80">
              <input
                type="text"
                placeholder="חיפוש לפי שם בעל כלי או חנות..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-4 pr-11 py-3 rounded-xl border border-gray-200 bg-gray-50/40 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 text-gray-800 transition-all duration-200 text-sm font-medium"
              />
              <Search className="w-5 h-5 text-gray-400 absolute right-4 top-3.5" />
            </div>

            <div className="flex flex-wrap gap-1.5 w-full lg:w-auto">
              <button
                onClick={() => setStatusFilter('ALL')}
                className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all duration-200 active:scale-95 cursor-pointer ${
                  statusFilter === 'ALL'
                    ? 'bg-gray-900 border-gray-900 text-white shadow-sm'
                    : 'bg-white/60 border-gray-200 text-gray-600 hover:bg-white hover:text-gray-900 shadow-sm shadow-black/5'
                }`}
              >
                הכל ({stats.total})
              </button>
              {statuses.map(st => {
                let count = 0;
                if (st.key === 'NEW') count = stats.new;
                if (st.key === 'WAITING_FOR_PICKUP') count = stats.waitingPickup;
                if (st.key === 'PICKED_UP_BY_DRIVER') count = stats.pickedUp;
                return (
                  <button
                    key={st.key}
                    onClick={() => setStatusFilter(st.key)}
                    className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all duration-200 active:scale-95 cursor-pointer ${
                      statusFilter === st.key
                        ? 'bg-gray-900 border-gray-900 text-white shadow-sm'
                        : 'bg-white/60 border-gray-200 text-gray-600 hover:bg-white hover:text-gray-900 shadow-sm shadow-black/5'
                    }`}
                  >
                    {st.label} ({count})
                  </button>
                );
              })}
            </div>
          </div>

          {/* Requests Table */}
          <div className="bg-white/80 backdrop-blur-md rounded-3xl border border-white/60 shadow-[0_8px_30px_rgb(0,0,0,0.02)] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-right border-collapse">
                <thead>
                  <tr className="bg-gray-50/50 text-gray-400 font-bold text-xs uppercase tracking-wider border-b border-gray-200/50 whitespace-nowrap">
                    <th className="p-5">מספר קריאה</th>
                    <th className="p-5">שם בעל הכלי</th>
                    <th className="p-5">שם החנות</th>
                    <th className="p-5">אחריות</th>
                    <th className="p-5">תאריך פתיחה</th>
                    <th className="p-5">סטטוס</th>
                    <th className="p-5 text-center">פעולות</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200/40">
                  {filteredRequests.length > 0 ? (
                    filteredRequests.map((req) => {
                      const statusObj = statuses.find(s => s.key === req.status) || statuses[0];
                      return (
                        <tr key={req.id} className="hover:bg-gray-50/50 transition-colors whitespace-nowrap">
                          <td className="p-5 text-gray-400 font-mono text-sm font-semibold">
                            {formatRequestNumber(tenantId, req.requestNumber)}
                          </td>
                          <td className="p-5 font-bold text-gray-800 text-right">
                            <div className="flex items-center gap-1.5 justify-start">
                              <span>{req.toolOwnerName}</span>
                              {req.repairLevel === 'RIDE_ONLY' && (
                                <span className="px-1.5 py-0.5 bg-blue-50 text-blue-600 border border-blue-100 rounded text-[9px] font-bold">נסיעה 🛴</span>
                              )}
                              {req.repairLevel === 'SAFE_RIDE' && (
                                <span className="px-1.5 py-0.5 bg-emerald-50 text-emerald-600 border border-emerald-100 rounded text-[9px] font-bold">בטוח 🛑</span>
                              )}
                              {req.repairLevel === 'LIKE_NEW' && (
                                <span className="px-1.5 py-0.5 bg-indigo-50 text-indigo-600 border border-indigo-100 rounded text-[9px] font-bold">כמו חדש ✨</span>
                              )}
                            </div>
                            {req.issueDescription && (
                              <div className="text-[10px] text-blue-600 font-normal truncate max-w-[150px] mt-0.5 inline-block" title={req.issueDescription}>
                                תקלה: {req.issueDescription}
                              </div>
                            )}
                          </td>
                          <td className="p-5 text-gray-600">{req.storeName}</td>
                          <td className="p-5">
                            {req.hasWarranty ? (
                              <span className="px-2.5 py-0.5 bg-green-50 text-green-700 rounded-md text-xs font-bold border border-green-100/50">כן</span>
                            ) : (
                              <span className="px-2.5 py-0.5 bg-gray-50 text-gray-500 rounded-md text-xs font-bold border border-gray-100">לא</span>
                            )}
                          </td>
                          <td className="p-5 text-gray-400 text-sm">
                            {new Date(req.createdAt).toLocaleDateString('he-IL', {
                              day: 'numeric',
                              month: 'numeric',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </td>
                          <td className="p-5">
                            <span className={`px-3 py-1.5 rounded-xl text-xs font-bold border inline-flex items-center gap-1.5 ${statusObj.bg} ${statusObj.text} ${statusObj.border}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${statusObj.dot}`}></span>
                              {statusObj.label}
                            </span>
                          </td>
                          <td className="p-5 text-center flex items-center justify-center gap-2">
                            <button
                              onClick={() => setSelectedRequest(req)}
                              className="p-2 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-xl transition-all shadow-sm active:scale-[0.98] border border-blue-100/50 cursor-pointer inline-flex items-center justify-center"
                              title="פרטי קריאה"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteRequest(req.id)}
                              className="p-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl transition-all shadow-sm active:scale-[0.98] border border-red-100/50 cursor-pointer inline-flex items-center justify-center"
                              title="מחק קריאה"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={7} className="p-10 text-center text-gray-400 text-sm">
                        {requests.length === 0
                          ? 'עדיין לא נפתחו קריאות שירות.'
                          : 'לא נמצאו קריאות שירות מתאימות לחיפוש.'
                        }
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Empty State CTA - Only when zero requests */}
          {requests.length === 0 && (
            <div className="bg-white/80 backdrop-blur-md rounded-3xl border border-white/60 shadow-[0_8px_30px_rgb(0,0,0,0.02)] p-10 text-center space-y-5">
              <div className="w-20 h-20 bg-blue-50 border border-blue-100 flex items-center justify-center rounded-full mx-auto">
                <FileText className="w-9 h-9 text-blue-500" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-800 mb-1">ברוכים הבאים לפורטל {businessName}!</h3>
                <p className="text-sm text-gray-500 leading-relaxed max-w-md mx-auto">
                  כאן תוכלו לעקוב אחרי קריאות השירות שלכם ולפתוח קריאות חדשות. לחצו על הכפתור למטה כדי להתחיל.
                </p>
              </div>
              <button
                onClick={openCreateModal}
                className="inline-flex items-center gap-2 px-6 py-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-2xl text-sm font-bold shadow-lg shadow-blue-500/10 transition-all active:scale-[0.98] cursor-pointer"
              >
                <Plus className="w-5 h-5" />
                פתח קריאת שירות ראשונה
              </button>
            </div>
          )}

          {/* Customer Info Footer */}
          <div className="bg-white/80 backdrop-blur-md rounded-3xl border border-white/60 shadow-[0_8px_30px_rgb(0,0,0,0.02)] p-5">
            <span className="text-xs text-gray-400 font-bold block mb-3">פרטי הלקוח</span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-gray-400 text-xs block">טלפון</span>
                <strong className="text-gray-800 font-mono">{customer.phone || 'לא מעודכן'}</strong>
              </div>
              <div>
                <span className="text-gray-400 text-xs block">כתובת</span>
                <strong className="text-gray-800">{customer.address || 'לא צוינה'}</strong>
              </div>
              <div>
                <span className="text-gray-400 text-xs block">מספר סריאלי</span>
                <strong className="text-gray-800 font-mono">{customer.serialNumber || 'לא זמין'}</strong>
              </div>
              <div>
                <span className="text-gray-400 text-xs block">לוחית רישוי</span>
                <strong className="text-gray-800 font-mono">{customer.licensePlate || 'לא זמין'}</strong>
              </div>
            </div>
          </div>

        </div>
      </main>

      {/* Read-Only Details Modal */}
      <AnimatePresence>
        {selectedRequest && (
          <div className="fixed inset-0 bg-slate-900/40 z-50 flex items-center justify-center p-4 backdrop-blur-sm overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white/95 backdrop-blur-md rounded-3xl max-w-3xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-white/60 flex flex-col"
            >
              {/* Modal Header */}
              <div className="p-6 border-b border-gray-200/50 flex items-center justify-between">
                <div>
                  <span className="text-gray-400 font-mono text-sm block">קריאת שירות {formatRequestNumber(tenantId, selectedRequest.requestNumber)}</span>
                  <h2 className="text-2xl font-black text-gray-900 mt-1">
                    {selectedRequest.toolOwnerName}
                  </h2>
                </div>
                <button
                  onClick={() => setSelectedRequest(null)}
                  className="p-2 hover:bg-gray-150 rounded-full text-gray-400 hover:text-gray-700 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 space-y-6 md:space-y-8 flex-1 text-right" dir="rtl">
                {/* Details Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 p-5 bg-slate-50/60 border border-slate-100/80 rounded-2xl text-sm shadow-sm">
                  <div>
                    <span className="block text-gray-400 text-xs mb-1 font-bold">שם החנות:</span>
                    <strong className="text-gray-800 text-base">{selectedRequest.storeName}</strong>
                  </div>
                  <div>
                    <span className="block text-gray-400 text-xs mb-1 font-bold">שם בעל הכלי:</span>
                    <strong className="text-gray-800 text-base">{selectedRequest.toolOwnerName}</strong>
                  </div>
                  <div>
                    <span className="block text-gray-400 text-xs mb-1 font-bold">טלפון:</span>
                    <strong className="text-gray-800 text-base font-mono">{selectedRequest.toolOwnerPhone || '-'}</strong>
                  </div>
                  <div>
                    <span className="block text-gray-400 text-xs mb-1 font-bold">תאריך פתיחה:</span>
                    <strong className="text-gray-800 text-base">
                      {new Date(selectedRequest.createdAt).toLocaleDateString('he-IL')}
                    </strong>
                  </div>
                </div>

                {/* Status indicator */}
                <div className="space-y-1.5">
                  <span className="block text-gray-400 text-xs font-bold">סטטוס נוכחי:</span>
                  <div>
                    {(() => {
                      const statusObj = statuses.find(s => s.key === selectedRequest.status) || statuses[0];
                      return (
                        <span className={`px-4 py-2.5 rounded-xl text-sm font-bold border inline-flex items-center gap-1.5 ${statusObj.bg} ${statusObj.text} ${statusObj.border}`}>
                          <span className={`w-2 h-2 rounded-full ${statusObj.dot}`}></span>
                          {statusObj.label}
                        </span>
                      );
                    })()}
                  </div>
                </div>

                {/* Issue Description */}
                {selectedRequest.issueDescription && (
                  <div className="p-4 bg-blue-50/30 border border-blue-100/30 rounded-2xl text-sm shadow-sm space-y-1">
                    <span className="block text-gray-400 text-xs font-bold">תיאור התקלה:</span>
                    <p className="text-gray-800 font-medium whitespace-pre-wrap">{selectedRequest.issueDescription}</p>
                  </div>
                )}

                {/* Repair Level and Pre-Approved Budget Displays */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Desired Repair Level */}
                  <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm shadow-sm space-y-1.5">
                    <span className="block text-gray-400 text-xs font-bold">רמת תיקון מבוקשת:</span>
                    <div className="pt-0.5">
                      {selectedRequest.repairLevel === 'RIDE_ONLY' && (
                        <span className="px-2.5 py-1 bg-blue-50 text-blue-700 rounded-lg text-xs font-bold border border-blue-100">מצב נסיעה בלבד 🛴</span>
                      )}
                      {selectedRequest.repairLevel === 'SAFE_RIDE' && (
                        <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-lg text-xs font-bold border border-emerald-100">נסיעה בטוחה 🛑</span>
                      )}
                      {selectedRequest.repairLevel === 'LIKE_NEW' && (
                        <span className="px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded-lg text-xs font-bold border border-indigo-100">כמו חדש! ✨</span>
                      )}
                      {!selectedRequest.repairLevel && (
                        <span className="px-2.5 py-1 bg-gray-50 text-gray-600 rounded-lg text-xs font-bold border border-gray-100">נסיעה בטוחה 🛑</span>
                      )}
                    </div>
                  </div>

                  {/* Pre-Approved Budget */}
                  <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm shadow-sm space-y-1.5">
                    <span className="block text-gray-400 text-xs font-bold">תקציב תיקון מאושר מראש:</span>
                    {selectedRequest.preApprovedAmount ? (
                      <div>
                        <strong className="text-gray-800 text-sm">₪{selectedRequest.preApprovedAmount}</strong>
                        {selectedRequest.preApprovedNotes && (
                          <p className="text-[10px] text-gray-450 mt-1 leading-tight">דגש: {selectedRequest.preApprovedNotes}</p>
                        )}
                      </div>
                    ) : (
                      <span className="text-gray-400 text-xs font-medium">לא הוגדר (דרוש אישור טלפוני)</span>
                    )}
                  </div>
                </div>

                {/* General Comments */}
                {selectedRequest.comments && (
                  <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm shadow-sm space-y-1">
                    <span className="block text-gray-400 text-xs font-bold">הערות לקוח נוספות:</span>
                    <p className="text-gray-700 font-medium whitespace-pre-wrap">{selectedRequest.comments}</p>
                  </div>
                )}

                {/* Cost acceptance */}
                <div className="p-4 bg-orange-50/50 border border-orange-100/50 rounded-2xl flex items-center justify-between text-orange-850 text-sm shadow-sm">
                  <span className="font-bold">אישור דמי בדיקה (150 ש&quot;ח):</span>
                  <span className="px-3 py-1 bg-orange-600 text-white rounded-lg text-xs font-black shadow-sm">מאושר</span>
                </div>

                {/* Photos */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Tool Photos */}
                  <div className="space-y-2">
                    <h3 className="text-sm font-bold text-gray-800">צילומי הכלי:</h3>
                    <div className="grid grid-cols-3 gap-2">
                      {(selectedRequest.toolImages || (selectedRequest.toolImage ? [selectedRequest.toolImage] : [])).map((imgUrl, idx) => (
                        <div key={idx} className="space-y-1">
                          <div className="relative aspect-[4/3] rounded-xl overflow-hidden border bg-gray-50 flex items-center justify-center">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img 
                              src={imgUrl} 
                              alt={`Tool upload ${idx + 1}`} 
                              className="max-w-full max-h-full object-contain hover:scale-105 transition-transform duration-300"
                            />
                          </div>
                          <a 
                            href={imgUrl} 
                            target="_blank" 
                            rel="noreferrer"
                            className="inline-block text-[10px] text-blue-600 font-bold hover:underline"
                          >
                            תמונה {idx + 1} ↗
                          </a>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Warranty Photo */}
                  <div className="space-y-2">
                    <h3 className="text-sm font-bold text-gray-800">חשבונית / תעודת אחריות:</h3>
                    {selectedRequest.hasWarranty && selectedRequest.warrantyReceiptImage ? (
                      <>
                        <div className="relative aspect-[4/3] rounded-2xl overflow-hidden border bg-gray-50 flex items-center justify-center">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img 
                            src={selectedRequest.warrantyReceiptImage} 
                            alt="Warranty receipt upload" 
                            className="max-w-full max-h-full object-contain hover:scale-105 transition-transform duration-500"
                          />
                        </div>
                        <a 
                          href={selectedRequest.warrantyReceiptImage} 
                          target="_blank" 
                          rel="noreferrer"
                          className="inline-block text-xs text-blue-600 font-bold hover:underline"
                        >
                          פתח תמונה בחלון חדש ↗
                        </a>
                      </>
                    ) : (
                      <div className="aspect-[4/3] rounded-2xl border border-dashed border-gray-200 flex flex-col items-center justify-center text-gray-400 bg-gray-50/50">
                        <AlertCircle className="w-8 h-8 text-gray-300 mb-1" />
                        <span className="text-xs font-semibold">לא צוינה אחריות</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="p-5 bg-gray-50/70 border-t border-gray-200/50 flex justify-end">
                <button
                  onClick={() => setSelectedRequest(null)}
                  className="px-6 py-2.5 bg-gray-950 hover:bg-gray-900 text-white rounded-xl text-sm font-bold transition-all shadow active:scale-[0.98] cursor-pointer"
                >
                  סגור
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Create Request Modal (Widget) */}
      <AnimatePresence>
        {isCreateModalOpen && (
          <div className="fixed inset-0 bg-slate-900/40 z-50 flex items-center justify-center p-4 backdrop-blur-sm overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl border border-gray-100 flex flex-col overflow-hidden max-h-[90vh]"
            >
              {/* Modal Header */}
              <div className="p-6 border-b border-gray-200/50 flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">פתח קריאת שירות חדשה</h2>
                  <p className="text-gray-400 text-xs mt-1">מלא את פרטי הכלי והתקלה כדי לשלוח לטיפול</p>
                </div>
                <button
                  onClick={() => setIsCreateModalOpen(false)}
                  className="p-2 hover:bg-gray-150 rounded-full text-gray-400 hover:text-gray-700 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 space-y-6 overflow-y-auto flex-1 text-right" dir="rtl">
                {submitSuccess ? (
                  /* Success screen */
                  <div className="text-center py-8 space-y-6">
                    <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center mx-auto border border-green-100 shadow-inner">
                      <Check className="w-10 h-10 text-green-500" strokeWidth={3} />
                    </div>
                    <div>
                      <h3 className="text-2xl font-black text-gray-900 mb-1">הקריאה התקבלה בהצלחה!</h3>
                      <p className="text-gray-500 text-sm">
                        קריאת השירות נרשמה במערכת {businessName} ומספרה הסידורי הוא:
                      </p>
                      <strong className="text-blue-600 font-mono text-xl mt-2 block">
                        #{tenantId.substring(0, 2).toUpperCase()}-{createdRequestNumber}
                      </strong>
                    </div>

                    <div className="flex flex-col gap-2.5 max-w-sm mx-auto pt-4">
                      {toolOwnerPhone ? (
                        <a
                          href={`https://wa.me/${toolOwnerPhone.startsWith('0') ? '972' + toolOwnerPhone.slice(1) : toolOwnerPhone}?text=${encodeURIComponent(
                            `היי ${toolOwnerName}, קריאת השירות שלך מספר ${tenantId.substring(0, 2).toUpperCase()}-${createdRequestNumber} נפתחה בהצלחה ב-${businessName}! 🛴\nנמשיך לעדכן אותך כאן ברגע שהכלי יהיה מוכן או אם יהיו עדכונים נוספים. המשך יום מעולה!`
                          )}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-full py-3.5 bg-green-500 hover:bg-green-600 text-white rounded-2xl text-sm font-bold flex items-center justify-center gap-2 shadow-lg shadow-green-500/10 transition-all active:scale-[0.98] cursor-pointer"
                        >
                          <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                            <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.003 5.37 5.378 0 12.003 0a11.94 11.94 0 0 1 8.484 3.513 11.94 11.94 0 0 1 3.51 8.49c-.003 6.63-5.378 12-12.003 12-1.996-.001-3.957-.502-5.709-1.455L0 24zm6.59-14.859c-.12-.2-.24-.2-.35-.2-.11 0-.24-.03-.36-.03-.13 0-.34.05-.52.25-.18.2-.68.66-.68 1.6s.69 1.86.78 2.06c.1.13 1.36 2.07 3.29 2.91.46.2.82.32 1.1.41.47.15.89.13 1.22.08.38-.06 1.15-.47 1.31-.93.16-.46.16-.86.11-.93-.05-.08-.18-.13-.38-.23-.19-.1-.1.38-.1.74-.11.16-.36.23-.74.13-.38-.11-1.42-.52-2.71-1.68-.96-.86-1.61-1.92-1.8-2.25-.19-.33-.02-.51.15-.68.15-.15.33-.36.5-.54.17-.18.23-.3.33-.5.1-.2.05-.38-.03-.48z" />
                          </svg>
                          שלח הודעת עדכון בוואטסאפ ללקוח
                        </a>
                      ) : (
                        <div className="p-3 bg-amber-50 text-amber-700 rounded-xl text-xs font-semibold text-center">
                          לא הוזן מספר טלפון ללקוח זה, לא ניתן לשלוח הודעת עדכון בוואטסאפ.
                        </div>
                      )}

                      <button
                        onClick={() => setIsCreateModalOpen(false)}
                        className="w-full py-3.5 bg-gray-900 hover:bg-gray-800 text-white rounded-2xl text-sm font-bold transition-all active:scale-[0.98] cursor-pointer"
                      >
                        סגור חלון
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Form fields */
                  <div className="space-y-6">
                    {submitError && (
                      <div className="p-4 bg-red-50 border border-red-100 rounded-2xl text-red-650 text-xs font-bold flex items-center gap-2">
                        <AlertCircle className="w-5 h-5 flex-shrink-0" />
                        <span>{submitError}</span>
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="block text-gray-750 text-xs font-bold flex items-center gap-1.5">
                          <Store className="w-3.5 h-3.5 text-gray-400" />
                          שם החנות <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={storeName}
                          onChange={(e) => setStoreName(e.target.value)}
                          className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 bg-gray-50/40 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 text-gray-800 text-xs font-medium"
                          required
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="block text-gray-755 text-xs font-bold flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5 text-gray-400" />
                          שם בעל הכלי <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={toolOwnerName}
                          onChange={(e) => setToolOwnerName(e.target.value)}
                          className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 bg-gray-50/40 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 text-gray-800 text-xs font-medium"
                          required
                        />
                      </div>

                      <div className="space-y-1.5 sm:col-span-2">
                        <label className="block text-gray-755 text-xs font-bold flex items-center gap-1.5">
                          <Phone className="w-3.5 h-3.5 text-gray-400" />
                          מספר טלפון בעל הכלי <span className="text-gray-450 font-normal text-[10px]">(אופציונלי)</span>
                        </label>
                        <input
                          type="tel"
                          value={toolOwnerPhone}
                          onChange={(e) => setToolOwnerPhone(e.target.value)}
                          placeholder="מספר טלפון ליצירת קשר"
                          className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 bg-gray-50/40 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 text-gray-800 text-xs font-medium text-right"
                          dir="rtl"
                        />
                      </div>

                      <div className="space-y-1.5 sm:col-span-2">
                        <label className="block text-gray-755 text-xs font-bold flex items-center gap-1.5">
                          <FileText className="w-3.5 h-3.5 text-gray-400" />
                          מה התקלה בכלי? <span className="text-red-500">*</span>
                        </label>
                        <textarea
                          value={issueDescription}
                          onChange={(e) => setIssueDescription(e.target.value)}
                          placeholder="תאר את הבעיה בכלי (לדוגמה: פנצ'ר בגלגל קדמי, המנוע לא נדלק, בעיה בבלמים...)"
                          rows={3}
                          className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 bg-gray-50/40 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 text-gray-800 text-xs font-medium text-right resize-none"
                          required
                        />
                      </div>

                      {/* Desired Repair Level Selection */}
                      <div className="space-y-1.5 sm:col-span-2">
                        <label className="block text-gray-755 text-xs font-bold flex items-center gap-1.5">
                          <span className="text-gray-450 text-[10px]">⚡</span>
                          לאיזו רמה תרצו שנגיע בתיקון? <span className="text-red-500">*</span>
                        </label>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          {/* Option 1: Basic Ride */}
                          <button
                            type="button"
                            onClick={() => setRepairLevel('RIDE_ONLY')}
                            className={`py-3 px-3 rounded-2xl border text-right transition-all flex flex-col justify-between group active:scale-[0.98] cursor-pointer ${
                              repairLevel === 'RIDE_ONLY'
                                ? 'border-blue-500 bg-gradient-to-br from-blue-50/90 to-sky-50/50 text-blue-955 shadow-md shadow-blue-500/5 ring-4 ring-blue-500/10'
                                : 'border-gray-200 bg-white text-gray-500 hover:bg-gray-50 hover:border-gray-300 shadow-sm'
                            }`}
                          >
                            <div className="flex justify-between items-center w-full mb-1">
                              <span className={`text-[11px] font-black transition-colors ${repairLevel === 'RIDE_ONLY' ? 'text-blue-600' : 'text-gray-700'}`}>מצב נסיעה בלבד 🛴</span>
                              <span className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center transition-all ${repairLevel === 'RIDE_ONLY' ? 'border-blue-500 bg-blue-500 scale-110' : 'border-gray-300 bg-white'}`}>
                                {repairLevel === 'RIDE_ONLY' && <span className="w-1 h-1 rounded-full bg-white"></span>}
                              </span>
                            </div>
                            <span className="block text-[9px] text-gray-400 font-medium leading-tight group-hover:text-gray-500 transition-colors">תיקון בסיסי שיחזיר את הכלי למצב נסיעה (ללא תוספות)</span>
                          </button>

                          {/* Option 2: Safe Ride */}
                          <button
                            type="button"
                            onClick={() => setRepairLevel('SAFE_RIDE')}
                            className={`py-3 px-3 rounded-2xl border text-right transition-all flex flex-col justify-between group active:scale-[0.98] cursor-pointer ${
                              repairLevel === 'SAFE_RIDE'
                                ? 'border-emerald-500 bg-gradient-to-br from-emerald-50/90 to-teal-50/50 text-emerald-955 shadow-md shadow-emerald-500/5 ring-4 ring-emerald-500/10'
                                : 'border-gray-200 bg-white text-gray-500 hover:bg-gray-50 hover:border-gray-300 shadow-sm'
                            }`}
                          >
                            <div className="flex justify-between items-center w-full mb-1">
                              <span className={`text-[11px] font-black transition-colors ${repairLevel === 'SAFE_RIDE' ? 'text-emerald-600' : 'text-gray-700'}`}>נסיעה בטוחה 🛑</span>
                              <span className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center transition-all ${repairLevel === 'SAFE_RIDE' ? 'border-emerald-500 bg-emerald-500 scale-110' : 'border-gray-300 bg-white'}`}>
                                {repairLevel === 'SAFE_RIDE' && <span className="w-1 h-1 rounded-full bg-white"></span>}
                              </span>
                            </div>
                            <span className="block text-[9px] text-gray-400 font-medium leading-tight group-hover:text-gray-500 transition-colors">נסיעה תקינה כולל בדיקה קפדנית של בלמים וצמיגים (מומלץ)</span>
                          </button>

                          {/* Option 3: Like New */}
                          <button
                            type="button"
                            onClick={() => setRepairLevel('LIKE_NEW')}
                            className={`py-3 px-3 rounded-2xl border text-right transition-all flex flex-col justify-between group active:scale-[0.98] cursor-pointer ${
                              repairLevel === 'LIKE_NEW'
                                ? 'border-purple-500 bg-gradient-to-br from-purple-50/90 to-indigo-50/50 text-purple-955 shadow-md shadow-purple-500/5 ring-4 ring-purple-500/10'
                                : 'border-gray-200 bg-white text-gray-500 hover:bg-gray-50 hover:border-gray-300 shadow-sm'
                            }`}
                          >
                            <div className="flex justify-between items-center w-full mb-1">
                              <span className={`text-[11px] font-black transition-colors ${repairLevel === 'LIKE_NEW' ? 'text-purple-600' : 'text-gray-700'}`}>כמו חדש! ✨</span>
                              <span className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center transition-all ${repairLevel === 'LIKE_NEW' ? 'border-purple-500 bg-purple-500 scale-110' : 'border-gray-300 bg-white'}`}>
                                {repairLevel === 'LIKE_NEW' && <span className="w-1 h-1 rounded-full bg-white"></span>}
                              </span>
                            </div>
                            <span className="block text-[9px] text-gray-400 font-medium leading-tight group-hover:text-gray-500 transition-colors">יישור קו מלא כולל הכל: תאורה, פלסטיקה, קוסמטיקה ושיפוץ כללי</span>
                          </button>
                        </div>
                      </div>

                      {/* Pre-approved Budget Section */}
                      <div className="space-y-2.5 sm:col-span-2 p-4 bg-blue-50/20 border border-blue-100/30 rounded-2xl shadow-sm text-right">
                        <label className="flex items-start cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={isPreApprovedBudgetEnabled}
                            onChange={(e) => setIsPreApprovedBudgetEnabled(e.target.checked)}
                            className="w-4.5 h-4.5 mt-0.5 text-blue-600 border-gray-300 rounded cursor-pointer"
                          />
                          <div className="mr-2.5">
                            <span className="block text-xs font-bold text-gray-800">אישור תקציב לתיקון מראש (מהיר יותר!) ⚡</span>
                            <span className="block text-[10px] text-gray-500 font-medium">מאפשר לנו להתחיל לעבוד מיד ללא צורך בשיחת אישור טלפונית</span>
                          </div>
                        </label>

                        <AnimatePresence>
                          {isPreApprovedBudgetEnabled && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              exit={{ opacity: 0, height: 0 }}
                              transition={{ duration: 0.25 }}
                              className="space-y-2 pt-2 border-t border-blue-100/20 overflow-hidden"
                            >
                              <div className="space-y-1">
                                <label className="block text-gray-700 text-[11px] font-bold">
                                  סכום אישור מקסימלי לתיקון (₪) <span className="text-red-500">*</span>
                                </label>
                                <input
                                  type="number"
                                  value={preApprovedAmount}
                                  onChange={(e) => setPreApprovedAmount(e.target.value)}
                                  min="500"
                                  className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 text-gray-800 text-xs font-bold text-right"
                                  required
                                />
                                <p className="text-[9px] text-gray-400">מינימום 500 ₪. לא נחרוג מסכום זה ללא אישורכם מראש.</p>
                              </div>

                              <div className="space-y-1">
                                <label className="block text-gray-700 text-[11px] font-bold">
                                  הנחיות או דגשים לגבי התקציב <span className="text-gray-400 font-normal text-[9px]">(אופציונלי)</span>
                                </label>
                                <input
                                  type="text"
                                  value={preApprovedNotes}
                                  onChange={(e) => setPreApprovedNotes(e.target.value)}
                                  placeholder="לדוגמה: אל תחליפו סוללה בלי לדבר איתי קודם..."
                                  className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 text-gray-800 text-xs font-medium text-right"
                                />
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>

                      {/* General Comments Section */}
                      <div className="space-y-1.5 sm:col-span-2">
                        <label className="block text-gray-755 text-xs font-bold flex items-center gap-1.5">
                          <span>📝</span>
                          הערות נוספות לצוות המעבדה <span className="text-gray-400 font-normal text-[10px]">(אופציונלי)</span>
                        </label>
                        <textarea
                          value={comments}
                          onChange={(e) => setComments(e.target.value)}
                          placeholder="הערות או דגשים נוספים לצוות המעבדה..."
                          rows={2}
                          className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 bg-gray-50/40 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 text-gray-800 text-xs font-medium text-right resize-none"
                        />
                      </div>
                    </div>

                    {/* Warranty */}
                    <div className="space-y-2">
                      <label className="block text-gray-700 text-xs font-bold">
                        האם יש אחריות לכלי? <span className="text-red-500">*</span>
                      </label>
                      <div className="grid grid-cols-2 gap-3">
                        <button
                          type="button"
                          onClick={() => setHasWarranty('yes')}
                          className={`py-3 px-4 rounded-xl border text-right transition-all flex items-center justify-between group active:scale-[0.98] cursor-pointer ${
                            hasWarranty === 'yes'
                              ? 'border-blue-500 bg-blue-50/40 text-blue-700 ring-2 ring-blue-500/10'
                              : 'border-gray-200 bg-white text-gray-500 hover:bg-gray-50'
                          }`}
                        >
                          <div>
                            <span className="block text-sm font-extrabold">כן</span>
                            <span className="block text-[10px] text-gray-400 mt-0.5">צרף תעודה/חשבונית</span>
                          </div>
                          <ShieldCheck className={`w-5 h-5 ${hasWarranty === 'yes' ? 'text-blue-500' : 'text-gray-300'}`} />
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setHasWarranty('no');
                            setWarrantyReceiptImage(null);
                            setWarrantyReceiptPreview(null);
                          }}
                          className={`py-3 px-4 rounded-xl border text-right transition-all flex items-center justify-between group active:scale-[0.98] cursor-pointer ${
                            hasWarranty === 'no'
                              ? 'border-blue-500 bg-blue-50/40 text-blue-700 ring-2 ring-blue-500/10'
                              : 'border-gray-200 bg-white text-gray-500 hover:bg-gray-50'
                          }`}
                        >
                          <div>
                            <span className="block text-sm font-extrabold">לא</span>
                            <span className="block text-[10px] text-gray-400 mt-0.5">כלי ללא אחריות</span>
                          </div>
                          <ShieldAlert className={`w-5 h-5 ${hasWarranty === 'no' ? 'text-blue-500' : 'text-gray-300'}`} />
                        </button>
                      </div>
                    </div>

                    {/* Warranty File */}
                    {hasWarranty === 'yes' && (
                      <div className="space-y-1.5">
                        <label className="block text-gray-700 text-xs font-bold">צילום חשבונית/תעודת אחריות:</label>
                        <div 
                          onClick={() => warrantyImageInputRef.current?.click()}
                          className="border border-dashed border-gray-300 rounded-xl p-4 text-center cursor-pointer hover:bg-blue-50/10 hover:border-blue-400 transition-all flex flex-col items-center justify-center min-h-[100px]"
                        >
                          <input
                            type="file"
                            accept="image/*"
                            ref={warrantyImageInputRef}
                            onChange={handleWarrantyImageChange}
                            className="hidden"
                          />
                          {warrantyReceiptPreview ? (
                            <div className="relative w-28 aspect-[4/3] rounded-lg overflow-hidden border bg-white">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={warrantyReceiptPreview} alt="Receipt preview" className="w-full h-full object-contain" />
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  removeWarrantyImage(e);
                                }}
                                className="absolute top-1 right-1 p-1 bg-red-650 text-white rounded-md hover:scale-105 transition-all shadow"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <>
                              <UploadCloud className="w-5 h-5 text-blue-600 mb-1" />
                              <span className="text-blue-600 font-bold text-xs">לחץ כאן להעלאת קובץ</span>
                            </>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Tool Images */}
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <label className="block text-gray-700 text-xs font-bold">צילומי הכלי *</label>
                        <span className="text-[10px] text-gray-400 font-bold">({toolImages.length}/3)</span>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        {toolImagePreviews.map((preview, idx) => (
                          <div key={idx} className="relative aspect-[4/3] rounded-lg overflow-hidden border bg-white flex items-center justify-center group/preview">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={preview} alt="preview" className="w-full h-full object-contain" />
                            <button
                              type="button"
                              onClick={(e) => removeToolImage(idx, e)}
                              className="absolute top-1 right-1 p-1 bg-red-600 text-white rounded-md shadow cursor-pointer opacity-80 hover:opacity-100"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                        {toolImages.length < 3 && (
                          <div 
                            onClick={() => toolImageInputRef.current?.click()}
                            className="border border-dashed border-gray-300 rounded-lg aspect-[4/3] flex flex-col items-center justify-center hover:bg-blue-50/10 hover:border-blue-400 transition-all cursor-pointer"
                          >
                            <input
                              type="file"
                              accept="image/*"
                              ref={toolImageInputRef}
                              onChange={handleToolImageChange}
                              className="hidden"
                              multiple
                            />
                            <UploadCloud className="w-4 h-4 text-blue-600 mb-0.5" />
                            <span className="text-blue-650 font-bold text-[10px]">הוסף תמונה</span>
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

                    {/* Inspection fee agreement */}
                    <div className="p-4 bg-amber-50/40 border border-amber-100/80 rounded-2xl">
                      <label className="flex items-start cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={agreedToInspectionFee}
                          onChange={(e) => setAgreedToInspectionFee(e.target.checked)}
                          className="w-4 h-4 mt-0.5 text-blue-600 border-gray-300 rounded cursor-pointer"
                          required
                        />
                        <span className="mr-2.5 text-xs text-gray-655 leading-relaxed font-semibold">
                          אני מסכים/ה לשלם <strong className="text-amber-850">150 ש&quot;ח דמי בדיקה</strong> אם התיקון אינו באחריות ואבחר שלא לתקן.
                        </span>
                      </label>
                    </div>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              {!submitSuccess && (
                <div className="p-5 bg-gray-50/70 border-t border-gray-200/50 flex justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => setIsCreateModalOpen(false)}
                    className="px-5 py-2.5 bg-white border border-gray-200 text-gray-600 rounded-xl text-xs font-bold active:scale-95 transition-all cursor-pointer"
                  >
                    ביטול
                  </button>
                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={isSubmitting}
                    className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-500/10 active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>שולח...</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>פתח קריאה</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Print Styles - QR Flyer */}
      <style jsx global>{`
        @media print {
          body * { visibility: hidden; }
          nav, .search-bar { display: none !important; }
        }
      `}</style>
    </div>
  );
}
