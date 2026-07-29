import { NextRequest, NextResponse } from 'next/server';
import { deleteTestApproval, updateTestApprovalStatus } from '@/lib/db';
import { requireTenantAdmin } from '@/lib/auth';
import { checkCsrf } from '@/lib/csrf';

const VALID_STATUSES = ['PENDING_APPROVAL', 'APPROVED'] as const;
type TestApprovalStatus = (typeof VALID_STATUSES)[number];

// Manual override — lets the admin mark a request approved directly (e.g. the
// customer approved verbally / in person) without waiting on the WhatsApp reply.
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
    const { status } = body;

    if (!VALID_STATUSES.includes(status)) {
      return NextResponse.json({ error: 'סטטוס לא תקין' }, { status: 400 });
    }

    const updated = await updateTestApprovalStatus(tenantId, id, status as TestApprovalStatus);
    if (!updated) {
      return NextResponse.json({ error: 'בקשה לא נמצאה' }, { status: 404 });
    }

    return NextResponse.json({ success: true, approval: updated });
  } catch (err: unknown) {
    console.error('Error updating test approval:', err);
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

    const deleted = await deleteTestApproval(tenantId, id);
    if (!deleted) {
      return NextResponse.json({ error: 'בקשה לא נמצאה' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error('Error deleting test approval:', err);
    return NextResponse.json({ error: 'שגיאת שרת פנימית' }, { status: 500 });
  }
}
