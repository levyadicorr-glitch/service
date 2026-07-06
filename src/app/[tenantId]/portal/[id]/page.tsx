import React from 'react';
import { getCustomerById, getServiceRequestsByCustomerId } from '@/lib/db';
import CustomerPortal from './CustomerPortal';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{
    tenantId: string;
    id: string;
  }>;
}

export default async function PortalPage({ params }: PageProps) {
  const { tenantId, id } = await params;
  const customer = await getCustomerById(tenantId, id);

  if (!customer) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6" dir="rtl">
        <div className="bg-white p-8 rounded-2xl shadow-md border border-gray-100 text-center max-w-md w-full">
          <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">הקישור אינו תקין</h2>
          <p className="text-gray-600 mb-6">
            לא מצאנו לקוח שמתאים למזהה המבוקש. אנא ודא שהקישור נכון או פנה למנהל המערכת.
          </p>
          <Link href={`/${tenantId}/admin`} className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-bold px-6 py-3 rounded-xl shadow transition-colors">
            חזרה לניהול
          </Link>
        </div>
      </div>
    );
  }

  const requests = await getServiceRequestsByCustomerId(tenantId, id);
  const { getTenantById } = await import('@/lib/db');
  const tenantObj = await getTenantById(tenantId);
  const businessName = tenantObj?.businessName || 'העסק';
  const whatsappTemplate = tenantObj?.whatsappTemplate || '';

  return <CustomerPortal customer={customer} initialRequests={requests} tenantId={tenantId} businessName={businessName} whatsappTemplate={whatsappTemplate} />;
}
