import React from 'react';
import { getServiceRequests, getCustomers } from '@/lib/db';
import AdminDashboard from './AdminDashboard';

// Force dynamic rendering to ensure the admin dashboard always sees the latest requests
export const dynamic = 'force-dynamic';

export default async function AdminPage(props: { params: Promise<{ tenantId: string }> }) {
  const params = await props.params;
  const { tenantId } = params;
  const requests = await getServiceRequests(tenantId);
  const customers = await getCustomers(tenantId);
  const { getTenantById } = await import('@/lib/db');
  const tenantObj = await getTenantById(tenantId);
  const businessName = tenantObj?.businessName || 'העסק';
  const whatsappTemplate = tenantObj?.whatsappTemplate || '';

  return <AdminDashboard initialRequests={requests} customers={customers} tenantId={tenantId} businessName={businessName} whatsappTemplate={whatsappTemplate} />;
}
