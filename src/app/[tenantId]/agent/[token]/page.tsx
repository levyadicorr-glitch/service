import React from 'react';
import {
  getAgentByToken,
  getCustomers,
  getDrivers,
  getOrdersByAgentId,
  getPartRequestsByAgentId,
  getServiceRequestsByAgentId,
  getTenantById,
  getServiceRequests,
  getOrders,
} from '@/lib/db';
import { normalizeServiceFormConfig } from '@/lib/serviceFormConfig';
import AgentPortal from './AgentPortal';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{
    tenantId: string;
    token: string;
  }>;
}

export default async function AgentPortalPage({ params }: PageProps) {
  const { tenantId, token } = await params;
  const agent = await getAgentByToken(tenantId, token);

  if (!agent) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6" dir="rtl">
        <div className="bg-white p-8 rounded-2xl shadow-md border border-gray-100 text-center max-w-md w-full">
          <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl">
            💼
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">הקישור אינו תקין</h2>
          <p className="text-gray-600">
            לא מצאנו סוכן מכירות שמתאים לקישור המבוקש. אנא ודא שהקישור נכון או פנה למנהל המערכת.
          </p>
        </div>
      </div>
    );
  }

  const tenantObj = await getTenantById(tenantId);
  const businessName = tenantObj?.businessName || tenantObj?.name || 'העסק';
  const serviceFormConfig = normalizeServiceFormConfig(tenantObj?.serviceFormConfig);
  const initialDeviceModels = tenantObj?.deviceModels || ['קורקינט', 'אופניים'];

  const [customers, drivers] = await Promise.all([
    getCustomers(tenantId),
    getDrivers(tenantId),
  ]);

  const [agentRequests, agentPartRequests, agentOrders, allRequestsResult, allOrders] = await Promise.all([
    getServiceRequestsByAgentId(tenantId, agent.id, { customers, drivers }),
    getPartRequestsByAgentId(tenantId, agent.id, { customers }),
    getOrdersByAgentId(tenantId, agent.id, { customers, drivers }),
    getServiceRequests(tenantId, { page: 1, limit: 150, excludeImages: true, customers, drivers }),
    getOrders(tenantId, { customers, drivers }),
  ]);

  const { normalizeModels } = await import('@/lib/db');
  const initialModels = normalizeModels(tenantObj?.models);

  return (
    <AgentPortal
      agent={agent}
      tenantId={tenantId}
      businessName={businessName}
      customers={customers}
      drivers={drivers}
      initialRequests={agentRequests}
      initialPartRequests={agentPartRequests}
      initialOrders={agentOrders}
      allRequests={allRequestsResult.requests}
      allOrders={allOrders}
      initialDeviceModels={initialDeviceModels}
      initialModels={initialModels}
      serviceFormConfig={serviceFormConfig}
    />
  );
}
