import { NextRequest, NextResponse } from 'next/server';
import { deleteChinaOrder, updateChinaOrderStatus, getTenantById } from '@/lib/db';
import { requireTenantAdmin } from '@/lib/auth';
import { checkCsrf } from '@/lib/csrf';
import { sendWhatsAppMessage } from '@/lib/greenApi';

const VALID_STATUSES = ['PENDING_APPROVAL', 'WAITING_TO_ORDER', 'ORDERED', 'ARRIVED'] as const;
type ChinaOrderStatus = (typeof VALID_STATUSES)[number];

// Admin: change the lifecycle status. Approving a technician submission is just
// a PATCH from 'PENDING_APPROVAL' to 'WAITING_TO_ORDER'.
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

    const updated = await updateChinaOrderStatus(tenantId, id, status as ChinaOrderStatus);
    if (!updated) {
      return NextResponse.json({ error: 'הזמנה לא נמצאה' }, { status: 404 });
    }

    // When a China part is marked ORDERED, notify the dedicated China-order
    // notification phones over WhatsApp. Best-effort: a failed/absent send must
    // never fail the status update itself. `notify` reports back exactly what
    // happened so the admin UI can explain why a message did/didn't go out.
    let notify: { sent: boolean; sentCount: number; reason: string } = {
      sent: false,
      sentCount: 0,
      reason: 'not_ordered',
    };
    if (status === 'ORDERED') {
      try {
        const tenant = await getTenantById(tenantId);
        const recipients = Array.from(new Set(
          (tenant?.chinaOrderNotificationPhones || '')
            .split(/[,\n;]/)
            .map((p) => p.trim())
            .filter((p) => p.length > 0)
        ));
        console.log('[CHINA-ORDERS] ORDERED notify:', {
          tenantId,
          orderId: id,
          recipients,
          hasInstance: !!tenant?.greenApiInstanceId,
          hasToken: !!tenant?.greenApiToken,
        });

        if (recipients.length === 0) {
          notify = { sent: false, sentCount: 0, reason: 'no_phones' };
        } else if (!tenant?.greenApiInstanceId || !tenant?.greenApiToken) {
          notify = { sent: false, sentCount: 0, reason: 'no_greenapi' };
        } else {
          const businessName = tenant.businessName || tenant.name || 'העסק';
          const factoryLine = updated.factory ? `\n🏭 מפעל: ${updated.factory}` : '';
          const techLine = updated.technicianName ? `\n🔧 טכנאי: ${updated.technicianName}` : '';
          const message = `📦 הוזמן חלק מסין ב-${businessName}\nחלק: ${updated.partName}\nכמות: ${updated.quantity}${factoryLine}${techLine}\nמספר הזמנה: #${updated.orderNumber}`;
          const results = await Promise.all(
            recipients.map((p) => sendWhatsAppMessage(tenant.greenApiInstanceId!, tenant.greenApiToken!, p, message))
          );
          const sentCount = results.filter((r) => r.sent).length;
          const firstError = results.find((r) => !r.sent)?.error;
          console.log('[CHINA-ORDERS] send results:', results);
          notify = {
            sent: sentCount > 0,
            sentCount,
            reason: sentCount > 0 ? 'sent' : `send_failed: ${firstError || 'unknown'}`,
          };
        }
      } catch (notifyErr) {
        console.error('Error sending China-order WhatsApp notification:', notifyErr);
        notify = { sent: false, sentCount: 0, reason: `error: ${notifyErr instanceof Error ? notifyErr.message : 'unknown'}` };
      }
    }

    return NextResponse.json({ success: true, order: updated, notify });
  } catch (err: unknown) {
    console.error('Error updating china order:', err);
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

    const deleted = await deleteChinaOrder(tenantId, id);
    if (!deleted) {
      return NextResponse.json({ error: 'הזמנה לא נמצאה' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error('Error deleting china order:', err);
    return NextResponse.json({ error: 'שגיאת שרת פנימית' }, { status: 500 });
  }
}
