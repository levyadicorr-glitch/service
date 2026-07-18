'use client';

import React, { useState, useEffect } from 'react';
import { Tenant } from '@/lib/db';
import {
  Building2, Users, Search, Plus, ShieldCheck,
  Settings, Loader2, ArrowRight, Lock, Copy, Trash2, AlertCircle,
  Eye, EyeOff, Edit2, Check, X
} from 'lucide-react';
import Link from 'next/link';

export default function SupAdminDashboard() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rememberMe, setRememberMe] = useState(false);
  
  // Create Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newTenantId, setNewTenantId] = useState('');
  const [newBusinessName, setNewBusinessName] = useState('');
  const [newAdminPassword, setNewAdminPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [baseUrl, setBaseUrl] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Password Visibility & Edit State
  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({});
  const [editingPasswordId, setEditingPasswordId] = useState<string | null>(null);
  const [editPasswordValue, setEditPasswordValue] = useState('');
  const [isSavingPassword, setIsSavingPassword] = useState(false);

  useEffect(() => {
    setBaseUrl(window.location.origin);
    const savedEmail = localStorage.getItem('supadmin_email');
    const savedPassword = localStorage.getItem('supadmin_password');
    if (savedEmail && savedPassword) {
      setEmail(savedEmail);
      setPassword(savedPassword);
      setRememberMe(true);
    }
  }, []);

  const authHeader = () => ({ 'Authorization': `Bearer ${email}:${password}` });

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/supadmin/tenants', {
        headers: authHeader()
      });
      if (!res.ok) {
        throw new Error('אימייל או סיסמה שגויים, או שגיאת שרת');
      }
      const data = await res.json();
      setTenants(data.tenants);
      setIsAuthenticated(true);
      if (rememberMe) {
        localStorage.setItem('supadmin_email', email);
        localStorage.setItem('supadmin_password', password);
      } else {
        localStorage.removeItem('supadmin_email');
        localStorage.removeItem('supadmin_password');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'שגיאת שרת');
    } finally {
      setIsLoading(false);
    }
  };

  const loadTenants = async () => {
    try {
      const res = await fetch('/api/supadmin/tenants', {
        headers: authHeader()
      });
      if (res.ok) {
        const data = await res.json();
        setTenants(data.tenants);
      }
    } catch (err) {
      console.error('Failed to reload tenants');
    }
  };

  const handleCreateTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitError(null);
    
    try {
      const res = await fetch('/api/supadmin/tenants', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeader()
        },
        body: JSON.stringify({
          tenantId: newTenantId,
          businessName: newBusinessName,
          adminPassword: newAdminPassword
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'שגיאה ביצירת סביבה');
      
      setIsModalOpen(false);
      setNewTenantId('');
      setNewBusinessName('');
      setNewAdminPassword('');
      loadTenants();
      alert(`הסביבה ${newBusinessName} נוצרה בהצלחה!\n\nסיסמת האדמין: ${newAdminPassword}\nשמור אותה - היא לא תוצג שוב.`);
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : 'שגיאה ביצירת סביבה');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteTenant = async (tenantId: string, tenantName: string) => {
    if (!window.confirm(`האם אתה בטוח שברצונך למחוק את הסביבה "${tenantName}" (${tenantId})?\n\nפעולה זו תמחק את הסביבה מהרשימה הראשית. שים לב: מסד הנתונים של הסביבה לא יימחק אוטומטית.`)) return;
    
    setIsDeleting(tenantId);
    try {
      const res = await fetch(`/api/supadmin/tenants?tenantId=${tenantId}`, {
        method: 'DELETE',
        headers: authHeader()
      });
      
      if (!res.ok) {
        let errorMsg = 'שגיאה במחיקת הסביבה';
        try {
          const data = await res.json();
          errorMsg = data.error || errorMsg;
        } catch {}
        throw new Error(errorMsg);
      }
      
      setTenants(prev => prev.filter(t => t.id !== tenantId));
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'שגיאה במחיקת הסביבה');
    } finally {
      setIsDeleting(null);
    }
  };

  const handleSavePassword = async (tenantId: string) => {
    if (!editPasswordValue.trim()) {
      alert('הסיסמה לא יכולה להיות ריקה');
      return;
    }
    setIsSavingPassword(true);
    try {
      const res = await fetch('/api/supadmin/tenants', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...authHeader()
        },
        body: JSON.stringify({
          tenantId,
          adminPassword: editPasswordValue.trim()
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'שגיאה בעדכון הסיסמה');
      
      setTenants(prev => prev.map(t => t.id === tenantId ? { ...t, adminPasswordPlain: editPasswordValue.trim() } : t));
      setEditingPasswordId(null);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'שגיאה בעדכון הסיסמה');
    } finally {
      setIsSavingPassword(false);
    }
  };

  const handleWhatsApp = (tenant: Tenant) => {
    const adminUrl = `${baseUrl}/${tenant.id}/admin`;
    const message = `היי! 👋\nהנה הקישור לממשק הניהול של ${tenant.businessName || tenant.name}:\n${adminUrl}\n\nסיסמת הכניסה תימסר בנפרד.\n\nבהצלחה! 🚀`;
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4" dir="rtl">
        <div className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl border border-gray-100 text-center">
          <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-inner">
            <ShieldCheck className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-black text-gray-900 mb-2">Wisewheel CRM</h1>
          <p className="text-sm text-gray-500 mb-8">התחברות פאנל סופר-אדמין לניהול סביבות</p>
          
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <input
                type="email"
                placeholder="אימייל"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full text-center px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all text-sm font-medium"
                dir="ltr"
                autoFocus
              />
            </div>
            <div>
              <input
                type="password"
                placeholder="סיסמה"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full text-center px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all text-sm font-medium"
              />
            </div>
            <label className="flex items-center gap-2 cursor-pointer select-none justify-center">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
              />
              <span className="text-xs text-gray-500 font-medium">זכור אותי במכשיר זה</span>
            </label>
            {error && <p className="text-red-500 text-xs font-bold">{error}</p>}
            <button
              type="submit"
              disabled={isLoading || !email || !password}
              className="w-full py-3 bg-gray-900 hover:bg-gray-800 text-white rounded-xl text-sm font-bold shadow-lg shadow-gray-900/20 transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
              היכנס למערכת
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans" dir="rtl">
      {/* Navbar */}
      <nav className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gray-900 text-white rounded-xl flex items-center justify-center shadow-md">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-black leading-tight">Wisewheel CRM Admin</h1>
            <span className="text-xs text-gray-500 font-bold uppercase tracking-wider">Multi-Tenant Platform</span>
          </div>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold shadow-lg shadow-blue-500/20 transition-all active:scale-95"
        >
          <Plus className="w-4 h-4" />
          סביבה חדשה
        </button>
      </nav>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto p-6 mt-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex items-center justify-between">
            <div>
              <span className="text-gray-400 text-xs font-bold block mb-1">סה"כ סביבות מנוהלות</span>
              <span className="text-3xl font-black">{tenants.length}</span>
            </div>
            <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center">
              <Building2 className="w-6 h-6" />
            </div>
          </div>
        </div>

        {/* Tenants Table */}
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-bold text-lg">רשימת סביבות (Tenants)</h2>
            <div className="relative">
              <Search className="w-4 h-4 text-gray-400 absolute right-3 top-3" />
              <input
                type="text"
                placeholder="חיפוש לפי מזהה או שם עסק..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-4 pr-9 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-blue-500 w-64"
              />
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead className="bg-gray-50/50 text-gray-500 border-b border-gray-100">
                <tr>
                  <th className="p-4 font-bold">מזהה URL (Tenant ID)</th>
                  <th className="p-4 font-bold">שם עסק במערכת</th>
                  <th className="p-4 font-bold">סיסמת אדמין</th>
                  <th className="p-4 font-bold">תאריך הקמה</th>
                  <th className="p-4 font-bold text-center">פעולות</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {tenants.filter(tenant => {
                  const query = searchQuery.trim().toLowerCase();
                  if (!query) return true;
                  return tenant.id.toLowerCase().includes(query) ||
                    (tenant.businessName || tenant.name || '').toLowerCase().includes(query);
                }).map(tenant => (
                  <tr key={tenant.id} className="hover:bg-gray-50/30 transition-colors">
                    <td className="p-4 font-mono font-bold text-blue-600">{tenant.id}</td>
                    <td className="p-4 font-bold">{tenant.name || tenant.businessName}</td>
                    <td className="p-4 font-mono text-sm">
                      {editingPasswordId === tenant.id ? (
                        <div className="flex items-center gap-2 justify-end" dir="ltr">
                          <input
                            type="text"
                            value={editPasswordValue}
                            onChange={(e) => setEditPasswordValue(e.target.value)}
                            className="px-2 py-1 bg-white border border-gray-300 rounded-lg text-xs font-mono w-32 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-left"
                            dir="ltr"
                            disabled={isSavingPassword}
                            autoFocus
                          />
                          <button
                            onClick={() => handleSavePassword(tenant.id)}
                            disabled={isSavingPassword || !editPasswordValue.trim()}
                            className="p-1 hover:bg-green-50 text-green-600 rounded-lg border border-green-100 disabled:opacity-50 cursor-pointer flex items-center justify-center"
                            title="שמור סיסמה"
                          >
                            {isSavingPassword ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Check className="w-3.5 h-3.5" />
                            )}
                          </button>
                          <button
                            onClick={() => setEditingPasswordId(null)}
                            disabled={isSavingPassword}
                            className="p-1 hover:bg-red-50 text-red-600 rounded-lg border border-red-100 cursor-pointer flex items-center justify-center"
                            title="ביטול"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 justify-end" dir="ltr">
                          {tenant.adminPasswordPlain ? (
                            <>
                              <span className="font-semibold text-gray-700 min-w-[70px] text-right">
                                {visiblePasswords[tenant.id] ? tenant.adminPasswordPlain : '••••••••'}
                              </span>
                              <button
                                onClick={() => setVisiblePasswords(prev => ({ ...prev, [tenant.id]: !prev[tenant.id] }))}
                                className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg cursor-pointer flex items-center justify-center"
                                title={visiblePasswords[tenant.id] ? 'הסתר סיסמה' : 'הצג סיסמה'}
                              >
                                {visiblePasswords[tenant.id] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                              </button>
                            </>
                          ) : (
                            <span className="text-gray-400 italic text-xs">לא ידוע</span>
                          )}
                          <button
                            onClick={() => {
                              setEditingPasswordId(tenant.id);
                              setEditPasswordValue(tenant.adminPasswordPlain || '');
                            }}
                            className="p-1 text-gray-400 hover:text-blue-600 hover:bg-gray-100 rounded-lg cursor-pointer flex items-center justify-center"
                            title="ערוך סיסמה"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </td>
                    <td className="p-4 text-gray-500 text-xs">
                      {new Date(tenant.createdAt).toLocaleDateString('he-IL')}
                    </td>
                    <td className="p-4">
                      <div className="flex items-center justify-center gap-2">
                        <a 
                          href={`/${tenant.id}/admin`}
                          target="_blank"
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-gray-900 hover:bg-gray-800 text-white rounded-lg text-xs font-bold transition-all active:scale-95"
                        >
                          כניסה לאדמין <ArrowRight className="w-3 h-3" />
                        </a>
                        <button
                          onClick={() => handleWhatsApp(tenant)}
                          className="p-1.5 bg-green-50 hover:bg-green-100 text-green-600 rounded-lg border border-green-100/50 transition-all active:scale-95 cursor-pointer"
                          title="שלח קישור סביבה בוואטסאפ"
                        >
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.027 6.988 2.895a9.82 9.82 0 012.893 6.994c-.002 5.45-4.437 9.888-9.885 9.888m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleDeleteTenant(tenant.id, tenant.businessName || tenant.name)}
                          disabled={isDeleting === tenant.id}
                          className="p-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg border border-red-100/50 transition-all active:scale-95 cursor-pointer disabled:opacity-50"
                          title="מחק סביבה"
                        >
                          {isDeleting === tenant.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* Create Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl border border-gray-100">
            <h2 className="text-xl font-black mb-4">יצירת סביבה חדשה</h2>
            <p className="text-xs text-gray-500 mb-6">יצירת סביבה תקים מסד נתונים חדש לגמרי עבור העסק.</p>
            
            <form onSubmit={handleCreateTenant} className="space-y-4">
              {submitError && (
                <div className="p-3 bg-red-50 text-red-600 text-xs font-bold rounded-xl">
                  {submitError}
                </div>
              )}
              
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  מזהה לכתובת ה-URL (Tenant ID) <span className="text-red-500">*</span>
                </label>
                <input 
                  type="text" 
                  value={newTenantId}
                  onChange={e => setNewTenantId(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, ''))}
                  placeholder="לדוגמה: bikeshop1"
                  className="w-full font-mono text-left px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm"
                  dir="ltr"
                  required
                />
                <p className="text-[10px] text-gray-400 mt-1">אנגלית ומספרים בלבד. הכתובת תהיה: `/{newTenantId || 'id'}/admin`</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  שם העסק (יוצג ללקוחות) <span className="text-red-500">*</span>
                </label>
                <input 
                  type="text" 
                  value={newBusinessName}
                  onChange={e => setNewBusinessName(e.target.value)}
                  placeholder="לדוגמה: מוסך אופניים כהן"
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  סיסמת מנהל סביבה (Admin) <span className="text-red-500">*</span>
                </label>
                <input 
                  type="text" 
                  value={newAdminPassword}
                  onChange={e => setNewAdminPassword(e.target.value)}
                  placeholder="סיסמה כניסה למערכת של בעל העסק"
                  className="w-full font-mono text-left px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm"
                  dir="ltr"
                  required
                />
              </div>

              <div className="pt-4 flex gap-3">
                <button 
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-sm font-bold transition-all"
                >
                  ביטול
                </button>
                <button 
                  type="submit"
                  disabled={isSubmitting || !newTenantId || !newBusinessName || !newAdminPassword}
                  className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold transition-all shadow-md shadow-blue-500/20 disabled:opacity-50 flex items-center justify-center"
                >
                  {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'הקם סביבה'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
