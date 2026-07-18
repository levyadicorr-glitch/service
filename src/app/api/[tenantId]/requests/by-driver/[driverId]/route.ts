import { NextRequest, NextResponse } from 'next/server';
import { getServiceRequestsByDriverId, getDriverById, tenantExists } from '@/lib/db';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ tenantId: string; driverId: string }> }
) {
  try {
    const { tenantId, driverId } = await params;

    // Public endpoint (driver panel) — access is gated by knowing the
    // driver's unguessable UUID; validate the tenant before touching its DB.
    if (!(await tenantExists(tenantId))) {
      return NextResponse.json({ error: 'סביבה לא נמצאה' }, { status: 404 });
    }

    const driver = await getDriverById(tenantId, driverId);
    if (!driver) {
      return NextResponse.json({ error: 'נהג לא נמצא' }, { status: 404 });
    }

    const requests = await getServiceRequestsByDriverId(tenantId, driverId);
    return NextResponse.json({ driver: { id: driver.id, name: driver.name }, requests });
  } catch (err: unknown) {
    console.error('Error fetching driver requests:', err);
    return NextResponse.json({ error: 'שגיאת שרת פנימית' }, { status: 500 });
  }
}
