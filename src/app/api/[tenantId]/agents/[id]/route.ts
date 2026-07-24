import { NextRequest, NextResponse } from 'next/server';
import { deleteAgent } from '@/lib/db';
import { requireTenantAdmin } from '@/lib/auth';

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ tenantId: string; id: string }> }
) {
  const { tenantId, id } = await params;
  const authErr = requireTenantAdmin(req, tenantId);
  if (authErr) return authErr;

  try {
    const success = await deleteAgent(tenantId, id);
    if (!success) {
      return NextResponse.json({ error: 'סוכן מכירות לא נמצא' }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error('Error deleting agent:', err);
    return NextResponse.json({ error: 'שגיאה במחיקת סוכן מכירות' }, { status: 500 });
  }
}
