import { NextRequest, NextResponse } from 'next/server';
import { addDeviceModelToTenant, tenantExists } from '@/lib/db';
import { requireTenantAdmin } from '@/lib/auth';
import { checkCsrf } from '@/lib/csrf';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> }
) {
  const csrfError = checkCsrf(req);
  if (csrfError) return csrfError;

  try {
    const { tenantId } = await params;
    if (!(await tenantExists(tenantId))) {
      return NextResponse.json({ error: 'סביבה לא נמצאה' }, { status: 404 });
    }

    const denied = requireTenantAdmin(req, tenantId);
    if (denied) return denied;

    const body = await req.json();
    const { modelName } = body;

    if (!modelName || typeof modelName !== 'string' || !modelName.trim()) {
      return NextResponse.json({ error: 'שם הדגם הוא שדה חובה' }, { status: 400 });
    }

    const updatedModels = await addDeviceModelToTenant(tenantId, modelName.trim());
    return NextResponse.json({ success: true, deviceModels: updatedModels });
  } catch (err: unknown) {
    console.error('Error adding device model:', err);
    return NextResponse.json({ error: 'שגיאת שרת פנימית' }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> }
) {
  const csrfError = checkCsrf(req);
  if (csrfError) return csrfError;

  try {
    const { tenantId } = await params;
    if (!(await tenantExists(tenantId))) {
      return NextResponse.json({ error: 'סביבה לא נמצאה' }, { status: 404 });
    }

    const denied = requireTenantAdmin(req, tenantId);
    if (denied) return denied;

    const body = await req.json();
    const { modelName } = body;

    if (!modelName || typeof modelName !== 'string') {
      return NextResponse.json({ error: 'שם הסוג להסרה הוא שדה חובה' }, { status: 400 });
    }

    const { deleteDeviceModelFromTenant } = await import('@/lib/db');
    const updatedModels = await deleteDeviceModelFromTenant(tenantId, modelName);
    return NextResponse.json({ success: true, deviceModels: updatedModels });
  } catch (err: unknown) {
    console.error('Error deleting device model:', err);
    return NextResponse.json({ error: 'שגיאת שרת פנימית' }, { status: 500 });
  }
}
