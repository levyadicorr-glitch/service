'use client';

import React, { useState, useEffect } from 'react';
import { Agent, Customer, Driver, Order, PartRequest, ServiceRequest, SpecificModel } from '@/lib/db';
import { ServiceFormConfig } from '@/lib/serviceFormConfig';
import ServiceRequestForm from '@/components/ServiceRequestForm';
import CustomerSelectCombobox from '@/components/CustomerSelectCombobox';
import { formatDate } from '@/lib/format';
import {
  ShoppingCart, Package, FileText, Truck, Plus, Camera, Loader2,
  CheckCircle2, Clock, Check, X, Search, RefreshCw, SlidersHorizontal, AlertCircle, Lock
} from 'lucide-react';

interface AgentPortalProps {
  agent: Agent;
  tenantId: string;
  businessName: string;
  customers: Customer[];
  drivers: Driver[];
  initialRequests: ServiceRequest[];
  initialPartRequests: PartRequest[];
  initialOrders: Order[];
  allRequests: ServiceRequest[];
  allOrders: Order[];
  initialDeviceModels: string[];
  initialModels?: SpecificModel[];
  serviceFormConfig?: ServiceFormConfig;
}

export default function AgentPortal({
  agent,
  tenantId,
  businessName,
  customers,
  drivers,
  initialRequests,
  initialPartRequests,
  initialOrders,
  allRequests,
  allOrders,
  initialDeviceModels,
  initialModels = [],
  serviceFormConfig,
}: AgentPortalProps) {
  const expectedPassword = agent.passwordPlain || agent.password || '';
  const [hasMounted, setHasMounted] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(!expectedPassword);
  const [inputPassword, setInputPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  useEffect(() => {
    setHasMounted(true);
    if (expectedPassword) {
      try {
        const stored = localStorage.getItem(`agent_auth_${agent.id}`);
        if (stored === 'true') {
          setIsAuthenticated(true);
        }
      } catch (err) {}
    }
  }, [agent.id, expectedPassword]);

  const handleAgentLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!expectedPassword || inputPassword.trim() === expectedPassword.trim()) {
      setIsAuthenticated(true);
      setLoginError('');
      try {
        localStorage.setItem(`agent_auth_${agent.id}`, 'true');
      } catch (err) {}
    } else {
      setLoginError('סיסמה שגויה, אנא נסה שוב');
    }
  };

  const [activeTab, setActiveTab] = useState<'orders' | 'partRequests' | 'serviceRequests' | 'drivers'>('orders');
  const [ordersList, setOrdersList] = useState<Order[]>(initialOrders);
  const [partRequestsList, setPartRequestsList] = useState<PartRequest[]>(initialPartRequests);
  const [requestsList, setRequestsList] = useState<ServiceRequest[]>(initialRequests);
  const [deviceModels, setDeviceModels] = useState<string[]>(initialDeviceModels);
  const [modelsList, setModelsList] = useState<SpecificModel[]>(initialModels);

  // New Order Modal State
  const [isAddOrderOpen, setIsAddOrderOpen] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [selectedDeviceType, setSelectedDeviceType] = useState<string>(initialDeviceModels[0] || 'קורקינט');
  const [customDeviceType, setCustomDeviceType] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [unitPrice, setUnitPrice] = useState('');
  const [newOrderModel, setNewOrderModel] = useState('');
  const [customModelText, setCustomModelText] = useState('');
  const [selectedDriverId, setSelectedDriverId] = useState('');
  const [isSavingOrder, setIsSavingOrder] = useState(false);
  const [isAddingNewModel, setIsAddingNewModel] = useState(false);
  const [isAddingSpecificModel, setIsAddingSpecificModel] = useState(false);
  const [newSpecificModelInput, setNewSpecificModelInput] = useState('');
  const [isSavingSpecificModel, setIsSavingSpecificModel] = useState(false);
  const [newModelInput, setNewModelInput] = useState('');
  const [isSavingModel, setIsSavingModel] = useState(false);

  // New Part Request Modal State
  const [isAddPartOpen, setIsAddPartOpen] = useState(false);
  const [partCustomerId, setPartCustomerId] = useState('');
  const [partDescription, setPartDescription] = useState('');
  const [partPhotoFile, setPartPhotoFile] = useState<File | null>(null);
  const [partPhotoPreview, setPartPhotoPreview] = useState<string | null>(null);
  const [isSavingPart, setIsSavingPart] = useState(false);

  // New Service Request Form Modal State
  const [isAddServiceOpen, setIsAddServiceOpen] = useState(false);
  const [serviceCustomerId, setServiceCustomerId] = useState('');
  const [serviceStoreName, setServiceStoreName] = useState('');
  const [serviceIssueDescription, setServiceIssueDescription] = useState('');
  const [serviceRepairLevel, setServiceRepairLevel] = useState<'RIDE_ONLY' | 'SAFE_RIDE' | 'LIKE_NEW'>('SAFE_RIDE');
  const [servicePreApprovedAmount, setServicePreApprovedAmount] = useState('');
  const [serviceToolFile, setServiceToolFile] = useState<File | null>(null);
  const [serviceToolPreview, setServiceToolPreview] = useState<string | null>(null);
  const [isSavingService, setIsSavingService] = useState(false);

  const handleServiceToolPhotoSelect = (file: File | null) => {
    if (!file) return;
    setServiceToolFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setServiceToolPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleCreateServiceRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!serviceCustomerId || !serviceStoreName.trim()) {
      alert('יש לבחור לקוח להזנת קריאת השירות');
      return;
    }

    setIsSavingService(true);
    try {
      const formData = new FormData();
      formData.append('customerId', serviceCustomerId);
      formData.append('storeName', serviceStoreName.trim());
      formData.append('toolOwnerName', serviceStoreName.trim());
      formData.append('agreedToInspectionFee', 'true');
      formData.append('hasWarranty', 'false');
      formData.append('repairLevel', serviceRepairLevel);
      if (serviceIssueDescription.trim()) formData.append('issueDescription', serviceIssueDescription.trim());
      if (servicePreApprovedAmount.trim()) formData.append('preApprovedAmount', servicePreApprovedAmount.trim());
      if (serviceToolFile) formData.append('toolImages', serviceToolFile);
      formData.append('agentId', agent.id);
      formData.append('agentName', agent.name);

      const res = await fetch(`/api/${tenantId}/requests`, {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'שגיאה בפתיחת קריאת השירות');

      setRequestsList(prev => [data.request, ...prev]);
      setIsAddServiceOpen(false);
      setServiceCustomerId('');
      setServiceStoreName('');
      setServiceIssueDescription('');
      setServicePreApprovedAmount('');
      setServiceToolFile(null);
      setServiceToolPreview(null);
      alert('קריאת השירות נפתחה בהצלחה! 🛠️');
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'שגיאה בפתיחת הקריאה');
    } finally {
      setIsSavingService(false);
    }
  };

  const ORDER_STATUSES: Record<Order['status'], { label: string; bg: string; text: string }> = {
    PENDING: { label: 'בהכנה', bg: 'bg-blue-50 border-blue-200', text: 'text-blue-700' },
    READY_FOR_DISPATCH: { label: 'מוכן לשילוח', bg: 'bg-purple-50 border-purple-200', text: 'text-purple-700' },
    FULFILLED: { label: 'סופק', bg: 'bg-green-50 border-green-200', text: 'text-green-700' },
    CANCELLED: { label: 'בוטל', bg: 'bg-gray-100 border-gray-200', text: 'text-gray-500' },
  };

  const handleAddDeviceModel = async () => {
    const trimmed = newModelInput.trim();
    if (!trimmed) return;
    setIsSavingModel(true);
    try {
      const res = await fetch(`/api/${tenantId}/device-models`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ modelName: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'שגיאה בהוספת הדגם');

      if (data.deviceModels && Array.isArray(data.deviceModels)) {
        setDeviceModels(data.deviceModels);
      } else if (!deviceModels.includes(trimmed)) {
        setDeviceModels(prev => [...prev, trimmed]);
      }
      setSelectedDeviceType(trimmed);
      setNewModelInput('');
      setIsAddingNewModel(false);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'שגיאה בהוספת הדגם');
    } finally {
      setIsSavingModel(false);
    }
  };

  const handleAddSpecificModel = async () => {
    const trimmed = newSpecificModelInput.trim();
    if (!trimmed) return;
    const currentDeviceType = (selectedDeviceType === 'other' ? customDeviceType : selectedDeviceType).trim();
    setIsSavingSpecificModel(true);
    try {
      const res = await fetch(`/api/${tenantId}/models`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ modelName: trimmed, deviceType: currentDeviceType }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'שגיאה בהוספת הדגם');

      if (data.models && Array.isArray(data.models)) {
        setModelsList(data.models);
      } else {
        setModelsList(prev => [...prev.filter(m => m.name !== trimmed), { name: trimmed, deviceType: currentDeviceType }]);
      }
      setNewOrderModel(trimmed);
      setNewSpecificModelInput('');
      setIsAddingSpecificModel(false);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'שגיאה בהוספת הדגם');
    } finally {
      setIsSavingSpecificModel(false);
    }
  };

  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomerId) {
      alert('יש לבחור לקוח');
      return;
    }
    const finalDeviceType = (selectedDeviceType === 'other' ? customDeviceType : selectedDeviceType).trim();
    if (!finalDeviceType) {
      alert('יש להזין סוג/דגם מכשיר');
      return;
    }
    const qty = Number(quantity);
    const price = Number(unitPrice);
    if (!qty || qty <= 0 || isNaN(price) || price < 0) {
      alert('יש להזין כמות ומחיר תקינים');
      return;
    }

    const finalModel = (newOrderModel === 'custom' ? customModelText : newOrderModel).trim();

    setIsSavingOrder(true);
    try {
      const res = await fetch(`/api/${tenantId}/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: selectedCustomerId,
          deviceType: finalDeviceType,
          model: finalModel,
          quantity: qty,
          unitPrice: price,
          driverId: selectedDriverId || undefined,
          agentId: agent.id,
          agentName: agent.name,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'שגיאה ביצירת ההזמנה');

      setOrdersList(prev => [data.order, ...prev]);
      setIsAddOrderOpen(false);
      setSelectedCustomerId('');
      setUnitPrice('');
      setQuantity('1');
      setNewOrderModel('');
      alert('ההזמנה נקלטה בהצלחה! 🚀');
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'שגיאה ביצירת ההזמנה');
    } finally {
      setIsSavingOrder(false);
    }
  };

  const handlePartPhotoSelect = (file: File | null) => {
    if (!file) return;
    setPartPhotoFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setPartPhotoPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleCreatePartRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!partCustomerId || !partDescription.trim() || !partPhotoFile) {
      alert('יש לבחור לקוח, להזין תיאור ולצרף תמונה');
      return;
    }

    setIsSavingPart(true);
    try {
      const formData = new FormData();
      formData.append('customerId', partCustomerId);
      formData.append('description', partDescription.trim());
      formData.append('photo', partPhotoFile);
      formData.append('agentId', agent.id);
      formData.append('agentName', agent.name);

      const res = await fetch(`/api/${tenantId}/parts-requests`, {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'שגיאה בשליחת בקשת החלק');

      setPartRequestsList(prev => [data.request, ...prev]);
      setIsAddPartOpen(false);
      setPartCustomerId('');
      setPartDescription('');
      setPartPhotoFile(null);
      setPartPhotoPreview(null);
      alert('בקשת החלק נשלחה בהצלחה! 🔧');
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'שגיאה בשליחת הבקשה');
    } finally {
      setIsSavingPart(false);
    }
  };

  if (!isAuthenticated && expectedPassword) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4" dir="rtl" suppressHydrationWarning>
        <div className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl border border-gray-100 space-y-6 text-center animate-in fade-in zoom-in-95 duration-200" suppressHydrationWarning>
          <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center text-3xl mx-auto shadow-sm border border-blue-100">
            💼
          </div>
          <div>
            <h2 className="text-xl font-black text-gray-900">{businessName}</h2>
            <p className="text-xs font-bold text-blue-600 mt-1 bg-blue-50 py-1 px-3 rounded-full inline-block">
              כניסת סוכן מכירות: {agent.name}
            </p>
          </div>

          <form onSubmit={handleAgentLogin} className="space-y-4 text-right" suppressHydrationWarning>
            {/* Hidden Username Field so Mobile Browsers (iOS Keychain/Chrome/Samsung Pass) Prompt Password Saving */}
            <input
              type="text"
              name="username"
              value={agent.phone}
              readOnly
              hidden
              autoComplete="username"
              suppressHydrationWarning
            />

            <div className="space-y-1.5" suppressHydrationWarning>
              <label className="block text-xs font-bold text-gray-700">סיסמת כניסה אישית</label>
              <input
                type="password"
                name="password"
                placeholder="הכנס את סיסמתך..."
                value={inputPassword}
                onChange={(e) => setInputPassword(e.target.value)}
                autoComplete="current-password"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:bg-white text-gray-900 text-sm font-medium transition-all"
                autoFocus
                required
                suppressHydrationWarning
              />
            </div>

            {loginError && (
              <p className="text-xs font-bold text-red-600 bg-red-50 p-2.5 rounded-xl border border-red-100 text-center">
                {loginError}
              </p>
            )}

            <button
              type="submit"
              className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold shadow-lg shadow-blue-500/20 transition-all active:scale-[0.98] cursor-pointer"
              suppressHydrationWarning
            >
              התחבר לפורטל
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans pb-24" dir="rtl">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-30 shadow-xs">
        <div className="max-w-4xl mx-auto px-4 py-3.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white font-black flex items-center justify-center text-lg shadow-md shadow-blue-500/20">
              💼
            </div>
            <div>
              <h1 className="text-base font-black text-gray-900 leading-tight">{businessName}</h1>
              <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md inline-block mt-0.5">
                פורטל סוכן: {agent.name}
              </span>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="max-w-4xl mx-auto px-4 flex border-t border-gray-100 overflow-x-auto no-scrollbar">
          {[
            { key: 'orders', label: 'הזמנות סחורה', icon: ShoppingCart, count: ordersList.length },
            { key: 'partRequests', label: 'בקשות חלקים', icon: Package, count: partRequestsList.length },
            { key: 'serviceRequests', label: 'קריאות שירות', icon: FileText, count: requestsList.length },
            { key: 'drivers', label: 'קו נהגים', icon: Truck },
          ].map(tab => {
            const TabIcon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as typeof activeTab)}
                className={`py-3 px-4 font-bold text-xs flex items-center gap-2 border-b-2 transition-all cursor-pointer whitespace-nowrap ${
                  isActive
                    ? 'border-blue-600 text-blue-600 bg-blue-50/40'
                    : 'border-transparent text-gray-500 hover:text-gray-800'
                }`}
              >
                <TabIcon className="w-4 h-4" />
                <span>{tab.label}</span>
                {tab.count !== undefined && (
                  <span className={`px-1.5 py-0.2 text-[10px] rounded-full font-bold ${isActive ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-6">
        {/* Tab 1: Orders */}
        {activeTab === 'orders' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-black text-gray-900 flex items-center gap-2">
                <ShoppingCart className="w-4 h-4 text-blue-600" />
                הזמנות סחורה שביצעת ({ordersList.length})
              </h2>
              <button
                type="button"
                onClick={() => setIsAddOrderOpen(true)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-500/20 flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                הזמנה חדשה
              </button>
            </div>

            {ordersList.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-2xl border border-gray-200 p-6">
                <ShoppingCart className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-600 text-sm font-bold">טרם פתחת הזמנות סחורה</p>
                <p className="text-gray-400 text-xs mt-1">לחץ על "הזמנה חדשה" כדי ליצור הזמנה עבור לקוח.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {ordersList.map(order => {
                  const statusInfo = ORDER_STATUSES[order.status] || ORDER_STATUSES.PENDING;
                  return (
                    <div key={order.id} className="bg-white p-4 rounded-2xl border border-gray-200 shadow-xs space-y-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <span className="text-[11px] text-gray-400 font-mono">הזמנה #{order.orderNumber}</span>
                          <h3 className="font-black text-gray-900 text-sm mt-0.5">
                            {order.customer ? `${order.customer.firstName} ${order.customer.lastName}` : 'לקוח לא ידוע'}
                          </h3>
                        </div>
                        <span className={`px-2.5 py-1 text-[11px] font-black rounded-lg border ${statusInfo.bg} ${statusInfo.text}`}>
                          {statusInfo.label}
                        </span>
                      </div>

                      <div className="bg-gray-50 p-3 rounded-xl border border-gray-100 text-xs space-y-1">
                        <div className="flex justify-between text-gray-700">
                          <span>פריט / דגם:</span>
                          <span className="font-bold">{order.deviceType} {order.model ? `- ${order.model}` : ''}</span>
                        </div>
                        <div className="flex justify-between text-gray-700">
                          <span>כמות × מחיר:</span>
                          <span className="font-bold">{order.quantity} × ₪{order.unitPrice.toLocaleString('he-IL')}</span>
                        </div>
                        <div className="flex justify-between text-gray-900 font-black pt-1 border-t border-gray-200 text-sm">
                          <span>סה"כ לתשלום:</span>
                          <span className="text-green-600">₪{order.totalPrice.toLocaleString('he-IL')}</span>
                        </div>
                      </div>

                      <div className="text-[11px] text-gray-400 flex items-center justify-between pt-1">
                        <span>תאריך יצירה: {formatDate(order.createdAt)}</span>
                        {order.driver && (
                          <span className="text-indigo-600 font-bold flex items-center gap-1">
                            <Truck className="w-3 h-3" /> נהג: {order.driver.name}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Part Requests */}
        {activeTab === 'partRequests' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-black text-gray-900 flex items-center gap-2">
                <Package className="w-4 h-4 text-blue-600" />
                בקשות חלקים שפתחת ({partRequestsList.length})
              </h2>
              <button
                type="button"
                onClick={() => setIsAddPartOpen(true)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-500/20 flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                בקשת חלק חדשה
              </button>
            </div>

            {partRequestsList.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-2xl border border-gray-200 p-6">
                <Package className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-600 text-sm font-bold">טרם פתחת בקשות חלקים</p>
                <p className="text-gray-400 text-xs mt-1">לחץ על "בקשת חלק חדשה" כדי לצלם ולבקש חלק עבור לקוח.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {partRequestsList.map(pr => (
                  <div key={pr.id} className="bg-white p-4 rounded-2xl border border-gray-200 shadow-xs flex gap-3.5 items-center">
                    <div className="w-16 h-16 rounded-xl border bg-gray-50 overflow-hidden flex-shrink-0">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={`/api/${tenantId}/parts-requests/${pr.id}/image`} alt="חלק" className="w-full h-full object-cover" />
                    </div>
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center justify-between">
                        <h3 className="font-bold text-gray-900 text-sm truncate">
                          {pr.customer ? `${pr.customer.firstName} ${pr.customer.lastName}` : 'לקוח לא ידוע'}
                        </h3>
                        <span className="text-[10px] text-gray-400 font-mono">#{pr.requestNumber}</span>
                      </div>
                      <p className="text-xs text-gray-600 truncate">{pr.description}</p>

                      <div className="flex items-center gap-2 pt-1">
                        {pr.quoteStatus === 'APPROVED' && (
                          <span className="px-2 py-0.5 bg-green-50 text-green-700 border border-green-200 rounded text-[10px] font-bold flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" /> אושר (₪{pr.quotePrice})
                          </span>
                        )}
                        {pr.quoteStatus === 'PENDING_APPROVAL' && (
                          <span className="px-2 py-0.5 bg-yellow-50 text-yellow-700 border border-yellow-200 rounded text-[10px] font-bold flex items-center gap-1">
                            <Clock className="w-3 h-3" /> ממתין לאישור לקוח
                          </span>
                        )}
                        {(!pr.quoteStatus || pr.quoteStatus === 'NONE') && (
                          <span className="px-2 py-0.5 bg-gray-50 text-gray-500 border border-gray-200 rounded text-[10px] font-bold">
                            נקלט במערכת
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Service Requests */}
        {activeTab === 'serviceRequests' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-black text-gray-900 flex items-center gap-2">
                <FileText className="w-4 h-4 text-blue-600" />
                קריאות שירות שפתחת ({requestsList.length})
              </h2>
              <button
                type="button"
                onClick={() => setIsAddServiceOpen(true)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-500/20 flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                קריאה חדשה
              </button>
            </div>

            {requestsList.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-2xl border border-gray-200 p-6">
                <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-600 text-sm font-bold">טרם פתחת קריאות שירות</p>
                <p className="text-gray-400 text-xs mt-1">לחץ על "קריאה חדשה" כדי לפתוח קריאת שירות עבור לקוח.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {requestsList.map(req => (
                  <div key={req.id} className="bg-white p-4 rounded-2xl border border-gray-200 shadow-xs space-y-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="text-[10px] text-gray-400 font-mono">קריאה #{req.requestNumber}</span>
                        <h3 className="font-bold text-gray-900 text-sm">
                          {req.customer ? `${req.customer.firstName} ${req.customer.lastName}` : req.storeName}
                        </h3>
                      </div>
                      <span className="px-2.5 py-1 text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-100 rounded-lg">
                        {req.status === 'NEW' ? 'חדש' : req.status === 'WAITING_FOR_PICKUP' ? 'ממתין לאיסוף' : req.status === 'PICKED_UP_BY_DRIVER' ? 'נאסף על ידי נהג' : 'הושלם'}
                      </span>
                    </div>
                    {req.issueDescription && (
                      <p className="text-xs text-gray-600 bg-gray-50 p-2 rounded-lg border border-gray-100">
                        <span className="font-bold">תקלה:</span> {req.issueDescription}
                      </p>
                    )}
                    <div className="text-[11px] text-gray-400 flex justify-between pt-1">
                      <span>חנות: {req.storeName}</span>
                      <span>{formatDate(req.createdAt)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 4: Drivers Overview */}
        {activeTab === 'drivers' && (
          <div className="space-y-4">
            <h2 className="text-sm font-black text-gray-900 flex items-center gap-2">
              <Truck className="w-4 h-4 text-blue-600" />
              קו נהגים ומשלוחים פעילים ({drivers.length})
            </h2>

            {drivers.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-2xl border border-gray-200 p-6">
                <Truck className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-600 text-sm font-bold">אין נהגים מוגדרים במערכת</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {drivers.map(driver => {
                  const driverOrders = allOrders.filter(o => o.driverId === driver.id && o.status !== 'FULFILLED' && o.status !== 'CANCELLED');
                  const driverRequests = allRequests.filter(r => r.driverId === driver.id && r.status !== 'COMPLETED');

                  return (
                    <div key={driver.id} className="bg-white p-4 rounded-2xl border border-gray-200 shadow-xs space-y-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100 flex items-center justify-center font-bold">
                          🚚
                        </div>
                        <div>
                          <h3 className="font-bold text-gray-900 text-sm">{driver.name}</h3>
                          <p className="text-xs text-gray-500">{driver.phone || 'ללא טלפון'}</p>
                        </div>
                      </div>

                      <div className="space-y-2 pt-2 border-t border-gray-100">
                        <h4 className="text-xs font-bold text-gray-700 flex items-center justify-between">
                          <span>משלוחים בהכנה / לשילוח:</span>
                          <span className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded text-[10px] font-bold">
                            {driverOrders.length} הזמנות
                          </span>
                        </h4>
                        {driverOrders.length === 0 ? (
                          <p className="text-[11px] text-gray-400 italic">אין הזמנות ששויכו לנהג זה</p>
                        ) : (
                          <div className="space-y-1.5">
                            {driverOrders.map(o => (
                              <div key={o.id} className="p-2 bg-gray-50 rounded-lg text-xs flex justify-between items-center border border-gray-100">
                                <div>
                                  <span className="font-bold text-gray-800">{o.customer ? `${o.customer.firstName} ${o.customer.lastName}` : 'לקוח'}</span>
                                  <span className="text-[10px] text-gray-500 block">{o.deviceType} ({o.quantity})</span>
                                </div>
                                <span className="text-[10px] font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-100">
                                  {o.status === 'READY_FOR_DISPATCH' ? 'מוכן לשילוח' : 'בהכנה'}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Modal: Create Order */}
      {isAddOrderOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl space-y-4 animate-in fade-in duration-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="text-base font-black text-gray-900 flex items-center gap-2">
                <ShoppingCart className="w-5 h-5 text-blue-600" />
                יצירת הזמנת סחורה חדשה
              </h3>
              <button type="button" onClick={() => setIsAddOrderOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateOrder} className="space-y-3.5">
              <CustomerSelectCombobox
                customers={customers}
                selectedCustomerId={selectedCustomerId}
                onSelectCustomer={(c) => setSelectedCustomerId(c ? c.id : '')}
                label="בחר לקוח"
                required
              />

              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <label className="block text-xs font-bold text-gray-700">סוג כלי <span className="text-red-500">*</span></label>
                  <button
                    type="button"
                    onClick={() => setIsAddingNewModel(!isAddingNewModel)}
                    className="text-[11px] font-bold text-blue-600 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3 h-3" /> הוסף סוג כלי
                  </button>
                </div>

                {isAddingNewModel ? (
                  <div className="flex items-center gap-1.5 p-2 bg-blue-50/50 border border-blue-200 rounded-xl">
                    <input
                      type="text"
                      placeholder="שם סוג כלי חדש..."
                      value={newModelInput}
                      onChange={(e) => setNewModelInput(e.target.value)}
                      className="flex-1 px-3 py-1.5 text-xs rounded-lg border border-gray-200 bg-white"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={handleAddDeviceModel}
                      disabled={isSavingModel || !newModelInput.trim()}
                      className="px-3 py-1.5 bg-blue-600 text-white font-bold text-xs rounded-lg disabled:opacity-50 cursor-pointer"
                    >
                      {isSavingModel ? <Loader2 className="w-3 h-3 animate-spin" /> : 'שמור'}
                    </button>
                  </div>
                ) : (
                  <select
                    value={selectedDeviceType}
                    onChange={(e) => setSelectedDeviceType(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-xs font-medium focus:bg-white"
                  >
                    {deviceModels.map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                    <option value="other">אחר...</option>
                  </select>
                )}

                {selectedDeviceType === 'other' && !isAddingNewModel && (
                  <input
                    type="text"
                    placeholder="הקלד סוג כלי מותאם אישית..."
                    value={customDeviceType}
                    onChange={(e) => setCustomDeviceType(e.target.value)}
                    className="mt-1.5 w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-xs font-medium"
                  />
                )}
              </div>

              {/* Model Field */}
              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <label className="block text-xs font-bold text-gray-700">
                    דגם <span className="text-gray-400 font-normal">(אופציונלי)</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsAddingSpecificModel(!isAddingSpecificModel)}
                    className="text-[11px] font-bold text-blue-600 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3 h-3" /> הוסף דגם למאגר
                  </button>
                </div>

                {isAddingSpecificModel ? (
                  <div className="flex items-center gap-1.5 p-2 bg-blue-50/50 border border-blue-200 rounded-xl">
                    <input
                      type="text"
                      placeholder="שם דגם חדש (למשל: Xiaomi M365)..."
                      value={newSpecificModelInput}
                      onChange={(e) => setNewSpecificModelInput(e.target.value)}
                      className="flex-1 px-3 py-1.5 text-xs rounded-lg border border-gray-200 bg-white"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={handleAddSpecificModel}
                      disabled={isSavingSpecificModel || !newSpecificModelInput.trim()}
                      className="px-3 py-1.5 bg-blue-600 text-white font-bold text-xs rounded-lg disabled:opacity-50 cursor-pointer"
                    >
                      {isSavingSpecificModel ? <Loader2 className="w-3 h-3 animate-spin" /> : 'שמור'}
                    </button>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {(() => {
                      const currentType = (selectedDeviceType === 'other' ? customDeviceType : selectedDeviceType).trim();
                      const filtered = modelsList.filter(m => !m.deviceType || m.deviceType === currentType);
                      if (filtered.length > 0) {
                        return (
                          <>
                            <select
                              value={newOrderModel}
                              onChange={(e) => setNewOrderModel(e.target.value)}
                              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-xs font-medium focus:bg-white"
                            >
                              <option value="">-- בחר דגם מתוך הרשימה --</option>
                              {filtered.map(m => (
                                <option key={m.name} value={m.name}>{m.name}</option>
                              ))}
                              <option value="custom">הקלד דגם אחר בחופשיות...</option>
                            </select>
                            {newOrderModel === 'custom' && (
                              <input
                                type="text"
                                placeholder="הקלד דגם מותאם אישית..."
                                value={customModelText}
                                onChange={(e) => setCustomModelText(e.target.value)}
                                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-xs font-medium"
                              />
                            )}
                          </>
                        );
                      }
                      return (
                        <input
                          type="text"
                          placeholder="למשל: Xiaomi Pro 2"
                          value={newOrderModel}
                          onChange={(e) => setNewOrderModel(e.target.value)}
                          className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-xs font-medium"
                        />
                      );
                    })()}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-gray-700">כמות <span className="text-red-500">*</span></label>
                  <input
                    type="number"
                    min="1"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-xs font-medium"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-gray-700">מחיר ליחידה (₪) <span className="text-red-500">*</span></label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0"
                    value={unitPrice}
                    onChange={(e) => setUnitPrice(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-xs font-medium"
                    required
                  />
                </div>
              </div>

              {drivers.length > 0 && (
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-gray-700">משויך לנהג (אופציונלי)</label>
                  <select
                    value={selectedDriverId}
                    onChange={(e) => setSelectedDriverId(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-xs font-medium"
                  >
                    <option value="">-- ללא נהג משויך --</option>
                    {drivers.map(d => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={isSavingOrder}
                  className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-500/20 disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {isSavingOrder ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  צור הזמנה
                </button>
                <button
                  type="button"
                  onClick={() => setIsAddOrderOpen(false)}
                  className="py-3 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold cursor-pointer"
                >
                  ביטול
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Create Part Request */}
      {isAddPartOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl space-y-4 animate-in fade-in duration-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="text-base font-black text-gray-900 flex items-center gap-2">
                <Package className="w-5 h-5 text-blue-600" />
                בקשת חלק חדשה
              </h3>
              <button type="button" onClick={() => setIsAddPartOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreatePartRequest} className="space-y-3.5">
              <CustomerSelectCombobox
                customers={customers}
                selectedCustomerId={partCustomerId}
                onSelectCustomer={(c) => setPartCustomerId(c ? c.id : '')}
                label="בחר לקוח"
                required
              />

              <div className="space-y-1">
                <label className="block text-xs font-bold text-gray-700">תיאור החלק המבוקש <span className="text-red-500">*</span></label>
                <textarea
                  rows={2}
                  placeholder="פרט איזה חלק נדרש..."
                  value={partDescription}
                  onChange={(e) => setPartDescription(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-xs"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-gray-700">צילום החלק <span className="text-red-500">*</span></label>

                <input
                  id="agent-part-photo-cam"
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={(e) => handlePartPhotoSelect(e.target.files?.[0] || null)}
                  className="hidden"
                />
                <input
                  id="agent-part-photo-gallery"
                  type="file"
                  accept="image/*"
                  onChange={(e) => handlePartPhotoSelect(e.target.files?.[0] || null)}
                  className="hidden"
                />

                {partPhotoPreview ? (
                  <div className="relative w-full h-36 rounded-xl border overflow-hidden bg-gray-50 flex items-center justify-center">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={partPhotoPreview} alt="תצוגה מקדימה" className="w-full h-full object-contain" />
                    <button
                      type="button"
                      onClick={() => { setPartPhotoFile(null); setPartPhotoPreview(null); }}
                      className="absolute top-2 right-2 p-1.5 bg-red-600 text-white rounded-lg text-xs font-bold shadow-md"
                    >
                      הסר תמונה
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => document.getElementById('agent-part-photo-cam')?.click()}
                      className="flex-1 py-3 bg-blue-50 border border-blue-200 text-blue-700 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 hover:bg-blue-100 transition-all cursor-pointer"
                    >
                      <Camera className="w-4 h-4" />
                      צלם במצלמה 📸
                    </button>
                    <button
                      type="button"
                      onClick={() => document.getElementById('agent-part-photo-gallery')?.click()}
                      className="flex-1 py-3 bg-gray-50 border border-gray-200 text-gray-700 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 hover:bg-gray-100 transition-all cursor-pointer"
                    >
                      בחר מהגלריה 🖼️
                    </button>
                  </div>
                )}
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={isSavingPart || !partPhotoFile}
                  className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-500/20 disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {isSavingPart ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  שלח בקשת חלק
                </button>
                <button
                  type="button"
                  onClick={() => setIsAddPartOpen(false)}
                  className="py-3 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold cursor-pointer"
                >
                  ביטול
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Create Service Request */}
      {isAddServiceOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-xl shadow-2xl space-y-4 animate-in fade-in duration-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="text-base font-black text-gray-900 flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-600" />
                פתיחת קריאת שירות עבור לקוח
              </h3>
              <button type="button" onClick={() => setIsAddServiceOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateServiceRequest} className="space-y-3.5">
              <CustomerSelectCombobox
                customers={customers}
                selectedCustomerId={serviceCustomerId}
                onSelectCustomer={(c) => {
                  setServiceCustomerId(c ? c.id : '');
                  if (c) setServiceStoreName(`${c.firstName} ${c.lastName}`);
                }}
                label="בחר לקוח"
                required
              />

              <div className="space-y-1">
                <label className="block text-xs font-bold text-gray-700">שם החנות / העסק <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={serviceStoreName}
                  onChange={(e) => setServiceStoreName(e.target.value)}
                  placeholder="שם החנות"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-xs"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-bold text-gray-700">תיאור התקלה</label>
                <textarea
                  rows={2}
                  value={serviceIssueDescription}
                  onChange={(e) => setServiceIssueDescription(e.target.value)}
                  placeholder="פרט את מהות התקלה..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-gray-700">רמת תיקון מאושרת</label>
                  <select
                    value={serviceRepairLevel}
                    onChange={(e) => setServiceRepairLevel(e.target.value as any)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-xs"
                  >
                    <option value="RIDE_ONLY">נסיעה בלבד 🛴</option>
                    <option value="SAFE_RIDE">נסיעה בטוחה 🛑</option>
                    <option value="LIKE_NEW">כמו חדש ✨</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-gray-700">סכום מאושר מראש (₪)</label>
                  <input
                    type="number"
                    value={servicePreApprovedAmount}
                    onChange={(e) => setServicePreApprovedAmount(e.target.value)}
                    placeholder="0"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-xs"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-gray-700">תמונת כלי / תקלה (אופציונלי)</label>
                <input
                  id="agent-service-tool-cam"
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={(e) => handleServiceToolPhotoSelect(e.target.files?.[0] || null)}
                  className="hidden"
                />
                <input
                  id="agent-service-tool-gallery"
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleServiceToolPhotoSelect(e.target.files?.[0] || null)}
                  className="hidden"
                />

                {serviceToolPreview ? (
                  <div className="relative w-full h-32 rounded-xl border overflow-hidden bg-gray-50 flex items-center justify-center">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={serviceToolPreview} alt="כלי" className="w-full h-full object-contain" />
                    <button
                      type="button"
                      onClick={() => { setServiceToolFile(null); setServiceToolPreview(null); }}
                      className="absolute top-2 right-2 p-1.5 bg-red-600 text-white rounded-lg text-xs font-bold shadow-md"
                    >
                      הסר תמונה
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => document.getElementById('agent-service-tool-cam')?.click()}
                      className="flex-1 py-2.5 bg-blue-50 border border-blue-200 text-blue-700 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 hover:bg-blue-100 transition-all cursor-pointer"
                    >
                      <Camera className="w-3.5 h-3.5" />
                      צלם במצלמה 📸
                    </button>
                    <button
                      type="button"
                      onClick={() => document.getElementById('agent-service-tool-gallery')?.click()}
                      className="flex-1 py-2.5 bg-gray-50 border border-gray-200 text-gray-700 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 hover:bg-gray-100 transition-all cursor-pointer"
                    >
                      גלריה 🖼️
                    </button>
                  </div>
                )}
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={isSavingService}
                  className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-500/20 disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {isSavingService ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  פתח קריאה
                </button>
                <button
                  type="button"
                  onClick={() => setIsAddServiceOpen(false)}
                  className="py-3 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold cursor-pointer"
                >
                  ביטול
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
