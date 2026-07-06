import { NextRequest, NextResponse } from 'next/server';
import { getServiceRequestsByCustomerId, getCustomerById } from '@/lib/db';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ tenantId: string; customerId: string }> }
) {
  try {
    const { tenantId, customerId } = await params;

    const customer = await getCustomerById(tenantId, customerId);
    if (!customer) {
      return NextResponse.json({ error: 'לקוח לא נמצא' }, { status: 404 });
    }

    const requests = await getServiceRequestsByCustomerId(tenantId, customerId);
    return NextResponse.json({ requests });
  } catch (err: unknown) {
    console.error('Error fetching customer requests:', err);
    const errorMessage = err instanceof Error ? err.message : 'שגיאת שרת פנימית';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
