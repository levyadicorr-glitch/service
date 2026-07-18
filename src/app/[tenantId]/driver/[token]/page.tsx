import React from 'react';
import { getDriverById, getServiceRequestsByDriverId, getTenantById } from '@/lib/db';
import DriverPanel from './DriverPanel';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{
    tenantId: string;
    token: string;
  }>;
}

export default async function DriverPanelPage({ params }: PageProps) {
  const { tenantId, token } = await params;
  const driver = await getDriverById(tenantId, token);

  if (!driver) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6" dir="rtl">
        <div className="bg-white p-8 rounded-2xl shadow-md border border-gray-100 text-center max-w-md w-full">
          <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">הקישור אינו תקין</h2>
          <p className="text-gray-600">
            לא מצאנו נהג שמתאים לקישור המבוקש. אנא ודא שהקישור נכון או פנה למנהל המערכת.
          </p>
        </div>
      </div>
    );
  }

  const requests = await getServiceRequestsByDriverId(tenantId, driver.id);
  const tenantObj = await getTenantById(tenantId);
  const businessName = tenantObj?.businessName || 'העסק';

  return <DriverPanel driver={driver} initialRequests={requests} tenantId={tenantId} businessName={businessName} />;
}
