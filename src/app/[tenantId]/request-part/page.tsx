import React from 'react';
import { getTenantById } from '@/lib/db';
import SalesPartRequestFlow from './SalesPartRequestFlow';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{
    tenantId: string;
  }>;
}

export default async function RequestPartPage({ params }: PageProps) {
  const { tenantId } = await params;
  const tenantObj = await getTenantById(tenantId);

  const businessName = tenantObj?.businessName || tenantObj?.name || 'העסק';
  const logoUrl = tenantObj?.logoUrl;
  const partsRequestPhone = tenantObj?.partsRequestPhone || tenantObj?.adminWhatsappPhone || '';

  return (
    <SalesPartRequestFlow
      tenantId={tenantId}
      businessName={businessName}
      logoUrl={logoUrl}
      partsRequestPhone={partsRequestPhone}
    />
  );
}
