import React from 'react';
import { getServiceRequests } from '@/lib/db';
import DriverDashboard from './DriverDashboard';

// Force dynamic rendering to ensure drivers always see the latest pickups
export const dynamic = 'force-dynamic';

export default async function DriverPage() {
  const requests = await getServiceRequests();

  return <DriverDashboard initialRequests={requests} />;
}
