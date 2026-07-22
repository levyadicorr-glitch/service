'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';

interface AdminLoginProps {
  tenantId: string;
  businessName: string;
  title?: string;
}

// Shared password gate for the admin and driver pages. On success the server
// sets an HTTP-only session cookie and the page re-renders authenticated.
export default function AdminLogin({ tenantId, businessName, title = 'כניסת מנהל' }: AdminLoginProps) {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setLoginError('');
    try {
      const res = await fetch(`/api/${tenantId}/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || 'סיסמה שגויה');
      }
      router.refresh();
    } catch (err: unknown) {
      setLoginError(err instanceof Error ? err.message : 'שגיאת שרת');
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#fbfbfd] flex items-center justify-center p-4" dir="rtl">
      <div className="bg-white p-8 rounded-3xl shadow-xl border border-gray-100 max-w-sm w-full text-center">
        <div className="w-16 h-16 rounded-2xl bg-blue-600 flex items-center justify-center text-white font-black text-3xl mx-auto mb-6 shadow-lg shadow-blue-500/30">{businessName.charAt(0)}</div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">{title}</h1>
        <p className="text-gray-500 text-sm mb-8">הזן סיסמה כדי לגשת למערכת</p>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <input
              type="password"
              placeholder="סיסמה..."
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 text-center text-lg tracking-widest"
              autoFocus
              // Password managers inject attributes (e.g. fdprocessedid) before
              // hydration; suppress the resulting mismatch warning.
              suppressHydrationWarning
            />
            {loginError && <p className="text-red-500 text-xs mt-2 font-bold">{loginError}</p>}
          </div>
          <button
            type="submit"
            disabled={isLoading || !password}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition-all shadow-lg shadow-blue-500/20 disabled:opacity-50"
          >
            {isLoading ? 'מתחבר...' : 'התחבר'}
          </button>
        </form>
      </div>
    </div>
  );
}
