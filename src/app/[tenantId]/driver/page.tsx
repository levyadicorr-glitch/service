import React from 'react';
import { getServiceRequests } from '@/lib/db';
import DriverDashboard from './DriverDashboard';

// Force dynamic rendering to ensure drivers always see the latest pickups
export const dynamic = 'force-dynamic';

export default async function DriverPage(props: { params: Promise<{ tenantId: string }> }) {
  const params = await props.params;
  const { tenantId } = params;
  const requests = await getServiceRequests(tenantId);
  const { getTenantById } = await import('@/lib/db');
  const tenantObj = await getTenantById(tenantId);
  const businessName = tenantObj?.businessName || 'העסק';

  return <DriverDashboard initialRequests={requests} tenantId={tenantId} businessName={businessName} />;
}
