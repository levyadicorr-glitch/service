import { NextRequest, NextResponse } from 'next/server';
import { assignDriverToRequest, deleteServiceRequest, getDriverById, getServiceRequestById, updateServiceRequestStatus } from '@/lib/db';
import { requireTenantAdmin } from '@/lib/auth';
import { checkCsrf } from '@/lib/csrf';

// Returns a single request WITH its images. The admin list is loaded without
// images to keep the payload small; the detail modal calls this on open to
// fetch the images for just the one request being viewed.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ tenantId: string; id: string }> }
) {
  try {
    const { tenantId, id } = await params;
    const denied = requireTenantAdmin(req, tenantId);
    if (denied) return denied;

    const request = await getServiceRequestById(tenantId, id);
    if (!request) {
      return NextResponse.json({ error: 'קריאת שירות לא נמצאה' }, { status: 404 });
    }

    return NextResponse.json({ request });
  } catch (err: unknown) {
    console.error('Error fetching request:', err);
    return NextResponse.json({ error: 'שגיאת שרת פנימית' }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ tenantId: string; id: string }> }
) {
  const csrfError = checkCsrf(req);
  if (csrfError) return csrfError;

  try {
    const { tenantId, id } = await params;
    const body = await req.json();
    const { status, driverId, driverToken } = body;

    // Allowed with an admin session, or from the driver panel when the caller
    // proves identity by supplying his own driver UUID — in which case he may
    // only mark a request assigned to him as picked up (same capability model
    // as the customer-portal DELETE below).
    const denied = requireTenantAdmin(req, tenantId);
    if (denied) {
      if (!driverToken || status !== 'PICKED_UP_BY_DRIVER' || driverId !== undefined) return denied;
      const request = await getServiceRequestById(tenantId, id);
      if (!request || request.driverId !== driverToken) return denied;
    }

    if (status === undefined && driverId === undefined) {
      return NextResponse.json({ error: 'סטטוס לא תקין' }, { status: 400 });
    }

    if (status !== undefined && !['NEW', 'WAITING_FOR_PICKUP', 'PICKED_UP_BY_DRIVER', 'COMPLETED'].includes(status)) {
      return NextResponse.json({ error: 'סטטוס לא תקין' }, { status: 400 });
    }

    if (driverId !== undefined && driverId !== null) {
      const driver = await getDriverById(tenantId, driverId);
      if (!driver) {
        return NextResponse.json({ error: 'נהג לא נמצא' }, { status: 400 });
      }
    }

    let updated;
    if (driverId !== undefined) {
      updated = await assignDriverToRequest(tenantId, id, driverId);
    }
    if (status !== undefined) {
      updated = await updateServiceRequestStatus(tenantId, id, status as 'NEW' | 'WAITING_FOR_PICKUP' | 'PICKED_UP_BY_DRIVER' | 'COMPLETED');
    }
    if (!updated) {
      return NextResponse.json({ error: 'קריאת שירות לא נמצאה' }, { status: 404 });
    }

    return NextResponse.json({ success: true, request: updated });
  } catch (err: unknown) {
    console.error('Error updating request status:', err);
    return NextResponse.json({ error: 'שגיאת שרת פנימית' }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ tenantId: string; id: string }> }
) {
  const csrfError = checkCsrf(req);
  if (csrfError) return csrfError;

  try {
    const { tenantId, id } = await params;

    // Allowed either with an admin session, or from the customer portal when the
    // caller proves ownership by supplying the request's customerId (both IDs are
    // unguessable UUIDs, same capability that guards the portal URL itself).
    const denied = requireTenantAdmin(req, tenantId);
    if (denied) {
      const customerId = new URL(req.url).searchParams.get('customerId');
      if (!customerId) return denied;
      const request = await getServiceRequestById(tenantId, id);
      if (!request || request.customerId !== customerId) return denied;
    }

    const deleted = await deleteServiceRequest(tenantId, id);
    if (!deleted) {
      return NextResponse.json({ error: 'קריאת שירות לא נמצאה' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error('Error deleting request:', err);
    return NextResponse.json({ error: 'שגיאת שרת פנימית' }, { status: 500 });
  }
}
