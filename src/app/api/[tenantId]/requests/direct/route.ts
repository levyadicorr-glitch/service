import { NextRequest, NextResponse } from 'next/server';
import { createServiceRequest, getCustomerById, getDriverById } from '@/lib/db';
import { requireTenantAdmin } from '@/lib/auth';
import { checkCsrf } from '@/lib/csrf';

export async function POST(req: NextRequest, props: { params: Promise<{ tenantId: string }> }) {
  const csrfError = checkCsrf(req);
  if (csrfError) return csrfError;

  try {
    const params = await props.params;
    const { tenantId } = params;
    const denied = requireTenantAdmin(req, tenantId);
    if (denied) return denied;

    const body = await req.json();
    const { customerId, toolOwnerName, toolOwnerPhone, driverId } = body;

    if (!customerId) {
      return NextResponse.json({ error: 'נא לבחור חנות/לקוח' }, { status: 400 });
    }

    const customer = await getCustomerById(tenantId, customerId);
    if (!customer) {
      return NextResponse.json({ error: 'הלקוח לא נמצא במערכת' }, { status: 404 });
    }

    if (driverId) {
      const driver = await getDriverById(tenantId, driverId);
      if (!driver) {
        return NextResponse.json({ error: 'נהג לא נמצא' }, { status: 400 });
      }
    }

    // Create a new request directly for the driver with WAITING_FOR_PICKUP status
    const newRequest = await createServiceRequest(tenantId, {
      customerId,
      storeName: `${customer.firstName} ${customer.lastName}`,
      toolOwnerName: toolOwnerName || `${customer.firstName} ${customer.lastName}`,
      toolOwnerPhone,
      hasWarranty: false,
      agreedToInspectionFee: true,
      status: 'WAITING_FOR_PICKUP',
      driverId: driverId || undefined
    });

    // Attach customer info for real-time frontend mapping
    const responseData = {
      ...newRequest,
      customer
    };

    return NextResponse.json({ success: true, request: responseData });
  } catch (err: unknown) {
    console.error('Error creating direct request:', err);
    return NextResponse.json({ error: 'שגיאת שרת פנימית' }, { status: 500 });
  }
}
