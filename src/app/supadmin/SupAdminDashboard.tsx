'use client';

import React, { useState, useEffect } from 'react';
import { Tenant } from '@/lib/db';
import { 
  Building2, Users, Search, Plus, ShieldCheck, 
  Settings, Loader2, ArrowRight, Lock, Copy, Eye, EyeOff
} from 'lucide-react';
import Link from 'next/link';

export default function SupAdminDashboard() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Create Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newTenantId, setNewTenantId] = useState('');
  const [newBusinessName, setNewBusinessName] = useState('');
  const [newAdminPassword, setNewAdminPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState<{ [key: string]: boolean }>({});

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/supadmin/tenants', {
        headers: {
          'Authorization': `Bearer ${password}`
        }
      });
      if (!res.ok) {
        throw new Error('סיסמה שגויה או שגיאת שרת');
      }
      const data = await res.json();
      setTenants(data.tenants);
      setIsAuthenticated(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const loadTenants = async () => {
    try {
      const res = await fetch('/api/supadmin/tenants', {
        headers: {
          'Authorization': `Bearer ${password}`
        }
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
          'Authorization': `Bearer ${password}`
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
      alert(`הסביבה ${newBusinessName} נוצרה בהצלחה!`);
    } catch (err: any) {
      setSubmitError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const togglePasswordVisibility = (id: string) => {
    setShowPassword(prev => ({ ...prev, [id]: !prev[id] }));
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
                type="password"
                placeholder="סיסמת ניהול מרכזית"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full text-center px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all text-sm font-medium"
                autoFocus
              />
            </div>
            {error && <p className="text-red-500 text-xs font-bold">{error}</p>}
            <button
              type="submit"
              disabled={isLoading || !password}
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
                  <th className="p-4 font-bold">סיסמת אדמין (סביבה)</th>
                  <th className="p-4 font-bold">תאריך הקמה</th>
                  <th className="p-4 font-bold text-center">פעולות</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {tenants.map(tenant => (
                  <tr key={tenant.id} className="hover:bg-gray-50/30 transition-colors">
                    <td className="p-4 font-mono font-bold text-blue-600">{tenant.id}</td>
                    <td className="p-4 font-bold">{tenant.name || tenant.businessName}</td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <span className="font-mono bg-gray-100 px-2 py-1 rounded text-xs">
                          {showPassword[tenant.id] ? tenant.adminPassword : '••••••••'}
                        </span>
                        <button 
                          onClick={() => togglePasswordVisibility(tenant.id)}
                          className="text-gray-400 hover:text-gray-700"
                        >
                          {showPassword[tenant.id] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </td>
                    <td className="p-4 text-gray-500 text-xs">
                      {new Date(tenant.createdAt).toLocaleDateString('he-IL')}
                    </td>
                    <td className="p-4 text-center">
                      <a 
                        href={`/${tenant.id}/admin`}
                        target="_blank"
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-gray-900 hover:bg-gray-800 text-white rounded-lg text-xs font-bold transition-all"
                      >
                        כניסה לאדמין <ArrowRight className="w-3 h-3" />
                      </a>
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
