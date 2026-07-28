import { NextRequest, NextResponse } from 'next/server';
import { deleteTechnician } from '@/lib/db';
import { requireTenantAdmin } from '@/lib/auth';

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ tenantId: string; id: string }> }
) {
  const { tenantId, id } = await params;
  const authErr = requireTenantAdmin(req, tenantId);
  if (authErr) return authErr;

  try {
    const success = await deleteTechnician(tenantId, id);
    if (!success) {
      return NextResponse.json({ error: 'טכנאי לא נמצא' }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error('Error deleting technician:', err);
    return NextResponse.json({ error: 'שגיאה במחיקת טכנאי' }, { status: 500 });
  }
}
