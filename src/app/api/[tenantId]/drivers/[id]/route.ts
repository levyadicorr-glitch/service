import { NextRequest, NextResponse } from 'next/server';
import { updateDriver, deleteDriver } from '@/lib/db';
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
    const { name, phone } = body;

    if (name !== undefined && (typeof name !== 'string' || !name.trim())) {
      return NextResponse.json({ error: 'שם הנהג הוא שדה חובה' }, { status: 400 });
    }

    const update: { name?: string; phone?: string } = {};
    if (name !== undefined) update.name = name.trim();
    if (phone !== undefined) update.phone = phone || undefined;

    const updated = await updateDriver(tenantId, id, update);
    if (!updated) {
      return NextResponse.json({ error: 'נהג לא נמצא' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error('Error updating driver:', err);
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

    const deleted = await deleteDriver(tenantId, id);
    if (!deleted) {
      return NextResponse.json({ error: 'נהג לא נמצא' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error('Error deleting driver:', err);
    return NextResponse.json({ error: 'שגיאת שרת פנימית' }, { status: 500 });
  }
}
