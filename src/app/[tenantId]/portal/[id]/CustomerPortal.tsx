'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Customer, PartRequest, ServiceRequest } from '@/lib/db';
import { buildWhatsAppMessage, formatRequestNumber } from '@/lib/format';
import {
  FileText, Clock, AlertCircle, CheckCircle2, Search, Plus,
  RotateCw, Trash2, Calendar, Phone, Copy, Printer, Eye,
  User, Barcode, ShieldCheck, ShieldAlert, UploadCloud, Check, Loader2, X, Settings, Package
} from 'lucide-react';

interface CustomerPortalProps {
  customer: Customer;
  tenantId: string;
  initialRequests: ServiceRequest[];
  initialPartRequests: PartRequest[];
  businessName: string;
  whatsappTemplate: string;
  partsRequestPhone?: string;
  logoUrl?: string;
  primaryColor?: string;
}

export default function CustomerPortal({ customer, initialRequests, initialPartRequests, tenantId, businessName, whatsappTemplate, partsRequestPhone = '', logoUrl = '', primaryColor = '' }: CustomerPortalProps) {
  const [requests, setRequests] = useState<ServiceRequest[]>(initialRequests);
  const [partRequestsHistory, setPartRequestsHistory] = useState<PartRequest[]>(initialPartRequests);
  const [currentCustomer, setCurrentCustomer] = useState<Customer>(customer);
  const [activeView, setActiveView] = useState<'requests' | 'parts'>('requests');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [baseUrl, setBaseUrl] = useState('');

  // Customer Settings States
  const [isCustomerSettingsOpen, setIsCustomerSettingsOpen] = useState(false);
  const [settingsFirstName, setSettingsFirstName] = useState(customer.firstName);
  const [settingsLastName, setSettingsLastName] = useState(customer.lastName);
  const [settingsPhone, setSettingsPhone] = useState(customer.phone || '');
  const [settingsEmail, setSettingsEmail] = useState(customer.email || '');
  const [settingsAddress, setSettingsAddress] = useState(customer.address || '');
  const [settingsLicensePlate, setSettingsLicensePlate] = useState(customer.licensePlate || '');
  const [settingsColor, setSettingsColor] = useState(customer.color || '');
  const [settingsSerialNumber, setSettingsSerialNumber] = useState(customer.serialNumber || '');
  const [customerLogoFile, setCustomerLogoFile] = useState<File | null>(null);
  const [customerLogoPreview, setCustomerLogoPreview] = useState<string | null>(customer.logoUrl || null);
  const [removeCustomerLogoFlag, setRemoveCustomerLogoFlag] = useState(false);
  const [isSavingCustomerSettings, setIsSavingCustomerSettings] = useState(false);
  const [customerSettingsError, setCustomerSettingsError] = useState<string | null>(null);
  const [customerSettingsSuccess, setCustomerSettingsSuccess] = useState(false);

  const openCustomerSettingsModal = () => {
    setSettingsFirstName(currentCustomer.firstName);
    setSettingsLastName(currentCustomer.lastName);
    setSettingsPhone(currentCustomer.phone || '');
    setSettingsEmail(currentCustomer.email || '');
    setSettingsAddress(currentCustomer.address || '');
    setSettingsLicensePlate(currentCustomer.licensePlate || '');
    setSettingsColor(currentCustomer.color || '');
    setSettingsSerialNumber(currentCustomer.serialNumber || '');
    setCustomerLogoFile(null);
    setCustomerLogoPreview(currentCustomer.logoUrl || null);
    setRemoveCustomerLogoFlag(false);
    setCustomerSettingsError(null);
    setCustomerSettingsSuccess(false);
    setIsCustomerSettingsOpen(true);
  };

  const handleCustomerLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setCustomerLogoFile(file);
      setCustomerLogoPreview(URL.createObjectURL(file));
      setRemoveCustomerLogoFlag(false);
    }
  };

  const handleRemoveCustomerLogo = () => {
    setCustomerLogoFile(null);
    setCustomerLogoPreview(null);
    setRemoveCustomerLogoFlag(true);
  };

  const handleSaveCustomerSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingCustomerSettings(true);
    setCustomerSettingsError(null);
    setCustomerSettingsSuccess(false);

    try {
      const formData = new FormData();
      formData.append('firstName', settingsFirstName.trim());
      formData.append('lastName', settingsLastName.trim());
      formData.append('phone', settingsPhone.trim());
      formData.append('email', settingsEmail.trim());
      formData.append('address', settingsAddress.trim());
      formData.append('licensePlate', settingsLicensePlate.trim());
      formData.append('color', settingsColor.trim());
      formData.append('serialNumber', settingsSerialNumber.trim());
      if (removeCustomerLogoFlag) {
        formData.append('removeLogo', 'true');
      } else if (customerLogoFile) {
        formData.append('logo', customerLogoFile);
      }

      const res = await fetch(`/api/${tenantId}/customers/${currentCustomer.id}/settings`, {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'שגיאה בשמירת ההגדרות');
      }

      const updatedCust: Customer = {
        ...currentCustomer,
        firstName: settingsFirstName.trim(),
        lastName: settingsLastName.trim(),
        phone: settingsPhone.trim(),
        email: settingsEmail.trim(),
        address: settingsAddress.trim(),
        licensePlate: settingsLicensePlate.trim(),
        color: settingsColor.trim(),
        serialNumber: settingsSerialNumber.trim(),
        logoUrl: removeCustomerLogoFlag ? '' : (data.logoUrl || currentCustomer.logoUrl)
      };

      setCurrentCustomer(updatedCust);
      setCustomerSettingsSuccess(true);
      setTimeout(() => setIsCustomerSettingsOpen(false), 1000);
    } catch (err: unknown) {
      setCustomerSettingsError(err instanceof Error ? err.message : 'שגיאה בשמירת ההגדרות');
    } finally {
      setIsSavingCustomerSettings(false);
    }
  };

  useEffect(() => {
    setBaseUrl(window.location.origin);
    // Simulate a slight delay to show the beautiful skeleton loader (UX effect)
    const timer = setTimeout(() => setIsInitialLoading(false), 100);
    return () => clearTimeout(timer);
  }, []);

  // Details Modal state
  const [selectedRequest, setSelectedRequest] = useState<ServiceRequest | null>(null);

  // Create Request Modal state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [storeName, setStoreName] = useState(`${customer.firstName} ${customer.lastName}`);
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

  // Part Request module state — up to MAX_PART_ITEMS parts submitted together
  const MAX_PART_ITEMS = 10;
  const createEmptyPartItem = () => ({
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    description: '',
    photo: null as File | null,
    photoPreview: null as string | null,
  });

  const [isPartFormOpen, setIsPartFormOpen] = useState(false);
  const [partItems, setPartItems] = useState<ReturnType<typeof createEmptyPartItem>[]>(() => [createEmptyPartItem()]);
  const [isSubmittingPartRequest, setIsSubmittingPartRequest] = useState(false);
  const [partRequestError, setPartRequestError] = useState<string | null>(null);
  const [partRequestSuccess, setPartRequestSuccess] = useState(false);
  const [submittedPartDescriptions, setSubmittedPartDescriptions] = useState<string[]>([]);

  const startNewPartRequest = () => {
    setPartItems([createEmptyPartItem()]);
    setPartRequestError(null);
    setPartRequestSuccess(false);
    setSubmittedPartDescriptions([]);
    setIsPartFormOpen(true);
  };

  const closePartModal = () => {
    partItems.forEach(item => { if (item.photoPreview) URL.revokeObjectURL(item.photoPreview); });
    setPartItems([createEmptyPartItem()]);
    setPartRequestError(null);
    setPartRequestSuccess(false);
    setSubmittedPartDescriptions([]);
    setIsPartFormOpen(false);
  };

  const addPartItem = () => {
    setPartItems(prev => prev.length >= MAX_PART_ITEMS ? prev : [...prev, createEmptyPartItem()]);
  };

  const removePartItem = (id: string) => {
    setPartItems(prev => {
      if (prev.length <= 1) return prev;
      const target = prev.find(i => i.id === id);
      if (target?.photoPreview) URL.revokeObjectURL(target.photoPreview);
      return prev.filter(i => i.id !== id);
    });
  };

  const updatePartItemDescription = (id: string, value: string) => {
    setPartItems(prev => prev.map(i => i.id === id ? { ...i, description: value } : i));
  };

  const handlePartItemPhotoChange = (id: string, e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setPartItems(prev => prev.map(i => {
        if (i.id !== id) return i;
        if (i.photoPreview) URL.revokeObjectURL(i.photoPreview);
        return { ...i, photo: file, photoPreview: URL.createObjectURL(file) };
      }));
    }
  };

  const removePartItemPhoto = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setPartItems(prev => prev.map(i => {
      if (i.id !== id) return i;
      if (i.photoPreview) URL.revokeObjectURL(i.photoPreview);
      return { ...i, photo: null, photoPreview: null };
    }));
  };

  const handleSubmitPartRequest = async () => {
    setPartRequestError(null);

    const incomplete = partItems.find(i => !i.description.trim() || !i.photo);
    if (incomplete) {
      setPartRequestError('יש למלא תיאור ולצרף תמונה לכל חלק שביקשתם.');
      return;
    }

    setIsSubmittingPartRequest(true);

    try {
      const settled = await Promise.allSettled(partItems.map(async item => {
        const formData = new FormData();
        formData.append('customerId', currentCustomer.id);
        formData.append('description', item.description.trim());
        formData.append('photo', item.photo as File);

        const res = await fetch(`/api/${tenantId}/parts-requests`, {
          method: 'POST',
          body: formData,
        });

        let data: { error?: string; request?: PartRequest };
        try {
          data = await res.json();
        } catch {
          throw new Error('שגיאת שרת זמנית, אנא נסה שנית בעוד רגע.');
        }
        if (!res.ok) {
          throw new Error(data.error || 'ארעה שגיאה בשליחת הבקשה.');
        }
        return data.request as PartRequest;
      }));

      const succeeded = settled
        .filter((r): r is PromiseFulfilledResult<PartRequest> => r.status === 'fulfilled')
        .map(r => r.value);
      const failedCount = settled.length - succeeded.length;

      if (succeeded.length > 0) {
        setPartRequestsHistory(prev => [...succeeded, ...prev]);
      }

      if (succeeded.length === 0) {
        setPartRequestError('ארעה שגיאה בשליחת הבקשות, אנא נסו שנית.');
      } else {
        setSubmittedPartDescriptions(succeeded.map(r => r.description));
        setPartRequestSuccess(true);
        if (failedCount > 0) {
          setPartRequestError(`${failedCount} מתוך ${settled.length} בקשות לא נשלחו, אנא נסו שוב עבורן.`);
        }
      }
    } finally {
      setIsSubmittingPartRequest(false);
    }
  };

  const openCreateModal = () => {
    setStoreName(`${currentCustomer.firstName} ${currentCustomer.lastName}`);
    setToolOwnerName('');
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
      formData.append('customerId', currentCustomer.id);
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

      let data: { error?: string; request?: ServiceRequest };
      try {
        data = await res.json();
      } catch {
        throw new Error('שגיאת שרת זמנית, אנא נסה שנית בעוד רגע.');
      }
      if (!res.ok) {
        throw new Error(data.error || 'ארעה שגיאה בשליחת הטופס.');
      }

      if (data.request?.requestNumber) {
        setCreatedRequestNumber(data.request.requestNumber);
      }
      
      // Update local state live!
      if (data.request) {
        setRequests(prev => [data.request as ServiceRequest, ...prev]);
      }
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
      const [reqRes, partRes] = await Promise.all([
        fetch(`/api/${tenantId}/requests/by-customer/${currentCustomer.id}`),
        fetch(`/api/${tenantId}/parts-requests/by-customer/${currentCustomer.id}`),
      ]);
      if (reqRes.ok) {
        const data = await reqRes.json();
        if (data.requests) setRequests(data.requests);
      }
      if (partRes.ok) {
        const data = await partRes.json();
        if (data.requests) setPartRequestsHistory(data.requests);
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
      const res = await fetch(`/api/${tenantId}/requests/${requestId}?customerId=${currentCustomer.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('שגיאה במחיקת קריאת השירות');

      setRequests(prev => prev.filter(r => r.id !== requestId));
    } catch (err: unknown) {
      alert('שגיאה במחיקת קריאת השירות');
    }
  };

  // Delete part request — gated by a shop-configured password, not link possession
  const handleDeletePartRequest = async (requestId: string) => {
    const password = window.prompt('להשלמת המחיקה, יש להזין את סיסמת המחיקה:');
    if (password === null) return;

    try {
      const res = await fetch(`/api/${tenantId}/parts-requests/${requestId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'שגיאה במחיקת הבקשה');
      }
      setPartRequestsHistory(prev => prev.filter(r => r.id !== requestId));
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'שגיאה במחיקת הבקשה');
    }
  };

  const formUrl = `${baseUrl}/${tenantId}/request/${currentCustomer.id}`;
  const portalUrl = `${baseUrl}/${tenantId}/portal/${currentCustomer.id}`;

  return (
    <div 
      className="min-h-screen bg-[#f5f5f7] text-[#1d1d1f] font-sans antialiased pb-20 print:bg-white print:pb-0 print:min-h-0 print:h-auto" 
      dir="rtl"
      style={{ '--theme-color': primaryColor || '#2563eb', '--theme-color-light': `${primaryColor || '#2563eb'}1A` } as React.CSSProperties}
    >
      <div className="print:hidden">
      <div className="flex flex-col md:flex-row min-h-screen">
        {/* Mobile header + section switcher (below md) */}
        <div className="md:hidden sticky top-0 z-40 bg-white/70 backdrop-blur-xl border-b border-gray-200/50">
          <div className="px-4 py-3 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-8 h-8 rounded-lg overflow-hidden border bg-gray-50 flex items-center justify-center flex-shrink-0">
                {currentCustomer.logoUrl ? (
                  <img src={currentCustomer.logoUrl} alt="Customer Avatar" className="w-full h-full object-contain" />
                ) : (
                  <div className="w-full h-full bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white font-black text-xs">{currentCustomer.firstName[0]}</div>
                )}
              </div>
              <span className="text-sm font-black text-gray-900 truncate">{currentCustomer.firstName} {currentCustomer.lastName}</span>
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <button
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 active:scale-95 transition-all border border-gray-200/50 bg-white/80 shadow-sm cursor-pointer flex items-center justify-center"
                title="רענן נתונים"
              >
                <RotateCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-blue-600' : ''}`} />
              </button>
              <button
                onClick={openCustomerSettingsModal}
                className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 active:scale-95 transition-all border border-gray-200/50 bg-white/80 shadow-sm cursor-pointer flex items-center justify-center"
                title="הגדרות פרופיל"
              >
                <Settings className="w-4 h-4" />
              </button>
              <button
                onClick={openCreateModal}
                className="p-2 bg-[var(--theme-color,#2563eb)] hover:opacity-90 text-white rounded-lg shadow-md transition-all active:scale-95 cursor-pointer flex items-center justify-center"
                title="פתח קריאה חדשה"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div className="px-4 pb-3 flex items-center gap-2">
            <button
              onClick={() => setActiveView('requests')}
              className={`flex-1 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                activeView === 'requests'
                  ? 'bg-[var(--theme-color,#2563eb)] text-white shadow-md'
                  : 'bg-gray-100 text-gray-600'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              קריאות שירות
            </button>
            <button
              onClick={() => setActiveView('parts')}
              className={`flex-1 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                activeView === 'parts'
                  ? 'bg-[#14C425] text-white shadow-md'
                  : 'bg-[#14C425]/10 text-[#0F9E1D]'
              }`}
            >
              <Package className="w-3.5 h-3.5" />
              בקשות חלקים
            </button>
          </div>
        </div>

        {/* Sidebar */}
        <aside className="hidden md:flex md:flex-col w-64 shrink-0 sticky top-0 h-screen bg-white/70 backdrop-blur-xl border-l border-gray-200/50 px-4 py-6 overflow-y-auto">
          <div className="flex items-center gap-3 mb-8 px-1">
            <div className="w-10 h-10 rounded-xl overflow-hidden border bg-gray-50 flex items-center justify-center shadow-lg shadow-blue-500/5 active:scale-95 transition-all select-none flex-shrink-0">
              {currentCustomer.logoUrl ? (
                <img src={currentCustomer.logoUrl} alt="Customer Avatar" className="w-full h-full object-contain" />
              ) : (
                <div className="w-full h-full bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white font-black text-lg">{currentCustomer.firstName[0]}</div>
              )}
            </div>
            <div className="min-w-0">
              <span className="text-sm font-black tracking-tight block leading-tight text-gray-900 truncate">{currentCustomer.firstName} {currentCustomer.lastName}</span>
              <span className="text-[10px] text-blue-600 font-bold uppercase tracking-wider mt-1 block truncate">{businessName} פורטל לקוח</span>
            </div>
          </div>

          <nav className="flex-1 space-y-1.5">
            <button
              onClick={() => setActiveView('requests')}
              className={`w-full px-4 py-3 rounded-xl text-sm font-bold flex items-center gap-2.5 transition-all cursor-pointer ${
                activeView === 'requests'
                  ? 'bg-[var(--theme-color,#2563eb)] text-white shadow-md shadow-[var(--theme-color-light,#2563eb1A)]'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <FileText className="w-4 h-4" />
              קריאות שירות
            </button>
            <button
              onClick={() => setActiveView('parts')}
              className={`w-full px-4 py-3 rounded-xl text-sm font-bold flex items-center gap-2.5 transition-all cursor-pointer ${
                activeView === 'parts'
                  ? 'bg-[#14C425] text-white shadow-md shadow-[#14C425]/20'
                  : 'bg-[#14C425]/10 text-[#0F9E1D] hover:bg-[#14C425]/15 border border-[#14C425]/20'
              }`}
            >
              <Package className="w-4 h-4" />
              בקשות חלקים
            </button>
          </nav>

          <div className="space-y-1.5 pt-4 mt-4 border-t border-gray-100">
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="w-full px-4 py-2.5 hover:bg-gray-100 rounded-xl text-gray-500 active:scale-95 transition-all border border-gray-200/50 bg-white/80 shadow-sm cursor-pointer flex items-center gap-2.5 text-xs font-bold"
            >
              <RotateCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-blue-600' : ''}`} />
              רענן נתונים
            </button>
            <button
              onClick={openCustomerSettingsModal}
              className="w-full px-4 py-2.5 hover:bg-gray-100 rounded-xl text-gray-500 active:scale-95 transition-all border border-gray-200/50 bg-white/80 shadow-sm cursor-pointer flex items-center gap-2.5 text-xs font-bold"
            >
              <Settings className="w-4 h-4" />
              הגדרות פרופיל
            </button>
            <button
              onClick={openCreateModal}
              className="w-full px-4 py-2.5 bg-[var(--theme-color,#2563eb)] hover:opacity-90 text-white rounded-xl text-xs font-bold flex items-center gap-2.5 shadow-lg shadow-[var(--theme-color-light,#2563eb1A)] transition-all active:scale-[0.98] cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              פתח קריאה חדשה
            </button>
          </div>
        </aside>

        {/* Content Pane */}
        <div className="flex-1 min-w-0">
      <main className="w-full px-4 md:px-8 lg:px-12 pt-6 md:pt-10">
        {activeView === 'requests' && (
        <div className="space-y-8">
          {/* Branded Welcome Hero Banner */}
          <div className="relative overflow-hidden bg-white/70 backdrop-blur-xl border border-white/60 p-6 md:p-8 rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.02)] flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl -mr-10 -mt-10 animate-pulse"></div>
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-indigo-500/5 rounded-full blur-3xl -ml-10 -mb-10"></div>
            
            <div className="relative z-10 flex flex-col md:flex-row items-center gap-4 text-center md:text-right">
              {logoUrl ? (
                <div className="w-16 h-16 rounded-2xl overflow-hidden border bg-white flex items-center justify-center shadow-md p-1 flex-shrink-0">
                  <img src={logoUrl} alt="Store Logo" className="w-full h-full object-contain" />
                </div>
              ) : (
                <div className="w-16 h-16 rounded-2xl bg-[var(--theme-color,#2563eb)] flex items-center justify-center text-white font-black text-2xl shadow-md flex-shrink-0">
                  {businessName.charAt(0)}
                </div>
              )}
              <div>
                <h1 className="text-xl md:text-2xl font-black text-gray-900">שירות לקוחות {businessName}</h1>
                <p className="text-gray-500 text-sm mt-1 font-medium">שלום {currentCustomer.firstName} {currentCustomer.lastName}, עקוב אחר קריאות השירות או פתח פנייה חדשה בכפתור למעלה.</p>
              </div>
            </div>
          </div>

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
              <div className="p-3.5 bg-white rounded-2xl border border-gray-200/50 shadow-inner relative flex items-center justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(formUrl)}`}
                  alt="QR Code"
                  className="w-32 h-32"
                />
                {currentCustomer.logoUrl && (
                  <div className="absolute w-8 h-8 bg-white p-0.5 rounded-lg border border-gray-150 shadow-sm overflow-hidden flex items-center justify-center">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={currentCustomer.logoUrl} alt="Logo" className="w-full h-full object-contain" />
                  </div>
                )}
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
                  {isInitialLoading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <tr key={`skeleton-${i}`} className="animate-pulse">
                        <td className="p-5"><div className="h-4 bg-gray-200 rounded w-16"></div></td>
                        <td className="p-5"><div className="h-4 bg-gray-200 rounded w-24"></div></td>
                        <td className="p-5"><div className="h-4 bg-gray-200 rounded w-20"></div></td>
                        <td className="p-5"><div className="h-6 bg-gray-200 rounded-full w-12"></div></td>
                        <td className="p-5"><div className="h-4 bg-gray-200 rounded w-24"></div></td>
                        <td className="p-5"><div className="h-6 bg-gray-200 rounded-xl w-24"></div></td>
                        <td className="p-5"><div className="h-8 bg-gray-200 rounded-xl w-16 mx-auto"></div></td>
                      </tr>
                    ))
                  ) : filteredRequests.length > 0 ? (
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
                <strong className="text-gray-800 font-mono">{currentCustomer.phone || 'לא מעודכן'}</strong>
              </div>
              <div>
                <span className="text-gray-400 text-xs block">כתובת</span>
                <strong className="text-gray-800">{currentCustomer.address || 'לא צוינה'}</strong>
              </div>
              <div>
                <span className="text-gray-400 text-xs block">מספר סריאלי</span>
                <strong className="text-gray-800 font-mono">{currentCustomer.serialNumber || 'לא זמין'}</strong>
              </div>
              <div>
                <span className="text-gray-400 text-xs block">לוחית רישוי</span>
                <strong className="text-gray-800 font-mono">{currentCustomer.licensePlate || 'לא זמין'}</strong>
              </div>
            </div>
          </div>

        </div>
        )}

        {activeView === 'parts' && (
          <div className="space-y-8">
            {/* Hero header — bold and unmistakable, with the primary CTA built in */}
            <div className="relative overflow-hidden bg-white/70 backdrop-blur-xl border border-white/60 p-6 md:p-8 rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.02)]">
              <div className="absolute top-0 right-0 w-64 h-64 bg-[#14C425]/10 rounded-full blur-3xl -mr-10 -mt-10 animate-pulse"></div>
              <div className="absolute bottom-0 left-0 w-64 h-64 bg-[#0F9E1D]/5 rounded-full blur-3xl -ml-10 -mb-10"></div>
              <div className="relative z-10 flex flex-col sm:flex-row items-center justify-between gap-5">
                <div className="flex items-center gap-4 text-center sm:text-right">
                  <div className="w-16 h-16 rounded-2xl bg-[#14C425] flex items-center justify-center text-white shadow-md flex-shrink-0">
                    <Package className="w-8 h-8" />
                  </div>
                  <div>
                    <h1 className="text-xl md:text-2xl font-black text-gray-900">בקשות חלקים</h1>
                    <p className="text-gray-500 text-sm mt-1 font-medium">חסר לכם חלק לכלי? אפשר לבקש עד {MAX_PART_ITEMS} חלקים בבת אחת.</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={startNewPartRequest}
                  className="w-full sm:w-auto px-6 py-3.5 bg-gradient-to-r from-[#14C425] to-[#0F9E1D] text-white rounded-2xl text-sm font-bold shadow-lg shadow-[#14C425]/20 transition-all active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer flex-shrink-0"
                >
                  <Plus className="w-4 h-4" />
                  בקשת חלק חדש
                </button>
              </div>
            </div>

            {/* History table */}
            <div className="bg-white/80 backdrop-blur-md rounded-3xl border border-white/60 shadow-[0_8px_30px_rgb(0,0,0,0.02)] overflow-hidden">
              <div className="p-5 border-b border-gray-100">
                <h2 className="text-sm font-black text-gray-900">היסטוריית בקשות חלקים</h2>
              </div>
              {partRequestsHistory.length === 0 ? (
                <div className="p-10 text-center text-gray-400 text-sm">עדיין לא נשלחו בקשות חלקים.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-right border-collapse">
                    <thead>
                      <tr className="bg-gray-50/50 text-gray-400 font-bold text-xs uppercase tracking-wider border-b border-gray-200/50 whitespace-nowrap">
                        <th className="p-4">תמונה</th>
                        <th className="p-4">תיאור</th>
                        <th className="p-4">סטטוס</th>
                        <th className="p-4">תאריך</th>
                        <th className="p-4 text-center">פעולות</th>
                      </tr>
                    </thead>
                    <tbody>
                      {partRequestsHistory.map(pr => (
                        <tr key={pr.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50/50 transition-colors">
                          <td className="p-4">
                            <div className="w-12 h-12 rounded-lg overflow-hidden border bg-white">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={pr.photoImage} alt="תמונת חלק" className="w-full h-full object-cover" />
                            </div>
                          </td>
                          <td className="p-4 text-sm text-gray-700 max-w-xs truncate" title={pr.description}>{pr.description}</td>
                          <td className="p-4">
                            <span className={`px-3 py-1.5 rounded-xl text-xs font-bold border inline-block ${
                              pr.status === 'FULFILLED'
                                ? 'bg-green-50/70 text-green-600 border-green-100'
                                : 'bg-blue-50/70 text-blue-600 border-blue-100'
                            }`}>
                              {pr.status === 'FULFILLED' ? 'סופק' : 'ממתין לחלק'}
                            </span>
                          </td>
                          <td className="p-4 text-xs text-gray-400 whitespace-nowrap">{new Date(pr.createdAt).toLocaleDateString('he-IL')}</td>
                          <td className="p-4 text-center">
                            <button
                              onClick={() => handleDeletePartRequest(pr.id)}
                              className="p-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl transition-all shadow-sm active:scale-[0.98] border border-red-100/50 cursor-pointer inline-flex items-center justify-center"
                              title="מחק בקשה"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
        </div>
      </div>

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

                    {/* Card 1: Owner details */}
                    <div className="p-4 bg-slate-50/60 border border-slate-100 rounded-2xl space-y-3">
                      <div className="flex items-center gap-1.5 text-slate-500">
                        <User className="w-3.5 h-3.5" />
                        <span className="text-[11px] font-black uppercase tracking-wide">פרטי בעל הכלי</span>
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
                          placeholder="הזן את שמך המלא"
                          className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 text-gray-800 text-xs font-medium"
                          required
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="block text-gray-755 text-xs font-bold flex items-center gap-1.5">
                          <Phone className="w-3.5 h-3.5 text-gray-400" />
                          מספר טלפון בעל הכלי <span className="text-gray-450 font-normal text-[10px]">(אופציונלי)</span>
                        </label>
                        <input
                          type="tel"
                          value={toolOwnerPhone}
                          onChange={(e) => setToolOwnerPhone(e.target.value)}
                          placeholder="מספר טלפון ליצירת קשר"
                          className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 text-gray-800 text-xs font-medium text-right"
                          dir="rtl"
                        />
                      </div>
                    </div>

                    {/* Card 2: Warranty (moved right after phone number) */}
                    <div className="p-4 bg-blue-50/30 border border-blue-100/60 rounded-2xl space-y-3">
                      <div className="flex items-center gap-1.5 text-blue-600">
                        <ShieldCheck className="w-3.5 h-3.5" />
                        <span className="text-[11px] font-black uppercase tracking-wide">אחריות</span>
                      </div>

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

                      {hasWarranty === 'yes' && (
                        <div className="space-y-1.5">
                          <label className="block text-gray-700 text-xs font-bold">צילום חשבונית/תעודת אחריות:</label>
                          <div
                            onClick={() => warrantyImageInputRef.current?.click()}
                            className="border border-dashed border-gray-300 rounded-xl p-4 text-center cursor-pointer hover:bg-blue-50/10 hover:border-blue-400 transition-all flex flex-col items-center justify-center min-h-[100px] bg-white"
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
                    </div>

                    {/* Card 3: Issue description + repair level */}
                    <div className="p-4 bg-teal-50/30 border border-teal-100/60 rounded-2xl space-y-4">
                      <div className="flex items-center gap-1.5 text-teal-600">
                        <FileText className="w-3.5 h-3.5" />
                        <span className="text-[11px] font-black uppercase tracking-wide">תיאור התקלה ורמת התיקון</span>
                      </div>

                      <div className="space-y-1.5">
                        <label className="block text-gray-755 text-xs font-bold flex items-center gap-1.5">
                          <FileText className="w-3.5 h-3.5 text-gray-400" />
                          מה התקלה בכלי? <span className="text-red-500">*</span>
                        </label>
                        <textarea
                          value={issueDescription}
                          onChange={(e) => setIssueDescription(e.target.value)}
                          placeholder="תאר את הבעיה בכלי (לדוגמה: פנצ'ר בגלגל קדמי, המנוע לא נדלק, בעיה בבלמים...)"
                          rows={3}
                          className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 text-gray-800 text-xs font-medium text-right resize-none"
                          required
                        />
                      </div>

                      {/* Desired Repair Level Selection */}
                      <div className="space-y-1.5">
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
                    </div>

                    {/* Card 4: Pre-approved budget */}
                    <div className="space-y-2.5 p-4 bg-blue-50/20 border border-blue-100/30 rounded-2xl shadow-sm text-right">
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
                      <div className="space-y-1.5 p-4 bg-gray-50/40 border border-gray-100 rounded-2xl">
                        <label className="block text-gray-755 text-xs font-bold flex items-center gap-1.5">
                          <span>📝</span>
                          הערות נוספות לצוות המעבדה <span className="text-gray-400 font-normal text-[10px]">(אופציונלי)</span>
                        </label>
                        <textarea
                          value={comments}
                          onChange={(e) => setComments(e.target.value)}
                          placeholder="הערות או דגשים נוספים לצוות המעבדה..."
                          rows={2}
                          className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 text-gray-800 text-xs font-medium text-right resize-none"
                        />
                      </div>

                    {/* Card 6: Tool Images */}
                    <div className="space-y-2 p-4 bg-cyan-50/20 border border-cyan-100/40 rounded-2xl">
                      <div className="flex items-center gap-1.5 text-cyan-600">
                        <UploadCloud className="w-3.5 h-3.5" />
                        <span className="text-[11px] font-black uppercase tracking-wide">צילומי הכלי</span>
                      </div>
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

      {/* Request a Part Modal (Widget) */}
      <AnimatePresence>
        {isPartFormOpen && (
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
                  <h2 className="text-xl font-bold text-gray-900">בקשת חלק חדשה</h2>
                  <p className="text-gray-400 text-xs mt-1">תארו את החלקים שאתם צריכים וצרפו תמונה לכל אחד ({partItems.length}/{MAX_PART_ITEMS})</p>
                </div>
                <button
                  onClick={closePartModal}
                  className="p-2 hover:bg-gray-150 rounded-full text-gray-400 hover:text-gray-700 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 space-y-6 overflow-y-auto flex-1 text-right" dir="rtl">
                {partRequestSuccess ? (
                  /* Success screen */
                  <div className="text-center py-8 space-y-6">
                    <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center mx-auto border border-green-100 shadow-inner">
                      <Check className="w-10 h-10 text-green-500" strokeWidth={3} />
                    </div>
                    <div>
                      <h3 className="text-2xl font-black text-gray-900 mb-1">
                        {submittedPartDescriptions.length > 1 ? `${submittedPartDescriptions.length} בקשות חלק נשלחו בהצלחה!` : 'הבקשה נשלחה בהצלחה!'}
                      </h3>
                      <p className="text-gray-500 text-sm">
                        בקשת החלק נרשמה במערכת {businessName}.
                      </p>
                      {partRequestError && (
                        <p className="text-amber-700 text-xs font-semibold mt-2">{partRequestError}</p>
                      )}
                    </div>

                    {submittedPartDescriptions.length > 1 && (
                      <ul className="text-xs text-gray-600 space-y-1 text-right max-w-sm mx-auto">
                        {submittedPartDescriptions.map((d, i) => (
                          <li key={i} className="flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-green-400 flex-shrink-0"></span>
                            {d}
                          </li>
                        ))}
                      </ul>
                    )}

                    <div className="flex flex-col gap-2.5 max-w-sm mx-auto pt-4">
                      {partsRequestPhone ? (
                        <a
                          href={`https://wa.me/${partsRequestPhone.startsWith('0') ? '972' + partsRequestPhone.slice(1) : partsRequestPhone}?text=${encodeURIComponent(
                            submittedPartDescriptions.length > 1
                              ? `היי, ${currentCustomer.firstName} ${currentCustomer.lastName} מבקש/ת ${submittedPartDescriptions.length} חלקים:\n${submittedPartDescriptions.map((d, i) => `${i + 1}. ${d}`).join('\n')}\n\nלצפייה בבקשות ובתמונות שצורפו, יש להיכנס לפאנל הניהול.`
                              : `היי, ${currentCustomer.firstName} ${currentCustomer.lastName} מבקש/ת חלק:\n"${submittedPartDescriptions[0] || ''}"\n\nלצפייה בבקשה ובתמונה שצורפה, יש להיכנס לפאנל הניהול.`
                          )}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-full py-3.5 bg-green-500 hover:bg-green-600 text-white rounded-2xl text-sm font-bold flex items-center justify-center gap-2 shadow-lg shadow-green-500/10 transition-all active:scale-[0.98] cursor-pointer"
                        >
                          <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                            <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.003 5.37 5.378 0 12.003 0a11.94 11.94 0 0 1 8.484 3.513 11.94 11.94 0 0 1 3.51 8.49c-.003 6.63-5.378 12-12.003 12-1.996-.001-3.957-.502-5.709-1.455L0 24zm6.59-14.859c-.12-.2-.24-.2-.35-.2-.11 0-.24-.03-.36-.03-.13 0-.34.05-.52.25-.18.2-.68.66-.68 1.6s.69 1.86.78 2.06c.1.13 1.36 2.07 3.29 2.91.46.2.82.32 1.1.41.47.15.89.13 1.22.08.38-.06 1.15-.47 1.31-.93.16-.46.16-.86.11-.93-.05-.08-.18-.13-.38-.23-.19-.1-.1.38-.1.74-.11.16-.36.23-.74.13-.38-.11-1.42-.52-2.71-1.68-.96-.86-1.61-1.92-1.8-2.25-.19-.33-.02-.51.15-.68.15-.15.33-.36.5-.54.17-.18.23-.3.33-.5.1-.2.05-.38-.03-.48z" />
                          </svg>
                          שלח בקשה בוואטסאפ לעסק
                        </a>
                      ) : (
                        <div className="p-3 bg-amber-50 text-amber-700 rounded-xl text-xs font-semibold text-center">
                          העסק טרם הגדיר מספר וואטסאפ לבקשות חלקים.
                        </div>
                      )}

                      <button
                        onClick={startNewPartRequest}
                        className="w-full py-3 bg-white border border-gray-200 text-gray-700 rounded-2xl text-sm font-bold transition-all active:scale-[0.98] flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Plus className="w-4 h-4" />
                        בקשת חלק נוספת
                      </button>

                      <button
                        onClick={closePartModal}
                        className="w-full py-3.5 bg-gray-900 hover:bg-gray-800 text-white rounded-2xl text-sm font-bold transition-all active:scale-[0.98] cursor-pointer"
                      >
                        סגור חלון
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Form fields */
                  <div className="space-y-5">
                    {partRequestError && (
                      <div className="p-4 bg-red-50 border border-red-100 rounded-2xl text-red-650 text-xs font-bold flex items-center gap-2">
                        <AlertCircle className="w-5 h-5 flex-shrink-0" />
                        <span>{partRequestError}</span>
                      </div>
                    )}

                    <div className="space-y-4">
                      {partItems.map((item, idx) => (
                        <div key={item.id} className="p-4 bg-gray-50/60 border border-gray-100 rounded-2xl space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-gray-500">חלק {idx + 1}</span>
                            {partItems.length > 1 && (
                              <button
                                type="button"
                                onClick={() => removePartItem(item.id)}
                                className="p-1 text-red-500 hover:bg-red-50 rounded-lg cursor-pointer transition-colors"
                                title="הסר חלק"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>

                          <textarea
                            value={item.description}
                            onChange={(e) => updatePartItemDescription(item.id, e.target.value)}
                            placeholder="תארו את החלק המבוקש (לדוגמה: צמיג קדמי, ידית בלם שמאלית...)"
                            rows={2}
                            className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-4 focus:ring-[#14C425]/10 focus:border-[#14C425] text-gray-800 text-xs font-medium text-right resize-none"
                          />

                          <div
                            onClick={() => document.getElementById(`part-photo-input-${item.id}`)?.click()}
                            className="border border-dashed border-gray-300 rounded-xl p-3 text-center cursor-pointer hover:bg-[#14C425]/10 hover:border-[#14C425] transition-all flex flex-col items-center justify-center min-h-[80px] bg-white"
                          >
                            <input
                              id={`part-photo-input-${item.id}`}
                              type="file"
                              accept="image/*"
                              onChange={(e) => handlePartItemPhotoChange(item.id, e)}
                              className="hidden"
                            />
                            {item.photoPreview ? (
                              <div className="relative w-24 aspect-[4/3] rounded-lg overflow-hidden border bg-white">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={item.photoPreview} alt="Part preview" className="w-full h-full object-contain" />
                                <button
                                  type="button"
                                  onClick={(e) => removePartItemPhoto(item.id, e)}
                                  className="absolute top-1 right-1 p-1 bg-red-650 text-white rounded-md hover:scale-105 transition-all shadow"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            ) : (
                              <>
                                <UploadCloud className="w-4 h-4 text-[#0F9E1D] mb-1" />
                                <span className="text-[#0F9E1D] font-bold text-[11px]">לחץ כאן להעלאת תמונה</span>
                              </>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                    {partItems.length < MAX_PART_ITEMS && (
                      <button
                        type="button"
                        onClick={addPartItem}
                        className="w-full py-2.5 border border-dashed border-[#14C425]/40 text-[#0F9E1D] rounded-xl text-xs font-bold hover:bg-[#14C425]/10 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        הוסף חלק נוסף
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              {!partRequestSuccess && (
                <div className="p-5 bg-gray-50/70 border-t border-gray-200/50 flex justify-between gap-3">
                  <button
                    type="button"
                    onClick={closePartModal}
                    className="px-5 py-2.5 bg-white border border-gray-200 text-gray-600 rounded-xl text-xs font-bold active:scale-95 transition-all cursor-pointer"
                  >
                    ביטול
                  </button>
                  <button
                    type="button"
                    onClick={handleSubmitPartRequest}
                    disabled={isSubmittingPartRequest}
                    className="px-6 py-2.5 bg-gradient-to-r from-[#14C425] to-[#0F9E1D] text-white rounded-xl text-xs font-bold shadow-md shadow-[#14C425]/10 active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    {isSubmittingPartRequest ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>שולח...</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>{partItems.length > 1 ? `שלח ${partItems.length} בקשות` : 'שלח בקשה'}</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>

      {/* Print Flyer Container - Visible ONLY when printing */}
      <div className="hidden print:flex flex-col items-center justify-center min-h-screen text-center bg-white p-8" dir="rtl">
        <div className="max-w-2xl w-full mx-auto border-8 border-double border-gray-900 rounded-[2.5rem] p-16 bg-white space-y-10 my-auto shadow-sm">
          <div className="flex flex-col items-center">
            {logoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt="Logo" className="w-20 h-20 object-contain mb-4" />
            )}
            <span className="text-sm font-extrabold text-blue-600 tracking-widest uppercase block mb-3">שירות לקוחות {businessName}</span>
            <h1 className="text-4xl font-black text-gray-900 leading-tight">סרקו לפתיחת קריאת שירות מהירה! 🛴</h1>
          </div>

          <div className="p-6 bg-white rounded-[2rem] border-2 border-gray-200/60 shadow-lg max-w-max mx-auto relative flex items-center justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(formUrl)}`}
              alt="QR Code"
              className="w-64 h-64 mx-auto"
            />
            {currentCustomer.logoUrl && (
              <div className="absolute w-14 h-14 bg-white p-1 rounded-2xl border border-gray-150 shadow-md overflow-hidden flex items-center justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={currentCustomer.logoUrl} alt="Logo" className="w-full h-full object-contain" />
              </div>
            )}
          </div>

          <div className="space-y-4">
            <p className="text-lg text-gray-750 font-bold leading-relaxed">
              סרקו את הקוד עם מצלמת הטלפון הנייד שלכם <br />
              כדי למלא את פרטי הכלי והתקלה במהירות ובקלות
            </p>
            <p className="text-xs text-gray-400 font-semibold">
              מאפשר לנו לטפל בכלי שלכם בצורה המהירה והמקצועית ביותר!
            </p>
          </div>

          <div className="pt-8 border-t-2 border-dashed border-gray-200 flex justify-between items-center text-gray-500 text-xs font-bold px-4">
            <span>{businessName}</span>
            <span>מערכת קריאות שירות דיגיטלית</span>
          </div>
        </div>
      </div>

      {/* Customer Profile Settings Modal */}
      {isCustomerSettingsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-950/40 backdrop-blur-sm print:hidden">
          <div className="bg-white rounded-3xl max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-gray-150 flex flex-col text-right" dir="rtl">
            {/* Modal Header */}
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <button
                onClick={() => setIsCustomerSettingsOpen(false)}
                className="p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-50 active:scale-95 transition-all cursor-pointer border-0 bg-transparent"
              >
                <X className="w-5 h-5" />
              </button>
              <h2 className="text-lg font-black text-gray-900 flex items-center gap-2">
                <User className="w-5 h-5 text-blue-600" />
                הגדרות פרופיל
              </h2>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSaveCustomerSettings} className="p-6 space-y-5">
              {customerSettingsError && (
                <div className="p-4 bg-red-50 border border-red-100 rounded-2xl text-red-650 text-xs font-bold flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 flex-shrink-0" />
                  <span>{customerSettingsError}</span>
                </div>
              )}

              {customerSettingsSuccess && (
                <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl text-emerald-650 text-xs font-bold flex items-center gap-2">
                  <Check className="w-5 h-5 flex-shrink-0" />
                  <span>השינויים נשמרו בהצלחה!</span>
                </div>
              )}

              {/* Logo/Avatar Upload Section */}
              <div className="space-y-2">
                <label className="block text-gray-700 text-xs font-bold">לוגו או תמונת פרופיל אישית</label>
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-xl border overflow-hidden bg-gray-50 flex items-center justify-center shadow-inner flex-shrink-0">
                    {customerLogoPreview ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={customerLogoPreview} alt="Profile Preview" className="w-full h-full object-contain" />
                    ) : (
                      <User className="w-6 h-6 text-gray-300" />
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => document.getElementById('customer-logo-upload')?.click()}
                      className="px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-600 border border-blue-100/50 rounded-xl text-xs font-bold transition-all cursor-pointer"
                    >
                      בחר תמונה
                    </button>
                    <input
                      id="customer-logo-upload"
                      type="file"
                      accept="image/*"
                      onChange={handleCustomerLogoChange}
                      className="hidden"
                    />
                    {customerLogoPreview && (
                      <button
                        type="button"
                        onClick={handleRemoveCustomerLogo}
                        className="px-4 py-2 bg-red-50 hover:bg-red-100/75 text-red-650 border border-red-100/50 rounded-xl text-xs font-bold transition-all cursor-pointer"
                      >
                        הסר
                      </button>
                    )}
                  </div>
                </div>
                <p className="text-[10px] text-gray-400">תמונת הלוגו תוצג במרכז קוד ה-QR שלך.</p>
              </div>

              {/* Name fields */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-gray-700 text-xs font-bold">שם פרטי *</label>
                  <input
                    type="text"
                    value={settingsFirstName}
                    onChange={(e) => setSettingsFirstName(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:bg-white text-gray-800 text-sm transition-all"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-gray-700 text-xs font-bold">שם משפחה *</label>
                  <input
                    type="text"
                    value={settingsLastName}
                    onChange={(e) => setSettingsLastName(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:bg-white text-gray-800 text-sm transition-all"
                    required
                  />
                </div>
              </div>

              {/* Contact fields */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-gray-700 text-xs font-bold">טלפון</label>
                  <input
                    type="text"
                    value={settingsPhone}
                    onChange={(e) => setSettingsPhone(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:bg-white text-gray-800 text-sm transition-all font-mono"
                    dir="ltr"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-gray-700 text-xs font-bold">אימייל</label>
                  <input
                    type="email"
                    value={settingsEmail}
                    onChange={(e) => setSettingsEmail(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:bg-white text-gray-800 text-sm transition-all"
                    dir="ltr"
                  />
                </div>
              </div>

              {/* Address */}
              <div className="space-y-1.5">
                <label className="block text-gray-700 text-xs font-bold">כתובת</label>
                <input
                  type="text"
                  value={settingsAddress}
                  onChange={(e) => setSettingsAddress(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:bg-white text-gray-800 text-sm transition-all"
                />
              </div>

              {/* Vehicle specific fields */}
              <div className="border-t border-gray-100 pt-4 space-y-4">
                <span className="block text-gray-400 text-[10px] font-bold uppercase tracking-wider">פרטי כלי ברירת מחדל</span>
                
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <label className="block text-gray-700 text-[11px] font-bold">מספר סריאלי</label>
                    <input
                      type="text"
                      value={settingsSerialNumber}
                      onChange={(e) => setSettingsSerialNumber(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-gray-200 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:bg-white text-gray-800 text-xs transition-all font-mono"
                      dir="ltr"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-gray-700 text-[11px] font-bold">צבע כלי</label>
                    <input
                      type="text"
                      value={settingsColor}
                      onChange={(e) => setSettingsColor(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-gray-200 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:bg-white text-gray-800 text-xs transition-all"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-gray-700 text-[11px] font-bold">לוחית רישוי</label>
                    <input
                      type="text"
                      value={settingsLicensePlate}
                      onChange={(e) => setSettingsLicensePlate(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-gray-200 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:bg-white text-gray-800 text-xs transition-all font-mono"
                      dir="ltr"
                    />
                  </div>
                </div>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={isSavingCustomerSettings}
                className="w-full py-3 bg-gray-950 hover:bg-gray-900 text-white rounded-xl text-sm font-black flex items-center justify-center gap-2 shadow-lg transition-all active:scale-[0.98] cursor-pointer disabled:opacity-50"
              >
                {isSavingCustomerSettings ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : null}
                {isSavingCustomerSettings ? 'שומר הגדרות...' : 'שמור שינויים'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Print Styles - QR Flyer */}
      <style jsx global>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 0 !important;
          }
          html, body {
            height: auto !important;
            min-height: 100vh !important;
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .print\\:hidden {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}
