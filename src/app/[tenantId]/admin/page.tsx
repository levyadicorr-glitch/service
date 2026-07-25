import React from 'react';
import { cookies } from 'next/headers';
import { getServiceRequests, getCustomers, getDrivers, getPartRequests, getOrders, getAgents, getTenantById, ensureIndexes } from '@/lib/db';
import { normalizeServiceFormConfig } from '@/lib/serviceFormConfig';
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
  const partsRequestPhone = tenantObj?.partsRequestPhone || '';
  const adminWhatsappPhone = tenantObj?.adminWhatsappPhone || '';
  const adminWhatsappPhone2 = tenantObj?.adminWhatsappPhone2 || '';
  const adminWhatsappPhone3 = tenantObj?.adminWhatsappPhone3 || '';
  const quoteNotificationPhones = tenantObj?.quoteNotificationPhones || '';
  const greenApiInstanceId = tenantObj?.greenApiInstanceId || '';
  const logoUrl = tenantObj?.logoUrl || '';
  const serviceFormConfig = normalizeServiceFormConfig(tenantObj?.serviceFormConfig);
  const initialDeviceModels = tenantObj?.deviceModels || ['קורקינט', 'אופניים'];

  // No data leaves the server before a valid admin session exists for this tenant.
  const cookieStore = await cookies();
  const session = verifySessionToken(cookieStore.get(SESSION_COOKIE)?.value);
  if (!session || session.tenantId !== tenantId) {
    return <AdminLogin tenantId={tenantId} businessName={businessName} />;
  }

  // Make sure indexes exist before the first queries run (cached per warm
  // process, so this is a no-op after the first load).
  await ensureIndexes(tenantId);

  // Load customers + drivers once, then feed them into every join so the other
  // loaders don't re-scan those collections. The list loaders exclude base64
  // images from their payloads — images load on demand (detail modal / lazy
  // thumbnails) instead of bloating the initial server-rendered payload.
  const [customers, drivers] = await Promise.all([
    getCustomers(tenantId),
    getDrivers(tenantId),
  ]);

  const [requestsResult, partRequests, orders, agents] = await Promise.all([
    getServiceRequests(tenantId, { page: 1, limit: 200, excludeImages: true, customers, drivers }),
    getPartRequests(tenantId, { excludeImages: true, customers }),
    getOrders(tenantId, { customers, drivers }),
    getAgents(tenantId),
  ]);
  const requests = requestsResult.requests;

  const { normalizeModels } = await import('@/lib/db');
  const initialModels = normalizeModels(tenantObj?.models);

  return <AdminDashboard initialRequests={requests} customers={customers} drivers={drivers} initialPartRequests={partRequests} initialOrders={orders} initialAgents={agents} initialDeviceModels={initialDeviceModels} initialModels={initialModels} tenantId={tenantId} businessName={businessName} whatsappTemplate={whatsappTemplate} partsRequestPhone={partsRequestPhone} adminWhatsappPhone={adminWhatsappPhone} adminWhatsappPhone2={adminWhatsappPhone2} adminWhatsappPhone3={adminWhatsappPhone3} quoteNotificationPhones={quoteNotificationPhones} greenApiInstanceId={greenApiInstanceId} logoUrl={logoUrl} serviceFormConfig={serviceFormConfig} />;
}
