'use client';

import React, { useState, useEffect } from 'react';
import { Customer, ServiceRequest } from '@/lib/db';
import { buildWhatsAppMessage, formatRequestNumber } from '@/lib/format';
import { 
  Search, Filter, Plus, Calendar, CheckCircle2, AlertCircle, Clock, 
  Trash2, Copy, Send, ExternalLink, Info, Check, User, Store, Phone, 
  Eye, Navigation, Settings, HelpCircle, FileText, X, RotateCw
} from 'lucide-react';

interface AdminDashboardProps {
  initialRequests: ServiceRequest[];
  customers: Customer[];
  tenantId: string;
  businessName: string;
  whatsappTemplate: string;
}

export default function AdminDashboard({ initialRequests, customers: initialCustomers, tenantId, businessName, whatsappTemplate }: AdminDashboardProps) {
  const [customersList, setCustomersList] = useState<Customer[]>(initialCustomers);
  const [requests, setRequests] = useState<ServiceRequest[]>(initialRequests);
  const [activeTab, setActiveTab] = useState<'requests' | 'customers'>('requests');
  
  // Search & Filter States
  const [requestSearch, setRequestSearch] = useState('');
  const [requestStatusFilter, setRequestStatusFilter] = useState<string>('ALL');
  const [customerSearch, setCustomerSearch] = useState('');
  
  // Dropdown open states
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);

  // Modal State
  const [selectedRequest, setSelectedRequest] = useState<ServiceRequest | null>(null);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [copiedCustomerId, setCopiedCustomerId] = useState<string | null>(null);
  const [baseUrl, setBaseUrl] = useState('');

  // Create Request Flow State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createSearch, setCreateSearch] = useState('');
  const [selectedCustomerForCreate, setSelectedCustomerForCreate] = useState<Customer | null>(null);
  const [adminToolOwnerName, setAdminToolOwnerName] = useState('');
  const [adminToolOwnerPhone, setAdminToolOwnerPhone] = useState('');
  const [isAdminSavingRequest, setIsAdminSavingRequest] = useState(false);

  // Add Customer Modal State
  const [isAddCustomerModalOpen, setIsAddCustomerModalOpen] = useState(false);
  const [isSavingCustomer, setIsSavingCustomer] = useState(false);
  const [newCustomer, setNewCustomer] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    email: '',
    address: '',
    licensePlate: '',
    color: '',
    serialNumber: '',
  });

  // QR Code Flyer State
  const [selectedCustomerForQr, setSelectedCustomerForQr] = useState<Customer | null>(null);

  // Live Sync & Manual Refresh States
  const [isAdminRefreshing, setIsAdminRefreshing] = useState(false);

  const refreshRequests = async (showLoader = false) => {
    if (showLoader) setIsAdminRefreshing(true);
    try {
      const res = await fetch(`/api/${tenantId}/requests`);
      const data = await res.json();
      if (res.ok && data.requests) {
        // Preserving the selected request reference to keep modal details updated if open
        setRequests(data.requests);
        if (selectedRequest) {
          const updatedReq = data.requests.find((r: ServiceRequest) => r.id === selectedRequest.id);
          if (updatedReq) setSelectedRequest(updatedReq);
        }
      }
    } catch (err) {
      console.error('Error refreshing requests:', err);
    } finally {
      if (showLoader) setIsAdminRefreshing(false);
    }
  };

  useEffect(() => {
    setBaseUrl(window.location.origin);
    // Legacy client-side auth flag, no longer used (auth is a server session cookie)
    localStorage.removeItem('admin_auth');
  }, []);

  useEffect(() => {
    // Set polling interval for 15 seconds
    const interval = setInterval(() => {
      refreshRequests(false);
    }, 15000);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Status mapping
  const statuses = [
    { key: 'NEW', label: 'חדש', bg: 'bg-blue-50/70', text: 'text-blue-600', border: 'border-blue-100', hover: 'hover:bg-blue-50/40' },
    { key: 'WAITING_FOR_PICKUP', label: 'ממתין לאיסוף', bg: 'bg-amber-50/70', text: 'text-amber-600', border: 'border-amber-100', hover: 'hover:bg-amber-50/40' },
    { key: 'PICKED_UP_BY_DRIVER', label: 'נהג אסף כלי', bg: 'bg-purple-50/70', text: 'text-purple-600', border: 'border-purple-100', hover: 'hover:bg-purple-50/40' },
    { key: 'COMPLETED', label: 'טיפול הסתיים', bg: 'bg-green-50/70', text: 'text-green-600', border: 'border-green-100', hover: 'hover:bg-green-50/40' }
  ];

  // Stats Calculations
  const stats = {
    total: requests.length,
    new: requests.filter(r => r.status === 'NEW').length,
    waitingPickup: requests.filter(r => r.status === 'WAITING_FOR_PICKUP').length,
    pickedUp: requests.filter(r => r.status === 'PICKED_UP_BY_DRIVER').length,
    completed: requests.filter(r => r.status === 'COMPLETED').length,
  };

  // Filter requests
  const filteredRequests = requests.filter(req => {
    const customerName = `${req.customer?.firstName || ''} ${req.customer?.lastName || ''}`.toLowerCase();
    const storeName = (req.storeName || '').toLowerCase();
    const searchLower = requestSearch.toLowerCase();
    
    const matchesSearch = customerName.includes(searchLower) || storeName.includes(searchLower);
    const matchesStatus = requestStatusFilter === 'ALL' || req.status === requestStatusFilter;
    
    return matchesSearch && matchesStatus;
  });

  // Filter customers
  const filteredCustomers = customersList.filter(cust => {
    const name = `${cust.firstName} ${cust.lastName}`.toLowerCase();
    const phone = (cust.phone || '').toLowerCase();
    const searchLower = customerSearch.toLowerCase();
    return name.includes(searchLower) || phone.includes(searchLower);
  });

  // Handle status update
  const handleStatusChange = async (reqId: string, newStatus: string) => {
    setIsUpdatingStatus(true);
    try {
      const res = await fetch(`/api/${tenantId}/requests/${reqId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!res.ok) throw new Error('Failed to update status');
      
      const data = await res.json();
      
      // Update local state
      const updatedRequests = requests.map(r => r.id === reqId ? { ...r, status: newStatus } : r);
      setRequests(updatedRequests as ServiceRequest[]);
      
      if (selectedRequest && selectedRequest.id === reqId) {
        setSelectedRequest({ ...selectedRequest, status: newStatus } as ServiceRequest);
      }
    } catch (err) {
      alert('שגיאה בעדכון הסטטוס');
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handleDeleteRequest = async (reqId: string) => {
    if (!confirm('האם אתה בטוח שברצונך למחוק קריאה זו לחלוטין? הפעולה בלתי הפיכה והקישור ללקוח יפסיק לעבוד.')) {
      return;
    }
    
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/${tenantId}/requests/${reqId}`, {
        method: 'DELETE',
      });

      if (!res.ok) throw new Error('Failed to delete request');
      
      setRequests(prev => prev.filter(r => r.id !== reqId));
      setSelectedRequest(null);
    } catch (err) {
      alert('שגיאה במחיקת הקריאה');
    } finally {
      setIsDeleting(false);
    }
  };

  // Handle direct request creation by admin
  const handleAdminSaveRequest = async () => {
    if (!selectedCustomerForCreate) return;
    setIsAdminSavingRequest(true);
    try {
      const res = await fetch(`/api/${tenantId}/requests/direct`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: selectedCustomerForCreate.id,
          toolOwnerName: adminToolOwnerName.trim() || undefined,
          toolOwnerPhone: adminToolOwnerPhone.trim() || undefined
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to create request');
      }

      const data = await res.json();
      
      // Update local state by prepending the new request
      setRequests(prev => [data.request, ...prev]);
      
      // Close & reset
      setIsCreateModalOpen(false);
      setSelectedCustomerForCreate(null);
      setCreateSearch('');
      setAdminToolOwnerName('');
      setAdminToolOwnerPhone('');
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'שגיאה בשמירת הקריאה';
      alert(errorMessage);
    } finally {
      setIsAdminSavingRequest(false);
    }
  };

  // Handle add customer
  const handleAddCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustomer.firstName.trim() || !newCustomer.lastName.trim()) {
      alert('שם פרטי ושם משפחה הם שדות חובה');
      return;
    }
    setIsSavingCustomer(true);
    try {
      const res = await fetch(`/api/${tenantId}/customers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newCustomer),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to create customer');
      }

      const data = await res.json();
      setCustomersList(prev => [data.customer, ...prev]);
      setIsAddCustomerModalOpen(false);
      setNewCustomer({
        firstName: '',
        lastName: '',
        phone: '',
        email: '',
        address: '',
        licensePlate: '',
        color: '',
        serialNumber: '',
      });
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'שגיאה בהוספת הלקוח';
      alert(errorMessage);
    } finally {
      setIsSavingCustomer(false);
    }
  };

  // Delete customer
  const handleDeleteCustomer = async (customerId: string) => {
    if (!window.confirm('האם אתה בטוח שברצונך למחוק לקוח זה? שים לב: כל קריאות השירות המשויכות אליו יימחקו גם כן!')) return;
    
    try {
      const res = await fetch(`/api/${tenantId}/customers/${customerId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('שגיאה במחיקת הלקוח');
      
      setCustomersList(prev => prev.filter(c => c.id !== customerId));
      // Also clean up local requests state
      setRequests(prev => prev.filter(r => r.customerId !== customerId));
    } catch (err: unknown) {
      alert('שגיאה במחיקת הלקוח');
    }
  };

  // Copy customer URL

  const copyCustomerUrl = (customerId: string) => {
    const url = `${baseUrl}/${tenantId}/portal/${customerId}`;
    navigator.clipboard.writeText(url);
    
    setCopiedCustomerId(customerId);
    setTimeout(() => setCopiedCustomerId(null), 2000);
  };

  return (
    <div className="min-h-screen bg-[#f5f5f7] text-[#1d1d1f] font-sans antialiased pb-20" dir="rtl">
      {/* Top Navbar */}
      <nav className="sticky top-0 z-40 bg-white/70 backdrop-blur-xl border-b border-gray-200/50 print:hidden transition-all duration-300">
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-3.5 md:h-16 flex flex-col md:flex-row items-center justify-between gap-3 md:gap-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white font-black text-xl shadow-lg shadow-blue-500/20 active:scale-95 transition-all cursor-pointer">{businessName.charAt(0)}</div>
            <span className="text-xl font-black tracking-tight bg-clip-text text-transparent bg-gradient-to-l from-gray-900 via-gray-800 to-blue-700">{businessName} <span className="font-normal text-blue-600">ניהול</span></span>
          </div>

          <div className="flex gap-1 p-1 bg-gray-200/60 backdrop-blur rounded-xl border border-gray-300/10">
            <button
              onClick={() => setActiveTab('requests')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all duration-200 ${
                activeTab === 'requests'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              קריאות שירות
            </button>
            <button
              onClick={() => setActiveTab('customers')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all duration-200 ${
                activeTab === 'customers'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              רשימת לקוחות
            </button>
          </div>
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 md:px-6 pt-6 md:pt-10 print:hidden">
        {activeTab === 'requests' ? (
          <div className="space-y-10">
            {/* Stats Cards Section */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
              {/* Total Card */}
              <div className="bg-white/75 backdrop-blur-md p-6 rounded-3xl border border-white/60 shadow-[0_8px_30px_rgb(0,0,0,0.02)] transition-all duration-300 hover:shadow-[0_8px_30px_rgb(0,0,0,0.06)] hover:scale-[1.01] hover:bg-white flex items-center justify-between">
                <div className="space-y-1">
                  <span className="text-gray-400 text-xs font-bold block">סה&quot;כ קריאות</span>
                  <span className="block text-3xl font-black text-gray-900 font-mono tracking-tight">{stats.total}</span>
                </div>
                <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
                  <FileText className="w-6 h-6" />
                </div>
              </div>

              {/* Status Cards */}
              {statuses.map(st => {
                let count = 0;
                let IconComponent = Clock;
                let colorClass = 'text-blue-600 bg-blue-50 border-blue-100';

                if (st.key === 'NEW') {
                  count = stats.new;
                  IconComponent = Clock;
                  colorClass = 'text-blue-600 bg-blue-50 border-blue-100';
                }
                if (st.key === 'WAITING_FOR_PICKUP') {
                  count = stats.waitingPickup;
                  IconComponent = AlertCircle;
                  colorClass = 'text-amber-600 bg-amber-50 border-amber-100';
                }
                if (st.key === 'PICKED_UP_BY_DRIVER') {
                  count = stats.pickedUp;
                  IconComponent = CheckCircle2;
                  colorClass = 'text-purple-600 bg-purple-50 border-purple-100';
                }

                return (
                  <div key={st.key} className="bg-white/75 backdrop-blur-md p-6 rounded-3xl border border-white/60 shadow-[0_8px_30px_rgb(0,0,0,0.02)] transition-all duration-300 hover:shadow-[0_8px_30px_rgb(0,0,0,0.06)] hover:scale-[1.01] hover:bg-white flex items-center justify-between">
                    <div className="space-y-1">
                      <span className="text-gray-400 text-xs font-bold block">{st.label}</span>
                      <span className="block text-3xl font-black text-gray-900 font-mono tracking-tight">{count}</span>
                    </div>
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border ${colorClass}`}>
                      <IconComponent className="w-6 h-6" />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Filter and Search Bar */}
            <div className="bg-white/80 backdrop-blur-md p-4 rounded-3xl border border-white/60 shadow-[0_8px_30px_rgb(0,0,0,0.02)] flex flex-col lg:flex-row gap-4 items-center justify-between">
              <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto items-stretch sm:items-center">
                <div className="relative w-full sm:w-80">
                  <input
                    type="text"
                    placeholder="חיפוש לפי שם לקוח או חנות..."
                    value={requestSearch}
                    onChange={(e) => setRequestSearch(e.target.value)}
                    className="w-full pl-4 pr-11 py-3 rounded-xl border border-gray-200 bg-gray-50/40 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 text-gray-800 transition-all duration-200 text-sm font-medium"
                  />
                  <Search className="w-5 h-5 text-gray-400 absolute right-4 top-3.5" />
                </div>
                
                <button
                  onClick={() => refreshRequests(true)}
                  disabled={isAdminRefreshing}
                  className="p-3 bg-white/80 border border-gray-250/50 hover:bg-gray-100 rounded-xl text-gray-500 hover:text-gray-700 active:scale-95 transition-all shadow-sm cursor-pointer flex items-center justify-center"
                  title="רענן קריאות"
                >
                  <RotateCw className={`w-4 h-4 ${isAdminRefreshing ? 'animate-spin text-blue-600' : ''}`} />
                </button>

                <button
                  onClick={() => {
                    setIsCreateModalOpen(true);
                    setCreateSearch('');
                    setSelectedCustomerForCreate(null);
                  }}
                  className="px-5 py-3 sm:py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-blue-500/10 transition-all duration-200 active:scale-[0.98] cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  פתח קריאה חדשה
                </button>
              </div>

              <div className="flex flex-wrap gap-1.5 w-full lg:w-auto">
                <button
                  onClick={() => setRequestStatusFilter('ALL')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all duration-200 active:scale-95 cursor-pointer ${
                    requestStatusFilter === 'ALL'
                      ? 'bg-gray-900 border-gray-900 text-white shadow-sm'
                      : 'bg-white/60 border-gray-200 text-gray-600 hover:bg-white hover:text-gray-900 shadow-sm shadow-black/5'
                  }`}
                >
                  הכל
                </button>
                {statuses.map(st => (
                  <button
                    key={st.key}
                    onClick={() => setRequestStatusFilter(st.key)}
                    className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all duration-200 active:scale-95 cursor-pointer ${
                      requestStatusFilter === st.key
                        ? 'bg-gray-900 border-gray-900 text-white shadow-sm'
                        : 'bg-white/60 border-gray-200 text-gray-600 hover:bg-white hover:text-gray-900 shadow-sm shadow-black/5'
                    }`}
                  >
                    {st.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Requests Table */}
            <div className="bg-white/80 backdrop-blur-md rounded-3xl border border-white/60 shadow-[0_8px_30px_rgb(0,0,0,0.02)] overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-right border-collapse">
                  <thead>
                    <tr className="bg-gray-50/50 text-gray-400 font-bold text-xs uppercase tracking-wider border-b border-gray-200/50 whitespace-nowrap">
                      <th className="p-5">מספר קריאה</th>
                      <th className="p-5">שם הלקוח</th>
                      <th className="p-5">שם החנות</th>
                      <th className="p-5">טלפון</th>
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
                          <tr key={req.id} className="hover:bg-gray-50/30 transition-colors whitespace-nowrap">
                            <td className="p-5 text-gray-400 font-mono text-sm font-semibold">
                              {formatRequestNumber(tenantId, req.requestNumber)}
                            </td>
                            <td className="p-5 font-bold text-gray-800 text-right">
                              <div className="flex items-center gap-1.5 justify-start">
                                <span>{req.customer?.firstName} {req.customer?.lastName}</span>
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
                            <td className="p-5 text-gray-500 font-mono text-sm">{req.customer?.phone || '-'}</td>
                            <td className="p-5">
                              {req.hasWarranty ? (
                                <span className="px-2.5 py-0.5 bg-green-50 text-green-700 rounded-md text-xs font-bold border border-green-100">כן</span>
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
                            {/* Premium Native Select Status Switcher */}
                            <td className="p-5">
                              <select
                                value={req.status}
                                onChange={(e) => handleStatusChange(req.id, e.target.value)}
                                disabled={isUpdatingStatus}
                                className={`px-3 py-1.5 rounded-xl text-xs font-bold border cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all ${statusObj.bg} ${statusObj.text} ${statusObj.border}`}
                                style={{
                                  WebkitAppearance: 'none',
                                  MozAppearance: 'none',
                                  appearance: 'none',
                                  paddingLeft: '1.5rem',
                                  paddingRight: '0.75rem',
                                  backgroundImage: `url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3E%3Cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3E%3C/svg%3E")`,
                                  backgroundPosition: 'left 0.4rem center',
                                  backgroundSize: '1rem',
                                  backgroundRepeat: 'no-repeat'
                                }}
                              >
                                {statuses.map(st => (
                                  <option key={st.key} value={st.key} className="bg-white text-gray-800 font-semibold">
                                    {st.label}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className="p-5 flex items-center justify-end gap-1.5">
                              {req.customer?.phone && (
                                <a
                                  href={`https://wa.me/${req.customer.phone.startsWith('0') ? '972' + req.customer.phone.slice(1) : req.customer.phone}?text=${encodeURIComponent(
                                    buildWhatsAppMessage(whatsappTemplate, `${baseUrl}/${tenantId}/request/${req.customer.id}`, businessName)
                                  )}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="p-2 bg-green-50 hover:bg-green-100 text-green-600 rounded-xl transition-all flex items-center justify-center shadow-sm active:scale-[0.98] border border-green-100/50 cursor-pointer"
                                  title="שליחת קישור בווטסאפ"
                                >
                                  <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                                    <path d="M12.012 2c-5.506 0-9.989 4.478-9.99 9.984a9.96 9.96 0 001.33 4.982L2 22l5.164-1.355a9.96 9.96 0 004.843 1.258h.005c5.507 0 9.99-4.478 9.99-9.984 0-2.667-1.04-5.172-2.927-7.058C17.188 3.037 14.686 2 12.012 2zm6.002 14.129c-.247.697-1.2 1.286-1.65 1.343-.45.056-.89.102-2.93-.733-2.61-1.066-4.29-3.72-4.42-3.896-.13-.176-1.05-1.394-1.05-2.66 0-1.266.66-1.89.89-2.137.23-.247.5-.31.67-.31.17 0 .34.01.49.017.16.006.37-.063.58.448.22.54.74 1.808.81 1.948.07.14.12.3.02.49-.09.19-.14.31-.29.48-.14.17-.3.38-.43.51-.15.15-.3.31-.13.6.17.29.75 1.235 1.61 2.002.73.655 1.34.858 1.63.987.29.128.46.108.63-.092.17-.2.74-.858.94-1.152.2-.294.4-.247.67-.147.27.1.1.27.81 1.152.07.14.07.29.02.49v-.004z"/>
                                  </svg>
                                </a>
                              )}
                              {req.customer?.address && (
                                <a
                                  href={`https://waze.com/ul?q=${encodeURIComponent(req.customer.address)}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="p-2 bg-cyan-50 hover:bg-cyan-100 text-cyan-600 rounded-xl transition-all flex items-center justify-center shadow-sm active:scale-[0.95] border border-cyan-100/50 cursor-pointer"
                                  title="ניווט ב-Waze"
                                >
                                  <Navigation className="w-4 h-4" />
                                </a>
                              )}
                              {req.status !== 'COMPLETED' && (
                                <button
                                  onClick={() => handleStatusChange(req.id, 'COMPLETED')}
                                  disabled={isUpdatingStatus}
                                  className="p-2 bg-green-50 hover:bg-green-100 text-green-600 rounded-xl transition-all shadow-sm active:scale-[0.98] border border-green-100/50 cursor-pointer"
                                  title="סמן כטיפול הסתיים"
                                >
                                  <CheckCircle2 className="w-4 h-4" />
                                </button>
                              )}
                              <button
                                onClick={() => handleDeleteRequest(req.id)}
                                className="p-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl transition-all shadow-sm active:scale-[0.98] border border-red-100/50 cursor-pointer"
                                title="מחק קריאה"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => setSelectedRequest(req)}
                                className="px-3.5 py-2 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-xl text-xs font-bold transition-all shadow-sm active:scale-[0.98] border border-blue-100/50 cursor-pointer"
                              >
                                פרטים
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={8} className="p-10 text-center text-gray-400 text-sm">
                          לא נמצאו קריאות שירות מתאימות.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Customer Search */}
            <div className="bg-white/80 backdrop-blur-md p-4 rounded-3xl border border-white/60 shadow-[0_8px_30px_rgb(0,0,0,0.02)] flex flex-col md:flex-row gap-4 items-center justify-between">
              <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto items-stretch sm:items-center">
                <div className="relative w-full sm:w-80">
                  <input
                    type="text"
                    placeholder="חיפוש לקוח לפי שם או טלפון..."
                    value={customerSearch}
                    onChange={(e) => setCustomerSearch(e.target.value)}
                    className="w-full pl-4 pr-11 py-3 rounded-xl border border-gray-200 bg-gray-50/40 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 text-gray-800 transition-all duration-200 text-sm font-medium"
                  />
                  <Search className="w-5 h-5 text-gray-400 absolute right-4 top-3.5" />
                </div>
                <button
                  onClick={() => setIsAddCustomerModalOpen(true)}
                  className="px-5 py-3 sm:py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-blue-500/10 transition-all duration-200 active:scale-[0.98] cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  הוסף לקוח חדש
                </button>
              </div>
              <span className="text-gray-400 text-xs font-bold bg-gray-100/80 px-3 py-1.5 rounded-xl border border-gray-200/20">נמצאו {filteredCustomers.length} לקוחות</span>
            </div>

            {/* Customer List Table */}
            <div className="bg-white/80 backdrop-blur-md rounded-3xl border border-white/60 shadow-[0_8px_30px_rgb(0,0,0,0.02)] overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-right border-collapse">
                  <thead>
                    <tr className="bg-gray-50/50 text-gray-400 font-bold text-xs uppercase tracking-wider border-b border-gray-200/50">
                      <th className="p-5">שם הלקוח</th>
                      <th className="p-5">טלפון</th>
                      <th className="p-5">כתובת</th>
                      <th className="p-5 text-center">קישור לטופס ופעולות</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200/40">
                    {filteredCustomers.length > 0 ? (
                      filteredCustomers.slice(0, 100).map((cust) => (
                        <tr key={cust.id} className="hover:bg-gray-50/50 transition-colors">
                          <td className="p-5 font-bold text-gray-800">{cust.firstName} {cust.lastName}</td>
                          <td className="p-5 text-gray-600 font-mono text-sm">{cust.phone || '-'}</td>
                          <td className="p-5 text-gray-500 text-sm">{cust.address || 'לא צוינה כתובת'}</td>
                          <td className="p-5 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              {/* Copy Link Button */}
                              <button
                                onClick={() => copyCustomerUrl(cust.id)}
                                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all shadow-sm active:scale-[0.98] border border-blue-100/50 cursor-pointer ${
                                  copiedCustomerId === cust.id
                                    ? 'bg-green-500 border-green-500 text-white shadow-green-500/10'
                                    : 'bg-blue-50 text-blue-600 hover:bg-blue-100'
                                }`}
                              >
                                <Copy className="w-3.5 h-3.5 inline-block mr-1" />
                                {copiedCustomerId === cust.id ? 'הועתק!' : 'העתק קישור'}
                              </button>
                              
                              {/* WhatsApp Share Button */}
                              {cust.phone && (
                                <a
                                  href={`https://wa.me/${cust.phone.startsWith('0') ? '972' + cust.phone.slice(1) : cust.phone}?text=${encodeURIComponent(
                                    `שלום ${cust.firstName} ${cust.lastName},\nלהלן קישור לפורטל השירות שלך ב-${businessName}:\n${baseUrl}/${tenantId}/portal/${cust.id}`
                                  )}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="p-2 bg-green-50 hover:bg-green-100 text-green-600 rounded-xl transition-all flex items-center justify-center shadow-sm active:scale-[0.98] border border-green-100/50 cursor-pointer"
                                  title="שלח בוואטסאפ"
                                >
                                  <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                                    <path d="M12.012 2c-5.506 0-9.989 4.478-9.99 9.984a9.96 9.96 0 001.33 4.982L2 22l5.164-1.355a9.96 9.96 0 004.843 1.258h.005c5.507 0 9.99-4.478 9.99-9.984 0-2.667-1.04-5.172-2.927-7.058C17.188 3.037 14.686 2 12.012 2zm6.002 14.129c-.247.697-1.2 1.286-1.65 1.343-.45.056-.89.102-2.93-.733-2.61-1.066-4.29-3.72-4.42-3.896-.13-.176-1.05-1.394-1.05-2.66 0-1.266.66-1.89.89-2.137.23-.247.5-.31.67-.31.17 0 .34.01.49.017.16.006.37-.063.58.448.22.54.74 1.808.81 1.948.07.14.12.3.02.49-.09.19-.14.31-.29.48-.14.17-.3.38-.43.51-.15.15-.3.31-.13.6.17.29.75 1.235 1.61 2.002.73.655 1.34.858 1.63.987.29.128.46.108.63-.092.17-.2.74-.858.94-1.152.2-.294.4-.247.67-.147.27.1.1.27.81 1.152.07.14.07.29.02.49v-.004z"/>
                                  </svg>
                                </a>
                              )}
 
                              {/* QR Code Printable Flyer Button */}
                              <button
                                onClick={() => setSelectedCustomerForQr(cust)}
                                className="p-2 bg-purple-50 hover:bg-purple-100 text-purple-600 rounded-xl transition-all flex items-center justify-center shadow-sm active:scale-[0.98] border border-purple-100/50 cursor-pointer"
                                title="הדפסת פלייר QR לחנות"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v1m0 11v1m0-6h.01M12 12h.01M16 8h.01M16 12h.01M8 8h.01M8 12h.01M4 4h4v4H4V4zm0 12h4v4H4v-4zm12-12h4v4h-4V4zM4 9h5M4 15h5M15 9h5" />
                                </svg>
                              </button>
 
                              {/* Waze Navigation Button */}
                              {cust.address && (
                                <a
                                  href={`https://waze.com/ul?q=${encodeURIComponent(cust.address)}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="p-2 bg-cyan-50 hover:bg-cyan-100 text-cyan-600 rounded-xl transition-all flex items-center justify-center shadow-sm active:scale-[0.95] border border-cyan-100/50 cursor-pointer"
                                  title="ניווט ב-Waze"
                                >
                                  <Navigation className="w-4 h-4" />
                                </a>
                              )}
 
                              {/* Portal Button */}
                              <a
                                href={`/${tenantId}/portal/${cust.id}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm active:scale-[0.98] border border-indigo-100/50 cursor-pointer"
                                title="כניסה לפורטל הלקוח"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                פורטל
                              </a>
                              
                              {/* Delete Customer Button */}
                              <button
                                onClick={() => handleDeleteCustomer(cust.id)}
                                className="p-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl transition-all shadow-sm active:scale-[0.98] border border-red-100/50 cursor-pointer"
                                title="מחק לקוח"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={4} className="p-10 text-center text-gray-400 text-sm">
                          לא נמצאו לקוחות.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              {filteredCustomers.length > 100 && (
                <div className="p-4 bg-gray-50 border-t text-center text-gray-400 text-xs font-semibold">
                  מציג את 100 הלקוחות הראשונים. השתמש בחיפוש לסינון מהיר.
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Details Modal */}
      {selectedRequest && (
        <div className="fixed inset-0 bg-slate-900/40 z-50 flex items-center justify-center p-4 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white/95 backdrop-blur-md rounded-3xl max-w-3xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-white/60 flex flex-col">
            {/* Modal Header */}
            <div className="p-6 border-b border-gray-200/50 flex items-center justify-between">
              <div>
                <span className="text-gray-400 font-mono text-sm block">קריאת שירות {formatRequestNumber(tenantId, selectedRequest.requestNumber)}</span>
                <h2 className="text-2xl font-black text-gray-900 mt-1">
                  {selectedRequest.customer?.firstName} {selectedRequest.customer?.lastName}
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
            <div className="p-4 md:p-6 space-y-6 md:space-y-8 flex-1" dir="rtl">
              {/* Client & Device Details Grid */}
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
                  <strong className="text-gray-800 text-base font-mono">{selectedRequest.customer?.phone || '-'}</strong>
                </div>
                <div>
                  <span className="block text-gray-400 text-xs mb-1 font-bold">כתובת:</span>
                  <strong className="text-gray-800 text-base truncate block" title={selectedRequest.customer?.address}>{selectedRequest.customer?.address || '-'}</strong>
                </div>
              </div>

              {/* Status Update Component */}
              <div className="space-y-3 text-right">
                <span className="block text-gray-400 text-xs font-bold">עדכן סטטוס קריאה:</span>
                <div className="flex flex-col sm:flex-row flex-wrap gap-2">
                  {statuses.map(st => (
                    <button
                      key={st.key}
                      onClick={() => handleStatusChange(selectedRequest.id, st.key)}
                      disabled={isUpdatingStatus}
                      className={`px-4 py-3 sm:py-2.5 w-full sm:w-auto rounded-xl text-xs font-bold border transition-all duration-200 active:scale-95 cursor-pointer ${
                        selectedRequest.status === st.key
                          ? st.key === 'COMPLETED'
                            ? 'bg-green-600 border-green-600 text-white shadow-sm shadow-green-500/10'
                            : 'bg-blue-600 border-blue-600 text-white shadow-sm shadow-blue-500/10'
                          : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50 active:scale-[0.98]'
                      }`}
                    >
                      {st.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Issue Description */}
              {selectedRequest.issueDescription && (
                <div className="p-4 bg-blue-50/30 border border-blue-100/30 rounded-2xl text-sm shadow-sm text-right space-y-1">
                  <span className="block text-gray-400 text-xs font-bold">תיאור התקלה:</span>
                  <p className="text-gray-800 font-medium whitespace-pre-wrap">{selectedRequest.issueDescription}</p>
                </div>
              )}

              {/* Repair Level and Pre-Approved Budget Displays */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-right">
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
                <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm shadow-sm text-right space-y-1">
                  <span className="block text-gray-400 text-xs font-bold">הערות לקוח נוספות:</span>
                  <p className="text-gray-700 font-medium whitespace-pre-wrap">{selectedRequest.comments}</p>
                </div>
              )}

              {/* Action Buttons (Delete & Info) */}
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex-1 p-4 bg-orange-50/50 border border-orange-100/50 rounded-2xl flex items-center justify-between text-orange-850 text-sm shadow-sm">
                  <span className="font-bold">אישור דמי בדיקה (150 ש&quot;ח):</span>
                  <span className="px-3 py-1 bg-orange-600 text-white rounded-lg text-xs font-black shadow-sm">מאושר</span>
                </div>
                
                <button
                  onClick={() => handleDeleteRequest(selectedRequest.id)}
                  disabled={isDeleting}
                  className="px-6 py-4 sm:py-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-2xl text-sm font-bold border border-red-100 transition-all active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer"
                >
                  {isDeleting ? (
                    <span className="animate-pulse">מוחק...</span>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4" />
                      מחק קריאה
                    </>
                  )}
                </button>
              </div>

              {/* Images Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-right">
                
                 {/* Tool Photos (Supports up to 3 images) */}
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

                {/* Receipt Photo */}
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
                      <svg className="w-8 h-8 text-gray-300 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                      <span className="text-xs font-semibold">לא צוינה אחריות</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            {/* Modal Footer */}
            <div className="p-5 bg-gray-50/70 border-t border-gray-100 flex justify-end">
              <button
                onClick={() => setSelectedRequest(null)}
                className="px-6 py-2.5 bg-gray-950 hover:bg-gray-900 text-white rounded-xl text-sm font-bold transition-all shadow active:scale-[0.98]"
              >
                סגור
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Service Request Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-gray-100 flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-gray-900">פתח קריאת שירות חדשה</h2>
                <p className="text-gray-400 text-xs mt-1">בחר לקוח כדי לשלוח לו קישור אישי לפתיחת קריאה ב-WhatsApp</p>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="p-2 hover:bg-gray-100 rounded-full text-gray-400 hover:text-gray-700 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-6" dir="rtl">
              {/* Customer Search input */}
              <div className="space-y-2">
                <label className="block text-gray-700 text-xs font-bold">חפש לקוח לפי שם או טלפון:</label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="הקלד שם לקוח לחיפוש..."
                    value={createSearch}
                    onChange={(e) => {
                      setCreateSearch(e.target.value);
                      setSelectedCustomerForCreate(null);
                    }}
                    className="w-full pl-4 pr-10 py-3 rounded-xl border border-gray-200 bg-gray-50/50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white text-gray-800 text-sm transition-all"
                  />
                  <svg className="w-4 h-4 text-gray-400 absolute right-3.5 top-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
              </div>

              {/* Dynamic Search Results */}
              {createSearch.trim().length > 0 && !selectedCustomerForCreate && (
                <div className="border border-gray-100 rounded-2xl overflow-hidden divide-y divide-gray-50 bg-white max-h-48 overflow-y-auto shadow-inner">
                  {customersList
                    .filter(cust => {
                      const name = `${cust.firstName} ${cust.lastName}`.toLowerCase();
                      const phone = (cust.phone || '').toLowerCase();
                      const search = createSearch.toLowerCase();
                      return name.includes(search) || phone.includes(search);
                    })
                    .slice(0, 5)
                    .map(cust => (
                      <div
                        key={cust.id}
                        onClick={() => {
                          setSelectedCustomerForCreate(cust);
                          setCreateSearch(`${cust.firstName} ${cust.lastName}`);
                        }}
                        className="p-3.5 hover:bg-blue-50/40 cursor-pointer flex items-center justify-between text-sm transition-colors"
                      >
                        <div className="text-right">
                          <strong className="text-gray-800 font-bold block">{cust.firstName} {cust.lastName}</strong>
                          <span className="text-gray-400 text-xs font-mono">{cust.phone || 'ללא טלפון'}</span>
                        </div>
                        <span className="text-xs text-blue-600 font-bold hover:underline">בחר ↙</span>
                      </div>
                    ))}
                  {customersList.filter(cust => {
                    const name = `${cust.firstName} ${cust.lastName}`.toLowerCase();
                    const phone = (cust.phone || '').toLowerCase();
                    const search = createSearch.toLowerCase();
                    return name.includes(search) || phone.includes(search);
                  }).length === 0 && (
                    <div className="p-4 text-center text-xs text-gray-400">לא נמצאו לקוחות מתאימים.</div>
                  )}
                </div>
              )}

              {/* Selected Customer Card & WhatsApp Action */}
              {selectedCustomerForCreate && (
                <div className="space-y-4">
                  <div className="p-4 bg-blue-50/30 border border-blue-100 rounded-2xl text-sm space-y-2">
                    <div className="flex justify-between">
                      <span className="text-gray-400">לקוח נבחר:</span>
                      <strong className="text-gray-800 font-bold">{selectedCustomerForCreate.firstName} {selectedCustomerForCreate.lastName}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">טלפון:</span>
                      <strong className="text-gray-800 font-mono">{selectedCustomerForCreate.phone || '-'}</strong>
                    </div>
                    {selectedCustomerForCreate.serialNumber && (
                      <div className="flex justify-between">
                        <span className="text-gray-400">מספר סריאלי:</span>
                        <strong className="text-gray-800 font-mono">{selectedCustomerForCreate.serialNumber}</strong>
                      </div>
                    )}
                  </div>

                  {/* Tool Description Input */}
                  <div className="space-y-1.5 text-right">
                    <label className="block text-gray-700 text-xs font-bold">שם בעל הכלי / פירוט (אופציונלי):</label>
                    <input
                      type="text"
                      placeholder="לדוגמה: קורקינט של דוד / שיאומי שחור"
                      value={adminToolOwnerName}
                      onChange={(e) => setAdminToolOwnerName(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:bg-white text-gray-800 text-xs transition-all"
                    />
                  </div>

                  {/* Tool Phone Input */}
                  <div className="space-y-1.5 text-right">
                    <label className="block text-gray-700 text-xs font-bold">מספר טלפון בעל הכלי (אופציונלי):</label>
                    <input
                      type="tel"
                      placeholder="הזן מספר טלפון ליצירת קשר"
                      value={adminToolOwnerPhone}
                      onChange={(e) => setAdminToolOwnerPhone(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:bg-white text-gray-800 text-xs transition-all text-right"
                      dir="rtl"
                    />
                  </div>

                  {selectedCustomerForCreate.phone ? (
                    <a
                      href={`https://wa.me/${selectedCustomerForCreate.phone.startsWith('0') ? '972' + selectedCustomerForCreate.phone.slice(1) : selectedCustomerForCreate.phone}?text=${encodeURIComponent(
                        `שלום ${selectedCustomerForCreate.firstName} ${selectedCustomerForCreate.lastName},\nלהלן קישור לפתיחת קריאת שירות מ-${businessName} עבור הכלי שלך:\n${baseUrl}/${tenantId}/request/${selectedCustomerForCreate.id}`
                      )}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full py-4 bg-[#25D366] hover:bg-[#20ba59] text-white rounded-2xl text-sm font-bold flex items-center justify-center gap-2 shadow-lg shadow-green-500/20 transition-all active:scale-[0.98] cursor-pointer"
                    >
                      <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                        <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.003 5.37 5.378 0 12.003 0a11.94 11.94 0 0 1 8.484 3.513 11.94 11.94 0 0 1 3.51 8.49c-.003 6.63-5.378 12-12.003 12-1.996-.001-3.957-.502-5.709-1.455L0 24zm6.59-14.859c-.12-.2-.24-.2-.35-.2-.11 0-.24-.03-.36-.03-.13 0-.34.05-.52.25-.18.2-.68.66-.68 1.6s.69 1.86.78 2c.1.13 1.36 2.07 3.29 2.91.46.2.82.32 1.1.41.47.15.89.13 1.22.08.38-.06 1.15-.47 1.31-.93.16-.46.16-.86.11-.93-.05-.08-.18-.13-.38-.23-.19-.1-.1.38-.1.74-.11.16-.36.23-.74.13-.38-.11-1.42-.52-2.71-1.68-.96-.86-1.61-1.92-1.8-2.25-.19-.33-.02-.51.15-.68.15-.15.33-.36.5-.54.17-.18.23-.3.33-.5.1-.2.05-.38-.03-.48z" />
                      </svg>
                      שלח קישור אישי ב-WhatsApp
                    </a>
                  ) : (
                    <div className="p-3 bg-red-50 text-red-600 rounded-xl text-xs font-semibold text-center">
                      ללקוח זה אין מספר טלפון מעודכן. לא ניתן לשלוח הודעה.
                    </div>
                  )}

                  {/* Save Directly in System Button */}
                  <button
                    type="button"
                    onClick={handleAdminSaveRequest}
                    disabled={isAdminSavingRequest}
                    className="w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-2xl text-sm font-black flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20 transition-all active:scale-[0.98] cursor-pointer disabled:opacity-50"
                  >
                    {isAdminSavingRequest ? (
                      <svg className="w-5 h-5 animate-spin text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                      </svg>
                    )}
                    שמור קריאה במערכת (ממתין לאיסוף)
                  </button>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-5 bg-gray-50/70 border-t border-gray-100 flex justify-end">
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="px-5 py-2 bg-gray-900 hover:bg-gray-800 text-white rounded-xl text-xs font-bold transition-all active:scale-[0.98]"
              >
                סגור
              </button>
            </div>
          </div>
        </div>
      )}

      {/* QR Flyer Modal */}
      {selectedCustomerForQr && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 backdrop-blur-sm overflow-y-auto print:p-0 print:bg-white print:static">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-gray-100 flex flex-col overflow-hidden print:shadow-none print:border-none print:max-w-none print:w-full print:h-full">
            {/* Modal Header - Hidden in Print */}
            <div className="p-6 border-b border-gray-100 flex items-center justify-between print:hidden">
              <div>
                <h2 className="text-xl font-bold text-gray-900">הורדת/הדפסת קוד QR חנות</h2>
                <p className="text-gray-400 text-xs mt-1">הדפס דף זה או שמור כ-PDF כדי להציג בחנות</p>
              </div>
              <button
                onClick={() => setSelectedCustomerForQr(null)}
                className="p-2 hover:bg-gray-100 rounded-full text-gray-400 hover:text-gray-700 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Flyer Container (The Printable Area) */}
            <div className="p-8 flex flex-col items-center text-center bg-white space-y-6 flex-1 print:p-12 print:justify-center" dir="rtl">
              {/* Flyer Header */}
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white font-black text-2xl shadow-lg shadow-blue-500/20">{businessName.charAt(0)}</div>
                <span className="text-3xl font-black tracking-tight text-gray-900">{businessName}</span>
              </div>
              
              <div className="space-y-2">
                <h1 className="text-3xl font-extrabold text-gray-950 tracking-tight">לקבלת שירות {businessName}</h1>
                <p className="text-gray-500 text-sm font-medium">סרקו את קוד ה-QR לפתיחת קריאת שירות מהירה במכשיר שלכם</p>
              </div>

              {/* QR Code Container */}
              <div className="p-4 bg-gray-50 rounded-3xl border border-gray-100 shadow-inner flex items-center justify-center print:border-none print:bg-white print:shadow-none">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(
                    `${baseUrl}/${tenantId}/request/${selectedCustomerForQr.id}`
                  )}`}
                  alt={`${businessName} Service QR Code`}
                  className="w-56 h-56 print:w-72 print:h-72"
                />
              </div>

              {/* Customer info footer on the flyer */}
              <div className="border-t border-gray-100 pt-6 w-full text-center space-y-1">
                <span className="block text-xs text-gray-400 font-bold uppercase tracking-wider">משויך לחנות / לקוח:</span>
                <strong className="text-lg text-gray-800 font-bold block">{selectedCustomerForQr.firstName} {selectedCustomerForQr.lastName}</strong>
                {selectedCustomerForQr.phone && (
                  <span className="text-xs text-gray-400 font-mono block">{selectedCustomerForQr.phone}</span>
                )}
              </div>
            </div>

            {/* Modal Actions - Hidden in Print */}
            <div className="p-5 bg-gray-50/70 border-t border-gray-100 flex justify-between gap-3 print:hidden">
              <button
                onClick={() => window.print()}
                className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 shadow-md shadow-blue-500/10 transition-all active:scale-[0.98] cursor-pointer"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                </svg>
                הדפס פלייר
              </button>
              <button
                onClick={() => setSelectedCustomerForQr(null)}
                className="px-6 py-3 bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 rounded-xl text-sm font-bold transition-all active:scale-[0.98]"
              >
                סגור
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Customer Modal */}
      {isAddCustomerModalOpen && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-gray-100 flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-gray-900">הוסף לקוח חדש</h2>
                <p className="text-gray-400 text-xs mt-1">מלא את פרטי הלקוח כדי להוסיף אותו למערכת</p>
              </div>
              <button
                onClick={() => setIsAddCustomerModalOpen(false)}
                className="p-2 hover:bg-gray-100 rounded-full text-gray-400 hover:text-gray-700 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Body - Form */}
            <form onSubmit={handleAddCustomer} className="p-6 space-y-4 max-h-[65vh] overflow-y-auto" dir="rtl">
              {/* Name Row */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="block text-gray-700 text-xs font-bold">שם פרטי <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    placeholder="ישראל"
                    value={newCustomer.firstName}
                    onChange={(e) => setNewCustomer(prev => ({ ...prev, firstName: e.target.value }))}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:bg-white text-gray-800 text-sm transition-all"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-gray-700 text-xs font-bold">שם משפחה <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    placeholder="ישראלי"
                    value={newCustomer.lastName}
                    onChange={(e) => setNewCustomer(prev => ({ ...prev, lastName: e.target.value }))}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:bg-white text-gray-800 text-sm transition-all"
                    required
                  />
                </div>
              </div>

              {/* Phone & Email Row */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="block text-gray-700 text-xs font-bold">טלפון</label>
                  <input
                    type="tel"
                    placeholder="052-1234567"
                    value={newCustomer.phone}
                    onChange={(e) => setNewCustomer(prev => ({ ...prev, phone: e.target.value }))}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:bg-white text-gray-800 text-sm transition-all"
                    dir="ltr"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-gray-700 text-xs font-bold">אימייל</label>
                  <input
                    type="email"
                    placeholder="email@example.com"
                    value={newCustomer.email}
                    onChange={(e) => setNewCustomer(prev => ({ ...prev, email: e.target.value }))}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:bg-white text-gray-800 text-sm transition-all"
                    dir="ltr"
                  />
                </div>
              </div>

              {/* Address */}
              <div className="space-y-1.5">
                <label className="block text-gray-700 text-xs font-bold">כתובת</label>
                <input
                  type="text"
                  placeholder="דרך מנחם בגין 121, תל אביב"
                  value={newCustomer.address}
                  onChange={(e) => setNewCustomer(prev => ({ ...prev, address: e.target.value }))}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:bg-white text-gray-800 text-sm transition-all"
                />
              </div>

              {/* Vehicle Details Row */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="block text-gray-700 text-xs font-bold">לוחית רישוי</label>
                  <input
                    type="text"
                    placeholder="12-345-67"
                    value={newCustomer.licensePlate}
                    onChange={(e) => setNewCustomer(prev => ({ ...prev, licensePlate: e.target.value }))}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:bg-white text-gray-800 text-sm transition-all"
                    dir="ltr"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-gray-700 text-xs font-bold">צבע</label>
                  <input
                    type="text"
                    placeholder="שחור מטאלי"
                    value={newCustomer.color}
                    onChange={(e) => setNewCustomer(prev => ({ ...prev, color: e.target.value }))}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:bg-white text-gray-800 text-sm transition-all"
                  />
                </div>
              </div>

              {/* Serial Number */}
              <div className="space-y-1.5">
                <label className="block text-gray-700 text-xs font-bold">מספר סריאלי</label>
                <input
                  type="text"
                  placeholder="GW-88392-XL"
                  value={newCustomer.serialNumber}
                  onChange={(e) => setNewCustomer(prev => ({ ...prev, serialNumber: e.target.value }))}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:bg-white text-gray-800 text-sm transition-all"
                  dir="ltr"
                />
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={isSavingCustomer}
                className="w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-2xl text-sm font-black flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20 transition-all active:scale-[0.98] cursor-pointer disabled:opacity-50"
              >
                {isSavingCustomer ? (
                  <svg className="w-5 h-5 animate-spin text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                  </svg>
                )}
                {isSavingCustomer ? 'שומר...' : 'הוסף לקוח למערכת'}
              </button>
            </form>

            {/* Modal Footer */}
            <div className="p-5 bg-gray-50/70 border-t border-gray-100 flex justify-end">
              <button
                onClick={() => setIsAddCustomerModalOpen(false)}
                className="px-5 py-2 bg-gray-900 hover:bg-gray-800 text-white rounded-xl text-xs font-bold transition-all active:scale-[0.98]"
              >
                סגור
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
