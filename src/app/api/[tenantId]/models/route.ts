import { NextRequest, NextResponse } from 'next/server';
import { addModelToTenant, tenantExists } from '@/lib/db';
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

    const body = await req.json();
    const { modelName } = body;

    if (!modelName || typeof modelName !== 'string' || !modelName.trim()) {
      return NextResponse.json({ error: 'שם הדגם הוא שדה חובה' }, { status: 400 });
    }

    const updatedModels = await addModelToTenant(tenantId, modelName.trim());
    return NextResponse.json({ success: true, models: updatedModels });
  } catch (err: unknown) {
    console.error('Error adding model:', err);
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

    const body = await req.json();
    const { modelName } = body;

    if (!modelName || typeof modelName !== 'string') {
      return NextResponse.json({ error: 'שם הדגם להסרה הוא שדה חובה' }, { status: 400 });
    }

    const { deleteModelFromTenant } = await import('@/lib/db');
    const updatedModels = await deleteModelFromTenant(tenantId, modelName);
    return NextResponse.json({ success: true, models: updatedModels });
  } catch (err: unknown) {
    console.error('Error deleting model:', err);
    return NextResponse.json({ error: 'שגיאת שרת פנימית' }, { status: 500 });
  }
}
