import { NextRequest, NextResponse } from 'next/server';
import { deleteCustomer } from '@/lib/db';
import { requireTenantAdmin } from '@/lib/auth';

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ tenantId: string; id: string }> }
) {
  try {
    const { tenantId, id } = await params;
    const denied = requireTenantAdmin(req, tenantId);
    if (denied) return denied;

    const deleted = await deleteCustomer(tenantId, id);
    if (!deleted) {
      return NextResponse.json({ error: 'לקוח לא נמצא' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error('Error deleting customer:', err);
    return NextResponse.json({ error: 'שגיאת שרת פנימית' }, { status: 500 });
  }
}
