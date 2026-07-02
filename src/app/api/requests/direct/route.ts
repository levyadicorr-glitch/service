import { NextRequest, NextResponse } from 'next/server';
import { createServiceRequest, getCustomerById } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { customerId, toolOwnerName } = body;

    if (!customerId) {
      return NextResponse.json({ error: 'נא לבחור חנות/לקוח' }, { status: 400 });
    }

    const customer = await getCustomerById(customerId);
    if (!customer) {
      return NextResponse.json({ error: 'הלקוח לא נמצא במערכת' }, { status: 404 });
    }

    // Create a new request directly for the driver with WAITING_FOR_PICKUP status
    const newRequest = await createServiceRequest({
      customerId,
      storeName: `${customer.firstName} ${customer.lastName}`,
      toolOwnerName: toolOwnerName || `${customer.firstName} ${customer.lastName}`,
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
  } catch (err: any) {
    console.error('Error creating direct request:', err);
    return NextResponse.json({ error: err.message || 'שגיאת שרת פנימית' }, { status: 500 });
  }
}
