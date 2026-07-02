import React from 'react';
import { getServiceRequests, getCustomers } from '@/lib/db';
import AdminDashboard from './AdminDashboard';

// Force dynamic rendering to ensure the admin dashboard always sees the latest requests
export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const requests = await getServiceRequests();
  const customers = await getCustomers();

  return <AdminDashboard initialRequests={requests} customers={customers} />;
}
