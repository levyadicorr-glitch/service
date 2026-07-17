import React from 'react';
import { cookies } from 'next/headers';
import { getServiceRequests, getCustomers, getTenantById } from '@/lib/db';
import { SESSION_COOKIE, verifySessionToken } from '@/lib/auth';
import AdminLogin from '../AdminLogin';
import AdminDashboard from './AdminDashboard';

// Force dynamic rendering to ensure the admin dashboard always sees the latest requests
export const dynamic = 'force-dynamic';

export default async function AdminPage(props: { params: Promise<{ tenantId: string }> }) {
  const params = await props.params;
  const { tenantId } = params;
  const tenantObj = await getTenantById(tenantId);
  const businessName = tenantObj?.businessName || 'העסק';
  const whatsappTemplate = tenantObj?.whatsappTemplate || '';

  // No data leaves the server before a valid admin session exists for this tenant.
  const cookieStore = await cookies();
  const session = verifySessionToken(cookieStore.get(SESSION_COOKIE)?.value);
  if (!session || session.tenantId !== tenantId) {
    return <AdminLogin tenantId={tenantId} businessName={businessName} />;
  }

  const requests = await getServiceRequests(tenantId);
  const customers = await getCustomers(tenantId);

  return <AdminDashboard initialRequests={requests} customers={customers} tenantId={tenantId} businessName={businessName} whatsappTemplate={whatsappTemplate} />;
}
