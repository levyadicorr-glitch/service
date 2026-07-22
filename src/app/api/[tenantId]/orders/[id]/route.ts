import { NextRequest, NextResponse } from 'next/server';
import { assignDriverToOrder, deleteOrder, getDriverById, updateOrderStatus } from '@/lib/db';
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
    const { status, driverId } = body;

    if (status === undefined && driverId === undefined) {
      return NextResponse.json({ error: 'אין מה לעדכן' }, { status: 400 });
    }

    if (status !== undefined && !['PENDING', 'FULFILLED', 'CANCELLED'].includes(status)) {
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
      updated = await assignDriverToOrder(tenantId, id, driverId);
    }
    if (status !== undefined) {
      updated = await updateOrderStatus(tenantId, id, status);
    }
    if (!updated) {
      return NextResponse.json({ error: 'הזמנה לא נמצאה' }, { status: 404 });
    }

    return NextResponse.json({ success: true, order: updated });
  } catch (err: unknown) {
    console.error('Error updating order:', err);
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
    const denied = requireTenantAdmin(req, tenantId);
    if (denied) return denied;

    const deleted = await deleteOrder(tenantId, id);
    if (!deleted) {
      return NextResponse.json({ error: 'הזמנה לא נמצאה' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error('Error deleting order:', err);
    return NextResponse.json({ error: 'שגיאת שרת פנימית' }, { status: 500 });
  }
}
