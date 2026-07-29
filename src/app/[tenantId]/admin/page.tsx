import React from 'react';
import { cookies } from 'next/headers';
import { getServiceRequests, getCustomers, getDrivers, getPartRequests, getOrders, getAgents, getChinaOrders, getTestApprovals, getTechnicians, getTenantById, ensureIndexes } from '@/lib/db';
import { normalizeServiceFormConfig } from '@/lib/serviceFormConfig';
import { normalizeAiBotConfig } from '@/lib/aiBotConfig';
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
  const chinaOrderNotificationPhones = tenantObj?.chinaOrderNotificationPhones || '';
  const testApprovalPrice = tenantObj?.testApprovalPrice ?? 150;
  const testApprovalPhone1 = tenantObj?.testApprovalPhone1 || '';
  const testApprovalPhone2 = tenantObj?.testApprovalPhone2 || '';
  const testApprovalPhone3 = tenantObj?.testApprovalPhone3 || '';
  const testApprovalPhone4 = tenantObj?.testApprovalPhone4 || '';
  const greenApiInstanceId = tenantObj?.greenApiInstanceId || '';
  // Only a derived boolean crosses to the client — the token itself never
  // becomes a prop (it is a write-only secret, like the AI key below).
  const greenApiTokenConfigured = Boolean(tenantObj?.greenApiToken);
  const logoUrl = tenantObj?.logoUrl || '';
  const serviceFormConfig = normalizeServiceFormConfig(tenantObj?.serviceFormConfig);
  const aiBotConfig = normalizeAiBotConfig(tenantObj?.aiBotConfig);
  // Only a derived boolean crosses to the client — the key itself is read
  // exclusively inside gemini.ts and must never become a prop.
  const aiKeyConfigured = Boolean(process.env.GEMINI_API_KEY);
  const initialDeviceModels = tenantObj?.deviceModels || ['קורקינט', 'אופניים'];
  const initialFactories = tenantObj?.factories || [];

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

  const [requestsResult, partRequests, orders, agents, chinaOrders, testApprovals, technicians] = await Promise.all([
    getServiceRequests(tenantId, { page: 1, limit: 200, excludeImages: true, customers, drivers }),
    getPartRequests(tenantId, { excludeImages: true, customers }),
    getOrders(tenantId, { customers, drivers }),
    getAgents(tenantId),
    getChinaOrders(tenantId, { excludeImages: true }),
    getTestApprovals(tenantId),
    getTechnicians(tenantId),
  ]);
  const requests = requestsResult.requests;

  const { normalizeModels } = await import('@/lib/db');
  const initialModels = normalizeModels(tenantObj?.models);

  return <AdminDashboard initialRequests={requests} customers={customers} drivers={drivers} initialPartRequests={partRequests} initialOrders={orders} initialAgents={agents} initialChinaOrders={chinaOrders} initialTestApprovals={testApprovals} initialTechnicians={technicians} initialFactories={initialFactories} initialDeviceModels={initialDeviceModels} initialModels={initialModels} tenantId={tenantId} businessName={businessName} whatsappTemplate={whatsappTemplate} partsRequestPhone={partsRequestPhone} adminWhatsappPhone={adminWhatsappPhone} adminWhatsappPhone2={adminWhatsappPhone2} adminWhatsappPhone3={adminWhatsappPhone3} quoteNotificationPhones={quoteNotificationPhones} chinaOrderNotificationPhones={chinaOrderNotificationPhones} testApprovalPrice={testApprovalPrice} testApprovalPhone1={testApprovalPhone1} testApprovalPhone2={testApprovalPhone2} testApprovalPhone3={testApprovalPhone3} testApprovalPhone4={testApprovalPhone4} greenApiInstanceId={greenApiInstanceId} greenApiTokenConfigured={greenApiTokenConfigured} logoUrl={logoUrl} serviceFormConfig={serviceFormConfig} aiBotConfig={aiBotConfig} aiKeyConfigured={aiKeyConfigured} />;
}
