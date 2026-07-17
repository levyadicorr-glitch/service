import { NextRequest, NextResponse } from 'next/server';
import { deleteServiceRequest, getServiceRequestById, updateServiceRequestStatus } from '@/lib/db';
import { requireTenantAdmin } from '@/lib/auth';
import { checkCsrf } from '@/lib/csrf';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ tenantId: string; id: string }> }
) {
  const csrfError = checkCsrf(req);
  if (csrfError) return csrfError;

  try {
    const { tenantId, id } = await params;
    const denied = requireTenantAdmin(req, tenantId);
    if (denied) return denied;

    const body = await req.json();
    const { status } = body;

    if (!status || !['NEW', 'WAITING_FOR_PICKUP', 'PICKED_UP_BY_DRIVER', 'COMPLETED'].includes(status)) {
      return NextResponse.json({ error: 'סטטוס לא תקין' }, { status: 400 });
    }

    const updated = await updateServiceRequestStatus(tenantId, id, status as 'NEW' | 'WAITING_FOR_PICKUP' | 'PICKED_UP_BY_DRIVER' | 'COMPLETED');
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
