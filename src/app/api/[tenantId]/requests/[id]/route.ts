import { NextRequest, NextResponse } from 'next/server';
import { updateServiceRequestStatus } from '@/lib/db';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ tenantId: string; id: string }> }
) {
  try {
    const { tenantId, id } = await params;
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
    const errorMessage = err instanceof Error ? err.message : 'שגיאת שרת פנימית';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ tenantId: string; id: string }> }
) {
  try {
    const { tenantId, id } = await params;
    
    // Import deleteServiceRequest dynamically here or at top of file
    const { deleteServiceRequest } = await import('@/lib/db');
    
    const deleted = await deleteServiceRequest(tenantId, id);
    if (!deleted) {
      return NextResponse.json({ error: 'קריאת שירות לא נמצאה' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error('Error deleting request:', err);
    const errorMessage = err instanceof Error ? err.message : 'שגיאת שרת פנימית';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
