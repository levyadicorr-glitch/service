import React from 'react';
import { cookies } from 'next/headers';
import { getServiceRequests, getTenantById } from '@/lib/db';
import { SESSION_COOKIE, verifySessionToken } from '@/lib/auth';
import AdminLogin from '../AdminLogin';
import DriverDashboard from './DriverDashboard';

// Force dynamic rendering to ensure drivers always see the latest pickups
export const dynamic = 'force-dynamic';

export default async function DriverPage(props: { params: Promise<{ tenantId: string }> }) {
  const params = await props.params;
  const { tenantId } = params;
  const tenantObj = await getTenantById(tenantId);
  const businessName = tenantObj?.businessName || 'העסק';

  // Pickup list contains customer names, phones and addresses — require a session.
  const cookieStore = await cookies();
  const session = verifySessionToken(cookieStore.get(SESSION_COOKIE)?.value);
  if (!session || session.tenantId !== tenantId) {
    return <AdminLogin tenantId={tenantId} businessName={businessName} title="כניסת נהג" />;
  }

  const requests = await getServiceRequests(tenantId);

  return <DriverDashboard initialRequests={requests} tenantId={tenantId} businessName={businessName} />;
}
