import React from 'react';
import { getTechnicianByToken, getTenantById } from '@/lib/db';
import TechnicianPortal from './TechnicianPortal';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{
    tenantId: string;
    token: string;
  }>;
}

export default async function TechnicianPortalPage({ params }: PageProps) {
  const { tenantId, token } = await params;
  const technician = await getTechnicianByToken(tenantId, token);

  if (!technician) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6" dir="rtl">
        <div className="bg-white p-8 rounded-2xl shadow-md border border-gray-100 text-center max-w-md w-full">
          <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl">
            🔧
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">הקישור אינו תקין</h2>
          <p className="text-gray-600">
            לא מצאנו טכנאי שמתאים לקישור המבוקש. אנא ודא שהקישור נכון או פנה למנהל המערכת.
          </p>
        </div>
      </div>
    );
  }

  const tenantObj = await getTenantById(tenantId);
  const businessName = tenantObj?.businessName || tenantObj?.name || 'העסק';
  const factories = tenantObj?.factories || [];

  return (
    <TechnicianPortal
      technician={technician}
      tenantId={tenantId}
      businessName={businessName}
      factories={factories}
    />
  );
}
