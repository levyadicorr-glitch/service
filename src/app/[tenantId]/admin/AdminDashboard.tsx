'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { Agent, Customer, Driver, Order, PartRequest, ServiceRequest, SpecificModel, ChinaOrder, Technician } from '@/lib/db';
import { ServiceFormConfig, normalizeServiceFormConfig, BUILTIN_FIELD_META, FormField, CustomFieldType } from '@/lib/serviceFormConfig';
import { AiBotConfig, normalizeAiBotConfig, AI_BOT_LIMITS } from '@/lib/aiBotConfig';
import ServiceRequestForm from '@/components/ServiceRequestForm';
import CustomerSelectCombobox from '@/components/CustomerSelectCombobox';
import { buildWhatsAppMessage, formatRequestNumber, formatDate } from '@/lib/format';
import {
  Search, Filter, Plus, Calendar, CheckCircle2, AlertCircle, Clock,
  Trash2, Copy, Send, ExternalLink, Info, Check, User, Store, Phone,
  Eye, Navigation, Settings, HelpCircle, FileText, X, RotateCw, Loader2, Truck, Package,
  Menu, ShoppingCart, Pencil, Route, MapPin, SlidersHorizontal, GripVertical, Smartphone, Briefcase,
  Bot, Sparkles, MessagesSquare, ShieldAlert, Power, FlaskConical, BookOpen, Boxes, Wrench, Factory, Camera, Image as ImageIcon
} from 'lucide-react';

interface AdminDashboardProps {
  initialRequests: ServiceRequest[];
  customers: Customer[];
  drivers: Driver[];
  initialPartRequests: PartRequest[];
  initialOrders: Order[];
  initialAgents?: Agent[];
  initialChinaOrders?: ChinaOrder[];
  initialTechnicians?: Technician[];
  initialFactories?: string[];
  initialDeviceModels?: string[];
  initialModels?: SpecificModel[];
  tenantId: string;
  businessName: string;
  whatsappTemplate: string;
  partsRequestPhone?: string;
  adminWhatsappPhone?: string;
  adminWhatsappPhone2?: string;
  adminWhatsappPhone3?: string;
  quoteNotificationPhones?: string;
  chinaOrderNotificationPhones?: string;
  greenApiInstanceId?: string;
  /** Derived on the server; the token itself never crosses to the client. */
  greenApiTokenConfigured?: boolean;
  logoUrl?: string;
  serviceFormConfig?: ServiceFormConfig;
  aiBotConfig?: AiBotConfig;
  /** Derived on the server; the key itself never crosses to the client. */
  aiKeyConfigured?: boolean;
}

