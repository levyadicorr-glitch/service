import { NextRequest, NextResponse } from 'next/server';
import { deletePartRequest, getTenantById, updatePartRequestStatus, getCustomerById } from '@/lib/db';
import { requireTenantAdmin } from '@/lib/auth';
import { checkCsrf } from '@/lib/csrf';
import { sendWhatsAppMessage } from '@/lib/greenApi';

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

    if (status !== 'NEW' && status !== 'FULFILLED' && status !== 'READY_FOR_DISPATCH') {
      return NextResponse.json({ error: 'סטטוס לא תקין' }, { status: 400 });
    }

    const updated = await updatePartRequestStatus(tenantId, id, status);
    if (!updated) {
      return NextResponse.json({ error: 'בקשה לא נמצאה' }, { status: 404 });
    }

    let autoNotifySent = false;
    if (status === 'READY_FOR_DISPATCH') {
      try {
        const tenant = await getTenantById(tenantId);
        const customer = updated.customerId ? await getCustomerById(tenantId, updated.customerId) : undefined;
        const customerPhone = (customer?.phone || '').trim();

        if (customerPhone && tenant?.greenApiInstanceId && tenant?.greenApiToken) {
          const businessName = tenant.businessName || tenant.name || 'העסק';
          const customerFirstName = customer?.firstName || 'לקוח';
          const message = `שלום ${customerFirstName}, החלק שביקשת ("${updated.description}") ב-${businessName} מוכן וממתין לשילוח! 📦🚀`;

          const sendRes = await sendWhatsAppMessage(
            tenant.greenApiInstanceId,
            tenant.greenApiToken,
            customerPhone,
            message
          );
          autoNotifySent = sendRes.sent;
        }
      } catch (waErr) {
        console.error('Error sending WhatsApp ready for dispatch notification:', waErr);
      }
    }

    return NextResponse.json({ success: true, request: updated, autoNotifySent });
  } catch (err: unknown) {
    console.error('Error updating part request:', err);
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

    // Allowed either with an admin session, or from the customer portal when
    // the caller supplies the shop's configured deletion password.
    const denied = requireTenantAdmin(req, tenantId);
    if (denied) {
      let password = '';
      try {
        password = (await req.json())?.password || '';
      } catch {
        // no/invalid JSON body
      }
      const tenant = await getTenantById(tenantId);
      if (!tenant?.partsDeletePassword) {
        return NextResponse.json({ error: 'מחיקה דרך הפורטל אינה מופעלת, יש לפנות לעסק' }, { status: 403 });
      }
      if (password !== tenant.partsDeletePassword) {
        return NextResponse.json({ error: 'סיסמה שגויה' }, { status: 403 });
      }
    }

    const deleted = await deletePartRequest(tenantId, id);
    if (!deleted) {
      return NextResponse.json({ error: 'בקשה לא נמצאה' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error('Error deleting part request:', err);
    return NextResponse.json({ error: 'שגיאת שרת פנימית' }, { status: 500 });
  }
}
