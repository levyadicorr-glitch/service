import { NextRequest, NextResponse } from 'next/server';
import { getServiceRequestsByCustomerId, getCustomerById, tenantExists } from '@/lib/db';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ tenantId: string; customerId: string }> }
) {
  try {
    const { tenantId, customerId } = await params;

    // Public endpoint (customer portal) — access is gated by knowing the
    // customer's unguessable UUID; validate the tenant before touching its DB.
    if (!(await tenantExists(tenantId))) {
      return NextResponse.json({ error: 'סביבה לא נמצאה' }, { status: 404 });
    }

    const customer = await getCustomerById(tenantId, customerId);
    if (!customer) {
      return NextResponse.json({ error: 'לקוח לא נמצא' }, { status: 404 });
    }

    const requests = await getServiceRequestsByCustomerId(tenantId, customerId);
    return NextResponse.json({ requests });
  } catch (err: unknown) {
    console.error('Error fetching customer requests:', err);
    return NextResponse.json({ error: 'שגיאת שרת פנימית' }, { status: 500 });
  }
}