export default function AdminDashboard({ initialRequests, customers: initialCustomers, drivers: initialDrivers, initialPartRequests, initialOrders, initialAgents = [], initialChinaOrders = [], initialTechnicians = [], initialFactories = [], initialDeviceModels = ['קורקינט', 'אופניים'], initialModels = [], tenantId, businessName, whatsappTemplate, partsRequestPhone = '', adminWhatsappPhone = '', adminWhatsappPhone2 = '', adminWhatsappPhone3 = '', quoteNotificationPhones = '', chinaOrderNotificationPhones = '', greenApiInstanceId = '', greenApiTokenConfigured = false, logoUrl = '', serviceFormConfig, aiBotConfig, aiKeyConfigured = false }: AdminDashboardProps) {
  const [customersList, setCustomersList] = useState<Customer[]>(initialCustomers);
  const [driversList, setDriversList] = useState<Driver[]>(initialDrivers);
  const [agentsList, setAgentsList] = useState<Agent[]>(initialAgents);
  const [requests, setRequests] = useState<ServiceRequest[]>(initialRequests);
  const [partRequestsList, setPartRequestsList] = useState<PartRequest[]>(initialPartRequests);
  const [ordersList, setOrdersList] = useState<Order[]>(initialOrders);
  const [chinaOrdersList, setChinaOrdersList] = useState<ChinaOrder[]>(initialChinaOrders);
  const [techniciansList, setTechniciansList] = useState<Technician[]>(initialTechnicians);
  const [factories, setFactories] = useState<string[]>(initialFactories);
  const [activeTab, setActiveTab] = useState<'requests' | 'customers' | 'drivers' | 'agents' | 'partRequests' | 'orders' | 'chinaOrders' | 'dispatch' | 'formBuilder' | 'aiBot'>('requests');
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  const REGIONS: { key: 'CENTER' | 'NORTH' | 'SOUTH' | 'JERUSALEM'; label: string }[] = [
    { key: 'CENTER', label: 'מרכז' },
    { key: 'SOUTH', label: 'דרום' },
    { key: 'NORTH', label: 'צפון' },
    { key: 'JERUSALEM', label: 'ירושלים' },
  ];

  // Search & Filter States
  const [requestSearch, setRequestSearch] = useState('');
  const [requestStatusFilter, setRequestStatusFilter] = useState<string>('ALL');
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerRegionFilter, setCustomerRegionFilter] = useState<string>('ALL');
  const [orderSearch, setOrderSearch] = useState('');
  const [partRequestSearch, setPartRequestSearch] = useState('');
  const [orderRegionFilter, setOrderRegionFilter] = useState<string>('ALL');

  // Settings States
  const [currentBusinessName, setCurrentBusinessName] = useState(businessName);
  const [currentWhatsappTemplate, setCurrentWhatsappTemplate] = useState(whatsappTemplate);
  const [currentPartsRequestPhone, setCurrentPartsRequestPhone] = useState(partsRequestPhone);
  const [currentAdminWhatsappPhone, setCurrentAdminWhatsappPhone] = useState(adminWhatsappPhone);
  const [currentAdminWhatsappPhone2, setCurrentAdminWhatsappPhone2] = useState(adminWhatsappPhone2);
  const [currentAdminWhatsappPhone3, setCurrentAdminWhatsappPhone3] = useState(adminWhatsappPhone3);
  const [currentQuoteNotificationPhones, setCurrentQuoteNotificationPhones] = useState(quoteNotificationPhones);
  const [currentChinaOrderNotificationPhones, setCurrentChinaOrderNotificationPhones] = useState(chinaOrderNotificationPhones);
  const [currentGreenApiInstanceId, setCurrentGreenApiInstanceId] = useState(greenApiInstanceId);
  const [currentLogoUrl, setCurrentLogoUrl] = useState(logoUrl);
  const [currentServiceFormConfig, setCurrentServiceFormConfig] = useState<ServiceFormConfig>(() => normalizeServiceFormConfig(serviceFormConfig));
  const [settingsServiceFormConfig, setSettingsServiceFormConfig] = useState<ServiceFormConfig>(() => normalizeServiceFormConfig(serviceFormConfig));
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [activeQuoteId, setActiveQuoteId] = useState<string | null>(null);
  const [activeQuotePrice, setActiveQuotePrice] = useState<string>('');

  const [settingsBusinessName, setSettingsBusinessName] = useState(businessName);
  const [settingsWhatsappTemplate, setSettingsWhatsappTemplate] = useState(whatsappTemplate);
  const [settingsPartsRequestPhone, setSettingsPartsRequestPhone] = useState(partsRequestPhone);
  const [settingsAdminWhatsappPhone, setSettingsAdminWhatsappPhone] = useState(adminWhatsappPhone);
  const [settingsAdminWhatsappPhone2, setSettingsAdminWhatsappPhone2] = useState(adminWhatsappPhone2);
  const [settingsAdminWhatsappPhone3, setSettingsAdminWhatsappPhone3] = useState(adminWhatsappPhone3);
  const [settingsQuoteNotificationPhones, setSettingsQuoteNotificationPhones] = useState(quoteNotificationPhones);
  const [settingsChinaOrderNotificationPhones, setSettingsChinaOrderNotificationPhones] = useState(chinaOrderNotificationPhones);
  const [settingsGreenApiInstanceId, setSettingsGreenApiInstanceId] = useState(greenApiInstanceId);
  const [settingsGreenApiToken, setSettingsGreenApiToken] = useState('');
  const [connectionTestResult, setConnectionTestResult] = useState<'idle' | 'checking' | 'connected' | 'disconnected' | 'error'>('idle');
  const [connectionTestMessage, setConnectionTestMessage] = useState('');
  const [settingsPartsDeletePassword, setSettingsPartsDeletePassword] = useState('');
  const [settingsPassword, setSettingsPassword] = useState('');
  const [settingsLogoFile, setSettingsLogoFile] = useState<File | null>(null);
  const [settingsLogoPreview, setSettingsLogoPreview] = useState<string | null>(null);
  const [removeLogoFlag, setRemoveLogoFlag] = useState(false);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [settingsSuccess, setSettingsSuccess] = useState(false);
  // Form-builder tab (standalone module) state
  const [isSavingFormConfig, setIsSavingFormConfig] = useState(false);
  const [formConfigSaved, setFormConfigSaved] = useState(false);
  const [formConfigError, setFormConfigError] = useState<string | null>(null);

  const openSettingsModal = () => {
    setSettingsBusinessName(currentBusinessName);
    setSettingsWhatsappTemplate(currentWhatsappTemplate);
    setSettingsPartsRequestPhone(currentPartsRequestPhone);
    setSettingsAdminWhatsappPhone(currentAdminWhatsappPhone);
    setSettingsAdminWhatsappPhone2(currentAdminWhatsappPhone2);
    setSettingsAdminWhatsappPhone3(currentAdminWhatsappPhone3);
    setSettingsQuoteNotificationPhones(currentQuoteNotificationPhones);
    setSettingsChinaOrderNotificationPhones(currentChinaOrderNotificationPhones);
    setSettingsGreenApiInstanceId(currentGreenApiInstanceId);
    setSettingsGreenApiToken('');
    setConnectionTestResult('idle');
    setConnectionTestMessage('');
    setSettingsPartsDeletePassword('');
    setSettingsPassword('');
    setSettingsLogoFile(null);
    setSettingsLogoPreview(currentLogoUrl);
    setRemoveLogoFlag(false);
    setSettingsError(null);
    setSettingsSuccess(false);
    setIsSettingsModalOpen(true);
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSettingsLogoFile(file);
      setSettingsLogoPreview(URL.createObjectURL(file));
      setRemoveLogoFlag(false);
    }
  };

  const handleRemoveLogo = () => {
    setSettingsLogoFile(null);
    setSettingsLogoPreview(null);
    setRemoveLogoFlag(true);
  };

  // ---- Service-request form builder helpers ----
  const updateFormField = (id: string, patch: Partial<FormField>) =>
    setSettingsServiceFormConfig(prev => ({ ...prev, fields: prev.fields.map(f => f.id === id ? { ...f, ...patch } : f) }));

  const moveFormField = (index: number, dir: -1 | 1) =>
    setSettingsServiceFormConfig(prev => {
      const fields = [...prev.fields];
      const target = index + dir;
      if (target < 0 || target >= fields.length) return prev;
      [fields[index], fields[target]] = [fields[target], fields[index]];
      return { ...prev, fields };
    });

  const addCustomField = (type: CustomFieldType) =>
    setSettingsServiceFormConfig(prev => {
      const id = `custom_${Math.random().toString(36).slice(2, 10)}`;
      const newField: FormField = { id, builtin: false, key: id, type, label: 'שדה חדש', enabled: true, required: false, placeholder: '' };
      return { ...prev, fields: [...prev.fields, newField] };
    });

  const removeCustomField = (id: string) =>
    setSettingsServiceFormConfig(prev => ({ ...prev, fields: prev.fields.filter(f => f.id !== id) }));

  const fieldHasRequiredToggle = (f: FormField) =>
    f.builtin ? (BUILTIN_FIELD_META[f.key as keyof typeof BUILTIN_FIELD_META]?.hasRequiredToggle ?? false) : true;

  const customTypeLabel = (t: CustomFieldType) => (t === 'textarea' ? 'טקסט ארוך' : t === 'tel' ? 'טלפון' : 'טקסט');

  const resetFormConfig = () => {
    setSettingsServiceFormConfig(normalizeServiceFormConfig(currentServiceFormConfig));
    setFormConfigError(null);
    setFormConfigSaved(false);
  };

  const handleSaveFormConfig = async () => {
    setIsSavingFormConfig(true);
    setFormConfigError(null);
    setFormConfigSaved(false);
    try {
      const formData = new FormData();
      formData.append('serviceFormConfig', JSON.stringify(settingsServiceFormConfig));
      const res = await fetch(`/api/${tenantId}/admin/settings`, { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'שגיאה בשמירת הטופס');
      setCurrentServiceFormConfig(normalizeServiceFormConfig(settingsServiceFormConfig));
      setFormConfigSaved(true);
      setTimeout(() => setFormConfigSaved(false), 2500);
    } catch (err: unknown) {
      setFormConfigError(err instanceof Error ? err.message : 'שגיאה בחיבור לשרת');
    } finally {
      setIsSavingFormConfig(false);
    }
  };

  // Whether the builder has unsaved edits vs. the applied config.
  const formConfigDirty = JSON.stringify(settingsServiceFormConfig) !== JSON.stringify(normalizeServiceFormConfig(currentServiceFormConfig));

  // ---------------- AI customer-service bot ----------------

  const [aiConfig, setAiConfig] = useState<AiBotConfig>(normalizeAiBotConfig(aiBotConfig));
  const [currentAiConfig, setCurrentAiConfig] = useState<AiBotConfig>(normalizeAiBotConfig(aiBotConfig));
  const [isSavingAiConfig, setIsSavingAiConfig] = useState(false);
  const [aiConfigError, setAiConfigError] = useState<string | null>(null);
  const [aiConfigSaved, setAiConfigSaved] = useState(false);

  const aiConfigDirty = JSON.stringify(aiConfig) !== JSON.stringify(currentAiConfig);

  const updateAiConfig = <K extends keyof AiBotConfig>(key: K, value: AiBotConfig[K]) => {
    setAiConfig(prev => ({ ...prev, [key]: value }));
  };

  const handleSaveAiConfig = async () => {
    setIsSavingAiConfig(true);
    setAiConfigError(null);
    setAiConfigSaved(false);
    try {
      // Only this one field goes in the FormData — the settings route skips
      // every key that is absent, so nothing else on the tenant is touched.
      const formData = new FormData();
      formData.append('aiBotConfig', JSON.stringify(aiConfig));
      const res = await fetch(`/api/${tenantId}/admin/settings`, { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'שגיאה בשמירת הגדרות הבוט');
      const applied = normalizeAiBotConfig(aiConfig);
      setCurrentAiConfig(applied);
      setAiConfig(applied);
      setAiConfigSaved(true);
      setTimeout(() => setAiConfigSaved(false), 2500);
    } catch (err: unknown) {
      setAiConfigError(err instanceof Error ? err.message : 'שגיאה בחיבור לשרת');
    } finally {
      setIsSavingAiConfig(false);
    }
  };

  // --- Playground ---
  interface AiTestResult {
    degraded?: boolean;
    errorKind?: string;
    error?: string;
    intent?: string;
    confidence?: number;
    needsHuman?: boolean;
    reply?: string;
    modelReply?: string;
    escalate?: boolean;
    escalationReason?: string;
    wouldApprove?: { requestNumbers: number[] };
    contextBlock?: string;
    usage?: { promptTokens: number; outputTokens: number; totalTokens: number };
    latencyMs?: number;
    model?: string;
  }

  interface AiTestEntry {
    id: string;
    message: string;
    result?: AiTestResult;
    error?: string;
  }

  const [aiTestCustomerId, setAiTestCustomerId] = useState('');
  const [aiTestPhone, setAiTestPhone] = useState('');
  const [aiTestMessage, setAiTestMessage] = useState('');
  const [aiTestLog, setAiTestLog] = useState<AiTestEntry[]>([]);
  const [isRunningAiTest, setIsRunningAiTest] = useState(false);
  const [aiProbe, setAiProbe] = useState<{ connected: boolean; latencyMs?: number; error?: string } | null>(null);
  const [isProbingAi, setIsProbingAi] = useState(false);

  const handleProbeAi = async () => {
    setIsProbingAi(true);
    setAiProbe(null);
    try {
      const res = await fetch(`/api/${tenantId}/admin/ai/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ probe: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'שגיאה בבדיקת החיבור');
      setAiProbe({ connected: Boolean(data.connected), latencyMs: data.latencyMs, error: data.error });
    } catch (err: unknown) {
      setAiProbe({ connected: false, error: err instanceof Error ? err.message : 'שגיאה בחיבור לשרת' });
    } finally {
      setIsProbingAi(false);
    }
  };

  const handleRunAiTest = async () => {
    const message = aiTestMessage.trim();
    if (!message) return;
    setIsRunningAiTest(true);
    const entryId = `${Date.now()}`;
    setAiTestLog(prev => [...prev, { id: entryId, message }]);
    setAiTestMessage('');
    try {
      const res = await fetch(`/api/${tenantId}/admin/ai/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, phone: aiTestPhone }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'שגיאה בהרצת הבדיקה');
      setAiTestLog(prev => prev.map(e => (e.id === entryId ? { ...e, result: data } : e)));
    } catch (err: unknown) {
      const messageText = err instanceof Error ? err.message : 'שגיאה בחיבור לשרת';
      setAiTestLog(prev => prev.map(e => (e.id === entryId ? { ...e, error: messageText } : e)));
    } finally {
      setIsRunningAiTest(false);
    }
  };

  // --- Conversation viewer ---
  interface AiThread {
    phone: string;
    customerName?: string;
    lastText: string;
    lastDirection: 'IN' | 'OUT';
    lastAt: string;
    messageCount: number;
    escalated: boolean;
    testMode: boolean;
  }

  interface AiMessage {
    id: string;
    direction: 'IN' | 'OUT';
    source: string;
    text: string;
    intent?: string;
    confidence?: number;
    escalationReason?: string;
    delivered?: boolean;
    testMode?: boolean;
    degraded?: boolean;
    errorKind?: string;
    latencyMs?: number;
    createdAt: string;
  }

  const [aiThreads, setAiThreads] = useState<AiThread[]>([]);
  const [aiSelectedPhone, setAiSelectedPhone] = useState('');
  const [aiMessages, setAiMessages] = useState<AiMessage[]>([]);
  const [aiLiveUsage, setAiLiveUsage] = useState<{ tenantCount: number; maxPerTenantPerDay: number } | null>(null);
  const [isLoadingAiThreads, setIsLoadingAiThreads] = useState(false);

  // Gated on the tab being open so the dashboard's initial load is untouched.
  useEffect(() => {
    if (activeTab !== 'aiBot') return;
    let cancelled = false;
    const loadThreads = async () => {
      setIsLoadingAiThreads(true);
      try {
        const res = await fetch(`/api/${tenantId}/admin/ai/conversations`);
        const data = await res.json();
        if (cancelled) return;
        setAiThreads(data.threads || []);
        setAiLiveUsage(data.usage || null);
      } catch {
        /* the panel simply shows no threads */
      } finally {
        if (!cancelled) setIsLoadingAiThreads(false);
      }
    };
    loadThreads();
    return () => { cancelled = true; };
  }, [activeTab, tenantId, aiConfigSaved]);

  useEffect(() => {
    if (activeTab !== 'aiBot' || !aiSelectedPhone) return;
    let cancelled = false;
    fetch(`/api/${tenantId}/admin/ai/conversations?phone=${encodeURIComponent(aiSelectedPhone)}`)
      .then(res => res.json())
      .then(data => { if (!cancelled) setAiMessages(data.messages || []); })
      .catch(() => { if (!cancelled) setAiMessages([]); });
    return () => { cancelled = true; };
  }, [activeTab, tenantId, aiSelectedPhone]);

  const PERSONA_PRESETS: { label: string; value: string }[] = [
    { label: 'ידידותי', value: 'אתה נציג שירות חם ואדיב. פונה ללקוח בגוף שני, משתמש באימוג\'י בודד כשמתאים, ומרגיע לקוח מתוסכל לפני שאתה עונה לגופו של עניין.' },
    { label: 'ענייני', value: 'אתה נציג שירות מקצועי ומדויק. עונה בצורה עניינית וברורה, בלי אימוג\'י ובלי מילות נימוס מיותרות.' },
    { label: 'קצר ולעניין', value: 'אתה עונה בקצרה מאוד — משפט אחד או שניים לכל היותר. רק העובדות שהלקוח ביקש, בלי הקדמות.' },
  ];

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingSettings(true);
    setSettingsError(null);
    setSettingsSuccess(false);

    try {
      const formData = new FormData();
      formData.append('businessName', settingsBusinessName.trim());
      formData.append('whatsappTemplate', settingsWhatsappTemplate.trim());
      formData.append('partsRequestPhone', settingsPartsRequestPhone.trim());
      formData.append('adminWhatsappPhone', settingsAdminWhatsappPhone.trim());
      formData.append('adminWhatsappPhone2', settingsAdminWhatsappPhone2.trim());
      formData.append('adminWhatsappPhone3', settingsAdminWhatsappPhone3.trim());
      formData.append('quoteNotificationPhones', settingsQuoteNotificationPhones.trim());
      formData.append('chinaOrderNotificationPhones', settingsChinaOrderNotificationPhones.trim());
      formData.append('greenApiInstanceId', settingsGreenApiInstanceId.trim());
      if (settingsGreenApiToken.trim()) {
        formData.append('greenApiToken', settingsGreenApiToken.trim());
      }
      if (settingsPartsDeletePassword.trim()) {
        formData.append('partsDeletePassword', settingsPartsDeletePassword.trim());
      }
      if (settingsPassword.trim()) {
        formData.append('password', settingsPassword.trim());
      }
      if (removeLogoFlag) {
        formData.append('removeLogo', 'true');
      } else if (settingsLogoFile) {
        formData.append('logo', settingsLogoFile);
      }

      const res = await fetch(`/api/${tenantId}/admin/settings`, {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'שגיאה בשמירת ההגדרות');
      }

      setCurrentBusinessName(settingsBusinessName);
      setCurrentWhatsappTemplate(settingsWhatsappTemplate);
      setCurrentPartsRequestPhone(settingsPartsRequestPhone);
      setCurrentAdminWhatsappPhone(settingsAdminWhatsappPhone);
      setCurrentAdminWhatsappPhone2(settingsAdminWhatsappPhone2);
      setCurrentAdminWhatsappPhone3(settingsAdminWhatsappPhone3);
      setCurrentQuoteNotificationPhones(settingsQuoteNotificationPhones);
      setCurrentChinaOrderNotificationPhones(settingsChinaOrderNotificationPhones);
      setCurrentGreenApiInstanceId(settingsGreenApiInstanceId);
      if (removeLogoFlag) {
        setCurrentLogoUrl('');
      } else if (data.logoUrl) {
        setCurrentLogoUrl(data.logoUrl);
      }

      setSettingsSuccess(true);
      setTimeout(() => setIsSettingsModalOpen(false), 1000);
    } catch (err: unknown) {
      setSettingsError(err instanceof Error ? err.message : 'שגיאה בחיבור לשרת');
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleTestGreenApiConnection = async () => {
    setConnectionTestResult('checking');
    setConnectionTestMessage('');
    try {
      const res = await fetch(`/api/${tenantId}/admin/whatsapp/test`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        setConnectionTestResult('error');
        setConnectionTestMessage(data.error || 'שגיאה בבדיקת החיבור');
        return;
      }
      if (data.connected) {
        setConnectionTestResult('connected');
        setConnectionTestMessage('הוואטסאפ מחובר ומאושר');
      } else {
        setConnectionTestResult('disconnected');
        setConnectionTestMessage(`המספר אינו מחובר (סטטוס: ${data.stateInstance || 'לא ידוע'}). סרוק את ה-QR ב-Green API.`);
      }
    } catch {
      setConnectionTestResult('error');
      setConnectionTestMessage('שגיאה בחיבור לשרת');
    }
  };

  // Dropdown open states
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);

  // Modal State
  const [selectedRequest, setSelectedRequest] = useState<ServiceRequest | null>(null);
  const [isLoadingRequestImages, setIsLoadingRequestImages] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [copiedCustomerId, setCopiedCustomerId] = useState<string | null>(null);
  const [baseUrl, setBaseUrl] = useState('');

  // Create Request Flow State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createSearch, setCreateSearch] = useState('');
  const [selectedCustomerForCreate, setSelectedCustomerForCreate] = useState<Customer | null>(null);

  // Add Customer Modal State
  const [isAddCustomerModalOpen, setIsAddCustomerModalOpen] = useState(false);
  const [isSavingCustomer, setIsSavingCustomer] = useState(false);
  const [newCustomer, setNewCustomer] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    email: '',
    address: '',
  });

  // Customer Card (edit) Modal State
  const [isCustomerCardOpen, setIsCustomerCardOpen] = useState(false);
  const [editingCustomerId, setEditingCustomerId] = useState<string | null>(null);
  const [isSavingCustomerCard, setIsSavingCustomerCard] = useState(false);
  const [customerCardForm, setCustomerCardForm] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    email: '',
    address: '',
    region: '' as '' | 'CENTER' | 'NORTH' | 'SOUTH' | 'JERUSALEM',
  });
  const [updatingRegionCustomerId, setUpdatingRegionCustomerId] = useState<string | null>(null);
  const [approvingCustomerId, setApprovingCustomerId] = useState<string | null>(null);

  // Drivers Management State (settings modal section)
  const [newDriverName, setNewDriverName] = useState('');
  const [newDriverPhone, setNewDriverPhone] = useState('');
  const [isSavingDriver, setIsSavingDriver] = useState(false);
  const [copiedDriverId, setCopiedDriverId] = useState<string | null>(null);
  const [copiedCustomerLoginUrl, setCopiedCustomerLoginUrl] = useState(false);
  const [copiedPortalCustId, setCopiedPortalCustId] = useState<string | null>(null);
  const [updatingDriverRequestId, setUpdatingDriverRequestId] = useState<string | null>(null);
  const [adminSelectedDriverId, setAdminSelectedDriverId] = useState('');

  const copyCustomerLoginUrl = () => {
    const url = `${baseUrl}/${tenantId}/login`;
    navigator.clipboard.writeText(url);
    setCopiedCustomerLoginUrl(true);
    setTimeout(() => setCopiedCustomerLoginUrl(false), 2000);
  };

  const [copiedAgentPartUrl, setCopiedAgentPartUrl] = useState(false);
  const copyAgentPartRequestUrl = () => {
    const url = `${baseUrl}/${tenantId}/request-part`;
    navigator.clipboard.writeText(url);
    setCopiedAgentPartUrl(true);
    setTimeout(() => setCopiedAgentPartUrl(false), 2000);
  };

  const copyCustomerPortalUrl = (cust: Customer) => {
    const url = `${baseUrl}/${tenantId}/portal/${cust.id}`;
    navigator.clipboard.writeText(url);
    setCopiedPortalCustId(cust.id);
    setTimeout(() => setCopiedPortalCustId(null), 2000);
  };

  // Sales Agents State & Handlers
  const [isAddAgentModalOpen, setIsAddAgentModalOpen] = useState(false);
  const [newAgentName, setNewAgentName] = useState('');
  const [newAgentPhone, setNewAgentPhone] = useState('');
  const [newAgentPassword, setNewAgentPassword] = useState('');
  const [isSavingAgent, setIsSavingAgent] = useState(false);
  const [deletingAgentId, setDeletingAgentId] = useState<string | null>(null);
  const [copiedAgentToken, setCopiedAgentToken] = useState<string | null>(null);

  const copyAgentPortalUrl = (agentToken: string) => {
    const url = `${baseUrl}/${tenantId}/agent/${agentToken}`;
    navigator.clipboard.writeText(url);
    setCopiedAgentToken(agentToken);
    setTimeout(() => setCopiedAgentToken(null), 2000);
  };

  const handleCreateAgent = async () => {
    if (!newAgentName.trim() || !newAgentPhone.trim() || !newAgentPassword.trim()) {
      alert('יש למלא שם, טלפון וסיסמת כניסה לסוכן');
      return;
    }
    setIsSavingAgent(true);
    try {
      const res = await fetch(`/api/${tenantId}/agents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newAgentName.trim(),
          phone: newAgentPhone.trim(),
          password: newAgentPassword.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'שגיאה ביצירת סוכן מכירות');

      setAgentsList(prev => [data.agent, ...prev]);
      setNewAgentName('');
      setNewAgentPhone('');
      setNewAgentPassword('');
      setIsAddAgentModalOpen(false);
      alert('סוכן מכירות חדש נוצר בהצלחה! 🎉');
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'שגיאה ביצירת סוכן');
    } finally {
      setIsSavingAgent(false);
    }
  };

  const handleDeleteAgent = async (agentId: string) => {
    if (!confirm('האם אתה בטוח שברצונך למחוק סוכן מכירות זה? היכולת שלו להתחבר לפורטל תחסם.')) return;
    setDeletingAgentId(agentId);
    try {
      const res = await fetch(`/api/${tenantId}/agents/${agentId}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'שגיאה במחיקת סוכן');
      }
      setAgentsList(prev => prev.filter(a => a.id !== agentId));
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'שגיאה במחיקת סוכן');
    } finally {
      setDeletingAgentId(null);
    }
  };

  // ---------------- China Parts Orders State & Handlers ----------------
  const CHINA_ORDER_STATUSES: { key: 'WAITING_TO_ORDER' | 'ORDERED' | 'ARRIVED'; label: string; bg: string; text: string; border: string }[] = [
    { key: 'WAITING_TO_ORDER', label: 'ממתין להזמנה', bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-100' },
    { key: 'ORDERED', label: 'הוזמן', bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-100' },
    { key: 'ARRIVED', label: 'הגיע', bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-100' },
  ];

  const [chinaOrderSearch, setChinaOrderSearch] = useState('');
  const [chinaStatusFilter, setChinaStatusFilter] = useState<string>('ALL');

  // New China order modal
  const [isAddChinaOrderModalOpen, setIsAddChinaOrderModalOpen] = useState(false);
  const [newChinaPartName, setNewChinaPartName] = useState('');
  const [newChinaQuantity, setNewChinaQuantity] = useState('1');
  const [newChinaFactory, setNewChinaFactory] = useState('');
  const [newChinaPhoto, setNewChinaPhoto] = useState<File | null>(null);
  const [newChinaPhotoPreview, setNewChinaPhotoPreview] = useState<string | null>(null);
  const [isSavingChinaOrder, setIsSavingChinaOrder] = useState(false);
  const chinaFileInputRef = useRef<HTMLInputElement>(null);
  const chinaCameraInputRef = useRef<HTMLInputElement>(null);
  const [updatingChinaOrderId, setUpdatingChinaOrderId] = useState<string | null>(null);

  const handleChinaPhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setNewChinaPhoto(file);
      setNewChinaPhotoPreview(URL.createObjectURL(file));
    }
  };

  const resetChinaOrderForm = () => {
    setNewChinaPartName('');
    setNewChinaQuantity('1');
    setNewChinaFactory('');
    setNewChinaPhoto(null);
    setNewChinaPhotoPreview(null);
    setIsAddingFactoryInline(false);
    setNewFactoryInput('');
  };

  const handleCreateChinaOrder = async () => {
    if (!newChinaPartName.trim()) {
      alert('יש להזין שם חלק');
      return;
    }
    const qty = parseInt(newChinaQuantity, 10);
    if (!Number.isFinite(qty) || qty < 1) {
      alert('כמות לא תקינה');
      return;
    }
    setIsSavingChinaOrder(true);
    try {
      const formData = new FormData();
      formData.append('partName', newChinaPartName.trim());
      formData.append('quantity', String(qty));
      formData.append('factory', newChinaFactory.trim());
      if (newChinaPhoto) formData.append('photo', newChinaPhoto);

      const res = await fetch(`/api/${tenantId}/china-orders`, {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'שגיאה ביצירת ההזמנה');

      setChinaOrdersList(prev => [data.order, ...prev]);
      resetChinaOrderForm();
      setIsAddChinaOrderModalOpen(false);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'שגיאה ביצירת ההזמנה');
    } finally {
      setIsSavingChinaOrder(false);
    }
  };

  const handleChinaOrderStatusChange = async (id: string, status: ChinaOrder['status']) => {
    setUpdatingChinaOrderId(id);
    try {
      const res = await fetch(`/api/${tenantId}/china-orders/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'שגיאה בעדכון הסטטוס');
      setChinaOrdersList(prev => prev.map(o => (o.id === id ? { ...o, status } : o)));

      // Surface the WhatsApp automation result when marking as ORDERED, so a
      // silent no-send becomes an actionable message instead of a mystery.
      if (status === 'ORDERED' && data.notify) {
        const n = data.notify;
        if (n.sent) {
          alert(`✅ הודעת וואטסאפ נשלחה ל-${n.sentCount} מספרים.`);
        } else if (n.reason === 'no_phones') {
          alert('⚠️ החלק סומן כ"הוזמן", אך לא נשלחה הודעה: לא הוגדרו מספרי טלפון להתראות הזמנות סין.\nהגדרות עסק ← "מספרי טלפון להתראות הזמנות חלקים מסין".');
        } else if (n.reason === 'no_instance') {
          alert('⚠️ החלק סומן כ"הוזמן", אך לא נשלחה הודעה: לא הוגדר Green API — Instance ID.\nהגדרות עסק ← "חיבור וואטסאפ אוטומטי (Green API)".');
        } else if (n.reason === 'no_token' || n.reason === 'no_greenapi') {
          alert('⚠️ החלק סומן כ"הוזמן", אך לא נשלחה הודעה: לא נשמר Green API — API Token.\nהגדרות עסק ← "חיבור וואטסאפ אוטומטי (Green API)" ← הזן ושמור את הטוקן.');
        } else {
          alert(`⚠️ החלק סומן כ"הוזמן", אך שליחת הוואטסאפ נכשלה:\n${n.reason}`);
        }
      }
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'שגיאה בעדכון הסטטוס');
    } finally {
      setUpdatingChinaOrderId(null);
    }
  };

  const handleApproveChinaOrder = (id: string) => handleChinaOrderStatusChange(id, 'WAITING_TO_ORDER');

  const handleDeleteChinaOrder = async (id: string) => {
    if (!confirm('האם למחוק הזמנה זו?')) return;
    try {
      const res = await fetch(`/api/${tenantId}/china-orders/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'שגיאה במחיקת ההזמנה');
      }
      setChinaOrdersList(prev => prev.filter(o => o.id !== id));
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'שגיאה במחיקת ההזמנה');
    }
  };

  // ---------------- Technicians State & Handlers ----------------
  const [isAddTechnicianModalOpen, setIsAddTechnicianModalOpen] = useState(false);
  const [newTechnicianName, setNewTechnicianName] = useState('');
  const [newTechnicianPhone, setNewTechnicianPhone] = useState('');
  const [newTechnicianPassword, setNewTechnicianPassword] = useState('');
  const [isSavingTechnician, setIsSavingTechnician] = useState(false);
  const [deletingTechnicianId, setDeletingTechnicianId] = useState<string | null>(null);
  const [copiedTechnicianToken, setCopiedTechnicianToken] = useState<string | null>(null);

  const copyTechnicianPortalUrl = (token: string) => {
    const url = `${baseUrl}/${tenantId}/technician/${token}`;
    navigator.clipboard.writeText(url);
    setCopiedTechnicianToken(token);
    setTimeout(() => setCopiedTechnicianToken(null), 2000);
  };

  const handleCreateTechnician = async () => {
    if (!newTechnicianName.trim() || !newTechnicianPhone.trim() || !newTechnicianPassword.trim()) {
      alert('יש למלא שם, טלפון וסיסמת כניסה לטכנאי');
      return;
    }
    setIsSavingTechnician(true);
    try {
      const res = await fetch(`/api/${tenantId}/technicians`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newTechnicianName.trim(),
          phone: newTechnicianPhone.trim(),
          password: newTechnicianPassword.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'שגיאה ביצירת טכנאי');

      setTechniciansList(prev => [data.technician, ...prev]);
      setNewTechnicianName('');
      setNewTechnicianPhone('');
      setNewTechnicianPassword('');
      setIsAddTechnicianModalOpen(false);
      alert('טכנאי חדש נוצר בהצלחה! 🎉');
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'שגיאה ביצירת טכנאי');
    } finally {
      setIsSavingTechnician(false);
    }
  };

  const handleDeleteTechnician = async (technicianId: string) => {
    if (!confirm('האם למחוק טכנאי זה? הקישור האישי שלו יפסיק לעבוד.')) return;
    setDeletingTechnicianId(technicianId);
    try {
      const res = await fetch(`/api/${tenantId}/technicians/${technicianId}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'שגיאה במחיקת טכנאי');
      }
      setTechniciansList(prev => prev.filter(t => t.id !== technicianId));
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'שגיאה במחיקת טכנאי');
    } finally {
      setDeletingTechnicianId(null);
    }
  };

  // ---------------- Factories (מפעלים) State & Handlers ----------------
  const [newFactoryInput, setNewFactoryInput] = useState('');
  const [isSavingFactory, setIsSavingFactory] = useState(false);
  // Inline "+" add-factory flow inside the new China order modal.
  const [isAddingFactoryInline, setIsAddingFactoryInline] = useState(false);

  const handleAddFactory = async (): Promise<string | null> => {
    const trimmed = newFactoryInput.trim();
    if (!trimmed) return null;
    setIsSavingFactory(true);
    try {
      const res = await fetch(`/api/${tenantId}/factories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ factoryName: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'שגיאה בהוספת המפעל');
      if (data.factories && Array.isArray(data.factories)) {
        setFactories(data.factories);
      } else if (!factories.includes(trimmed)) {
        setFactories(prev => [...prev, trimmed]);
      }
      setNewFactoryInput('');
      return trimmed;
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'שגיאה בהוספת המפעל');
      return null;
    } finally {
      setIsSavingFactory(false);
    }
  };

  // Adds a factory from the new-order modal and auto-selects it.
  const handleAddFactoryInline = async () => {
    const added = await handleAddFactory();
    if (added) {
      setNewChinaFactory(added);
      setIsAddingFactoryInline(false);
    }
  };

  const handleDeleteFactory = async (factoryName: string) => {
    try {
      const res = await fetch(`/api/${tenantId}/factories`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ factoryName }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'שגיאה במחיקת המפעל');
      if (data.factories && Array.isArray(data.factories)) {
        setFactories(data.factories);
      } else {
        setFactories(prev => prev.filter(f => f !== factoryName));
      }
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'שגיאה במחיקת המפעל');
    }
  };

  // China orders split: pending technician submissions vs the live orders table.
  const pendingChinaOrders = chinaOrdersList.filter(o => o.status === 'PENDING_APPROVAL');
  const activeChinaOrders = chinaOrdersList.filter(o => o.status !== 'PENDING_APPROVAL');
  const filteredChinaOrders = activeChinaOrders.filter(o => {
    const matchesSearch = !chinaOrderSearch.trim()
      || o.partName.toLowerCase().includes(chinaOrderSearch.trim().toLowerCase())
      || (o.factory || '').toLowerCase().includes(chinaOrderSearch.trim().toLowerCase());
    const matchesStatus = chinaStatusFilter === 'ALL' || o.status === chinaStatusFilter;
    return matchesSearch && matchesStatus;
  });

  const multiDriver = driversList.length > 1;

  // Orders Management State
  const [deviceModels, setDeviceModels] = useState<string[]>(
    initialDeviceModels && initialDeviceModels.length > 0 ? initialDeviceModels : ['קורקינט', 'אופניים']
  );
  const [isAddingNewModel, setIsAddingNewModel] = useState(false);
  const [newModelInput, setNewModelInput] = useState('');
  const [isSavingNewModel, setIsSavingNewModel] = useState(false);

  const handleAddDeviceModel = async () => {
    const trimmed = newModelInput.trim();
    if (!trimmed) return;
    setIsSavingNewModel(true);
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
      setNewOrderDeviceType(trimmed);
      setNewModelInput('');
      setIsAddingNewModel(false);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'שגיאה בהוספת הדגם');
    } finally {
      setIsSavingNewModel(false);
    }
  };

  const [modelsList, setModelsList] = useState<SpecificModel[]>(initialModels || []);
  const [isAddingSpecificModel, setIsAddingSpecificModel] = useState(false);
  const [newSpecificModelInput, setNewSpecificModelInput] = useState('');
  const [newSpecificModelDeviceType, setNewSpecificModelDeviceType] = useState('');
  const [isSavingSpecificModel, setIsSavingSpecificModel] = useState(false);
  const [newOrderCustomModelText, setNewOrderCustomModelText] = useState('');

  const handleAddSpecificModel = async (overrideDeviceType?: string) => {
    const trimmed = newSpecificModelInput.trim();
    if (!trimmed) return;
    const targetDeviceType = overrideDeviceType !== undefined
      ? overrideDeviceType.trim()
      : (newOrderDeviceType === 'other' ? newOrderCustomDeviceType : newOrderDeviceType).trim();

    setIsSavingSpecificModel(true);
    try {
      const res = await fetch(`/api/${tenantId}/models`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ modelName: trimmed, deviceType: targetDeviceType }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'שגיאה בהוספת הדגם');

      if (data.models && Array.isArray(data.models)) {
        setModelsList(data.models);
      } else {
        setModelsList(prev => [...prev.filter(m => m.name !== trimmed), { name: trimmed, deviceType: targetDeviceType }]);
      }
      setNewOrderModel(trimmed);
      setNewSpecificModelInput('');
      setNewSpecificModelDeviceType('');
      setIsAddingSpecificModel(false);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'שגיאה בהוספת הדגם');
    } finally {
      setIsSavingSpecificModel(false);
    }
  };

  const handleDeleteDeviceModel = async (modelName: string) => {
    try {
      const res = await fetch(`/api/${tenantId}/device-models`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ modelName }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'שגיאה בהסרת סוג הכלי');
      if (data.deviceModels && Array.isArray(data.deviceModels)) {
        setDeviceModels(data.deviceModels);
      } else {
        setDeviceModels(prev => prev.filter(m => m !== modelName));
      }
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'שגיאה בהסרת סוג הכלי');
    }
  };

  const handleDeleteSpecificModel = async (modelName: string) => {
    try {
      const res = await fetch(`/api/${tenantId}/models`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ modelName }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'שגיאה בהסרת הדגם');
      if (data.models && Array.isArray(data.models)) {
        setModelsList(data.models);
      } else {
        setModelsList(prev => prev.filter(m => m.name !== modelName));
      }
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'שגיאה בהסרת הדגם');
    }
  };

  const ORDER_STATUSES: { key: 'PENDING' | 'READY_FOR_DISPATCH' | 'FULFILLED' | 'CANCELLED'; label: string; bg: string; text: string; border: string }[] = [
    { key: 'PENDING', label: 'בהכנה', bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-100' },
    { key: 'READY_FOR_DISPATCH', label: 'מוכן לשילוח', bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-100' },
    { key: 'FULFILLED', label: 'סופק', bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-100' },
    { key: 'CANCELLED', label: 'בוטל', bg: 'bg-gray-100', text: 'text-gray-500', border: 'border-gray-200' },
  ];
  const [isAddOrderModalOpen, setIsAddOrderModalOpen] = useState(false);
  const [newOrderCustomerId, setNewOrderCustomerId] = useState('');
  const [newOrderDeviceType, setNewOrderDeviceType] = useState<string>('קורקינט');
  const [newOrderCustomDeviceType, setNewOrderCustomDeviceType] = useState('');
  const [newOrderQuantity, setNewOrderQuantity] = useState('1');
  const [newOrderUnitPrice, setNewOrderUnitPrice] = useState('');
  const [newOrderModel, setNewOrderModel] = useState('');
  const [newOrderDriverId, setNewOrderDriverId] = useState('');
  const [newOrderRegion, setNewOrderRegion] = useState<'' | 'CENTER' | 'NORTH' | 'SOUTH' | 'JERUSALEM'>('');
  const [isSavingOrder, setIsSavingOrder] = useState(false);
  const [updatingDriverOrderId, setUpdatingDriverOrderId] = useState<string | null>(null);

  // QR Code Flyer State
  const [selectedCustomerForQr, setSelectedCustomerForQr] = useState<Customer | null>(null);

  // Live Sync & Manual Refresh States
  const [isAdminRefreshing, setIsAdminRefreshing] = useState(false);

  const refreshRequests = async (showLoader = false) => {
    if (showLoader) setIsAdminRefreshing(true);
    try {
      const [resRequests, resPartRequests] = await Promise.all([
        fetch(`/api/${tenantId}/requests?excludeImages=true&limit=200`),
        fetch(`/api/${tenantId}/parts-requests`),
      ]);
      const dataRequests = await resRequests.json();
      const dataPartRequests = await resPartRequests.json();

      if (resRequests.ok && dataRequests.requests) {
        setRequests(dataRequests.requests);
        if (selectedRequest) {
          const updatedReq = dataRequests.requests.find((r: ServiceRequest) => r.id === selectedRequest.id);
          if (updatedReq) {
            setSelectedRequest(prev => prev ? { ...prev, ...updatedReq } : updatedReq);
          }
        }
      }

      if (resPartRequests.ok && dataPartRequests.requests) {
        setPartRequestsList(dataPartRequests.requests);
      }
    } catch (err) {
      console.error('Error refreshing requests:', err);
    } finally {
      if (showLoader) setIsAdminRefreshing(false);
    }
  };

  // Open the request detail modal. The list is loaded without images (to keep
  // the payload small), so fetch this one request's images on demand and merge
  // them in. Text/status show instantly; images fill in when they arrive.
  const openRequestDetails = async (req: ServiceRequest) => {
    setSelectedRequest(req);
    setIsLoadingRequestImages(true);
    try {
      const res = await fetch(`/api/${tenantId}/requests/${req.id}`);
      const data = await res.json();
      if (res.ok && data.request) {
        setSelectedRequest(prev => (prev && prev.id === req.id ? { ...prev, ...data.request } : prev));
      }
    } catch (err) {
      console.error('Error loading request images:', err);
    } finally {
      setIsLoadingRequestImages(false);
    }
  };

  useEffect(() => {
    setBaseUrl(window.location.origin);
    // Legacy client-side auth flag, no longer used (auth is a server session cookie)
    localStorage.removeItem('admin_auth');
  }, []);

  // Close the mobile sidebar drawer on Escape
  useEffect(() => {
    if (!isMobileSidebarOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsMobileSidebarOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isMobileSidebarOpen]);

  useEffect(() => {
    // Set polling interval for 30 seconds
    const interval = setInterval(() => {
      refreshRequests(false);
    }, 30000);

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
    const matchesSearch = name.includes(searchLower) || phone.includes(searchLower);
    const matchesRegion = customerRegionFilter === 'ALL' || cust.region === customerRegionFilter;
    return matchesSearch && matchesRegion;
  });

  // Filter orders
  const filteredOrders = ordersList.filter(order => {
    const customerName = order.customer ? `${order.customer.firstName} ${order.customer.lastName}`.toLowerCase() : '';
    const customerPhone = (order.customer?.phone || '').toLowerCase();
    const searchLower = orderSearch.toLowerCase();
    const matchesSearch = !searchLower || customerName.includes(searchLower) || customerPhone.includes(searchLower) || order.deviceType.toLowerCase().includes(searchLower);
    const matchesRegion = orderRegionFilter === 'ALL' || order.customer?.region === orderRegionFilter;
    return matchesSearch && matchesRegion;
  });

  // Filter part requests
  const filteredPartRequests = partRequestsList.filter(pr => {
    const customerName = pr.customer ? `${pr.customer.firstName} ${pr.customer.lastName}`.toLowerCase() : '';
    const customerPhone = (pr.customer?.phone || '').toLowerCase();
    const searchLower = partRequestSearch.toLowerCase();
    return !searchLower || customerName.includes(searchLower) || customerPhone.includes(searchLower) || pr.description.toLowerCase().includes(searchLower);
  });

  // ---- Dispatch Board: group open requests/orders by region, then by driver ----
  const dispatchRegionKeys: { key: string; label: string }[] = [...REGIONS, { key: 'UNASSIGNED', label: 'ללא אזור' }];
  const openDispatchRequests = requests.filter(r => r.status !== 'COMPLETED');
  const openDispatchOrders = ordersList.filter(o => o.status === 'PENDING');
  const openDispatchParts = partRequestsList.filter(p => p.status === 'NEW');

  function bucketByDriver<T extends { driverId?: string }>(items: T[]): Map<string, T[]> {
    const buckets = new Map<string, T[]>();
    items.forEach(item => {
      const key = item.driverId || 'unassigned';
      buckets.set(key, [...(buckets.get(key) || []), item]);
    });
    return buckets;
  }

  const dispatchGroups = dispatchRegionKeys
    .map(region => {
      const regionRequests = openDispatchRequests.filter(r => (r.customer?.region || 'UNASSIGNED') === region.key);
      const regionOrders = openDispatchOrders.filter(o => (o.customer?.region || 'UNASSIGNED') === region.key);
      const regionParts = openDispatchParts.filter(p => (p.customer?.region || 'UNASSIGNED') === region.key);
      const driverKeys = Array.from(new Set([
        ...regionRequests.map(r => r.driverId || 'unassigned'),
        ...regionOrders.map(o => o.driverId || 'unassigned'),
      ])).sort((a, b) => (a === 'unassigned' ? 1 : 0) - (b === 'unassigned' ? 1 : 0));
      const requestsByDriver = bucketByDriver(regionRequests);
      const ordersByDriver = bucketByDriver(regionOrders);
      return { region, driverKeys, requestsByDriver, ordersByDriver, parts: regionParts };
    })
    .filter(g => g.driverKeys.length > 0 || g.parts.length > 0);

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

  // Called by <ServiceRequestForm> after the admin saves a request from inside.
  const handleAdminRequestCreated = (request: ServiceRequest) => {
    const assignedDriver = request.driverId ? driversList.find(d => d.id === request.driverId) : undefined;
    setRequests(prev => [{ ...request, driver: assignedDriver }, ...prev]);
    setIsCreateModalOpen(false);
    setSelectedCustomerForCreate(null);
    setCreateSearch('');
    setAdminSelectedDriverId('');
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

  // Open the customer card modal pre-filled with an existing customer's data
  const openCustomerCard = (cust: Customer) => {
    setEditingCustomerId(cust.id);
    setCustomerCardForm({
      firstName: cust.firstName,
      lastName: cust.lastName,
      phone: cust.phone || '',
      email: cust.email || '',
      address: cust.address || '',
      region: cust.region || '',
    });
    setIsCustomerCardOpen(true);
  };

  const applyCustomerUpdate = (customerId: string, update: Partial<Customer>) => {
    setCustomersList(prev => prev.map(c => c.id === customerId ? { ...c, ...update } : c));
    setRequests(prev => prev.map(r => r.customerId === customerId && r.customer ? { ...r, customer: { ...r.customer, ...update } } : r));
    setOrdersList(prev => prev.map(o => o.customerId === customerId && o.customer ? { ...o, customer: { ...o.customer, ...update } } : o));
    setPartRequestsList(prev => prev.map(p => p.customerId === customerId && p.customer ? { ...p, customer: { ...p.customer, ...update } } : p));
  };

  const handleSaveCustomerCard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCustomerId) return;
    if (!customerCardForm.firstName.trim() || !customerCardForm.lastName.trim()) {
      alert('שם פרטי ושם משפחה הם שדות חובה');
      return;
    }

    setIsSavingCustomerCard(true);
    try {
      const update = {
        firstName: customerCardForm.firstName.trim(),
        lastName: customerCardForm.lastName.trim(),
        phone: customerCardForm.phone.trim() || undefined,
        email: customerCardForm.email.trim() || undefined,
        address: customerCardForm.address.trim() || undefined,
        region: customerCardForm.region || undefined,
      };

      const res = await fetch(`/api/${tenantId}/customers/${editingCustomerId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(update),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to update customer');
      }

      applyCustomerUpdate(editingCustomerId, update);
      setIsCustomerCardOpen(false);
      setEditingCustomerId(null);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'שגיאה בעדכון הלקוח');
    } finally {
      setIsSavingCustomerCard(false);
    }
  };

  const handleUpdateCustomerRegion = async (customerId: string, region: string) => {
    setUpdatingRegionCustomerId(customerId);
    try {
      const res = await fetch(`/api/${tenantId}/customers/${customerId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ region: region || undefined }),
      });
      if (!res.ok) throw new Error('Failed to update region');

      applyCustomerUpdate(customerId, { region: (region || undefined) as Customer['region'] });
    } catch {
      alert('שגיאה בעדכון האזור');
    } finally {
      setUpdatingRegionCustomerId(null);
    }
  };

  const handleApproveCustomer = async (customerId: string) => {
    setApprovingCustomerId(customerId);
    try {
      const res = await fetch(`/api/${tenantId}/customers/${customerId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approved: true }),
      });
      if (!res.ok) throw new Error('Failed to approve customer');

      applyCustomerUpdate(customerId, { approved: true });
    } catch {
      alert('שגיאה באישור הלקוח');
    } finally {
      setApprovingCustomerId(null);
    }
  };

  // Copy customer URL

  const copyCustomerUrl = (customerId: string) => {
    const url = `${baseUrl}/${tenantId}/portal/${customerId}`;
    navigator.clipboard.writeText(url);

    setCopiedCustomerId(customerId);
    setTimeout(() => setCopiedCustomerId(null), 2000);
  };

  // ---- Drivers management ----

  const copyDriverUrl = (driverId: string) => {
    const url = `${baseUrl}/${tenantId}/driver/${driverId}`;
    navigator.clipboard.writeText(url);

    setCopiedDriverId(driverId);
    setTimeout(() => setCopiedDriverId(null), 2000);
  };

  const handleAddDriver = async () => {
    if (!newDriverName.trim()) {
      alert('שם הנהג הוא שדה חובה');
      return;
    }
    setIsSavingDriver(true);
    try {
      const res = await fetch(`/api/${tenantId}/drivers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newDriverName.trim(), phone: newDriverPhone.trim() || undefined }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to create driver');
      }

      const data = await res.json();
      setDriversList(prev => [...prev, data.driver]);
      setNewDriverName('');
      setNewDriverPhone('');
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'שגיאה בהוספת הנהג');
    } finally {
      setIsSavingDriver(false);
    }
  };

  const handleDeleteDriver = async (driverId: string) => {
    if (!window.confirm('האם אתה בטוח שברצונך למחוק נהג זה? קריאות המשויכות אליו יהפכו ללא משויכות והקישור האישי שלו יפסיק לעבוד.')) return;

    try {
      const res = await fetch(`/api/${tenantId}/drivers/${driverId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('שגיאה במחיקת הנהג');

      setDriversList(prev => prev.filter(d => d.id !== driverId));
      // Requests/orders assigned to him become unassigned locally, matching the server
      setRequests(prev => prev.map(r => r.driverId === driverId ? { ...r, driverId: undefined, driver: undefined } : r));
      setOrdersList(prev => prev.map(o => o.driverId === driverId ? { ...o, driverId: undefined, driver: undefined } : o));
    } catch {
      alert('שגיאה במחיקת הנהג');
    }
  };

  // Assign / unassign a driver on a request (admin only)
  const handleDriverChange = async (reqId: string, driverId: string | null) => {
    setUpdatingDriverRequestId(reqId);
    try {
      const res = await fetch(`/api/${tenantId}/requests/${reqId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ driverId }),
      });

      if (!res.ok) throw new Error('Failed to assign driver');

      const driver = driverId ? driversList.find(d => d.id === driverId) : undefined;
      setRequests(prev => prev.map(r => r.id === reqId ? { ...r, driverId: driverId || undefined, driver } : r));
    } catch {
      alert('שגיאה בשיוך הנהג');
    } finally {
      setUpdatingDriverRequestId(null);
    }
  };

  // ---- Part requests management ----

  const handleTogglePartRequestStatus = async (id: string, currentStatus: 'NEW' | 'FULFILLED' | 'READY_FOR_DISPATCH') => {
    const nextStatus = currentStatus === 'NEW' ? 'FULFILLED' : 'NEW';
    try {
      const res = await fetch(`/api/${tenantId}/parts-requests/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (!res.ok) throw new Error('Failed to update part request');

      setPartRequestsList(prev => prev.map(r => r.id === id ? { ...r, status: nextStatus } : r));
    } catch {
      alert('שגיאה בעדכון סטטוס הבקשה');
    }
  };

  const handleSendQuote = async (pr: PartRequest, price: number) => {
    try {
      const res = await fetch(`/api/${tenantId}/parts-requests/${pr.id}/quote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ price }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to send quote');

      setPartRequestsList(prev => prev.map(r => r.id === pr.id ? { ...r, quotePrice: price, quoteStatus: 'PENDING_APPROVAL', quoteSentAt: new Date().toISOString() } : r));
      
      if (data.whatsappSent) {
        alert('הצעת המחיר נשלחה ללקוח ב-WhatsApp! 🚀');
      } else {
        alert('הצעת המחיר נשמרה אך שליחת ה-WhatsApp נכשלה או לא הוגדרה.');
      }
    } catch (err: any) {
      alert(err.message || 'שגיאה בשליחת הצעת מחיר');
    }
  };

  const handleMarkPartReadyForDispatch = async (pr: PartRequest) => {
    try {
      const res = await fetch(`/api/${tenantId}/parts-requests/${pr.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'READY_FOR_DISPATCH' }),
      });
      if (!res.ok) throw new Error('Failed to update part request status');

      const data = await res.json();
      setPartRequestsList(prev => prev.map(r => r.id === pr.id ? { ...r, status: 'READY_FOR_DISPATCH' } : r));

      const customerPhone = pr.customer?.phone;
      if (data.autoNotifySent) {
        alert('הסטטוס עודכן ל"מוכן לשילוח" ונשלחה הודעת WhatsApp אוטומטית ללקוח! 🚀');
      } else if (customerPhone) {
        const cleanPhone = customerPhone.startsWith('0') ? '972' + customerPhone.slice(1) : customerPhone;
        const msg = encodeURIComponent(`שלום ${pr.customer?.firstName || 'לקוח'}, החלק שביקשת ("${pr.description}") ב-${businessName} מוכן וממתין לשילוח! 📦🚀`);
        window.open(`https://wa.me/${cleanPhone}?text=${msg}`, '_blank');
      } else {
        alert('הסטטוס עודכן ל"מוכן לשילוח".');
      }
    } catch {
      alert('שגיאה בעדכון סטטוס הבקשה ל"מוכן לשילוח"');
    }
  };

  const handleDeletePartRequest = async (id: string) => {
    if (!window.confirm('האם אתה בטוח שברצונך למחוק בקשת חלק זו?')) return;

    try {
      const res = await fetch(`/api/${tenantId}/parts-requests/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete part request');

      setPartRequestsList(prev => prev.filter(r => r.id !== id));
    } catch {
      alert('שגיאה במחיקת הבקשה');
    }
  };

  // ---- Orders management ----

  const handleAddOrder = async () => {
    const finalDeviceType = (newOrderDeviceType === 'other' ? newOrderCustomDeviceType : newOrderDeviceType).trim();
    const quantity = Number(newOrderQuantity);
    const unitPrice = Number(newOrderUnitPrice);

    if (!newOrderCustomerId) {
      alert('יש לבחור לקוח');
      return;
    }
    if (!finalDeviceType) {
      alert('סוג כלי הוא שדה חובה');
      return;
    }
    if (!Number.isFinite(quantity) || quantity <= 0) {
      alert('כמות לא תקינה');
      return;
    }
    if (!Number.isFinite(unitPrice) || unitPrice < 0) {
      alert('מחיר ליחידה לא תקין');
      return;
    }
    if (!newOrderRegion) {
      alert('יש לבחור אזור');
      return;
    }

    setIsSavingOrder(true);
    try {
      // Region lives on the customer, so persist it there if it changed/was set.
      const selectedCustomer = customersList.find(c => c.id === newOrderCustomerId);
      if (selectedCustomer && selectedCustomer.region !== newOrderRegion) {
        const regionRes = await fetch(`/api/${tenantId}/customers/${newOrderCustomerId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ region: newOrderRegion }),
        });
        if (!regionRes.ok) {
          const errorData = await regionRes.json();
          throw new Error(errorData.error || 'שגיאה בעדכון האזור');
        }
        applyCustomerUpdate(newOrderCustomerId, { region: newOrderRegion });
      }

      const finalModel = (newOrderModel === 'custom' ? newOrderCustomModelText : newOrderModel).trim();

      const res = await fetch(`/api/${tenantId}/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: newOrderCustomerId,
          deviceType: finalDeviceType,
          model: finalModel,
          quantity,
          unitPrice,
          driverId: newOrderDriverId || undefined,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to create order');
      }

      const data = await res.json();
      // Attach the joined driver so the new row renders it without a refetch.
      const driver = data.order.driverId ? driversList.find(d => d.id === data.order.driverId) : undefined;
      setOrdersList(prev => [{ ...data.order, driver }, ...prev]);
      setNewOrderCustomerId('');
      setNewOrderDeviceType(deviceModels[0] || 'קורקינט');
      setNewOrderCustomDeviceType('');
      setNewOrderQuantity('1');
      setNewOrderUnitPrice('');
      setNewOrderDriverId('');
      setNewOrderRegion('');
      setIsAddOrderModalOpen(false);
      if (data.autoNotifySent) {
        alert('ההזמנה נוצרה בהצלחה ונשלחה הודעת WhatsApp אוטומטית ללקוח! 🚀');
      } else {
        alert('ההזמנה נוצרה בהצלחה!');
      }
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'שגיאה בהוספת ההזמנה');
    } finally {
      setIsSavingOrder(false);
    }
  };

  const handleDeleteOrder = async (id: string) => {
    if (!window.confirm('האם אתה בטוח שברצונך למחוק הזמנה זו?')) return;

    try {
      const res = await fetch(`/api/${tenantId}/orders/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete order');

      setOrdersList(prev => prev.filter(o => o.id !== id));
    } catch {
      alert('שגיאה במחיקת ההזמנה');
    }
  };

  const handleOrderStatusChange = async (id: string, status: 'PENDING' | 'READY_FOR_DISPATCH' | 'FULFILLED' | 'CANCELLED') => {
    try {
      const res = await fetch(`/api/${tenantId}/orders/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error('Failed to update order status');

      const data = await res.json();
      setOrdersList(prev => prev.map(o => o.id === id ? { ...o, status } : o));

      if (data.autoNotifySent) {
        alert('הסטטוס עודכן ונשלחה התראת WhatsApp אוטומטית ללקוח! 🚀');
      }
    } catch {
      alert('שגיאה בעדכון סטטוס ההזמנה');
    }
  };

  const handleOrderDriverChange = async (orderId: string, driverId: string | null) => {
    setUpdatingDriverOrderId(orderId);
    try {
      const res = await fetch(`/api/${tenantId}/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ driverId }),
      });

      if (!res.ok) throw new Error('Failed to assign driver');

      const driver = driverId ? driversList.find(d => d.id === driverId) : undefined;
      setOrdersList(prev => prev.map(o => o.id === orderId ? { ...o, driverId: driverId || undefined, driver } : o));
    } catch {
      alert('שגיאה בשיוך הנהג להזמנה');
    } finally {
      setUpdatingDriverOrderId(null);
    }
  };

  // ---- Shared nav items (used by both the desktop sidebar and mobile drawer) ----

  const navItems: { key: typeof activeTab; label: string; icon: React.ElementType }[] = [
    { key: 'requests', label: 'קריאות שירות', icon: FileText },
    { key: 'customers', label: 'רשימת לקוחות', icon: User },
    { key: 'drivers', label: 'נהגים', icon: Truck },
    { key: 'agents', label: 'סוכני מכירות', icon: Briefcase },
    { key: 'partRequests', label: 'בקשות חלקים', icon: Package },
    { key: 'orders', label: 'הזמנת סחורה', icon: ShoppingCart },
    { key: 'chinaOrders', label: 'הזמנות חלקים בסין', icon: Boxes },
    { key: 'dispatch', label: 'לוח שילוח', icon: Route },
    { key: 'formBuilder', label: 'עיצוב הטופס', icon: SlidersHorizontal },
    { key: 'aiBot', label: 'בוט AI שירות לקוחות', icon: Bot },
  ];

  const handleNavSelect = (key: typeof activeTab) => {
    setActiveTab(key);
    setIsMobileSidebarOpen(false);
  };

  return (
    <div className="min-h-screen bg-[#f5f5f7] text-[#1d1d1f] font-sans antialiased pb-20" dir="rtl">
      <div className="flex flex-col md:flex-row print:hidden">
        {/* Mobile header (below md) */}
        <div className="md:hidden sticky top-0 z-40 bg-white/70 backdrop-blur-xl border-b border-gray-200/50">
          <div className="px-4 py-3 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <button
                onClick={() => setIsMobileSidebarOpen(true)}
                className="p-2 bg-white hover:bg-gray-100 rounded-lg text-gray-500 border border-gray-200 shadow-sm active:scale-95 transition-all cursor-pointer flex items-center justify-center flex-shrink-0"
                title="פתח תפריט"
                aria-label="פתח תפריט ניווט"
                aria-haspopup="true"
                aria-expanded={isMobileSidebarOpen}
              >
                <Menu className="w-4 h-4" />
              </button>
              <div className="w-8 h-8 rounded-lg overflow-hidden border bg-gray-50 flex items-center justify-center flex-shrink-0">
                {currentLogoUrl ? (
                  <img src={currentLogoUrl} alt="Logo" className="w-full h-full object-contain" />
                ) : (
                  <div className="w-full h-full bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white font-black text-xs">{currentBusinessName.charAt(0)}</div>
                )}
              </div>
              <span className="text-sm font-black text-gray-900 truncate">{currentBusinessName} <span className="font-normal text-blue-600">ניהול</span></span>
            </div>
            <button
              onClick={openSettingsModal}
              className="p-2 bg-white hover:bg-gray-100 rounded-lg text-gray-500 border border-gray-200 shadow-sm active:scale-95 transition-all cursor-pointer flex items-center justify-center flex-shrink-0"
              title="הגדרות עסק"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Mobile drawer backdrop */}
        {isMobileSidebarOpen && (
          <div
            className="md:hidden fixed inset-0 bg-black/40 z-40 backdrop-blur-sm"
            onClick={() => setIsMobileSidebarOpen(false)}
            aria-hidden="true"
          />
        )}

        {/* Mobile drawer sidebar */}
        <aside
          role="dialog"
          aria-modal="true"
          aria-label="תפריט ניווט"
          className={`md:hidden fixed inset-y-0 right-0 z-50 w-72 flex flex-col bg-white/95 backdrop-blur-xl border-l border-gray-200/50 px-4 py-6 overflow-y-auto shadow-2xl transition-transform duration-300 motion-reduce:transition-none ${
            isMobileSidebarOpen ? 'translate-x-0' : 'translate-x-full'
          }`}
        >
          <div className="flex items-center justify-between gap-3 mb-8 px-1">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl overflow-hidden border bg-gray-50 flex items-center justify-center shadow-lg shadow-blue-500/5 flex-shrink-0">
                {currentLogoUrl ? (
                  <img src={currentLogoUrl} alt="Logo" className="w-full h-full object-contain" />
                ) : (
                  <div className="w-full h-full bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white font-black text-xl">{currentBusinessName.charAt(0)}</div>
                )}
              </div>
              <span className="text-sm font-black tracking-tight bg-clip-text text-transparent bg-gradient-to-l from-gray-900 via-gray-800 to-blue-700 min-w-0 truncate">{currentBusinessName} <span className="font-normal text-blue-600">ניהול</span></span>
            </div>
            <button
              onClick={() => setIsMobileSidebarOpen(false)}
              className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-700 transition-colors cursor-pointer flex-shrink-0"
              title="סגור תפריט"
              aria-label="סגור תפריט ניווט"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <nav className="flex-1 space-y-1.5">
            {navItems.map(item => {
              const ItemIcon = item.icon;
              return (
                <button
                  key={item.key}
                  onClick={() => handleNavSelect(item.key)}
                  className={`w-full px-4 py-3 rounded-xl text-sm font-bold flex items-center gap-2.5 transition-all cursor-pointer ${
                    activeTab === item.key
                      ? (item.key === 'chinaOrders' ? 'bg-red-600 text-white shadow-md' : 'bg-gray-900 text-white shadow-md')
                      : (item.key === 'chinaOrders' ? 'text-red-600 hover:bg-red-50 font-black' : 'text-gray-600 hover:bg-gray-100')
                  }`}
                >
                  <ItemIcon className="w-4 h-4" />
                  {item.label}
                </button>
              );
            })}
          </nav>

          <div className="pt-4 mt-4 border-t border-gray-100">
            <button
              onClick={() => { openSettingsModal(); setIsMobileSidebarOpen(false); }}
              className="w-full px-4 py-2.5 hover:bg-gray-100 rounded-xl text-gray-500 active:scale-95 transition-all border border-gray-200/50 bg-white/80 shadow-sm cursor-pointer flex items-center gap-2.5 text-xs font-bold"
            >
              <Settings className="w-4 h-4" />
              הגדרות עסק
            </button>
          </div>
        </aside>

        {/* Desktop sidebar */}
        <aside className="hidden md:flex md:flex-col w-64 shrink-0 sticky top-0 h-screen bg-white/70 backdrop-blur-xl border-l border-gray-200/50 px-4 py-6 overflow-y-auto">
          <div className="flex items-center gap-3 mb-8 px-1">
            <div className="w-10 h-10 rounded-xl overflow-hidden border bg-gray-50 flex items-center justify-center shadow-lg shadow-blue-500/5 active:scale-95 transition-all cursor-pointer flex-shrink-0">
              {currentLogoUrl ? (
                <img src={currentLogoUrl} alt="Logo" className="w-full h-full object-contain" />
              ) : (
                <div className="w-full h-full bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white font-black text-xl">{currentBusinessName.charAt(0)}</div>
              )}
            </div>
            <span className="text-sm font-black tracking-tight bg-clip-text text-transparent bg-gradient-to-l from-gray-900 via-gray-800 to-blue-700 min-w-0 truncate">{currentBusinessName} <span className="font-normal text-blue-600">ניהול</span></span>
          </div>

          <nav className="flex-1 space-y-1.5">
            {navItems.map(item => {
              const ItemIcon = item.icon;
              return (
                <button
                  key={item.key}
                  onClick={() => setActiveTab(item.key)}
                  className={`w-full px-4 py-3 rounded-xl text-sm font-bold flex items-center gap-2.5 transition-all cursor-pointer ${
                    activeTab === item.key
                      ? (item.key === 'chinaOrders' ? 'bg-red-600 text-white shadow-md' : 'bg-gray-900 text-white shadow-md')
                      : (item.key === 'chinaOrders' ? 'text-red-600 hover:bg-red-50 font-black' : 'text-gray-600 hover:bg-gray-100')
                  }`}
                >
                  <ItemIcon className="w-4 h-4" />
                  {item.label}
                </button>
              );
            })}
          </nav>

          <div className="pt-4 mt-4 border-t border-gray-100">
            <button
              onClick={openSettingsModal}
              className="w-full px-4 py-2.5 hover:bg-gray-100 rounded-xl text-gray-500 active:scale-95 transition-all border border-gray-200/50 bg-white/80 shadow-sm cursor-pointer flex items-center gap-2.5 text-xs font-bold"
            >
              <Settings className="w-4 h-4" />
              הגדרות עסק
            </button>
          </div>
        </aside>

        {/* Content Pane */}
        <div className="flex-1 min-w-0">
      <main className="w-full px-4 md:px-8 lg:px-12 pt-6 md:pt-10">
        {activeTab === 'requests' && (
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
                    setAdminSelectedDriverId('');
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
                      <th className="p-5">נהג</th>
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
                              <div className="flex items-center gap-1.5 justify-start flex-wrap">
                                <span>{req.customer?.firstName} {req.customer?.lastName}</span>
                                {req.agentName && (
                                  <span className="px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-200/60 rounded-full text-[10px] font-bold flex items-center gap-1 shadow-2xs">
                                    👔 סוכן: {req.agentName}
                                  </span>
                                )}
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
                            <td className="p-5 text-gray-400 text-sm font-mono">
                              {formatDate(req.createdAt)}
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
                            {/* Driver Assignment Select */}
                            <td className="p-5">
                              {driversList.length === 0 ? (
                                <span className="text-gray-300 text-xs font-bold">-</span>
                              ) : (
                                <select
                                  value={req.driverId || ''}
                                  onChange={(e) => handleDriverChange(req.id, e.target.value || null)}
                                  disabled={updatingDriverRequestId === req.id}
                                  className={`px-3 py-1.5 rounded-xl text-xs font-bold border cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all ${
                                    !req.driverId && multiDriver
                                      ? 'bg-red-50 text-red-600 border-red-200 font-black animate-pulse'
                                      : req.driverId
                                        ? 'bg-cyan-50/70 text-cyan-700 border-cyan-100'
                                        : 'bg-gray-50 text-gray-500 border-gray-200'
                                  }`}
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
                                  <option value="" className="bg-white text-gray-800 font-semibold">
                                    {multiDriver ? 'שייך נהג!' : 'ללא נהג'}
                                  </option>
                                  {driversList.map(d => (
                                    <option key={d.id} value={d.id} className="bg-white text-gray-800 font-semibold">
                                      {d.name}
                                    </option>
                                  ))}
                                </select>
                              )}
                            </td>
                            <td className="p-5 flex items-center justify-end gap-1.5">
                              {req.customer?.phone && (
                                <a
                                  href={`https://wa.me/${req.customer.phone.startsWith('0') ? '972' + req.customer.phone.slice(1) : req.customer.phone}?text=${encodeURIComponent(
                                    buildWhatsAppMessage(currentWhatsappTemplate, `${baseUrl}/${tenantId}/request/${req.customer.id}`, currentBusinessName)
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
                                onClick={() => openRequestDetails(req)}
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
                        <td colSpan={9} className="p-10 text-center text-gray-400 text-sm">
                          לא נמצאו קריאות שירות מתאימות.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
        {activeTab === 'customers' && (
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
                <select
                  value={customerRegionFilter}
                  onChange={(e) => setCustomerRegionFilter(e.target.value)}
                  className="px-4 py-3 sm:py-2.5 rounded-xl border border-gray-200 bg-gray-50/40 focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-gray-700 text-xs font-bold transition-all cursor-pointer"
                >
                  <option value="ALL">כל האזורים</option>
                  {REGIONS.map(r => (
                    <option key={r.key} value={r.key}>{r.label}</option>
                  ))}
                </select>
                <button
                  onClick={() => setIsAddCustomerModalOpen(true)}
                  className="px-5 py-3 sm:py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-blue-500/10 transition-all duration-200 active:scale-[0.98] cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  הוסף לקוח חדש
                </button>
                <button
                  onClick={copyCustomerLoginUrl}
                  className={`px-4 py-3 sm:py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all duration-200 active:scale-[0.98] cursor-pointer border shadow-sm ${
                    copiedCustomerLoginUrl
                      ? 'bg-emerald-600 text-white border-emerald-600'
                      : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                  }`}
                  title="העתק קישור לדף הכניסה של הלקוחות"
                >
                  <Copy className="w-4 h-4" />
                  {copiedCustomerLoginUrl ? 'קישור הכניסה הועתק!' : 'העתק קישור כניסה ללקוחות'}
                </button>
                <button
                  onClick={copyAgentPartRequestUrl}
                  className={`px-4 py-3 sm:py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all duration-200 active:scale-[0.98] cursor-pointer border shadow-sm ${
                    copiedAgentPartUrl
                      ? 'bg-emerald-600 text-white border-emerald-600'
                      : 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100'
                  }`}
                  title="העתק קישור סוכן לבקשת חלק"
                >
                  <Package className="w-4 h-4" />
                  {copiedAgentPartUrl ? 'קישור סוכן לבקשת חלק הועתק!' : 'העתק קישור סוכן לבקשת חלק'}
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
                      <th className="p-5">אזור</th>
                      <th className="p-5 text-center">קישור לטופס ופעולות</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200/40">
                    {filteredCustomers.length > 0 ? (
                      filteredCustomers.slice(0, 100).map((cust) => (
                        <tr key={cust.id} className="hover:bg-gray-50/50 transition-colors">
                          <td className="p-5 font-bold text-gray-800">
                            <div className="flex items-center gap-2">
                              <span>{cust.firstName} {cust.lastName}</span>
                              {cust.approved === false && (
                                <span className="text-[10px] font-bold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-md border border-amber-200">
                                  ממתין לאישור
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="p-5 text-gray-600 font-mono text-sm">{cust.phone || '-'}</td>
                          <td className="p-5 text-gray-500 text-sm">{cust.address || 'לא צוינה כתובת'}</td>
                          <td className="p-5">
                            <select
                              value={cust.region || ''}
                              onChange={(e) => handleUpdateCustomerRegion(cust.id, e.target.value)}
                              disabled={updatingRegionCustomerId === cust.id}
                              className={`px-3 py-1.5 rounded-xl text-xs font-bold border cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all ${
                                cust.region ? 'bg-cyan-50/70 text-cyan-700 border-cyan-100' : 'bg-gray-50 text-gray-500 border-gray-200'
                              }`}
                            >
                              <option value="">ללא אזור</option>
                              {REGIONS.map(r => (
                                <option key={r.key} value={r.key}>{r.label}</option>
                              ))}
                            </select>
                          </td>
                          <td className="p-5 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              {/* Approve Customer Button */}
                              {cust.approved === false && (
                                <button
                                  onClick={() => handleApproveCustomer(cust.id)}
                                  disabled={approvingCustomerId === cust.id}
                                  className="px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm active:scale-[0.98] border border-emerald-100/50 cursor-pointer disabled:opacity-50"
                                  title="אשר גישת לקוח לפורטל"
                                >
                                  {approvingCustomerId === cust.id ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  ) : (
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                  )}
                                  אשר לקוח
                                </button>
                              )}

                              {/* Edit Customer Button */}
                              <button
                                onClick={() => openCustomerCard(cust)}
                                className="p-2 bg-gray-50 hover:bg-gray-100 text-gray-500 rounded-xl transition-all flex items-center justify-center shadow-sm active:scale-[0.98] border border-gray-200/70 cursor-pointer"
                                title="עריכת פרטי לקוח"
                                aria-label="עריכת פרטי לקוח"
                              >
                                <Pencil className="w-4 h-4" />
                              </button>

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

                              {/* WhatsApp Portal Link Share */}
                              {cust.phone && (
                                <a
                                  href={`https://wa.me/${cust.phone.replace(/\D/g, '').startsWith('0') ? '972' + cust.phone.replace(/\D/g, '').slice(1) : cust.phone.replace(/\D/g, '')}?text=${encodeURIComponent(
                                    `שלום ${cust.firstName},\nזהו הקישור האישי שלך לפורטל קריאות השירות ב-${currentBusinessName}:\n${baseUrl}/${tenantId}/portal/${cust.id}`
                                  )}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="p-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 rounded-xl transition-all flex items-center justify-center shadow-sm active:scale-[0.98] border border-emerald-100/50 cursor-pointer"
                                  title="שלח קישור אישי ב-WhatsApp"
                                >
                                  <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                                    <path d="M12.012 2c-5.506 0-9.989 4.478-9.99 9.984a9.96 9.96 0 001.33 4.982L2 22l5.164-1.355a9.96 9.96 0 004.843 1.258h.005c5.507 0 9.99-4.478 9.99-9.984 0-2.667-1.04-5.172-2.927-7.058C17.188 3.037 14.686 2 12.012 2zm6.002 14.129c-.247.697-1.2 1.286-1.65 1.343-.45.056-.89.102-2.93-.733-2.61-1.066-4.29-3.72-4.42-3.896-.13-.176-1.05-1.394-1.05-2.66 0-1.266.66-1.89.89-2.137.23-.247.5-.31.67-.31.17 0 .34.01.49.017.16.006.37-.063.58.448.22.54.74 1.808.81 1.948.07.14.12.3.02.49-.09.19-.14.31-.29.48-.14.17-.3.38-.43.51-.15.15-.3.31-.13.6.17.29.75 1.235 1.61 2.002.73.655 1.34.858 1.63.987.29.128.46.108.63-.092.17-.2.74-.858.94-1.152.2-.294.4-.247.67-.147.27.1.1.27.81 1.152.07.14.07.29.02.49v-.004z"/>
                                  </svg>
                                </a>
                              )}

                              {/* Copy Customer Portal Link */}
                              <button
                                onClick={() => copyCustomerPortalUrl(cust)}
                                className={`p-2 rounded-xl transition-all flex items-center justify-center shadow-sm active:scale-[0.98] border cursor-pointer ${
                                  copiedPortalCustId === cust.id
                                    ? 'bg-emerald-600 text-white border-emerald-600'
                                    : 'bg-blue-50 hover:bg-blue-100 text-blue-600 border-blue-100/50'
                                }`}
                                title="העתק קישור לפורטל הלקוח"
                              >
                                <Copy className="w-4 h-4" />
                              </button>
                              
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
                        <td colSpan={5} className="p-10 text-center text-gray-400 text-sm">
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

        {activeTab === 'drivers' && (
          <div className="space-y-6">
            <div className="bg-white/80 backdrop-blur-md rounded-3xl border border-white/60 shadow-[0_8px_30px_rgb(0,0,0,0.02)] p-6 space-y-4">
              <h3 className="text-sm font-black text-gray-900 flex items-center gap-2">
                <Truck className="w-4 h-4 text-blue-600" />
                נהגים
              </h3>
              <p className="text-[10px] text-gray-400 leading-relaxed">
                לכל נהג נוצר קישור אישי וסודי לפאנל הנהג שלו, שבו יופיעו רק הקריאות המשויכות אליו.
                אם קיים נהג אחד בלבד — כל קריאה חדשה תשויך אליו אוטומטית. אם יש יותר מנהג אחד — יש לשייך נהג לכל קריאה מטבלת הקריאות.
              </p>

              {/* Existing Drivers List */}
              {driversList.length > 0 && (
                <div className="space-y-2">
                  {driversList.map(d => (
                    <div key={d.id} className="p-3 bg-gray-50/70 border border-gray-100 rounded-2xl flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <strong className="text-sm text-gray-800 font-bold block truncate">{d.name}</strong>
                        {d.phone && <span className="text-[10px] text-gray-400 font-mono block" dir="ltr">{d.phone}</span>}
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {/* Copy personal link */}
                        <button
                          type="button"
                          onClick={() => copyDriverUrl(d.id)}
                          className={`px-3 py-2 rounded-xl text-[10px] font-bold transition-all shadow-sm active:scale-[0.98] border border-blue-100/50 cursor-pointer ${
                            copiedDriverId === d.id
                              ? 'bg-green-500 border-green-500 text-white'
                              : 'bg-blue-50 text-blue-600 hover:bg-blue-100'
                          }`}
                          title="העתק קישור אישי לפאנל הנהג"
                        >
                          <Copy className="w-3 h-3 inline-block ml-1" />
                          {copiedDriverId === d.id ? 'הועתק!' : 'העתק קישור'}
                        </button>

                        {/* WhatsApp share */}
                        {d.phone && (
                          <a
                            href={`https://wa.me/${d.phone.startsWith('0') ? '972' + d.phone.slice(1) : d.phone}?text=${encodeURIComponent(
                              `שלום ${d.name},\nזהו הקישור האישי שלך לפאנל הנהג של ${currentBusinessName}:\n${baseUrl}/${tenantId}/driver/${d.id}`
                            )}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 bg-green-50 hover:bg-green-100 text-green-600 rounded-xl transition-all flex items-center justify-center shadow-sm active:scale-[0.98] border border-green-100/50 cursor-pointer"
                            title="שלח קישור אישי בוואטסאפ"
                          >
                            <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                              <path d="M12.012 2c-5.506 0-9.989 4.478-9.99 9.984a9.96 9.96 0 001.33 4.982L2 22l5.164-1.355a9.96 9.96 0 004.843 1.258h.005c5.507 0 9.99-4.478 9.99-9.984 0-2.667-1.04-5.172-2.927-7.058C17.188 3.037 14.686 2 12.012 2zm6.002 14.129c-.247.697-1.2 1.286-1.65 1.343-.45.056-.89.102-2.93-.733-2.61-1.066-4.29-3.72-4.42-3.896-.13-.176-1.05-1.394-1.05-2.66 0-1.266.66-1.89.89-2.137.23-.247.5-.31.67-.31.17 0 .34.01.49.017.16.006.37-.063.58.448.22.54.74 1.808.81 1.948.07.14.12.3.02.49-.09.19-.14.31-.29.48-.14.17-.3.38-.43.51-.15.15-.3.31-.13.6.17.29.75 1.235 1.61 2.002.73.655 1.34.858 1.63.987.29.128.46.108.63-.092.17-.2.74-.858.94-1.152.2-.294.4-.247.67-.147.27.1.1.27.81 1.152.07.14.07.29.02.49v-.004z"/>
                            </svg>
                          </a>
                        )}

                        {/* Open panel */}
                        <a
                          href={`/${tenantId}/driver/${d.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-xl transition-all flex items-center justify-center shadow-sm active:scale-[0.98] border border-indigo-100/50 cursor-pointer"
                          title="פתח את פאנל הנהג"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </a>

                        {/* Delete driver */}
                        <button
                          type="button"
                          onClick={() => handleDeleteDriver(d.id)}
                          className="p-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl transition-all shadow-sm active:scale-[0.98] border border-red-100/50 cursor-pointer"
                          title="מחק נהג"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Add Driver Form */}
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  placeholder="שם הנהג *"
                  value={newDriverName}
                  onChange={(e) => setNewDriverName(e.target.value)}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:bg-white text-gray-800 text-xs transition-all"
                />
                <input
                  type="tel"
                  placeholder="טלפון (אופציונלי)"
                  value={newDriverPhone}
                  onChange={(e) => setNewDriverPhone(e.target.value)}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:bg-white text-gray-800 text-xs transition-all"
                  dir="ltr"
                />
                <button
                  type="button"
                  onClick={handleAddDriver}
                  disabled={isSavingDriver}
                  className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-md shadow-blue-500/10 transition-all active:scale-[0.98] cursor-pointer disabled:opacity-50"
                >
                  {isSavingDriver ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Plus className="w-3.5 h-3.5" />
                  )}
                  הוסף נהג
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'agents' && (
          <div className="space-y-6">
            <div className="bg-white/80 backdrop-blur-md rounded-3xl border border-white/60 shadow-[0_8px_30px_rgb(0,0,0,0.02)] p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-black text-gray-900 flex items-center gap-2">
                    <Briefcase className="w-4 h-4 text-blue-600" />
                    סוכני מכירות במערכת ({agentsList.length})
                  </h3>
                  <p className="text-xs text-gray-500 mt-1">
                    סוכני מכירות יכולים לפתוח קריאות שירות, הזמנות סחורה ובקשות חלקים מפורטל ייעודי מאובטח.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsAddAgentModalOpen(true)}
                  className="px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-md shadow-blue-500/10 transition-all active:scale-[0.98] cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  הוסף סוכן מכירות
                </button>
              </div>

              {agentsList.length === 0 ? (
                <div className="text-center py-12 bg-gray-50/50 rounded-2xl border border-dashed border-gray-200">
                  <Briefcase className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500 text-sm font-bold">אין סוכני מכירות מוגדרים במערכת</p>
                  <p className="text-gray-400 text-xs mt-1">לחץ על "הוסף סוכן מכירות" כדי ליצור סוכן חדש ולקבל עבורו קישור לפורטל.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {agentsList.map((agent) => (
                    <div
                      key={agent.id}
                      className="bg-white p-5 rounded-2xl border border-gray-150 shadow-sm space-y-4 hover:shadow-md transition-all"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 font-bold text-sm">
                            💼
                          </div>
                          <div>
                            <h4 className="font-bold text-gray-900 text-sm">{agent.name}</h4>
                            <p className="text-xs text-gray-500" dir="ltr">{agent.phone}</p>
                            {(agent.passwordPlain || agent.password) && (
                              <p className="text-[11px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100 inline-block mt-1">
                                🔑 סיסמה: {agent.passwordPlain || agent.password}
                              </p>
                            )}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDeleteAgent(agent.id)}
                          disabled={deletingAgentId === agent.id}
                          className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all cursor-pointer"
                          title="מחק סוכן"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="pt-3 border-t border-gray-100 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => copyAgentPortalUrl(agent.token)}
                          className="flex-1 py-2 px-3 bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-700 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          {copiedAgentToken === agent.token ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-green-600" />
                              <span className="text-green-600">הועתק!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5 text-gray-500" />
                              <span>העתק קישור לפורטל</span>
                            </>
                          )}
                        </button>

                        {agent.phone && (
                          <a
                            href={`https://wa.me/${agent.phone.startsWith('0') ? '972' + agent.phone.slice(1) : agent.phone}?text=${encodeURIComponent(
                              `שלום ${agent.name},\nזהו הקישור האישי שלך לפורטל סוכן המכירות של ${currentBusinessName}:\n${baseUrl}/${tenantId}/agent/${agent.token}`
                            )}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 bg-green-50 hover:bg-green-100 text-green-600 border border-green-200/50 rounded-xl transition-all flex items-center justify-center cursor-pointer shadow-sm"
                            title="שלח קישור לפורטל ב-WhatsApp"
                          >
                            <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                              <path d="M12.012 2c-5.506 0-9.989 4.478-9.99 9.984a9.96 9.96 0 001.33 4.982L2 22l5.164-1.355a9.96 9.96 0 004.843 1.258h.005c5.507 0 9.99-4.478 9.99-9.984 0-2.667-1.04-5.172-2.927-7.058C17.188 3.037 14.686 2 12.012 2zm6.002 14.129c-.247.697-1.2 1.286-1.65 1.343-.45.056-.89.102-2.93-.733-2.61-1.066-4.29-3.72-4.42-3.896-.13-.176-1.05-1.394-1.05-2.66 0-1.266.66-1.89.89-2.137.23-.247.5-.31.67-.31.17 0 .34.01.49.017.16.006.37-.063.58.448.22.54.74 1.808.81 1.948.07.14.12.3.02.49-.09.19-.14.31-.29.48-.14.17-.3.38-.43.51-.15.15-.3.31-.13.6.17.29.75 1.235 1.61 2.002.73.655 1.34.858 1.63.987.29.128.46.108.63-.092.17-.2.74-.858.94-1.152.2-.294.4-.247.67-.147.27.1.1.27.81 1.152.07.14.07.29.02.49v-.004z"/>
                            </svg>
                          </a>
                        )}

                        <a
                          href={`/${tenantId}/agent/${agent.token}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2 bg-blue-50 hover:bg-blue-100 text-blue-600 border border-blue-100 rounded-xl transition-all flex items-center justify-center cursor-pointer shadow-sm"
                          title="פתח פורטל"
                        >
                          <Eye className="w-4 h-4" />
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'partRequests' && (
          <div className="space-y-6">
            <div className="bg-white/80 backdrop-blur-md p-4 rounded-3xl border border-white/60 shadow-[0_8px_30px_rgb(0,0,0,0.02)] flex flex-col md:flex-row gap-4 items-center justify-between">
              <div className="relative w-full md:w-96">
                <input
                  type="text"
                  placeholder="חיפוש לפי לקוח, טלפון או תיאור החלק..."
                  value={partRequestSearch}
                  onChange={(e) => setPartRequestSearch(e.target.value)}
                  className="w-full pl-4 pr-11 py-3 sm:py-2.5 rounded-xl border border-gray-200 bg-gray-50/40 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 text-gray-800 transition-all duration-200 text-sm font-medium"
                />
                <Search className="w-5 h-5 text-gray-400 absolute right-4 top-3" />
              </div>
              <span className="text-gray-400 text-xs font-bold bg-gray-100/80 px-3 py-1.5 rounded-xl border border-gray-200/20 whitespace-nowrap">
                נמצאו {filteredPartRequests.length} בקשות
              </span>
            </div>

            <div className="bg-white/80 backdrop-blur-md rounded-3xl border border-white/60 shadow-[0_8px_30px_rgb(0,0,0,0.02)] p-6 space-y-4">
              <h3 className="text-sm font-black text-gray-900 flex items-center gap-2">
                <Package className="w-4 h-4 text-[#0F9E1D]" />
                בקשות חלקים
              </h3>
              <p className="text-[10px] text-gray-400 leading-relaxed">
                בקשות חלק שנשלחו על ידי לקוחות דרך הפורטל האישי שלהם, כולל תמונת החלק המבוקש.
              </p>

              {filteredPartRequests.length === 0 ? (
                <div className="p-10 text-center text-gray-400 text-sm">
                  {partRequestsList.length === 0 ? 'עדיין לא נשלחו בקשות חלקים.' : 'לא נמצאו בקשות חלקים תואמות לחיפוש.'}
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredPartRequests.map(pr => (
                    <div key={pr.id} className="p-3 bg-gray-50/70 border border-gray-100 rounded-2xl flex items-center gap-3">
                      <div className="w-14 h-14 rounded-xl overflow-hidden border bg-white flex-shrink-0">
                        {/* Thumbnail loads on demand from the image endpoint (lazy),
                            so part-request photos never bloat the page payload. */}
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={`/api/${tenantId}/parts-requests/${pr.id}/image`} alt="תמונת חלק" loading="lazy" className="w-full h-full object-cover" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <strong className="text-sm text-gray-800 font-bold flex items-center gap-1.5 truncate">
                          <span>{pr.customer ? `${pr.customer.firstName} ${pr.customer.lastName}` : 'לקוח לא ידוע'}</span>
                          {pr.agentName && (
                            <span className="px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-200/60 rounded-full text-[10px] font-bold flex items-center gap-1 shadow-2xs">
                              👔 סוכן: {pr.agentName}
                            </span>
                          )}
                        </strong>
                        {pr.customer?.phone && <span className="text-[10px] text-gray-400 font-mono block" dir="ltr">{pr.customer.phone}</span>}
                        <span className="text-xs text-gray-600 block mt-1 truncate">{pr.description}</span>
                        <span className="text-[10px] text-gray-400 block mt-0.5">{formatDate(pr.createdAt)}</span>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <Link
                          href={`/${tenantId}/part/${pr.id}`}
                          target="_blank"
                          className="p-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl transition-all shadow-sm active:scale-[0.98] border border-gray-200 cursor-pointer"
                          title="צפה בפרטי הבקשה והתמונה"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </Link>
                        {pr.customer?.phone && (
                          <a
                            href={`https://wa.me/${pr.customer.phone.startsWith('0') ? '972' + pr.customer.phone.slice(1) : pr.customer.phone}?text=${encodeURIComponent(`שלום ${pr.customer.firstName}, קיבלנו את בקשת החלק שלך: "${pr.description}". אשמח לסייע בהמשך ההזמנה!`)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 bg-green-50 hover:bg-green-100 text-green-600 rounded-xl transition-all shadow-sm active:scale-[0.98] border border-green-100/50 cursor-pointer"
                            title="פתח שיחת WhatsApp עם הלקוח"
                          >
                            <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                              <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.003 5.37 5.378 0 12.003 0a11.94 11.94 0 0 1 8.484 3.513 11.94 11.94 0 0 1 3.51 8.49c-.003 6.63-5.378 12-12.003 12-1.996-.001-3.957-.502-5.709-1.455L0 24zm6.59-14.859c-.12-.2-.24-.2-.35-.2-.11 0-.24-.03-.36-.03-.13 0-.34.05-.52.25-.18.2-.68.66-.68 1.6s.69 1.86.78 2.06c.1.13 1.36 2.07 3.29 2.91.46.2.82.32 1.1.41.47.15.89.13 1.22.08.38-.06 1.15-.47 1.31-.93.16-.46.16-.86.11-.93-.05-.08-.18-.13-.38-.23-.19-.1-.1.38-.1.74-.11.16-.36.23-.74.13-.38-.11-1.42-.52-2.71-1.68-.96-.86-1.61-1.92-1.8-2.25-.19-.33-.02-.51.15-.68.15-.15.33-.36.5-.54.17-.18.23-.3.33-.5.1-.2.05-.38-.03-.48z" />
                            </svg>
                          </a>
                        )}
                        {/* Quote System */}
                        <div className="flex items-center gap-2">
                          {pr.quoteStatus === 'APPROVED' && (
                            <span className="px-3 py-2 rounded-xl text-[10px] font-black bg-green-100 text-green-700 border border-green-200 shadow-sm flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              הצעה אושרה ({pr.quotePrice}₪)
                            </span>
                          )}
                          {pr.quoteStatus === 'PENDING_APPROVAL' && (
                            <span className="px-3 py-2 rounded-xl text-[10px] font-black bg-yellow-100 text-yellow-700 border border-yellow-200 shadow-sm flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5" />
                              ממתין לאישור הלקוח
                            </span>
                          )}
                          {(pr.quoteStatus === 'NONE' || !pr.quoteStatus) && (
                            <>
                              {activeQuoteId === pr.id ? (
                                <div className="flex items-center gap-1 bg-white border border-blue-200 p-1 rounded-xl shadow-sm">
                                  <input 
                                    type="number" 
                                    value={activeQuotePrice} 
                                    onChange={(e) => setActiveQuotePrice(e.target.value)}
                                    placeholder="מחיר..."
                                    className="w-20 px-2 py-1 text-xs border-none focus:ring-0"
                                  />
                                  <button
                                    onClick={() => {
                                      if (activeQuotePrice && !isNaN(Number(activeQuotePrice))) {
                                        handleSendQuote(pr, Number(activeQuotePrice));
                                        setActiveQuoteId(null);
                                        setActiveQuotePrice('');
                                      }
                                    }}
                                    className="p-1.5 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-lg"
                                  >
                                    <Send className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => {
                                      setActiveQuoteId(null);
                                      setActiveQuotePrice('');
                                    }}
                                    className="p-1.5 bg-gray-50 hover:bg-gray-100 text-gray-500 rounded-lg"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setActiveQuoteId(pr.id);
                                    setActiveQuotePrice('');
                                  }}
                                  className="px-3 py-2 rounded-xl text-[10px] font-bold transition-all shadow-sm active:scale-[0.98] border cursor-pointer flex items-center gap-1 bg-blue-50 hover:bg-blue-100 border-blue-200/60 text-blue-600"
                                  title="צור הצעת מחיר לחלק"
                                >
                                  <FileText className="w-3.5 h-3.5" />
                                  <span>הצעת מחיר</span>
                                </button>
                              )}
                            </>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() => handleMarkPartReadyForDispatch(pr)}
                          className={`px-3 py-2 rounded-xl text-[10px] font-bold transition-all shadow-sm active:scale-[0.98] border cursor-pointer flex items-center gap-1 ${
                            pr.status === 'READY_FOR_DISPATCH'
                              ? 'bg-purple-100 border-purple-200 text-purple-700 font-black'
                              : 'bg-purple-50 hover:bg-purple-100 border-purple-200/60 text-purple-600'
                          }`}
                          title="עדכן שהחלק מוכן לשילוח ושלח התראה ללקוח בוואטסאפ"
                        >
                          <Truck className="w-3.5 h-3.5" />
                          <span>{pr.status === 'READY_FOR_DISPATCH' ? 'נשלחה התרעה (מוכן)' : 'מוכן לשילוח'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleTogglePartRequestStatus(pr.id, pr.status)}
                          className={`px-3 py-2 rounded-xl text-[10px] font-bold transition-all shadow-sm active:scale-[0.98] border cursor-pointer ${
                            pr.status === 'FULFILLED'
                              ? 'bg-green-50 border-green-100/50 text-green-600 hover:bg-green-100'
                              : 'bg-blue-50 border-blue-100/50 text-blue-600 hover:bg-blue-100'
                          }`}
                        >
                          {pr.status === 'FULFILLED' ? 'טופל' : pr.status === 'READY_FOR_DISPATCH' ? 'מוכן לשילוח' : 'חדש'}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeletePartRequest(pr.id)}
                          className="p-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl transition-all shadow-sm active:scale-[0.98] border border-red-100/50 cursor-pointer"
                          title="מחק בקשה"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'orders' && (
          <div className="space-y-6">
            <div className="bg-white/80 backdrop-blur-md p-4 rounded-3xl border border-white/60 shadow-[0_8px_30px_rgb(0,0,0,0.02)] flex flex-col md:flex-row gap-4 items-center justify-between">
              <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto items-stretch sm:items-center">
                <div className="relative w-full sm:w-72">
                  <input
                    type="text"
                    placeholder="חיפוש הזמנה לפי לקוח או סוג מכשיר..."
                    value={orderSearch}
                    onChange={(e) => setOrderSearch(e.target.value)}
                    className="w-full pl-4 pr-11 py-3 sm:py-2.5 rounded-xl border border-gray-200 bg-gray-50/40 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 text-gray-800 transition-all duration-200 text-sm font-medium"
                  />
                  <Search className="w-5 h-5 text-gray-400 absolute right-4 top-3" />
                </div>
                <select
                  value={orderRegionFilter}
                  onChange={(e) => setOrderRegionFilter(e.target.value)}
                  className="px-4 py-3 sm:py-2.5 rounded-xl border border-gray-200 bg-gray-50/40 focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-gray-700 text-xs font-bold transition-all cursor-pointer"
                >
                  <option value="ALL">כל האזורים</option>
                  {REGIONS.map(r => (
                    <option key={r.key} value={r.key}>{r.label}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setIsAddOrderModalOpen(true)}
                  className="px-5 py-3 sm:py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-blue-500/10 transition-all duration-200 active:scale-[0.98] cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  הזמנה חדשה
                </button>
              </div>
              <span className="text-gray-400 text-xs font-bold bg-gray-100/80 px-3 py-1.5 rounded-xl border border-gray-200/20 whitespace-nowrap">נמצאו {filteredOrders.length} הזמנות</span>
            </div>

            <div className="bg-white/80 backdrop-blur-md rounded-3xl border border-white/60 shadow-[0_8px_30px_rgb(0,0,0,0.02)] p-6 space-y-4">
              {filteredOrders.length === 0 ? (
                <div className="p-10 text-center text-gray-400 text-sm">
                  {ordersList.length === 0 ? 'עדיין לא נוצרו הזמנות.' : 'לא נמצאו הזמנות תואמות לחיפוש.'}
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredOrders.map(order => (
                    <div key={order.id} className="p-3 bg-gray-50/70 border border-gray-100 rounded-2xl flex flex-col sm:flex-row sm:items-center gap-3">
                      <div className="w-11 h-11 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 flex-shrink-0">
                        <ShoppingCart className="w-5 h-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <strong className="text-sm text-gray-800 font-bold flex items-center gap-1.5 truncate">
                          <span>{order.customer ? `${order.customer.firstName} ${order.customer.lastName}` : 'לקוח לא ידוע'}</span>
                          {order.agentName && (
                            <span className="px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-200/60 rounded-full text-[10px] font-bold flex items-center gap-1 shadow-2xs">
                              👔 סוכן: {order.agentName}
                            </span>
                          )}
                        </strong>
                        <span className="text-xs text-gray-600 block mt-1 truncate">
                          {order.deviceType} {order.model ? `- ${order.model}` : ''} × {order.quantity} — ₪{order.unitPrice.toLocaleString('he-IL')} ליחידה
                        </span>
                        <span className="text-[10px] text-gray-400 block mt-0.5">{formatDate(order.createdAt)}</span>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0 flex-wrap">
                        <span className="px-3 py-2 rounded-xl text-[10px] font-bold bg-green-50 border border-green-100/50 text-green-600 font-mono">
                          ₪{order.totalPrice.toLocaleString('he-IL')}
                        </span>

                        {/* Customer Region */}
                        {order.customer && (
                          <select
                            value={order.customer.region || ''}
                            onChange={(e) => handleUpdateCustomerRegion(order.customerId, e.target.value)}
                            disabled={updatingRegionCustomerId === order.customerId}
                            className={`px-3 py-1.5 rounded-xl text-[10px] font-bold border cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all ${
                              order.customer.region ? 'bg-cyan-50/70 text-cyan-700 border-cyan-100' : 'bg-gray-50 text-gray-500 border-gray-200'
                            }`}
                          >
                            <option value="">ללא אזור</option>
                            {REGIONS.map(r => (
                              <option key={r.key} value={r.key}>{r.label}</option>
                            ))}
                          </select>
                        )}

                        {/* Driver Assignment */}
                        {driversList.length > 0 && (
                          <select
                            value={order.driverId || ''}
                            onChange={(e) => handleOrderDriverChange(order.id, e.target.value || null)}
                            disabled={updatingDriverOrderId === order.id}
                            className={`px-3 py-1.5 rounded-xl text-[10px] font-bold border cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all ${
                              order.driverId ? 'bg-cyan-50/70 text-cyan-700 border-cyan-100' : 'bg-gray-50 text-gray-500 border-gray-200'
                            }`}
                          >
                            <option value="">ללא נהג</option>
                            {driversList.map(d => (
                              <option key={d.id} value={d.id}>{d.name}</option>
                            ))}
                          </select>
                        )}

                        {/* Status */}
                        {(() => {
                          const statusObj = ORDER_STATUSES.find(s => s.key === order.status) || ORDER_STATUSES[0];
                          return (
                            <select
                              value={order.status}
                              onChange={(e) => handleOrderStatusChange(order.id, e.target.value as 'PENDING' | 'READY_FOR_DISPATCH' | 'FULFILLED' | 'CANCELLED')}
                              className={`px-3 py-1.5 rounded-xl text-[10px] font-bold border cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all ${statusObj.bg} ${statusObj.text} ${statusObj.border}`}
                            >
                              {ORDER_STATUSES.map(st => (
                                <option key={st.key} value={st.key}>{st.label}</option>
                              ))}
                            </select>
                          );
                        })()}
                        {order.customer?.phone && (
                          <a
                            href={`https://wa.me/${order.customer.phone.startsWith('0') ? '972' + order.customer.phone.slice(1) : order.customer.phone}?text=${encodeURIComponent(`שלום ${order.customer.firstName}, לגבי הזמנה #${order.orderNumber} ב-${businessName}`)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 bg-green-50 hover:bg-green-100 text-green-600 rounded-xl transition-all shadow-sm active:scale-[0.98] border border-green-100/50 cursor-pointer"
                            title="פתח שיחת WhatsApp עם הלקוח"
                          >
                            <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                              <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.003 5.37 5.378 0 12.003 0a11.94 11.94 0 0 1 8.484 3.513 11.94 11.94 0 0 1 3.51 8.49c-.003 6.63-5.378 12-12.003 12-1.996-.001-3.957-.502-5.709-1.455L0 24zm6.59-14.859c-.12-.2-.24-.2-.35-.2-.11 0-.24-.03-.36-.03-.13 0-.34.05-.52.25-.18.2-.68.66-.68 1.6s.69 1.86.78 2.06c.1.13 1.36 2.07 3.29 2.91.46.2.82.32 1.1.41.47.15.89.13 1.22.08.38-.06 1.15-.47 1.31-.93.16-.46.16-.86.11-.93-.05-.08-.18-.13-.38-.23-.19-.1-.1.38-.1.74-.11.16-.36.23-.74.13-.38-.11-1.42-.52-2.71-1.68-.96-.86-1.61-1.92-1.8-2.25-.19-.33-.02-.51.15-.68.15-.15.33-.36.5-.54.17-.18.23-.3.33-.5.1-.2.05-.38-.03-.48z" />
                            </svg>
                          </a>
                        )}

                        <button
                          type="button"
                          onClick={() => handleDeleteOrder(order.id)}
                          className="p-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl transition-all shadow-sm active:scale-[0.98] border border-red-100/50 cursor-pointer"
                          title="מחק הזמנה"
                          aria-label="מחק הזמנה"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'chinaOrders' && (
          <div className="space-y-6">
            {/* Pending technician submissions awaiting approval */}
            {pendingChinaOrders.length > 0 && (
              <div className="bg-white/80 backdrop-blur-md rounded-3xl border border-amber-200/70 shadow-[0_8px_30px_rgb(0,0,0,0.02)] p-6 space-y-4">
                <h3 className="text-sm font-black text-gray-900 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-amber-600" />
                  בקשות טכנאים ממתינות לאישור ({pendingChinaOrders.length})
                </h3>
                <div className="space-y-2">
                  {pendingChinaOrders.map(o => (
                    <div key={o.id} className="p-3 bg-amber-50/60 border border-amber-100 rounded-2xl flex items-center gap-3">
                      <div className="w-14 h-14 rounded-xl overflow-hidden border bg-white flex-shrink-0">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={`/api/${tenantId}/china-orders/${o.id}/image`} alt="תמונת חלק" loading="lazy" className="w-full h-full object-cover" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <strong className="text-sm text-gray-800 font-bold flex items-center gap-1.5 truncate">
                          <span>{o.partName}</span>
                          {o.technicianName && (
                            <span className="px-2 py-0.5 bg-red-50 text-red-700 border border-red-200/60 rounded-full text-[10px] font-bold flex items-center gap-1">
                              🔧 טכנאי: {o.technicianName}
                            </span>
                          )}
                        </strong>
                        <span className="text-xs text-gray-600 block mt-1 truncate">
                          כמות: {o.quantity}{o.factory ? ` · מפעל: ${o.factory}` : ''}
                        </span>
                        <span className="text-[10px] text-gray-400 block mt-0.5">{formatDate(o.createdAt)}</span>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <button
                          type="button"
                          onClick={() => handleApproveChinaOrder(o.id)}
                          disabled={updatingChinaOrderId === o.id}
                          className="px-3 py-2 rounded-xl text-[10px] font-bold bg-green-50 hover:bg-green-100 text-green-600 border border-green-100/50 transition-all cursor-pointer flex items-center gap-1"
                        >
                          <Check className="w-3.5 h-3.5" /> אשר
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteChinaOrder(o.id)}
                          className="px-3 py-2 rounded-xl text-[10px] font-bold bg-red-50 hover:bg-red-100 text-red-600 border border-red-100/50 transition-all cursor-pointer flex items-center gap-1"
                        >
                          <X className="w-3.5 h-3.5" /> דחה
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Orders toolbar */}
            <div className="bg-white/80 backdrop-blur-md p-4 rounded-3xl border border-white/60 shadow-[0_8px_30px_rgb(0,0,0,0.02)] flex flex-col md:flex-row gap-4 items-center justify-between">
              <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto items-stretch sm:items-center">
                <div className="relative w-full sm:w-72">
                  <input
                    type="text"
                    placeholder="חיפוש לפי שם חלק או מפעל..."
                    value={chinaOrderSearch}
                    onChange={(e) => setChinaOrderSearch(e.target.value)}
                    className="w-full pl-4 pr-11 py-3 sm:py-2.5 rounded-xl border border-gray-200 bg-gray-50/40 focus:outline-none focus:ring-4 focus:ring-red-500/10 focus:border-red-500 text-gray-800 transition-all duration-200 text-sm font-medium"
                  />
                  <Search className="w-5 h-5 text-gray-400 absolute right-4 top-3" />
                </div>
                <select
                  value={chinaStatusFilter}
                  onChange={(e) => setChinaStatusFilter(e.target.value)}
                  className="px-4 py-3 sm:py-2.5 rounded-xl border border-gray-200 bg-gray-50/40 focus:outline-none focus:ring-2 focus:ring-red-500/20 text-gray-700 text-xs font-bold transition-all cursor-pointer"
                >
                  <option value="ALL">כל הסטטוסים</option>
                  {CHINA_ORDER_STATUSES.map(s => (
                    <option key={s.key} value={s.key}>{s.label}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => { resetChinaOrderForm(); setIsAddChinaOrderModalOpen(true); }}
                  className="px-5 py-3 sm:py-2.5 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-red-500/10 transition-all duration-200 active:scale-[0.98] cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  הזמנה חדשה
                </button>
              </div>
              <span className="text-gray-400 text-xs font-bold bg-gray-100/80 px-3 py-1.5 rounded-xl border border-gray-200/20 whitespace-nowrap">נמצאו {filteredChinaOrders.length} הזמנות</span>
            </div>

            {/* Orders table */}
            <div className="bg-white/80 backdrop-blur-md rounded-3xl border border-white/60 shadow-[0_8px_30px_rgb(0,0,0,0.02)] p-6 space-y-4">
              {filteredChinaOrders.length === 0 ? (
                <div className="p-10 text-center text-gray-400 text-sm">
                  {activeChinaOrders.length === 0 ? 'עדיין לא נוצרו הזמנות חלקים מסין.' : 'לא נמצאו הזמנות תואמות לחיפוש.'}
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredChinaOrders.map(o => {
                    const statusObj = CHINA_ORDER_STATUSES.find(s => s.key === o.status) || CHINA_ORDER_STATUSES[0];
                    return (
                      <div key={o.id} className="p-3 bg-gray-50/70 border border-gray-100 rounded-2xl flex items-center gap-3">
                        <div className="w-14 h-14 rounded-xl overflow-hidden border bg-white flex-shrink-0">
                          {/* Thumbnail loads on demand from the image endpoint (lazy). */}
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={`/api/${tenantId}/china-orders/${o.id}/image`} alt="תמונת חלק" loading="lazy" className="w-full h-full object-cover" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <strong className="text-sm text-gray-800 font-bold flex items-center gap-1.5 truncate">
                            <span>{o.partName}</span>
                            {o.source === 'technician' && o.technicianName && (
                              <span className="px-2 py-0.5 bg-red-50 text-red-700 border border-red-200/60 rounded-full text-[10px] font-bold flex items-center gap-1">
                                🔧 {o.technicianName}
                              </span>
                            )}
                          </strong>
                          <span className="text-xs text-gray-600 block mt-1 truncate">
                            כמות: {o.quantity}{o.factory ? ` · מפעל: ${o.factory}` : ''}
                          </span>
                          <span className="text-[10px] text-gray-400 block mt-0.5">{formatDate(o.createdAt)}</span>
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0 flex-wrap">
                          <select
                            value={o.status}
                            onChange={(e) => handleChinaOrderStatusChange(o.id, e.target.value as ChinaOrder['status'])}
                            disabled={updatingChinaOrderId === o.id}
                            className={`px-3 py-1.5 rounded-xl text-[10px] font-bold border cursor-pointer focus:outline-none focus:ring-2 focus:ring-red-500/20 transition-all ${statusObj.bg} ${statusObj.text} ${statusObj.border}`}
                          >
                            {CHINA_ORDER_STATUSES.map(st => (
                              <option key={st.key} value={st.key}>{st.label}</option>
                            ))}
                          </select>
                          <button
                            type="button"
                            onClick={() => handleDeleteChinaOrder(o.id)}
                            className="p-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl transition-all shadow-sm active:scale-[0.98] border border-red-100/50 cursor-pointer"
                            title="מחק הזמנה"
                            aria-label="מחק הזמנה"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Technicians management */}
            <div className="bg-white/80 backdrop-blur-md rounded-3xl border border-white/60 shadow-[0_8px_30px_rgb(0,0,0,0.02)] p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-black text-gray-900 flex items-center gap-2">
                    <Wrench className="w-4 h-4 text-red-600" />
                    טכנאים ({techniciansList.length})
                  </h3>
                  <p className="text-xs text-gray-500 mt-1">
                    לכל טכנאי קישור אישי מאובטח בסיסמה להעלאת בקשות חלקים מסין. הבקשות ממתינות לאישורך.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsAddTechnicianModalOpen(true)}
                  className="px-4 py-2.5 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-md shadow-red-500/10 transition-all active:scale-[0.98] cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  הוסף טכנאי
                </button>
              </div>

              {techniciansList.length === 0 ? (
                <div className="text-center py-12 bg-gray-50/50 rounded-2xl border border-dashed border-gray-200">
                  <Wrench className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500 text-sm font-bold">אין טכנאים מוגדרים במערכת</p>
                  <p className="text-gray-400 text-xs mt-1">לחץ על "הוסף טכנאי" כדי ליצור טכנאי חדש ולקבל עבורו קישור אישי.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {techniciansList.map((tech) => (
                    <div key={tech.id} className="bg-white p-5 rounded-2xl border border-gray-150 shadow-sm space-y-4 hover:shadow-md transition-all">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-red-50 border border-red-100 flex items-center justify-center text-red-600 font-bold text-sm">
                            🔧
                          </div>
                          <div>
                            <h4 className="font-bold text-gray-900 text-sm">{tech.name}</h4>
                            <p className="text-xs text-gray-500" dir="ltr">{tech.phone}</p>
                            {(tech.passwordPlain || tech.password) && (
                              <p className="text-[11px] font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded border border-red-100 inline-block mt-1">
                                🔑 סיסמה: {tech.passwordPlain || tech.password}
                              </p>
                            )}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDeleteTechnician(tech.id)}
                          disabled={deletingTechnicianId === tech.id}
                          className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all cursor-pointer"
                          title="מחק טכנאי"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="pt-3 border-t border-gray-100 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => copyTechnicianPortalUrl(tech.token)}
                          className="flex-1 py-2 px-3 bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-700 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          {copiedTechnicianToken === tech.token ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-green-600" />
                              <span className="text-green-600">הועתק!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5 text-gray-500" />
                              <span>העתק קישור אישי</span>
                            </>
                          )}
                        </button>

                        {tech.phone && (
                          <a
                            href={`https://wa.me/${tech.phone.startsWith('0') ? '972' + tech.phone.slice(1) : tech.phone}?text=${encodeURIComponent(
                              `שלום ${tech.name},\nזהו הקישור האישי שלך להעלאת בקשות חלקים מסין ב-${currentBusinessName}:\n${baseUrl}/${tenantId}/technician/${tech.token}\n\nהסיסמה שלך: ${tech.passwordPlain || tech.password || ''}`
                            )}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 bg-green-50 hover:bg-green-100 text-green-600 border border-green-200/50 rounded-xl transition-all flex items-center justify-center cursor-pointer shadow-sm"
                            title="שלח קישור אישי ב-WhatsApp"
                          >
                            <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                              <path d="M12.012 2c-5.506 0-9.989 4.478-9.99 9.984a9.96 9.96 0 001.33 4.982L2 22l5.164-1.355a9.96 9.96 0 004.843 1.258h.005c5.507 0 9.99-4.478 9.99-9.984 0-2.667-1.04-5.172-2.927-7.058C17.188 3.037 14.686 2 12.012 2zm6.002 14.129c-.247.697-1.2 1.286-1.65 1.343-.45.056-.89.102-2.93-.733-2.61-1.066-4.29-3.72-4.42-3.896-.13-.176-1.05-1.394-1.05-2.66 0-1.266.66-1.89.89-2.137.23-.247.5-.31.67-.31.17 0 .34.01.49.017.16.006.37-.063.58.448.22.54.74 1.808.81 1.948.07.14.12.3.02.49-.09.19-.14.31-.29.48-.14.17-.3.38-.43.51-.15.15-.3.31-.13.6.17.29.75 1.235 1.61 2.002.73.655 1.34.858 1.63.987.29.128.46.108.63-.092.17-.2.74-.858.94-1.152.2-.294.4-.247.67-.147.27.1.1.27.81 1.152.07.14.07.29.02.49v-.004z"/>
                            </svg>
                          </a>
                        )}

                        <a
                          href={`/${tenantId}/technician/${tech.token}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2 bg-red-50 hover:bg-red-100 text-red-600 border border-red-100 rounded-xl transition-all flex items-center justify-center cursor-pointer shadow-sm"
                          title="פתח פורטל טכנאי"
                        >
                          <Eye className="w-4 h-4" />
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'dispatch' && (
          <div className="space-y-6">
            <div className="bg-white/80 backdrop-blur-md p-4 rounded-3xl border border-white/60 shadow-[0_8px_30px_rgb(0,0,0,0.02)]">
              <h3 className="text-sm font-black text-gray-900 flex items-center gap-2">
                <Route className="w-4 h-4 text-blue-600" />
                לוח שילוח
              </h3>
              <p className="text-[10px] text-gray-400 leading-relaxed mt-1">
                כל הקריאות וההזמנות הפתוחות, מקובצות לפי אזור ואז לפי נהג — כדי לראות בבוקר לאן לשלוח כל נהג.
              </p>
            </div>

            {dispatchGroups.length === 0 ? (
              <div className="bg-white/80 backdrop-blur-md rounded-3xl border border-white/60 shadow-[0_8px_30px_rgb(0,0,0,0.02)] p-10 text-center text-gray-400 text-sm">
                אין קריאות או הזמנות פתוחות כרגע.
              </div>
            ) : (
              dispatchGroups.map(group => (
                <div key={group.region.key} className="bg-white/80 backdrop-blur-md rounded-3xl border border-white/60 shadow-[0_8px_30px_rgb(0,0,0,0.02)] p-6 space-y-4">
                  <h4 className="text-sm font-black text-gray-900 flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-cyan-600" />
                    {group.region.label}
                  </h4>

                  {group.driverKeys.map(driverKey => {
                    const driver = driverKey === 'unassigned' ? null : driversList.find(d => d.id === driverKey);
                    const driverRequests = group.requestsByDriver.get(driverKey) || [];
                    const driverOrders = group.ordersByDriver.get(driverKey) || [];
                    return (
                      <div key={driverKey} className="p-3 bg-gray-50/60 border border-gray-100 rounded-2xl space-y-2">
                        <span className={`text-xs font-black flex items-center gap-1.5 ${driver ? 'text-cyan-700' : 'text-red-500'}`}>
                          <Truck className="w-3.5 h-3.5" />
                          {driver ? driver.name : 'לא משויך לנהג'}
                        </span>

                        {driverRequests.map(req => {
                          const statusObj = statuses.find(s => s.key === req.status) || statuses[0];
                          return (
                            <div key={`req-${req.id}`} className="p-2.5 bg-white border border-gray-100 rounded-xl flex items-center gap-2.5">
                              <span className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center flex-shrink-0" title="קריאת שירות">
                                <FileText className="w-4 h-4 text-blue-600" />
                              </span>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5">
                                  <span className="px-1.5 py-0.5 rounded-md text-[9px] font-black bg-blue-50 text-blue-600 border border-blue-100 flex-shrink-0">קריאת שירות</span>
                                  <strong className="text-xs text-gray-800 font-bold truncate">
                                    {req.customer ? `${req.customer.firstName} ${req.customer.lastName}` : 'לקוח לא ידוע'}
                                  </strong>
                                </div>
                                <span className="text-[10px] text-gray-500 block truncate">{req.customer?.address || 'ללא כתובת'}{req.customer?.phone ? ` · ${req.customer.phone}` : ''}</span>
                              </div>
                              <select
                                value={req.status}
                                onChange={(e) => handleStatusChange(req.id, e.target.value)}
                                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all flex-shrink-0 ${statusObj.bg} ${statusObj.text} ${statusObj.border}`}
                              >
                                {statuses.map(st => (
                                  <option key={st.key} value={st.key}>{st.label}</option>
                                ))}
                              </select>
                              {driversList.length > 0 && (
                                <select
                                  value={req.driverId || ''}
                                  onChange={(e) => handleDriverChange(req.id, e.target.value || null)}
                                  className="px-2.5 py-1 rounded-lg text-[10px] font-bold border cursor-pointer bg-gray-50 text-gray-500 border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all flex-shrink-0"
                                >
                                  <option value="">ללא נהג</option>
                                  {driversList.map(d => (
                                    <option key={d.id} value={d.id}>{d.name}</option>
                                  ))}
                                </select>
                              )}
                            </div>
                          );
                        })}

                        {driverOrders.map(order => {
                          const statusObj = ORDER_STATUSES.find(s => s.key === order.status) || ORDER_STATUSES[0];
                          return (
                            <div key={`order-${order.id}`} className="p-2.5 bg-white border border-gray-100 rounded-xl flex items-center gap-2.5">
                              <span className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center flex-shrink-0" title="הזמנת סחורה">
                                <ShoppingCart className="w-4 h-4 text-indigo-600" />
                              </span>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5">
                                  <span className="px-1.5 py-0.5 rounded-md text-[9px] font-black bg-indigo-50 text-indigo-600 border border-indigo-100 flex-shrink-0">הזמנת סחורה</span>
                                  <strong className="text-xs text-gray-800 font-bold truncate">
                                    {order.customer ? `${order.customer.firstName} ${order.customer.lastName}` : 'לקוח לא ידוע'}
                                  </strong>
                                </div>
                                <span className="text-[10px] text-gray-500 block truncate">
                                  {order.deviceType} {order.model ? `- ${order.model}` : ''} × {order.quantity} · {order.customer?.address || 'ללא כתובת'}
                                </span>
                              </div>
                              <select
                                value={order.status}
                                onChange={(e) => handleOrderStatusChange(order.id, e.target.value as 'PENDING' | 'READY_FOR_DISPATCH' | 'FULFILLED' | 'CANCELLED')}
                                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all flex-shrink-0 ${statusObj.bg} ${statusObj.text} ${statusObj.border}`}
                              >
                                {ORDER_STATUSES.map(st => (
                                  <option key={st.key} value={st.key}>{st.label}</option>
                                ))}
                              </select>
                              {driversList.length > 0 && (
                                <select
                                  value={order.driverId || ''}
                                  onChange={(e) => handleOrderDriverChange(order.id, e.target.value || null)}
                                  className="px-2.5 py-1 rounded-lg text-[10px] font-bold border cursor-pointer bg-gray-50 text-gray-500 border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all flex-shrink-0"
                                >
                                  <option value="">ללא נהג</option>
                                  {driversList.map(d => (
                                    <option key={d.id} value={d.id}>{d.name}</option>
                                  ))}
                                </select>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}

                  {group.parts.length > 0 && (
                    <div className="p-3 bg-green-50/40 border border-green-100/50 rounded-2xl space-y-2">
                      <span className="text-xs font-black text-green-700 flex items-center gap-1.5">
                        <Package className="w-3.5 h-3.5" />
                        בקשות חלקים ({group.parts.length}) — ללא שיוך נהג
                      </span>
                      {group.parts.map(pr => (
                        <div key={`part-${pr.id}`} className="p-2.5 bg-white border border-gray-100 rounded-xl flex items-center gap-2.5">
                          <span className="w-8 h-8 rounded-lg bg-green-50 border border-green-100 flex items-center justify-center flex-shrink-0" title="חלקים">
                            <Package className="w-4 h-4 text-green-600" />
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <span className="px-1.5 py-0.5 rounded-md text-[9px] font-black bg-green-50 text-green-600 border border-green-100 flex-shrink-0">חלקים</span>
                              <strong className="text-xs text-gray-800 font-bold truncate">
                                {pr.customer ? `${pr.customer.firstName} ${pr.customer.lastName}` : 'לקוח לא ידוע'}
                              </strong>
                            </div>
                            <span className="text-[10px] text-gray-500 block truncate">{pr.description}{pr.customer?.address ? ` · ${pr.customer.address}` : ''}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleTogglePartRequestStatus(pr.id, pr.status)}
                            className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-blue-50 border border-blue-100/50 text-blue-600 hover:bg-blue-100 transition-all flex-shrink-0 cursor-pointer"
                          >
                            חדש
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'formBuilder' && (
          <div className="space-y-6 pb-10">
            {/* Header + save bar */}
            <div className="bg-white/80 backdrop-blur-md p-6 rounded-3xl border border-white/60 shadow-[0_8px_30px_rgb(0,0,0,0.02)] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-black text-gray-900 flex items-center gap-2">
                  <SlidersHorizontal className="w-5 h-5 text-blue-600" />
                  עיצוב טופס קריאת שירות
                </h3>
                <p className="text-xs text-gray-400 mt-1 leading-relaxed max-w-xl">
                  בחר/י אילו שדות יופיעו בטופס שהלקוח ממלא, מה חובה, ערוך/י כותרות, סדר/י מחדש והוסף/י שדות משלך. השינויים חלים על הפורטל, הטופס הציבורי ופתיחת קריאה מהאדמין.
                </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {formConfigSaved && (
                  <span className="text-xs font-bold text-emerald-600 flex items-center gap-1"><Check className="w-4 h-4" /> נשמר!</span>
                )}
                {formConfigError && (
                  <span className="text-xs font-bold text-red-600 flex items-center gap-1"><AlertCircle className="w-4 h-4" /> {formConfigError}</span>
                )}
                <button
                  type="button"
                  onClick={resetFormConfig}
                  disabled={!formConfigDirty || isSavingFormConfig}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  איפוס
                </button>
                <button
                  type="button"
                  onClick={handleSaveFormConfig}
                  disabled={!formConfigDirty || isSavingFormConfig}
                  className="px-5 py-2.5 rounded-xl text-xs font-black text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 shadow-lg shadow-blue-500/20 transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center gap-2"
                >
                  {isSavingFormConfig ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  {isSavingFormConfig ? 'שומר...' : 'שמור שינויים'}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
              {/* ===== Editor column ===== */}
              <div className="space-y-4">
                <div className="bg-white/80 backdrop-blur-md p-5 rounded-3xl border border-white/60 shadow-[0_8px_30px_rgb(0,0,0,0.02)] space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-black text-gray-900">שדות הטופס</h4>
                    <span className="text-[10px] bg-gray-100 text-gray-500 font-bold px-2 py-1 rounded-lg">
                      {settingsServiceFormConfig.fields.filter(f => f.enabled).length}/{settingsServiceFormConfig.fields.length} מוצגים
                    </span>
                  </div>

                  {settingsServiceFormConfig.fields.map((f, index) => (
                    <div key={f.id} className={`p-3 rounded-2xl border transition-all ${f.enabled ? 'bg-slate-50/70 border-slate-150' : 'bg-gray-50/50 border-gray-100 opacity-60'}`}>
                      <div className="flex items-center gap-2">
                        <GripVertical className="w-4 h-4 text-gray-300 flex-shrink-0" />
                        <div className="flex flex-col gap-0.5">
                          <button type="button" onClick={() => moveFormField(index, -1)} disabled={index === 0}
                            className="p-0.5 text-gray-400 hover:text-gray-700 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer" title="הזז למעלה">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 15l7-7 7 7" /></svg>
                          </button>
                          <button type="button" onClick={() => moveFormField(index, 1)} disabled={index === settingsServiceFormConfig.fields.length - 1}
                            className="p-0.5 text-gray-400 hover:text-gray-700 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer" title="הזז למטה">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                          </button>
                        </div>

                        <input
                          type="text"
                          value={f.label}
                          onChange={(e) => updateFormField(f.id, { label: e.target.value })}
                          className="flex-1 min-w-0 px-3 py-2 rounded-lg border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-gray-800 text-xs font-bold"
                        />

                        {!f.builtin && (
                          <span className="text-[9px] bg-indigo-100 text-indigo-700 font-bold px-1.5 py-0.5 rounded-md whitespace-nowrap flex-shrink-0">{customTypeLabel(f.type as CustomFieldType)}</span>
                        )}
                        {!f.builtin && (
                          <button type="button" onClick={() => removeCustomField(f.id)} className="p-1 text-red-500 hover:bg-red-50 rounded-lg cursor-pointer flex-shrink-0" title="מחק שדה">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      <div className="flex items-center gap-2 mt-2.5 pr-10">
                        <button type="button" onClick={() => updateFormField(f.id, { enabled: !f.enabled })}
                          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer border ${f.enabled ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-gray-100 text-gray-400 border-transparent'}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${f.enabled ? 'bg-blue-500' : 'bg-gray-400'}`} />
                          {f.enabled ? 'מוצג' : 'מוסתר'}
                        </button>
                        {fieldHasRequiredToggle(f) && (
                          <button type="button" disabled={!f.enabled} onClick={() => updateFormField(f.id, { required: !f.required })}
                            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all border ${!f.enabled ? 'opacity-40 cursor-not-allowed bg-gray-100 text-gray-400 border-transparent' : f.required ? 'bg-amber-50 text-amber-700 border-amber-200 cursor-pointer' : 'bg-gray-100 text-gray-500 border-transparent cursor-pointer'}`}>
                            {f.required ? 'חובה' : 'רשות'}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Add custom + inspection fee */}
                <div className="bg-white/80 backdrop-blur-md p-5 rounded-3xl border border-white/60 shadow-[0_8px_30px_rgb(0,0,0,0.02)] space-y-4">
                  <div className="space-y-2">
                    <span className="text-xs font-black text-gray-900 block">הוספת שדה חדש</span>
                    <div className="flex flex-wrap items-center gap-2">
                      {(['text', 'textarea', 'tel'] as CustomFieldType[]).map((t) => (
                        <button key={t} type="button" onClick={() => addCustomField(t)}
                          className="px-3 py-2 bg-white border border-dashed border-blue-300 text-blue-600 rounded-xl text-[11px] font-bold hover:bg-blue-50 transition-all flex items-center gap-1 cursor-pointer">
                          <Plus className="w-3 h-3" /> {customTypeLabel(t)}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-1.5 pt-3 border-t border-gray-100">
                    <label className="block text-gray-700 text-xs font-black">סכום דמי בדיקה (₪)</label>
                    <input
                      type="number"
                      min={0}
                      value={settingsServiceFormConfig.inspectionFeeAmount}
                      onChange={(e) => setSettingsServiceFormConfig(prev => ({ ...prev, inspectionFeeAmount: Math.max(0, Math.round(Number(e.target.value) || 0)) }))}
                      className="w-40 px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:bg-white text-gray-800 text-sm transition-all"
                      dir="ltr"
                    />
                    <p className="text-[10px] text-gray-400">הסכום שמופיע בהסכמת דמי הבדיקה בטופס.</p>
                  </div>
                </div>
              </div>

              {/* ===== Live preview column ===== */}
              <div className="lg:sticky lg:top-6">
                <div className="bg-gradient-to-b from-slate-200/60 to-slate-100/40 rounded-[2rem] border border-slate-200/70 p-4 shadow-inner">
                  <div className="flex items-center gap-2 mb-3 px-1 text-slate-500 text-xs font-bold">
                    <Smartphone className="w-4 h-4" />
                    תצוגה מקדימה — כפי שהלקוח רואה
                  </div>
                  <div className="bg-white rounded-3xl shadow-xl border border-slate-200 max-h-[72vh] overflow-y-auto p-5" dir="rtl">
                    <ServiceRequestForm
                      config={settingsServiceFormConfig}
                      customer={{ id: 'preview', excelId: 0, firstName: 'לקוח', lastName: 'לדוגמה' }}
                      tenantId={tenantId}
                      context="preview"
                      readOnly
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'aiBot' && (
          <div className="space-y-6 pb-10">
            {/* ===== 1. Header + save bar ===== */}
            <div className="bg-white/80 backdrop-blur-md p-6 rounded-3xl border border-white/60 shadow-[0_8px_30px_rgb(0,0,0,0.02)] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-black text-gray-900 flex items-center gap-2">
                  <Bot className="w-5 h-5 text-blue-600" />
                  בוט AI שירות לקוחות
                </h3>
                <p className="text-xs text-gray-400 mt-1 leading-relaxed max-w-xl">
                  הבוט עונה ללקוחות בוואטסאפ על סטטוס קריאות, מאשר הצעות מחיר, עונה על שאלות מבסיס הידע שתכתוב/י, ומעביר לנציג אנושי כשהוא לא בטוח.
                </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {aiConfigSaved && (
                  <span className="text-xs font-bold text-emerald-600 flex items-center gap-1"><Check className="w-4 h-4" /> נשמר!</span>
                )}
                {aiConfigError && (
                  <span className="text-xs font-bold text-red-600 flex items-center gap-1"><AlertCircle className="w-4 h-4" /> {aiConfigError}</span>
                )}
                <button
                  type="button"
                  onClick={() => setAiConfig(currentAiConfig)}
                  disabled={!aiConfigDirty || isSavingAiConfig}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  איפוס
                </button>
                <button
                  type="button"
                  onClick={handleSaveAiConfig}
                  disabled={!aiConfigDirty || isSavingAiConfig}
                  className="px-5 py-2.5 rounded-xl text-xs font-black text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 shadow-lg shadow-blue-500/20 transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center gap-2"
                >
                  {isSavingAiConfig ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  {isSavingAiConfig ? 'שומר...' : 'שמור שינויים'}
                </button>
              </div>
            </div>

            {/* ===== 2. Status strip ===== */}
            <div className="bg-white/80 backdrop-blur-md p-5 rounded-3xl border border-white/60 shadow-[0_8px_30px_rgb(0,0,0,0.02)]">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold border ${aiKeyConfigured ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                  <Sparkles className="w-3.5 h-3.5" />
                  {aiKeyConfigured ? 'מפתח AI בשרת: מוגדר' : 'מפתח AI בשרת: חסר'}
                </span>
                <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold border ${currentAiConfig.enabled ? (currentAiConfig.testMode ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200') : 'bg-gray-100 text-gray-500 border-gray-200'}`}>
                  <Power className="w-3.5 h-3.5" />
                  מצב: {currentAiConfig.enabled ? (currentAiConfig.testMode ? 'בדיקה' : 'פעיל') : 'כבוי'}
                </span>
                <button
                  type="button"
                  onClick={handleProbeAi}
                  disabled={isProbingAi || !aiKeyConfigured}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  {isProbingAi ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCw className="w-3.5 h-3.5" />}
                  בדיקת חיבור למודל
                </button>
                {aiProbe && (
                  <span className={`text-[11px] font-bold ${aiProbe.connected ? 'text-emerald-600' : 'text-red-600'}`}>
                    {aiProbe.connected ? `מחובר · ${aiProbe.latencyMs}ms` : `נכשל: ${aiProbe.error || 'לא מחובר'}`}
                  </span>
                )}
              </div>

              {!aiKeyConfigured && (
                <div className="mt-3 p-3 rounded-2xl bg-red-50/70 border border-red-100 text-[11px] text-red-700 leading-relaxed">
                  <b>המפתח לא מוגדר בשרת.</b> יש להגדיר משתנה סביבה בשם <code className="font-mono bg-white/70 px-1 rounded" dir="ltr">GEMINI_API_KEY</code> (מפתח חינמי מ-Google AI Studio) ב-<code className="font-mono bg-white/70 px-1 rounded" dir="ltr">.env.local</code> ובהגדרות הפריסה. עד אז הבוט לא יפעל — ואישורי הצעות מחיר ימשיכו לעבוד כרגיל לפי מילות מפתח.
                </div>
              )}
            </div>

            {/* ===== 3. Master switches ===== */}
            <div className="bg-white/80 backdrop-blur-md p-5 rounded-3xl border border-white/60 shadow-[0_8px_30px_rgb(0,0,0,0.02)] space-y-4">
              <h4 className="text-sm font-black text-gray-900 flex items-center gap-2"><Power className="w-4 h-4 text-emerald-600" /> הפעלה</h4>

              <label className="flex items-start gap-3 p-3 rounded-2xl border border-gray-100 bg-gray-50/60 cursor-pointer">
                <input
                  type="checkbox"
                  checked={aiConfig.enabled}
                  onChange={e => updateAiConfig('enabled', e.target.checked)}
                  className="mt-0.5 w-4 h-4 accent-emerald-600 cursor-pointer"
                />
                <span>
                  <span className="text-xs font-black text-gray-800">הפעלת הבוט</span>
                  <span className="block text-[11px] text-gray-400 mt-0.5 leading-relaxed">
                    כשכבוי, אישורי הצעות מחיר ממשיכים לעבוד כרגיל לפי מילות מפתח.
                  </span>
                </span>
              </label>

              <label className="flex items-start gap-3 p-3 rounded-2xl border border-amber-100 bg-amber-50/50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={aiConfig.testMode}
                  onChange={e => updateAiConfig('testMode', e.target.checked)}
                  className="mt-0.5 w-4 h-4 accent-amber-600 cursor-pointer"
                />
                <span>
                  <span className="text-xs font-black text-amber-800 flex items-center gap-1.5"><FlaskConical className="w-3.5 h-3.5" /> מצב בדיקה</span>
                  <span className="block text-[11px] text-amber-700/80 mt-0.5 leading-relaxed">
                    הבוט מנתח ועונה, אך התשובה נשמרת ביומן בלבד ולא נשלחת ללקוח. אישורי הצעות מחיר אינם מבוצעים.
                  </span>
                </span>
              </label>
            </div>

            {/* ===== 4. Persona ===== */}
            <div className="bg-white/80 backdrop-blur-md p-5 rounded-3xl border border-white/60 shadow-[0_8px_30px_rgb(0,0,0,0.02)] space-y-3">
              <h4 className="text-sm font-black text-gray-900 flex items-center gap-2"><Sparkles className="w-4 h-4 text-indigo-600" /> אישיות וסגנון</h4>

              <div className="flex flex-wrap gap-2">
                {PERSONA_PRESETS.map(p => (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => updateAiConfig('persona', p.value)}
                    className="px-3 py-1.5 rounded-xl text-[11px] font-bold border border-gray-200 bg-white text-gray-600 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-200 transition-all cursor-pointer"
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              <div>
                <label className="text-[11px] font-bold text-gray-500 block mb-1">אישיות הבוט</label>
                <textarea
                  value={aiConfig.persona}
                  onChange={e => updateAiConfig('persona', e.target.value)}
                  maxLength={AI_BOT_LIMITS.persona}
                  rows={4}
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500/30 leading-relaxed"
                />
                <div className="text-[10px] text-gray-400 mt-1">{aiConfig.persona.length}/{AI_BOT_LIMITS.persona}</div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-gray-500 block mb-1">משפט פתיחה (אופציונלי)</label>
                <input
                  type="text"
                  value={aiConfig.greeting}
                  onChange={e => updateAiConfig('greeting', e.target.value)}
                  maxLength={AI_BOT_LIMITS.greeting}
                  placeholder="היי! הגעת לשירות הלקוחות שלנו 🛴"
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                />
              </div>
            </div>

            {/* ===== 5. Knowledge base ===== */}
            <div className="bg-white/80 backdrop-blur-md p-5 rounded-3xl border border-white/60 shadow-[0_8px_30px_rgb(0,0,0,0.02)] space-y-3">
              <h4 className="text-sm font-black text-gray-900 flex items-center gap-2"><BookOpen className="w-4 h-4 text-blue-600" /> בסיס ידע</h4>
              <p className="text-[11px] text-gray-400 leading-relaxed">
                כל מה שכתוב כאן הבוט יכול לענות עליו. מה שלא כתוב כאן — הוא יעביר לנציג. כדאי לכלול: שעות פעילות, אזורי שירות, זמני טיפול ממוצעים, מדיניות אחריות, ודמי בדיקה.
              </p>
              <textarea
                value={aiConfig.knowledgeBase}
                onChange={e => updateAiConfig('knowledgeBase', e.target.value)}
                maxLength={AI_BOT_LIMITS.knowledgeBase}
                rows={12}
                placeholder={'שעות פעילות: א׳-ה׳ 09:00-18:00, ו׳ 09:00-13:00\nאזורי שירות: גוש דן, שרון והשפלה\nזמן טיפול ממוצע: 3-5 ימי עסקים\nאחריות: 3 חודשים על כל תיקון\nדמי בדיקה: 80 ₪, מתקזזים מול התיקון'}
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500/30 leading-relaxed"
              />
              <div className={`text-[10px] font-bold ${aiConfig.knowledgeBase.length > 5000 ? 'text-amber-600' : 'text-gray-400'}`}>
                {aiConfig.knowledgeBase.length}/{AI_BOT_LIMITS.knowledgeBase}
              </div>
            </div>

            {/* ===== 6. Quote approval ===== */}
            <div className="bg-white/80 backdrop-blur-md p-5 rounded-3xl border border-white/60 shadow-[0_8px_30px_rgb(0,0,0,0.02)] space-y-4">
              <h4 className="text-sm font-black text-gray-900 flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-600" /> אישור הצעות מחיר</h4>

              <label className="flex items-start gap-3 p-3 rounded-2xl border border-gray-100 bg-gray-50/60 cursor-pointer">
                <input
                  type="checkbox"
                  checked={aiConfig.allowQuoteApproval}
                  onChange={e => updateAiConfig('allowQuoteApproval', e.target.checked)}
                  className="mt-0.5 w-4 h-4 accent-emerald-600 cursor-pointer"
                />
                <span>
                  <span className="text-xs font-black text-gray-800">הבוט רשאי לאשר הצעות מחיר</span>
                  <span className="block text-[11px] text-gray-400 mt-0.5 leading-relaxed">
                    האישור חל רק על הצעות פתוחות של הלקוח ששלח את ההודעה. דחיית הצעה לעולם אינה מבוצעת אוטומטית — היא תמיד עוברת לנציג.
                  </span>
                </span>
              </label>

              <div>
                <label className="text-[11px] font-bold text-gray-500 block mb-2">
                  רמת ודאות נדרשת לאישור: <span className="text-emerald-600 font-black">{Math.round(aiConfig.approvalConfidence * 100)}%</span>
                </label>
                <input
                  type="range"
                  min={0.5}
                  max={1}
                  step={0.05}
                  value={aiConfig.approvalConfidence}
                  onChange={e => updateAiConfig('approvalConfidence', parseFloat(e.target.value))}
                  className="w-full accent-emerald-600 cursor-pointer"
                />
              </div>
            </div>

            {/* ===== 7. Escalation ===== */}
            <div className="bg-white/80 backdrop-blur-md p-5 rounded-3xl border border-white/60 shadow-[0_8px_30px_rgb(0,0,0,0.02)] space-y-3">
              <h4 className="text-sm font-black text-gray-900 flex items-center gap-2"><ShieldAlert className="w-4 h-4 text-amber-600" /> העברה לנציג אנושי</h4>

              <div>
                <label className="text-[11px] font-bold text-gray-500 block mb-1">מספרי טלפון להתראה</label>
                <input
                  type="text"
                  dir="ltr"
                  value={aiConfig.escalationPhones}
                  onChange={e => updateAiConfig('escalationPhones', e.target.value)}
                  placeholder="0501234567, 0507654321"
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-800 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                />
                <div className="text-[10px] text-gray-400 mt-1">ריק = שימוש ברשימת מספרי ההתראה הקיימת של העסק.</div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-gray-500 block mb-1">ההודעה שהלקוח יקבל בהעברה לנציג</label>
                <textarea
                  value={aiConfig.escalationMessage}
                  onChange={e => updateAiConfig('escalationMessage', e.target.value)}
                  maxLength={AI_BOT_LIMITS.escalationMessage}
                  rows={2}
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500/30 leading-relaxed"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-[11px] font-bold text-gray-500 block mb-1">השתקת הבוט אחרי העברה (דקות)</label>
                  <input
                    type="number"
                    min={0}
                    max={1440}
                    value={aiConfig.handoffFreezeMinutes}
                    onChange={e => updateAiConfig('handoffFreezeMinutes', parseInt(e.target.value || '0', 10))}
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                  />
                  <div className="text-[10px] text-gray-400 mt-1">כדי שלקוח שביקש נציג לא ימשיך לקבל תשובות מהבוט.</div>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-gray-500 block mb-2">
                    ודאות מינימלית לשליחת תשובה: <span className="text-amber-600 font-black">{Math.round(aiConfig.replyConfidence * 100)}%</span>
                  </label>
                  <input
                    type="range"
                    min={0.3}
                    max={1}
                    step={0.05}
                    value={aiConfig.replyConfidence}
                    onChange={e => updateAiConfig('replyConfidence', parseFloat(e.target.value))}
                    className="w-full accent-amber-600 cursor-pointer"
                  />
                  <div className="text-[10px] text-gray-400 mt-1">מתחת לסף הזה הלקוח יקבל את הודעת ההעברה במקום את תשובת הבוט.</div>
                </div>
              </div>
            </div>

            {/* ===== 8. Limits ===== */}
            <div className="bg-white/80 backdrop-blur-md p-5 rounded-3xl border border-white/60 shadow-[0_8px_30px_rgb(0,0,0,0.02)] space-y-3">
              <h4 className="text-sm font-black text-gray-900 flex items-center gap-2"><AlertCircle className="w-4 h-4 text-gray-500" /> מגבלות יומיות</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-[11px] font-bold text-gray-500 block mb-1">מקסימום תשובות ללקוח ליום</label>
                  <input
                    type="number"
                    min={0}
                    max={1000}
                    value={aiConfig.maxRepliesPerCustomerPerDay}
                    onChange={e => updateAiConfig('maxRepliesPerCustomerPerDay', parseInt(e.target.value || '0', 10))}
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-gray-500 block mb-1">מקסימום תשובות לעסק ליום</label>
                  <input
                    type="number"
                    min={0}
                    max={10000}
                    value={aiConfig.maxRepliesPerTenantPerDay}
                    onChange={e => updateAiConfig('maxRepliesPerTenantPerDay', parseInt(e.target.value || '0', 10))}
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                  />
                </div>
              </div>
              {aiLiveUsage && (
                <div>
                  <div className="flex items-center justify-between text-[11px] font-bold text-gray-500 mb-1">
                    <span>נשלחו היום</span>
                    <span className="text-gray-800">{aiLiveUsage.tenantCount} / {aiLiveUsage.maxPerTenantPerDay}</span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-gray-100 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${aiLiveUsage.tenantCount >= aiLiveUsage.maxPerTenantPerDay ? 'bg-red-500' : 'bg-blue-500'}`}
                      style={{ width: `${Math.min(100, aiLiveUsage.maxPerTenantPerDay > 0 ? (aiLiveUsage.tenantCount / aiLiveUsage.maxPerTenantPerDay) * 100 : 0)}%` }}
                    />
                  </div>
                </div>
              )}

              <p className="text-[10px] text-gray-400 leading-relaxed">
                כשמגבלה נחצית הבוט שותק — ההודעה לא נענית, ומסלול אישור הצעות המחיר לפי מילות מפתח ממשיך לעבוד כרגיל.
              </p>
            </div>

            {/* ===== 9. Playground ===== */}
            <div className="bg-white/80 backdrop-blur-md p-5 rounded-3xl border border-white/60 shadow-[0_8px_30px_rgb(0,0,0,0.02)] space-y-4">
              <div>
                <h4 className="text-sm font-black text-gray-900 flex items-center gap-2"><FlaskConical className="w-4 h-4 text-purple-600" /> מגרש בדיקות</h4>
                <p className="text-[11px] text-gray-400 mt-1 leading-relaxed">
                  בדיקה יבשה מול ההגדרות <b>השמורות</b>. לעולם לא נשלחת הודעה ולעולם לא מאושרת הצעה — רק מוצג מה היה קורה.
                </p>
              </div>

              <CustomerSelectCombobox
                customers={customersList}
                selectedCustomerId={aiTestCustomerId}
                onSelectCustomer={(c) => {
                  setAiTestCustomerId(c?.id || '');
                  setAiTestPhone(c?.phone || '');
                }}
                label="בחר/י לקוח לבדיקה (אופציונלי)"
              />

              <div>
                <label className="text-[11px] font-bold text-gray-500 block mb-1">טלפון הפונה</label>
                <input
                  type="text"
                  dir="ltr"
                  value={aiTestPhone}
                  onChange={e => setAiTestPhone(e.target.value)}
                  placeholder="0509611808"
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-800 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                />
              </div>

              <div className="flex flex-col sm:flex-row gap-2">
                <textarea
                  value={aiTestMessage}
                  onChange={e => setAiTestMessage(e.target.value)}
                  rows={2}
                  placeholder="מה קורה עם הקורקינט שלי?"
                  className="flex-1 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500/30 leading-relaxed"
                />
                <button
                  type="button"
                  onClick={handleRunAiTest}
                  disabled={isRunningAiTest || !aiTestMessage.trim() || !aiKeyConfigured}
                  className="px-5 py-2.5 rounded-xl text-xs font-black text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 shadow-lg shadow-purple-500/20 transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2 flex-shrink-0"
                >
                  {isRunningAiTest ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  הרץ בדיקה
                </button>
              </div>

              {aiTestLog.length > 0 && (
                <div className="space-y-3 pt-2">
                  {aiTestLog.map(entry => (
                    <div key={entry.id} className="space-y-2">
                      <div className="flex justify-end">
                        <div className="max-w-[85%] px-3 py-2 rounded-2xl rounded-tr-sm bg-gray-100 text-gray-800 text-xs leading-relaxed whitespace-pre-wrap">
                          {entry.message}
                        </div>
                      </div>

                      {entry.error && (
                        <div className="flex justify-start">
                          <div className="max-w-[85%] px-3 py-2 rounded-2xl rounded-tl-sm bg-red-50 border border-red-100 text-red-700 text-xs">
                            {entry.error}
                          </div>
                        </div>
                      )}

                      {entry.result && (
                        <div className="flex flex-col items-start gap-1.5">
                          <div className={`max-w-[85%] px-3 py-2 rounded-2xl rounded-tl-sm text-xs leading-relaxed whitespace-pre-wrap ${entry.result.degraded ? 'bg-red-50 border border-red-100 text-red-700' : entry.result.escalate ? 'bg-amber-50 border border-amber-100 text-amber-900' : 'bg-emerald-50 border border-emerald-100 text-emerald-900'}`}>
                            {entry.result.degraded
                              ? `הבוט לא הגיב (${entry.result.errorKind || 'שגיאה'}) — במצב אמיתי המערכת הייתה נופלת חזרה למסלול מילות המפתח. ${entry.result.error || ''}`
                              : entry.result.reply}
                          </div>

                          {!entry.result.degraded && (
                            <div className="flex flex-wrap gap-1.5">
                              <span className="px-2 py-1 rounded-lg bg-gray-100 text-gray-600 text-[10px] font-bold">כוונה: {entry.result.intent}</span>
                              <span className="px-2 py-1 rounded-lg bg-gray-100 text-gray-600 text-[10px] font-bold">ודאות: {Math.round((entry.result.confidence || 0) * 100)}%</span>
                              <span className="px-2 py-1 rounded-lg bg-gray-100 text-gray-600 text-[10px] font-bold">{entry.result.latencyMs}ms</span>
                              {entry.result.usage && (
                                <span className="px-2 py-1 rounded-lg bg-gray-100 text-gray-600 text-[10px] font-bold">{entry.result.usage.totalTokens} טוקנים</span>
                              )}
                              {entry.result.escalate && (
                                <span className="px-2 py-1 rounded-lg bg-amber-100 text-amber-700 text-[10px] font-bold">הועבר לנציג: {entry.result.escalationReason}</span>
                              )}
                              {(entry.result.wouldApprove?.requestNumbers.length || 0) > 0 && (
                                <span className="px-2 py-1 rounded-lg bg-emerald-100 text-emerald-700 text-[10px] font-bold">
                                  היה מאשר: {entry.result.wouldApprove?.requestNumbers.map(n => formatRequestNumber(tenantId, n)).join(', ')}
                                </span>
                              )}
                            </div>
                          )}

                          {entry.result.contextBlock && (
                            <details className="w-full">
                              <summary className="text-[10px] font-bold text-gray-400 cursor-pointer hover:text-gray-600">
                                הצג את בלוק ההקשר המדויק שנשלח למודל
                              </summary>
                              <pre className="mt-1.5 p-3 rounded-xl bg-slate-900 text-slate-200 text-[10px] leading-relaxed overflow-x-auto whitespace-pre-wrap font-mono">
                                {entry.result.contextBlock}
                              </pre>
                            </details>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ===== 10. Recent conversations ===== */}
            <div className="bg-white/80 backdrop-blur-md p-5 rounded-3xl border border-white/60 shadow-[0_8px_30px_rgb(0,0,0,0.02)] space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-black text-gray-900 flex items-center gap-2">
                  <MessagesSquare className="w-4 h-4 text-blue-600" /> שיחות אחרונות
                </h4>
                {isLoadingAiThreads && <Loader2 className="w-4 h-4 animate-spin text-gray-400" />}
              </div>

              {aiThreads.length === 0 && !isLoadingAiThreads ? (
                <p className="text-[11px] text-gray-400 py-6 text-center">אין עדיין שיחות מתועדות.</p>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
                  {/* Thread list */}
                  <div className="space-y-1.5 max-h-[28rem] overflow-y-auto">
                    {aiThreads.map(thread => (
                      <button
                        key={thread.phone}
                        type="button"
                        onClick={() => setAiSelectedPhone(thread.phone)}
                        className={`w-full text-right p-3 rounded-2xl border transition-all cursor-pointer ${aiSelectedPhone === thread.phone ? 'bg-blue-50 border-blue-200' : 'bg-gray-50/60 border-gray-100 hover:bg-gray-100/60'}`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-black text-gray-800 truncate">
                            {thread.customerName || thread.phone}
                          </span>
                          <span className="text-[10px] text-gray-400 flex-shrink-0" dir="ltr">
                            {formatDate(thread.lastAt)}
                          </span>
                        </div>
                        <div className="text-[10px] text-gray-400 font-mono mt-0.5" dir="ltr">{thread.phone}</div>
                        <div className="text-[11px] text-gray-500 truncate mt-1">{thread.lastText || '—'}</div>
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          <span className="px-1.5 py-0.5 rounded-md bg-gray-100 text-gray-500 text-[9px] font-bold">
                            {thread.messageCount} הודעות
                          </span>
                          {thread.escalated && (
                            <span className="px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-700 text-[9px] font-bold">הועבר לנציג</span>
                          )}
                          {thread.testMode && (
                            <span className="px-1.5 py-0.5 rounded-md bg-purple-100 text-purple-700 text-[9px] font-bold">בדיקה</span>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>

                  {/* Transcript */}
                  <div className="lg:col-span-2 space-y-2 max-h-[28rem] overflow-y-auto p-1">
                    {!aiSelectedPhone ? (
                      <p className="text-[11px] text-gray-400 py-10 text-center">בחר/י שיחה מהרשימה כדי לראות את התמלול.</p>
                    ) : aiMessages.length === 0 ? (
                      <p className="text-[11px] text-gray-400 py-10 text-center">אין הודעות בשיחה זו.</p>
                    ) : (
                      aiMessages.map(msg => (
                        <div key={msg.id} className={`flex ${msg.direction === 'IN' ? 'justify-end' : 'justify-start'}`}>
                          <div
                            className={`max-w-[80%] px-3 py-2 rounded-2xl text-xs leading-relaxed whitespace-pre-wrap ${
                              msg.direction === 'IN'
                                ? 'bg-gray-100 text-gray-800 rounded-tr-sm'
                                : msg.degraded
                                  ? 'bg-red-50 text-red-700 border border-red-100 rounded-tl-sm'
                                  : 'bg-emerald-50 text-emerald-900 rounded-tl-sm'
                            } ${msg.direction === 'OUT' && msg.delivered === false && !msg.degraded ? 'opacity-60 border border-dashed border-emerald-300' : ''}`}
                          >
                            {msg.degraded
                              ? `הבוט לא הגיב (${msg.errorKind || 'שגיאה'}) — המערכת נפלה חזרה למסלול מילות המפתח.`
                              : msg.text || '—'}
                            <div className="flex flex-wrap items-center gap-1.5 mt-1.5 opacity-70">
                              <span className="text-[9px]" dir="ltr">{formatDate(msg.createdAt)}</span>
                              {msg.intent && <span className="text-[9px] font-bold">· {msg.intent}</span>}
                              {typeof msg.confidence === 'number' && (
                                <span className="text-[9px] font-bold">· {Math.round(msg.confidence * 100)}%</span>
                              )}
                              {msg.direction === 'OUT' && msg.delivered === false && !msg.degraded && (
                                <span className="text-[9px] font-bold">· לא נשלח ללקוח</span>
                              )}
                              {msg.source === 'FALLBACK_REGEX' && (
                                <span className="text-[9px] font-bold">· מילות מפתח</span>
                              )}
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
        </div>
      </div>

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

              {selectedRequest.customFields && selectedRequest.customFields.length > 0 && (
                <div className="p-4 bg-indigo-50/40 border border-indigo-100/50 rounded-2xl text-sm shadow-sm text-right space-y-2">
                  {selectedRequest.customFields.map((cf) => (
                    <div key={cf.key}>
                      <span className="block text-gray-400 text-xs font-bold">{cf.label}:</span>
                      <p className="text-gray-700 font-medium whitespace-pre-wrap">{cf.value}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Action Buttons (Delete & Info) */}
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex-1 p-4 bg-orange-50/50 border border-orange-100/50 rounded-2xl flex items-center justify-between text-orange-850 text-sm shadow-sm">
                  <span className="font-bold">אישור דמי בדיקה ({currentServiceFormConfig.inspectionFeeAmount} ש&quot;ח):</span>
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
                   <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
                     צילומי הכלי:
                     {isLoadingRequestImages && !selectedRequest.toolImages && !selectedRequest.toolImage && (
                       <Loader2 className="w-3.5 h-3.5 animate-spin text-gray-400" />
                     )}
                   </h3>
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

              {/* Handover Form Details */}
              {selectedRequest.pickupSignedAt && (
                <div className="border-t border-gray-100 pt-6 mt-6 space-y-4 text-right" dir="rtl">
                  <h3 className="text-sm font-bold text-gray-800">פרטי מסירה למוביל (טופס מסירה דיגיטלי):</h3>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                    <div className="bg-gray-50 p-3 rounded-2xl border border-gray-100 shadow-sm">
                      <span className="text-gray-400 block font-bold">נציג החנות (המוסר):</span>
                      <strong className="text-gray-800 font-bold text-sm mt-0.5 block">{selectedRequest.pickupSignerName}</strong>
                    </div>
                    <div className="bg-gray-50 p-3 rounded-2xl border border-gray-100 shadow-sm">
                      <span className="text-gray-400 block font-bold">זמן מסירה:</span>
                      <strong className="text-gray-800 font-bold text-sm mt-0.5 block">
                        {new Date(selectedRequest.pickupSignedAt).toLocaleString('he-IL')}
                      </strong>
                    </div>
                  </div>

                  {selectedRequest.pickupConditionNotes && (
                    <div className="bg-gray-50 p-3.5 rounded-2xl border border-gray-100 shadow-sm text-sm">
                      <span className="text-gray-400 block font-bold text-xs">הערות מצב פיזי של הכלי בעת המסירה:</span>
                      <p className="text-gray-800 font-bold mt-1.5 whitespace-pre-wrap">{selectedRequest.pickupConditionNotes}</p>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    {selectedRequest.pickupSignatureImage && (
                      <div className="space-y-2">
                        <span className="text-xs font-bold text-gray-800 block">חתימת המוסר:</span>
                        <div className="relative aspect-[4/3] rounded-2xl overflow-hidden border bg-gray-50 flex items-center justify-center">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img 
                            src={selectedRequest.pickupSignatureImage} 
                            alt="חתימת מסירה" 
                            className="max-w-full max-h-full object-contain"
                          />
                        </div>
                        <a 
                          href={selectedRequest.pickupSignatureImage} 
                          target="_blank" 
                          rel="noreferrer"
                          className="inline-block text-xs text-blue-600 font-bold hover:underline"
                        >
                          פתח תמונה בחלון חדש ↗
                        </a>
                      </div>
                    )}

                    {selectedRequest.pickupPhotoImage && (
                      <div className="space-y-2">
                        <span className="text-xs font-bold text-gray-800 block">צילום מסירה:</span>
                        <div className="relative aspect-[4/3] rounded-2xl overflow-hidden border bg-gray-50 flex items-center justify-center">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img 
                            src={selectedRequest.pickupPhotoImage} 
                            alt="צילום מסירה" 
                            className="max-w-full max-h-full object-contain"
                          />
                        </div>
                        <a 
                          href={selectedRequest.pickupPhotoImage} 
                          target="_blank" 
                          rel="noreferrer"
                          className="inline-block text-xs text-blue-600 font-bold hover:underline"
                        >
                          פתח תמונה בחלון חדש ↗
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              )}
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
              <CustomerSelectCombobox
                customers={customersList}
                selectedCustomerId={selectedCustomerForCreate?.id || ''}
                onSelectCustomer={(c) => setSelectedCustomerForCreate(c)}
                label="חפש לקוח לפי שם או טלפון:"
              />

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
                  </div>

                  {/* Driver Select — required when there is more than one driver */}
                  {multiDriver && (
                    <div className="space-y-1.5 text-right">
                      <label className="block text-gray-700 text-xs font-bold">בחר נהג <span className="text-red-500">*</span></label>
                      <select
                        value={adminSelectedDriverId}
                        onChange={(e) => setAdminSelectedDriverId(e.target.value)}
                        className={`w-full px-4 py-3 rounded-xl border bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:bg-white text-xs transition-all cursor-pointer ${
                          adminSelectedDriverId ? 'border-gray-200 text-gray-800' : 'border-red-200 text-red-600 font-bold'
                        }`}
                      >
                        <option value="">בחר נהג לקריאה...</option>
                        {driversList.map(d => (
                          <option key={d.id} value={d.id}>{d.name}</option>
                        ))}
                      </select>
                    </div>
                  )}

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

                  {/* Full configurable form — save directly into the system */}
                  <div className="pt-4 border-t border-gray-100">
                    {(!multiDriver || adminSelectedDriverId) ? (
                      <>
                        <p className="text-xs font-bold text-gray-500 mb-3">או מלא/י את הטופס המלא ושמור/י ישירות במערכת (ממתין לאיסוף):</p>
                        <ServiceRequestForm
                          config={currentServiceFormConfig}
                          customer={selectedCustomerForCreate}
                          tenantId={tenantId}
                          context="admin"
                          endpoint={`/api/${tenantId}/requests/direct`}
                          extraPayload={adminSelectedDriverId ? { driverId: adminSelectedDriverId } : undefined}
                          submitLabel="שמור קריאה במערכת (ממתין לאיסוף)"
                          onSuccess={handleAdminRequestCreated}
                        />
                      </>
                    ) : (
                      <div className="p-3 bg-amber-50 text-amber-700 rounded-xl text-xs font-semibold text-center">
                        בחר/י נהג כדי למלא ולשמור קריאה במערכת.
                      </div>
                    )}
                  </div>
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
                <div className="w-10 h-10 rounded-xl overflow-hidden border bg-gray-50 flex items-center justify-center shadow-lg shadow-blue-500/5">
                  {currentLogoUrl ? (
                    <img src={currentLogoUrl} alt="Logo" className="w-full h-full object-contain" />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white font-black text-2xl">{currentBusinessName.charAt(0)}</div>
                  )}
                </div>
                <span className="text-3xl font-black tracking-tight text-gray-900">{currentBusinessName}</span>
              </div>
              
              <div className="space-y-2">
                <h1 className="text-3xl font-extrabold text-gray-950 tracking-tight">לקבלת שירות {currentBusinessName}</h1>
                <p className="text-gray-500 text-sm font-medium">סרקו את קוד ה-QR לפתיחת קריאת שירות מהירה במכשיר שלכם</p>
              </div>

              {/* QR Code Container */}
              <div className="p-4 bg-gray-50 rounded-3xl border border-gray-100 shadow-inner flex items-center justify-center print:border-none print:bg-white print:shadow-none relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(
                    `${baseUrl}/${tenantId}/request/${selectedCustomerForQr.id}`
                  )}`}
                  alt={`${currentBusinessName} Service QR Code`}
                  className="w-56 h-56 print:w-72 print:h-72"
                />
                {selectedCustomerForQr.logoUrl && (
                  <div className="absolute w-12 h-12 print:w-16 print:h-16 bg-white p-1 rounded-2xl border-2 border-gray-150 shadow-md overflow-hidden flex items-center justify-center">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={selectedCustomerForQr.logoUrl} alt="Customer Logo" className="w-full h-full object-contain" />
                  </div>
                )}
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

      {/* Customer Card (Edit Customer) Modal */}
      {isCustomerCardOpen && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-gray-100 flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-gray-900">כרטיס לקוח</h2>
                <p className="text-gray-400 text-xs mt-1">עריכת פרטי הלקוח, כולל כתובת ואזור</p>
              </div>
              <button
                onClick={() => setIsCustomerCardOpen(false)}
                className="p-2 hover:bg-gray-100 rounded-full text-gray-400 hover:text-gray-700 transition-colors cursor-pointer"
                aria-label="סגור חלון"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body - Form */}
            <form onSubmit={handleSaveCustomerCard} className="p-6 space-y-4 max-h-[65vh] overflow-y-auto" dir="rtl">
              {/* Name Row */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="block text-gray-700 text-xs font-bold">שם פרטי <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    value={customerCardForm.firstName}
                    onChange={(e) => setCustomerCardForm(prev => ({ ...prev, firstName: e.target.value }))}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:bg-white text-gray-800 text-sm transition-all"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-gray-700 text-xs font-bold">שם משפחה <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    value={customerCardForm.lastName}
                    onChange={(e) => setCustomerCardForm(prev => ({ ...prev, lastName: e.target.value }))}
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
                    value={customerCardForm.phone}
                    onChange={(e) => setCustomerCardForm(prev => ({ ...prev, phone: e.target.value }))}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:bg-white text-gray-800 text-sm transition-all"
                    dir="ltr"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-gray-700 text-xs font-bold">אימייל</label>
                  <input
                    type="email"
                    value={customerCardForm.email}
                    onChange={(e) => setCustomerCardForm(prev => ({ ...prev, email: e.target.value }))}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:bg-white text-gray-800 text-sm transition-all"
                    dir="ltr"
                  />
                </div>
              </div>

              {/* Address & Region Row */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="block text-gray-700 text-xs font-bold">כתובת</label>
                  <input
                    type="text"
                    placeholder="דרך מנחם בגין 121, תל אביב"
                    value={customerCardForm.address}
                    onChange={(e) => setCustomerCardForm(prev => ({ ...prev, address: e.target.value }))}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:bg-white text-gray-800 text-sm transition-all"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-gray-700 text-xs font-bold">אזור</label>
                  <select
                    value={customerCardForm.region}
                    onChange={(e) => setCustomerCardForm(prev => ({ ...prev, region: e.target.value as typeof prev.region }))}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:bg-white text-gray-800 text-sm transition-all"
                  >
                    <option value="">ללא אזור</option>
                    {REGIONS.map(r => (
                      <option key={r.key} value={r.key}>{r.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={isSavingCustomerCard}
                className="w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-2xl text-sm font-black flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20 transition-all active:scale-[0.98] cursor-pointer disabled:opacity-50"
              >
                {isSavingCustomerCard ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Check className="w-5 h-5" />
                )}
                {isSavingCustomerCard ? 'שומר...' : 'שמור שינויים'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* New Order Modal */}
      {isAddOrderModalOpen && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-gray-100 flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-gray-900">הזמנת סחורה חדשה</h2>
                <p className="text-gray-400 text-xs mt-1">בחר לקוח, סוג כלי, דגם, כמות ומחיר ליחידה</p>
              </div>
              <button
                onClick={() => setIsAddOrderModalOpen(false)}
                className="p-2 hover:bg-gray-100 rounded-full text-gray-400 hover:text-gray-700 transition-colors cursor-pointer"
                aria-label="סגור חלון"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto" dir="rtl">
              <CustomerSelectCombobox
                customers={customersList}
                selectedCustomerId={newOrderCustomerId}
                onSelectCustomer={(c) => {
                  setNewOrderCustomerId(c ? c.id : '');
                  setNewOrderRegion(c?.region || '');
                }}
                label="לקוח"
                required
              />
                {(() => {
                  const selectedCustomer = customersList.find(c => c.id === newOrderCustomerId);
                  if (!selectedCustomer || selectedCustomer.address) return null;
                  return (
                    <button
                      type="button"
                      onClick={() => {
                        setIsAddOrderModalOpen(false);
                        openCustomerCard(selectedCustomer);
                      }}
                      className="text-xs font-bold text-amber-600 hover:text-amber-700 flex items-center gap-1 cursor-pointer"
                    >
                      <Pencil className="w-3 h-3" />
                      ללקוח הזה אין כתובת — הוסף כתובת ואזור
                    </button>
                  );
                })()}

              <div className="space-y-1.5">
                <label className="block text-gray-700 text-xs font-bold flex items-center justify-between">
                  <span>סוג כלי <span className="text-red-500">*</span></span>
                  <button
                    type="button"
                    onClick={() => setIsAddingNewModel(!isAddingNewModel)}
                    className="text-blue-600 hover:text-blue-700 text-xs font-bold flex items-center gap-1 bg-blue-50 px-2 py-0.5 rounded-lg border border-blue-100 transition-all active:scale-95 cursor-pointer"
                    title="הוסף סוג חדש לרשימה"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>הוסף סוג כלי</span>
                  </button>
                </label>

                {isAddingNewModel ? (
                  <div className="flex items-center gap-1.5 p-2 bg-blue-50/50 border border-blue-200 rounded-xl">
                    <input
                      type="text"
                      placeholder="שם סוג כלי חדש..."
                      value={newModelInput}
                      onChange={(e) => setNewModelInput(e.target.value)}
                      className="flex-1 px-3 py-2 text-xs rounded-lg border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={handleAddDeviceModel}
                      disabled={isSavingNewModel || !newModelInput.trim()}
                      className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-lg shadow-sm disabled:opacity-50 flex items-center gap-1 cursor-pointer"
                    >
                      {isSavingNewModel ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                      <span>שמור</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsAddingNewModel(false)}
                      className="px-2.5 py-2 bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold text-xs rounded-lg cursor-pointer"
                    >
                      ביטול
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <select
                      value={newOrderDeviceType}
                      onChange={(e) => setNewOrderDeviceType(e.target.value)}
                      className="flex-1 px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:bg-white text-gray-800 text-sm transition-all cursor-pointer font-medium"
                    >
                      {deviceModels.map((model) => (
                        <option key={model} value={model}>
                          {model}
                        </option>
                      ))}
                      <option value="other">אחר...</option>
                    </select>
                  </div>
                )}

                {newOrderDeviceType === 'other' && !isAddingNewModel && (
                  <input
                    type="text"
                    placeholder="הקלד סוג כלי מותאם אישית"
                    value={newOrderCustomDeviceType}
                    onChange={(e) => setNewOrderCustomDeviceType(e.target.value)}
                    className="mt-2 w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:bg-white text-gray-800 text-sm transition-all"
                  />
                )}
              </div>

              {/* Model Field */}
              <div className="space-y-1.5">
                <label className="block text-gray-700 text-xs font-bold flex items-center justify-between">
                  <span>דגם <span className="text-gray-400 font-normal">(אופציונלי)</span></span>
                  <button
                    type="button"
                    onClick={() => setIsAddingSpecificModel(!isAddingSpecificModel)}
                    className="text-blue-600 hover:text-blue-700 text-xs font-bold flex items-center gap-1 bg-blue-50 px-2 py-0.5 rounded-lg border border-blue-100 transition-all active:scale-95 cursor-pointer"
                    title="הוסף דגם חדש למאגר"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>הוסף דגם למאגר</span>
                  </button>
                </label>

                {isAddingSpecificModel ? (
                  <div className="flex items-center gap-1.5 p-2 bg-blue-50/50 border border-blue-200 rounded-xl">
                    <input
                      type="text"
                      placeholder="שם דגם חדש (למשל: Xiaomi M365)..."
                      value={newSpecificModelInput}
                      onChange={(e) => setNewSpecificModelInput(e.target.value)}
                      className="flex-1 px-3 py-2 text-xs rounded-lg border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => handleAddSpecificModel()}
                      disabled={isSavingSpecificModel || !newSpecificModelInput.trim()}
                      className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-lg shadow-sm disabled:opacity-50 flex items-center gap-1 cursor-pointer"
                    >
                      {isSavingSpecificModel ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                      <span>שמור</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsAddingSpecificModel(false)}
                      className="px-2.5 py-2 bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold text-xs rounded-lg cursor-pointer"
                    >
                      ביטול
                    </button>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {(() => {
                      const currentType = (newOrderDeviceType === 'other' ? newOrderCustomDeviceType : newOrderDeviceType).trim();
                      const filtered = modelsList.filter(m => !m.deviceType || m.deviceType === currentType);
                      if (filtered.length > 0) {
                        return (
                          <>
                            <select
                              value={newOrderModel}
                              onChange={(e) => setNewOrderModel(e.target.value)}
                              className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:bg-white text-gray-800 text-sm transition-all cursor-pointer font-medium"
                            >
                              <option value="">-- בחר דגם מתוך הרשימה --</option>
                              {filtered.map((m) => (
                                <option key={m.name} value={m.name}>
                                  {m.name}
                                </option>
                              ))}
                              <option value="custom">הקלד דגם אחר בחופשיות...</option>
                            </select>
                            {newOrderModel === 'custom' && (
                              <input
                                type="text"
                                placeholder="הקלד דגם מותאם אישית"
                                value={newOrderCustomModelText}
                                onChange={(e) => setNewOrderCustomModelText(e.target.value)}
                                className="mt-2 w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:bg-white text-gray-800 text-sm transition-all font-medium"
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
                          className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:bg-white text-gray-800 text-sm transition-all font-medium"
                        />
                      );
                    })()}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="block text-gray-700 text-xs font-bold">כמות <span className="text-red-500">*</span></label>
                  <input
                    type="number"
                    min="1"
                    value={newOrderQuantity}
                    onChange={(e) => setNewOrderQuantity(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:bg-white text-gray-800 text-sm transition-all"
                    dir="ltr"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-gray-700 text-xs font-bold">מחיר ליחידה (₪) <span className="text-red-500">*</span></label>
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={newOrderUnitPrice}
                    onChange={(e) => setNewOrderUnitPrice(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:bg-white text-gray-800 text-sm transition-all"
                    dir="ltr"
                  />
                </div>
              </div>

              {/* Region (required) + driver assignment */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="block text-gray-700 text-xs font-bold">אזור <span className="text-red-500">*</span></label>
                  <select
                    value={newOrderRegion}
                    onChange={(e) => setNewOrderRegion(e.target.value as typeof newOrderRegion)}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:bg-white text-gray-800 text-sm transition-all"
                  >
                    <option value="">בחר אזור...</option>
                    {REGIONS.map(r => (
                      <option key={r.key} value={r.key}>{r.label}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-gray-700 text-xs font-bold">שיוך לנהג</label>
                  <select
                    value={newOrderDriverId}
                    onChange={(e) => setNewOrderDriverId(e.target.value)}
                    disabled={driversList.length === 0}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:bg-white text-gray-800 text-sm transition-all disabled:opacity-50"
                  >
                    <option value="">{driversList.length === 0 ? 'אין נהגים' : 'ללא נהג'}</option>
                    {driversList.map(d => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-between gap-3 pt-1 px-1">
                <span className="text-xs text-gray-500 font-bold">
                  סה&quot;כ: <span className="text-gray-900 font-mono">₪{((Number(newOrderQuantity) || 0) * (Number(newOrderUnitPrice) || 0)).toLocaleString('he-IL')}</span>
                </span>
              </div>

              <button
                type="button"
                onClick={handleAddOrder}
                disabled={isSavingOrder}
                className="w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-2xl text-sm font-black flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20 transition-all active:scale-[0.98] cursor-pointer disabled:opacity-50"
              >
                {isSavingOrder ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Plus className="w-5 h-5" />
                )}
                {isSavingOrder ? 'שומר...' : 'צור הזמנה'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {isSettingsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-950/40 backdrop-blur-sm">
          <div className="bg-white rounded-3xl max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-gray-150 flex flex-col text-right">
            {/* Modal Header */}
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <button
                onClick={() => setIsSettingsModalOpen(false)}
                className="p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-50 active:scale-95 transition-all cursor-pointer border-0 bg-transparent"
              >
                <X className="w-5 h-5" />
              </button>
              <h2 className="text-lg font-black text-gray-900 flex items-center gap-2">
                <Settings className="w-5 h-5 text-blue-600" />
                הגדרות עסק
              </h2>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSaveSettings} className="p-6 space-y-6">
              {settingsError && (
                <div className="p-4 bg-red-50 border border-red-100 rounded-2xl text-red-650 text-xs font-bold flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 flex-shrink-0" />
                  <span>{settingsError}</span>
                </div>
              )}

              {settingsSuccess && (
                <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl text-emerald-650 text-xs font-bold flex items-center gap-2">
                  <Check className="w-5 h-5 flex-shrink-0" />
                  <span>ההגדרות נשמרו בהצלחה!</span>
                </div>
              )}

              {/* Logo Upload Section */}
              <div className="space-y-2">
                <label className="block text-gray-700 text-xs font-bold">לוגו העסק</label>
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-xl border overflow-hidden bg-gray-50 flex items-center justify-center shadow-inner flex-shrink-0">
                    {settingsLogoPreview ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={settingsLogoPreview} alt="Logo Preview" className="w-full h-full object-contain" />
                    ) : (
                      <Store className="w-6 h-6 text-gray-300" />
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => document.getElementById('logo-upload-input')?.click()}
                      className="px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-600 border border-blue-100/50 rounded-xl text-xs font-bold transition-all cursor-pointer"
                    >
                      העלה לוגו
                    </button>
                    <input
                      id="logo-upload-input"
                      type="file"
                      accept="image/*"
                      onChange={handleLogoChange}
                      className="hidden"
                    />
                    {settingsLogoPreview && (
                      <button
                        type="button"
                        onClick={handleRemoveLogo}
                        className="px-4 py-2 bg-red-50 hover:bg-red-100/70 text-red-600 border border-red-100/50 rounded-xl text-xs font-bold transition-all cursor-pointer"
                      >
                        הסר
                      </button>
                    )}
                  </div>
                </div>
                <p className="text-[10px] text-gray-400">הלוגו יוצג ב-QR, בפורטל הלקוחות ובדף הציבורי.</p>
              </div>

              {/* Business Name */}
              <div className="space-y-1.5">
                <label className="block text-gray-700 text-xs font-bold">שם העסק *</label>
                <input
                  type="text"
                  value={settingsBusinessName}
                  onChange={(e) => setSettingsBusinessName(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:bg-white text-gray-800 text-sm transition-all font-semibold"
                  required
                />
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <label className="block text-gray-700 text-xs font-bold">שינוי סיסמה (השאר ריק כדי לא לשנות)</label>
                <input
                  type="password"
                  placeholder="סיסמת מנהל חדשה"
                  value={settingsPassword}
                  onChange={(e) => setSettingsPassword(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:bg-white text-gray-800 text-sm transition-all"
                  dir="ltr"
                />
              </div>

              {/* WhatsApp Template */}
              <div className="space-y-1.5">
                <label className="block text-gray-700 text-xs font-bold">תבנית הודעת וואטסאפ ללקוחות</label>
                <textarea
                  rows={3}
                  value={settingsWhatsappTemplate}
                  onChange={(e) => setSettingsWhatsappTemplate(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:bg-white text-gray-800 text-sm transition-all resize-none text-right"
                  dir="rtl"
                />
                <p className="text-[10px] text-gray-400">השתמש ב-<code>{"{link}"}</code> עבור קישור לפתיחת קריאה, וב-<code>{"{businessName}"}</code> עבור שם העסק.</p>
              </div>

              {/* Parts Request WhatsApp Number */}
              <div className="space-y-1.5">
                <label className="block text-gray-700 text-xs font-bold">מספר וואטסאפ לבקשות חלקים</label>
                <input
                  type="tel"
                  placeholder="05XXXXXXXX"
                  value={settingsPartsRequestPhone}
                  onChange={(e) => setSettingsPartsRequestPhone(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:bg-white text-gray-800 text-sm transition-all"
                  dir="ltr"
                />
                <p className="text-[10px] text-gray-400">המספר שאליו יישלחו הודעות וואטסאפ כשלקוח מבקש חלק דרך הפורטל האישי שלו.</p>
              </div>

              {/* Admin WhatsApp Numbers for New Customer Approval */}
              <div className="space-y-1.5">
                <label className="block text-gray-700 text-xs font-bold">מספרי וואטסאפ לקבלת אישורי לקוחות חדשים</label>
                <input
                  type="tel"
                  placeholder="מספר 1 — 05XXXXXXXX"
                  value={settingsAdminWhatsappPhone}
                  onChange={(e) => setSettingsAdminWhatsappPhone(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:bg-white text-gray-800 text-sm transition-all font-mono"
                  dir="ltr"
                />
                <input
                  type="tel"
                  placeholder="מספר 2 (אופציונלי) — 05XXXXXXXX"
                  value={settingsAdminWhatsappPhone2}
                  onChange={(e) => setSettingsAdminWhatsappPhone2(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:bg-white text-gray-800 text-sm transition-all font-mono"
                  dir="ltr"
                />
                <input
                  type="tel"
                  placeholder="מספר 3 (אופציונלי) — 05XXXXXXXX"
                  value={settingsAdminWhatsappPhone3}
                  onChange={(e) => setSettingsAdminWhatsappPhone3(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:bg-white text-gray-800 text-sm transition-all font-mono"
                  dir="ltr"
                />
                <p className="text-[10px] text-gray-400">
                  לכל המספרים האלה תישלח הודעה כשלקוח חדש נרשם ומבקש אישור גישה. אם חיבור ה-Green API למטה מוגדר ותקין, ההודעה תישלח אוטומטית לכולם; אחרת יוצג ללקוח כפתור שליחה ידני למספר הראשון בלבד.
                </p>
              </div>

              {/* Quote Notification Phones */}
              <div className="pt-4 border-t border-gray-150 space-y-2">
                <label className="text-xs font-black text-gray-900 block">
                  מספרי טלפון לאישור הצעות מחיר (מופרדים בפסיק)
                </label>
                <input
                  type="text"
                  placeholder="0501234567, 0529876543"
                  value={settingsQuoteNotificationPhones}
                  onChange={(e) => setSettingsQuoteNotificationPhones(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:bg-white text-gray-800 text-sm transition-all font-mono"
                  dir="ltr"
                />
                <p className="text-[10px] text-gray-400">
                  כאשר לקוח יאשר הצעת מחיר לחלק, הודעת האישור תישלח למספרים האלו. אם ריק, יישלח למספר הראשי של המנהל (מספר 1 למעלה).
                </p>
              </div>

              {/* China Order Notification Phones */}
              <div className="pt-4 border-t border-gray-150 space-y-2">
                <label className="text-xs font-black text-gray-900 flex items-center gap-1.5">
                  <Boxes className="w-4 h-4 text-red-600" />
                  מספרי טלפון להתראות הזמנות חלקים מסין (מופרדים בפסיק)
                </label>
                <input
                  type="text"
                  placeholder="0501234567, 0529876543"
                  value={settingsChinaOrderNotificationPhones}
                  onChange={(e) => setSettingsChinaOrderNotificationPhones(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:bg-white text-gray-800 text-sm transition-all font-mono"
                  dir="ltr"
                />
                <p className="text-[10px] text-gray-400">
                  ברגע שהזמנת חלק מסין מסומנת כ״הוזמן״, תישלח הודעת וואטסאפ אוטומטית למספרים האלו (דורש חיבור Green API תקין למטה).
                </p>
              </div>

              {/* Green API — WhatsApp Automation Connection */}
              <div className="pt-4 border-t border-gray-150 space-y-3">
                <h3 className="text-xs font-black text-gray-900 flex items-center gap-1.5">
                  <Send className="w-4 h-4 text-green-600" />
                  חיבור וואטסאפ אוטומטי (Green API)
                </h3>
                <p className="text-[10px] text-gray-400 leading-relaxed">
                  צור חשבון ואינסטנס ב-<span className="font-mono">green-api.com</span>, סרוק את ה-QR עם מספר הוואטסאפ שברצונך לחבר, והזן כאן את ה-Instance ID וה-API Token מהאינסטנס שלך. כך ההודעות האוטומטיות יישלחו מהמספר שלך.
                </p>

                {/* Green API Instance ID */}
                <div className="space-y-1.5">
                  <label className="block text-gray-700 text-xs font-bold">Green API — Instance ID</label>
                  <input
                    type="text"
                    placeholder="1101XXXXXX"
                    value={settingsGreenApiInstanceId}
                    onChange={(e) => setSettingsGreenApiInstanceId(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:bg-white text-gray-800 text-sm transition-all font-mono"
                    dir="ltr"
                  />
                </div>

                {/* Green API Token */}
                <div className="space-y-1.5">
                  <label className="text-gray-700 text-xs font-bold flex items-center gap-1.5">
                    Green API — API Token
                    {greenApiTokenConfigured ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-black text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                        <CheckCircle2 className="w-3 h-3" /> טוקן שמור
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] font-black text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                        <AlertCircle className="w-3 h-3" /> לא הוגדר טוקן
                      </span>
                    )}
                  </label>
                  <input
                    type="password"
                    placeholder={greenApiTokenConfigured ? 'השאר ריק כדי לא לשנות' : 'הזן API Token'}
                    value={settingsGreenApiToken}
                    onChange={(e) => setSettingsGreenApiToken(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:bg-white text-gray-800 text-sm transition-all font-mono"
                    dir="ltr"
                  />
                  {greenApiTokenConfigured ? (
                    <p className="text-[10px] text-gray-400">הטוקן נשמר מוצפן ולא מוצג שוב. השאר ריק אם אינך רוצה לשנות אותו.</p>
                  ) : (
                    <p className="text-[10px] text-amber-600 font-bold">לא נשמר טוקן עדיין — יש להזין ולשמור טוקן כדי שהאוטומציה של הוואטסאפ (כולל התראות הזמנות מסין) תעבוד.</p>
                  )}
                </div>

                {/* Test Connection */}
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={handleTestGreenApiConnection}
                    disabled={connectionTestResult === 'checking'}
                    className="px-4 py-2.5 rounded-xl text-xs font-bold bg-green-600 hover:bg-green-700 text-white transition-all shadow-sm flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    {connectionTestResult === 'checking' ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Send className="w-3.5 h-3.5" />
                    )}
                    {connectionTestResult === 'checking' ? 'בודק חיבור...' : 'בדוק חיבור'}
                  </button>
                  {connectionTestResult === 'connected' && (
                    <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-2 rounded-xl">
                      <CheckCircle2 className="w-4 h-4" />
                      {connectionTestMessage}
                    </div>
                  )}
                  {(connectionTestResult === 'disconnected' || connectionTestResult === 'error') && (
                    <div className="flex items-center gap-1.5 text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 px-3 py-2 rounded-xl">
                      <AlertCircle className="w-4 h-4 flex-shrink-0" />
                      {connectionTestMessage}
                    </div>
                  )}
                  <p className="text-[10px] text-gray-400">הבדיקה משתמשת בפרטים השמורים. אם עדכנת את ה-Instance ID או הטוקן — שמור תחילה את ההגדרות ואז בדוק.</p>
                </div>
              </div>

              {/* Parts Request Delete Password */}
              <div className="space-y-1.5">
                <label className="block text-gray-700 text-xs font-bold">סיסמת מחיקת בקשות חלקים (פורטל לקוח)</label>
                <input
                  type="password"
                  placeholder="השאר ריק כדי לא לשנות"
                  value={settingsPartsDeletePassword}
                  onChange={(e) => setSettingsPartsDeletePassword(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:bg-white text-gray-800 text-sm transition-all"
                  dir="ltr"
                />
                <p className="text-[10px] text-gray-400">לקוחות יתבקשו להזין סיסמה זו כדי למחוק בקשת חלק מהפורטל האישי שלהם.</p>
              </div>

              {/* Customer Access Links Section */}
              <div className="pt-4 border-t border-gray-150 space-y-4">
                <h3 className="text-xs font-black text-gray-900 flex items-center gap-1.5">
                  <Phone className="w-4 h-4 text-blue-600" />
                  קישורים וגישת לקוחות
                </h3>

                {/* Customer Login Portal Link */}
                <div className="bg-slate-50 border border-slate-200/80 p-3.5 rounded-2xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800">קישור דף כניסת לקוחות</span>
                    <span className="text-[10px] bg-blue-100 text-blue-700 font-bold px-2 py-0.5 rounded-md">Mobile Portal</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={`${baseUrl}/${tenantId}/login`}
                      className="flex-1 bg-white border border-slate-200 text-slate-700 text-xs font-mono py-2 px-3 rounded-xl outline-none"
                      dir="ltr"
                    />
                    <button
                      type="button"
                      onClick={copyCustomerLoginUrl}
                      className={`px-3 py-2 rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1 cursor-pointer ${
                        copiedCustomerLoginUrl
                          ? 'bg-emerald-600 text-white'
                          : 'bg-blue-600 hover:bg-blue-700 text-white'
                      }`}
                    >
                      <Copy className="w-3.5 h-3.5" />
                      {copiedCustomerLoginUrl ? 'הועתק!' : 'העתק'}
                    </button>
                    <a
                      href={`${baseUrl}/${tenantId}/login`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl transition-all flex items-center justify-center cursor-pointer"
                      title="פתח בחלון חדש"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </a>
                  </div>
                  <p className="text-[10px] text-slate-500">
                    זהו הקישור שתוכל לשלוח ללקוחות שלך. הם יזינו את הטלפון ויכנסו ישירות לפורטל האישי שלהם.
                  </p>
                </div>

                {/* Sales Agent Part Request Link */}
                <div className="bg-emerald-50/70 border border-emerald-200/80 p-3.5 rounded-2xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-emerald-900">קישור סוכן מכירות לבקשת חלקים</span>
                    <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-md">Sales Flow</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={`${baseUrl}/${tenantId}/request-part`}
                      className="flex-1 bg-white border border-emerald-200 text-emerald-900 text-xs font-mono py-2 px-3 rounded-xl outline-none"
                      dir="ltr"
                    />
                    <button
                      type="button"
                      onClick={copyAgentPartRequestUrl}
                      className={`px-3 py-2 rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1 cursor-pointer ${
                        copiedAgentPartUrl
                          ? 'bg-emerald-600 text-white'
                          : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                      }`}
                    >
                      <Copy className="w-3.5 h-3.5" />
                      {copiedAgentPartUrl ? 'הועתק!' : 'העתק'}
                    </button>
                    <a
                      href={`${baseUrl}/${tenantId}/request-part`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 rounded-xl transition-all flex items-center justify-center cursor-pointer"
                      title="פתח בחלון חדש"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </a>
                  </div>
                  <p className="text-[10px] text-emerald-700 font-medium">
                    קישור המיועד לסוכן מכירות לשליחה ללקוח. הלקוח מזין טלפון (או נרשם קצרות אם חדש) ומועבר ישירות לטופס לבקשת חלק.
                  </p>
                </div>
              </div>

              {/* Management of Device Types and Models */}
              <div className="pt-4 border-t border-gray-150 space-y-4">
                <h3 className="text-xs font-black text-gray-900 flex items-center gap-1.5">
                  <Smartphone className="w-4 h-4 text-purple-600" />
                  ניהול סוגי כלים ודגמים במאגר העסק
                </h3>

                {/* Device Types Management */}
                <div className="bg-slate-50 border border-slate-200/80 p-4 rounded-2xl space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-800">
                      סוגי כלים שמורים (כמו קורקינט, אופניים)
                    </label>
                    <span className="text-[10px] bg-purple-100 text-purple-700 font-bold px-2 py-0.5 rounded-md">
                      {deviceModels.length} סוגים
                    </span>
                  </div>

                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="הוסף סוג כלי חדש..."
                      value={newModelInput}
                      onChange={(e) => setNewModelInput(e.target.value)}
                      className="flex-1 px-3 py-2 text-xs rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                    />
                    <button
                      type="button"
                      onClick={handleAddDeviceModel}
                      disabled={isSavingNewModel || !newModelInput.trim()}
                      className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1 cursor-pointer disabled:opacity-50"
                    >
                      {isSavingNewModel ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                      הוסף סוג
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {deviceModels.length === 0 ? (
                      <span className="text-xs text-gray-400 font-medium">אין סוגי כלים שמורים במאגר</span>
                    ) : (
                      deviceModels.map((item) => (
                        <div
                          key={item}
                          className="inline-flex items-center gap-1.5 bg-white border border-slate-200 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-700 shadow-2xs group"
                        >
                          <span>{item}</span>
                          <button
                            type="button"
                            onClick={() => handleDeleteDeviceModel(item)}
                            className="text-gray-400 hover:text-red-600 transition-colors p-0.5 rounded-md hover:bg-red-50 cursor-pointer"
                            title={`מחק ${item}`}
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Factories (מפעלים) Management — used by China parts orders */}
                <div className="bg-red-50/50 border border-red-200/80 p-4 rounded-2xl space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <Factory className="w-4 h-4 text-red-600" />
                      מפעלים להזמנות חלקים מסין
                    </label>
                    <span className="text-[10px] bg-red-100 text-red-700 font-bold px-2 py-0.5 rounded-md">
                      {factories.length} מפעלים
                    </span>
                  </div>

                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="הוסף שם מפעל חדש..."
                      value={newFactoryInput}
                      onChange={(e) => setNewFactoryInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddFactory(); } }}
                      className="flex-1 px-3 py-2 text-xs rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-red-500/20"
                    />
                    <button
                      type="button"
                      onClick={handleAddFactory}
                      disabled={isSavingFactory || !newFactoryInput.trim()}
                      className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1 cursor-pointer disabled:opacity-50"
                    >
                      {isSavingFactory ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                      הוסף מפעל
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {factories.length === 0 ? (
                      <span className="text-xs text-gray-400 font-medium">אין מפעלים שמורים במאגר</span>
                    ) : (
                      factories.map((item) => (
                        <div
                          key={item}
                          className="inline-flex items-center gap-1.5 bg-white border border-red-200 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-700 shadow-2xs group"
                        >
                          <span>{item}</span>
                          <button
                            type="button"
                            onClick={() => handleDeleteFactory(item)}
                            className="text-gray-400 hover:text-red-600 transition-colors p-0.5 rounded-md hover:bg-red-50 cursor-pointer"
                            title={`מחק ${item}`}
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Specific Models Management */}
                <div className="bg-slate-50 border border-slate-200/80 p-4 rounded-2xl space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-800">
                      דגמים שמורים במאגר (משויכים לסוג כלי)
                    </label>
                    <span className="text-[10px] bg-blue-100 text-blue-700 font-bold px-2 py-0.5 rounded-md">
                      {modelsList.length} דגמים
                    </span>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="text"
                      placeholder="שם דגם (למשל: Ninebot MAX)..."
                      value={newSpecificModelInput}
                      onChange={(e) => setNewSpecificModelInput(e.target.value)}
                      className="flex-1 px-3 py-2 text-xs rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                    <select
                      value={newSpecificModelDeviceType}
                      onChange={(e) => setNewSpecificModelDeviceType(e.target.value)}
                      className="px-3 py-2 text-xs rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-gray-700 font-medium"
                    >
                      <option value="">שייך לסוג כלי (אופציונלי)...</option>
                      {deviceModels.map(d => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => handleAddSpecificModel(newSpecificModelDeviceType)}
                      disabled={isSavingSpecificModel || !newSpecificModelInput.trim()}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50"
                    >
                      {isSavingSpecificModel ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                      הוסף דגם
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {modelsList.length === 0 ? (
                      <span className="text-xs text-gray-400 font-medium">אין דגמים שמורים במאגר</span>
                    ) : (
                      modelsList.map((item) => (
                        <div
                          key={item.name}
                          className="inline-flex items-center gap-1.5 bg-white border border-slate-200 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-700 shadow-2xs group"
                        >
                          <span>{item.name}</span>
                          {item.deviceType && (
                            <span className="text-[10px] text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded font-normal">
                              {item.deviceType}
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => handleDeleteSpecificModel(item.name)}
                            className="text-gray-400 hover:text-red-600 transition-colors p-0.5 rounded-md hover:bg-red-50 cursor-pointer"
                            title={`מחק ${item.name}`}
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={isSavingSettings}
                className="w-full py-3.5 bg-gray-950 hover:bg-gray-900 text-white rounded-xl text-sm font-black flex items-center justify-center gap-2 shadow-lg transition-all active:scale-[0.98] cursor-pointer disabled:opacity-50"
              >
                {isSavingSettings ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : null}
                {isSavingSettings ? 'שומר הגדרות...' : 'שמור שינויים'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Add Agent Modal */}
      {isAddAgentModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-gray-100 pb-4">
              <h3 className="text-base font-black text-gray-900 flex items-center gap-2">
                <Briefcase className="w-5 h-5 text-blue-600" />
                הוספת סוכן מכירות חדש
              </h3>
              <button
                type="button"
                onClick={() => setIsAddAgentModalOpen(false)}
                className="p-1 text-gray-400 hover:text-gray-600 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-gray-700">שם מלא <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  placeholder="שם הסוכן (למשל: דני כהן)"
                  value={newAgentName}
                  onChange={(e) => setNewAgentName(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:bg-white text-gray-800 text-sm font-medium transition-all"
                  autoFocus
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-gray-700">מספר טלפון <span className="text-red-500">*</span></label>
                <input
                  type="tel"
                  placeholder="0500000000"
                  value={newAgentPhone}
                  onChange={(e) => setNewAgentPhone(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:bg-white text-gray-800 text-sm font-medium transition-all"
                  dir="ltr"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-gray-700">סיסמת כניסה לסוכן <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  placeholder="הגדר סיסמה (למשל: 123456)"
                  value={newAgentPassword}
                  onChange={(e) => setNewAgentPassword(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:bg-white text-gray-800 text-sm font-medium transition-all"
                  dir="ltr"
                />
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={handleCreateAgent}
                disabled={isSavingAgent || !newAgentName.trim() || !newAgentPhone.trim() || !newAgentPassword.trim()}
                className="flex-1 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl text-xs font-bold shadow-lg shadow-blue-500/10 transition-all active:scale-[0.98] cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isSavingAgent ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                <span>צור סוכן והנפק קישור</span>
              </button>
              <button
                type="button"
                onClick={() => setIsAddAgentModalOpen(false)}
                className="py-3 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                ביטול
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New China Order Modal */}
      {isAddChinaOrderModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-gray-100 pb-4">
              <h3 className="text-base font-black text-gray-900 flex items-center gap-2">
                <Boxes className="w-5 h-5 text-red-600" />
                הזמנת חלק חדשה מסין
              </h3>
              <button
                type="button"
                onClick={() => setIsAddChinaOrderModalOpen(false)}
                className="p-1 text-gray-400 hover:text-gray-600 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-gray-700">שם החלק <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  placeholder="לדוגמה: בקר מהירות 48V"
                  value={newChinaPartName}
                  onChange={(e) => setNewChinaPartName(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:bg-white text-gray-800 text-sm font-medium transition-all"
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-gray-700">כמות <span className="text-red-500">*</span></label>
                  <input
                    type="number"
                    min={1}
                    value={newChinaQuantity}
                    onChange={(e) => setNewChinaQuantity(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:bg-white text-gray-800 text-sm font-medium transition-all"
                    dir="ltr"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-gray-700">מפעל מייצר</label>
                  <div className="flex gap-2">
                    <select
                      value={newChinaFactory}
                      onChange={(e) => setNewChinaFactory(e.target.value)}
                      className="flex-1 min-w-0 px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:bg-white text-gray-800 text-sm font-medium transition-all"
                    >
                      <option value="">ללא מפעל</option>
                      {factories.map(f => (
                        <option key={f} value={f}>{f}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => { setIsAddingFactoryInline(v => !v); setNewFactoryInput(''); }}
                      className="px-3 py-3 bg-red-50 hover:bg-red-100 text-red-600 border border-red-100 rounded-xl transition-all cursor-pointer flex items-center justify-center flex-shrink-0"
                      title="הוסף מפעל חדש"
                      aria-label="הוסף מפעל חדש"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>

              {isAddingFactoryInline && (
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="שם מפעל חדש..."
                    value={newFactoryInput}
                    onChange={(e) => setNewFactoryInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddFactoryInline(); } }}
                    autoFocus
                    className="flex-1 px-4 py-2.5 rounded-xl border border-red-200 bg-white focus:outline-none focus:ring-2 focus:ring-red-500/20 text-gray-800 text-sm"
                  />
                  <button
                    type="button"
                    onClick={handleAddFactoryInline}
                    disabled={isSavingFactory || !newFactoryInput.trim()}
                    className="px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1 cursor-pointer disabled:opacity-50"
                  >
                    {isSavingFactory ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                    הוסף
                  </button>
                </div>
              )}
              {factories.length === 0 && !isAddingFactoryInline && (
                <p className="text-[11px] text-gray-400">אין מפעלים עדיין — לחץ על ➕ להוספת מפעל חדש.</p>
              )}

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-gray-700">תמונת החלק</label>
                <input type="file" accept="image/*" ref={chinaFileInputRef} onChange={handleChinaPhotoChange} className="hidden" />
                <input type="file" accept="image/*" capture="environment" ref={chinaCameraInputRef} onChange={handleChinaPhotoChange} className="hidden" />
                {newChinaPhotoPreview ? (
                  <div className="relative rounded-2xl overflow-hidden border border-red-200 bg-gray-50 aspect-video flex items-center justify-center">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={newChinaPhotoPreview} alt="תצוגה מקדימה" className="w-full h-full object-contain" />
                    <div className="absolute top-2 right-2 flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => chinaCameraInputRef.current?.click()}
                        className="px-2.5 py-1 bg-red-600/90 hover:bg-red-500 text-white rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <Camera className="w-3.5 h-3.5" /> צלם
                      </button>
                      <button
                        type="button"
                        onClick={() => chinaFileInputRef.current?.click()}
                        className="px-2.5 py-1 bg-gray-700/90 text-white rounded-lg text-xs font-bold cursor-pointer"
                      >
                        גלריה
                      </button>
                      <button
                        type="button"
                        onClick={() => { setNewChinaPhoto(null); setNewChinaPhotoPreview(null); }}
                        className="px-2 py-1 bg-red-700/90 text-white rounded-lg text-xs font-bold cursor-pointer"
                      >
                        הסר
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="border-2 border-dashed border-gray-200 rounded-2xl p-5 flex flex-col items-center justify-center bg-gray-50/50 gap-3">
                    <span className="text-xs font-bold text-gray-500">צלם במצלמה או העלה מהגלריה</span>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => chinaCameraInputRef.current?.click()}
                        className="px-4 py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-bold flex items-center gap-2 transition-all active:scale-95 cursor-pointer"
                      >
                        <Camera className="w-4 h-4" />
                        <span>צלם במצלמה</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => chinaFileInputRef.current?.click()}
                        className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-200 rounded-xl text-xs font-bold flex items-center gap-2 transition-all active:scale-95 cursor-pointer"
                      >
                        <ImageIcon className="w-4 h-4 text-gray-400" />
                        <span>בחר מהגלריה</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={handleCreateChinaOrder}
                disabled={isSavingChinaOrder || !newChinaPartName.trim()}
                className="flex-1 py-3 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white rounded-xl text-xs font-bold shadow-lg shadow-red-500/10 transition-all active:scale-[0.98] cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isSavingChinaOrder ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                <span>צור הזמנה</span>
              </button>
              <button
                type="button"
                onClick={() => setIsAddChinaOrderModalOpen(false)}
                className="py-3 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                ביטול
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Technician Modal */}
      {isAddTechnicianModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-gray-100 pb-4">
              <h3 className="text-base font-black text-gray-900 flex items-center gap-2">
                <Wrench className="w-5 h-5 text-red-600" />
                הוספת טכנאי חדש
              </h3>
              <button
                type="button"
                onClick={() => setIsAddTechnicianModalOpen(false)}
                className="p-1 text-gray-400 hover:text-gray-600 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-gray-700">שם מלא <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  placeholder="שם הטכנאי (למשל: יוסי לוי)"
                  value={newTechnicianName}
                  onChange={(e) => setNewTechnicianName(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:bg-white text-gray-800 text-sm font-medium transition-all"
                  autoFocus
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-gray-700">מספר טלפון <span className="text-red-500">*</span></label>
                <input
                  type="tel"
                  placeholder="0500000000"
                  value={newTechnicianPhone}
                  onChange={(e) => setNewTechnicianPhone(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:bg-white text-gray-800 text-sm font-medium transition-all"
                  dir="ltr"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-gray-700">סיסמת כניסה לטכנאי <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  placeholder="הגדר סיסמה (למשל: 123456)"
                  value={newTechnicianPassword}
                  onChange={(e) => setNewTechnicianPassword(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:bg-white text-gray-800 text-sm font-medium transition-all"
                  dir="ltr"
                />
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={handleCreateTechnician}
                disabled={isSavingTechnician || !newTechnicianName.trim() || !newTechnicianPhone.trim() || !newTechnicianPassword.trim()}
                className="flex-1 py-3 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white rounded-xl text-xs font-bold shadow-lg shadow-red-500/10 transition-all active:scale-[0.98] cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isSavingTechnician ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                <span>צור טכנאי והנפק קישור</span>
              </button>
              <button
                type="button"
                onClick={() => setIsAddTechnicianModalOpen(false)}
                className="py-3 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                ביטול
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
