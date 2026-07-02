import { NextRequest, NextResponse } from 'next/server';
import { updateServiceRequestStatus } from '@/lib/db';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { status } = body;

    if (!status || !['NEW', 'WAITING_FOR_PICKUP', 'PICKED_UP_BY_DRIVER'].includes(status)) {
      return NextResponse.json({ error: 'סטטוס לא תקין' }, { status: 400 });
    }

    const updated = await updateServiceRequestStatus(id, status as 'NEW' | 'WAITING_FOR_PICKUP' | 'PICKED_UP_BY_DRIVER');
    if (!updated) {
      return NextResponse.json({ error: 'קריאת שירות לא נמצאה' }, { status: 404 });
    }

    return NextResponse.json({ success: true, request: updated });
  } catch (err: any) {
    console.error('Error updating request status:', err);
    return NextResponse.json({ error: err.message || 'שגיאת שרת פנימית' }, { status: 500 });
  }
}
