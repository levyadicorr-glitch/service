import { NextRequest, NextResponse } from 'next/server';
import { deleteCustomer } from '@/lib/db';

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ tenantId: string; id: string }> }
) {
  try {
    const { tenantId, id } = await params;
    
    const deleted = await deleteCustomer(tenantId, id);
    if (!deleted) {
      return NextResponse.json({ error: 'לקוח לא נמצא' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error('Error deleting customer:', err);
    const errorMessage = err instanceof Error ? err.message : 'שגיאת שרת פנימית';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
