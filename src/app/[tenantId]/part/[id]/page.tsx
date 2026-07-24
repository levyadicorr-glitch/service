import React from 'react';
import { getPartRequestById, getTenantById, getCustomerById } from '@/lib/db';
import PartRequestClientView from './PartRequestClientView';
import { redirect } from 'next/navigation';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{
    tenantId: string;
    id: string;
  }>;
}

export default async function PartRequestPage({ params }: PageProps) {
  const { tenantId, id } = await params;

  const partRequest = await getPartRequestById(tenantId, id);

  if (!partRequest) {
    // Check if id is actually a Customer ID and redirect to portal if so
    const customer = await getCustomerById(tenantId, id);
    if (customer) {
      redirect(`/${tenantId}/portal/${id}`);
    }

    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 text-slate-100" dir="rtl">
        <div className="bg-slate-900 border border-slate-800 p-8 rounded-3xl text-center max-w-md w-full shadow-2xl space-y-4">
          <div className="w-16 h-16 bg-red-500/10 text-red-400 rounded-full flex items-center justify-center mx-auto">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-white">בקשת החלק לא נמצאה</h2>
          <p className="text-slate-400 text-sm leading-relaxed">
            לא מצאנו בקשת חלק עם המזהה המבוקש. אנא ודא שהקישור תקין או פנה לניהול.
          </p>
          <Link
            href={`/${tenantId}/admin`}
            className="inline-block bg-blue-600 hover:bg-blue-500 text-white font-bold px-6 py-3 rounded-xl shadow-lg transition-all"
          >
            חזרה לדשבורד מנהל
          </Link>
        </div>
      </div>
    );
  }

  const tenantObj = await getTenantById(tenantId);
  const businessName = tenantObj?.businessName || tenantObj?.name || 'העסק';
  const logoUrl = tenantObj?.logoUrl;

  return (
    <PartRequestClientView
      partRequest={partRequest}
      tenantId={tenantId}
      businessName={businessName}
      logoUrl={logoUrl}
    />
  );
}
