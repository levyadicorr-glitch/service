import React from 'react';
import { getTenantById } from '@/lib/db';
import CustomerLogin from './CustomerLogin';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{
    tenantId: string;
  }>;
}

export default async function CustomerLoginPage({ params }: PageProps) {
  const { tenantId } = await params;
  const tenant = await getTenantById(tenantId);

  if (!tenant) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 text-slate-100" dir="rtl">
        <div className="bg-slate-900 border border-slate-800 p-8 rounded-3xl text-center max-w-md w-full shadow-2xl">
          <h2 className="text-2xl font-bold text-red-400 mb-2">העסק לא נמצא</h2>
          <p className="text-slate-400 mb-6 text-sm">
            לא מצאנו עסק הרשום תחת המזהה "{tenantId}". אנא ודא שהקישור תקין.
          </p>
          <Link
            href="/"
            className="inline-block bg-blue-600 hover:bg-blue-500 text-white font-bold px-6 py-3 rounded-xl transition-all"
          >
            חזרה לדף הבית
          </Link>
        </div>
      </div>
    );
  }

  const businessName = tenant.businessName || tenant.name || 'העסק';

  return (
    <CustomerLogin
      tenantId={tenantId}
      businessName={businessName}
      logoUrl={tenant.logoUrl}
      partsRequestPhone={tenant.partsRequestPhone}
    />
  );
}
