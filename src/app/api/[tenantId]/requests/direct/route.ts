import { NextRequest, NextResponse } from 'next/server';
import { createServiceRequest, getCustomerById } from '@/lib/db';

export async function POST(req: NextRequest, props: { params: Promise<{ tenantId: string }> }) {
  try {
    const params = await props.params;
    const { tenantId } = params;
    const body = await req.json();
    const { customerId, toolOwnerName, toolOwnerPhone } = body;

    if (!customerId) {
      return NextResponse.json({ error: 'נא לבחור חנות/לקוח' }, { status: 400 });
    }

    const customer = await getCustomerById(tenantId, customerId);
    if (!customer) {
      return NextResponse.json({ error: 'הלקוח לא נמצא במערכת' }, { status: 404 });
    }

    // Create a new request directly for the driver with WAITING_FOR_PICKUP status
    const newRequest = await createServiceRequest(tenantId, {
      customerId,
      storeName: `${customer.firstName} ${customer.lastName}`,
      toolOwnerName: toolOwnerName || `${customer.firstName} ${customer.lastName}`,
      toolOwnerPhone,
      hasWarranty: false,
      agreedToInspectionFee: true,
      status: 'WAITING_FOR_PICKUP'
    });

    // Attach customer info for real-time frontend mapping
    const responseData = {
      ...newRequest,
      customer
    };

    return NextResponse.json({ success: true, request: responseData });
  } catch (err: unknown) {
    console.error('Error creating direct request:', err);
    const errorMessage = err instanceof Error ? err.message : 'שגיאת שרת פנימית';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
