import { NextRequest, NextResponse } from 'next/server';
import { addFactoryToTenant, deleteFactoryFromTenant, tenantExists } from '@/lib/db';
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
    const { factoryName } = body;

    if (!factoryName || typeof factoryName !== 'string' || !factoryName.trim()) {
      return NextResponse.json({ error: 'שם המפעל הוא שדה חובה' }, { status: 400 });
    }

    const updatedFactories = await addFactoryToTenant(tenantId, factoryName.trim());
    return NextResponse.json({ success: true, factories: updatedFactories });
  } catch (err: unknown) {
    console.error('Error adding factory:', err);
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
    const { factoryName } = body;

    if (!factoryName || typeof factoryName !== 'string') {
      return NextResponse.json({ error: 'שם המפעל להסרה הוא שדה חובה' }, { status: 400 });
    }

    const updatedFactories = await deleteFactoryFromTenant(tenantId, factoryName);
    return NextResponse.json({ success: true, factories: updatedFactories });
  } catch (err: unknown) {
    console.error('Error deleting factory:', err);
    return NextResponse.json({ error: 'שגיאת שרת פנימית' }, { status: 500 });
  }
}
