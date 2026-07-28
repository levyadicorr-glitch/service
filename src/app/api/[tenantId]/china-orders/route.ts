import { NextRequest, NextResponse } from 'next/server';
import { createChinaOrder, getChinaOrders, getTechnicianByToken, tenantExists, getTenantById } from '@/lib/db';
import { requireTenantAdmin } from '@/lib/auth';
import { checkCsrf } from '@/lib/csrf';
import { sendChinaOrderNotification, type ChinaNotifyResult } from '@/lib/greenApi';

const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // 8MB per file, before compression

function validateImageFile(file: File): string | null {
  if (file.size > MAX_IMAGE_BYTES) {
    return 'קובץ תמונה גדול מדי (מקסימום 8MB)';
  }
  if (file.type && !file.type.startsWith('image/')) {
    return 'ניתן להעלות קבצי תמונה בלבד';
  }
  return null;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ tenantId: string }> }) {
  try {
    const { tenantId } = await params;
    const denied = requireTenantAdmin(req, tenantId);
    if (denied) return denied;

    const orders = await getChinaOrders(tenantId, { excludeImages: true });
    return NextResponse.json({ orders });
  } catch (err: unknown) {
    console.error('Error fetching china orders:', err);
    return NextResponse.json({ error: 'שגיאת שרת פנימית' }, { status: 500 });
  }
}

// Dual-mode create:
//  - Admin (valid admin_session) → source 'admin', status 'WAITING_TO_ORDER'.
//  - Technician (valid technicianToken in the body) → source 'technician',
//    status 'PENDING_APPROVAL' (lands in the admin approval queue).
export async function POST(req: NextRequest, { params }: { params: Promise<{ tenantId: string }> }) {
  const csrfError = checkCsrf(req);
  if (csrfError) return csrfError;

  try {
    const { tenantId } = await params;
    if (!(await tenantExists(tenantId))) {
      return NextResponse.json({ error: 'סביבה לא נמצאה' }, { status: 404 });
    }

    const formData = await req.formData();
    const partName = ((formData.get('partName') as string) || '').trim();
    const factory = ((formData.get('factory') as string) || '').trim();
    const quantityRaw = (formData.get('quantity') as string) || '';
    const photo = formData.get('photo') as File | null;
    const technicianToken = ((formData.get('technicianToken') as string) || '').trim();

    if (!partName) {
      return NextResponse.json({ error: 'שם החלק הינו שדה חובה' }, { status: 400 });
    }
    const quantity = parseInt(quantityRaw, 10);
    if (!Number.isFinite(quantity) || quantity < 1) {
      return NextResponse.json({ error: 'כמות לא תקינה' }, { status: 400 });
    }

    // Authorize the caller: admin session OR a valid technician token.
    let source: 'admin' | 'technician' = 'admin';
    let status: 'PENDING_APPROVAL' | 'WAITING_TO_ORDER' = 'WAITING_TO_ORDER';
    let technicianId: string | undefined;
    let technicianName: string | undefined;

    if (technicianToken) {
      const technician = await getTechnicianByToken(tenantId, technicianToken);
      if (!technician) {
        return NextResponse.json({ error: 'הקישור אינו תקין' }, { status: 403 });
      }
      source = 'technician';
      status = 'PENDING_APPROVAL';
      technicianId = technician.id;
      technicianName = technician.name;
    } else {
      const denied = requireTenantAdmin(req, tenantId);
      if (denied) return denied;
    }

    let photoImage = '';
    if (photo && photo.size > 0) {
      const fileError = validateImageFile(photo);
      if (fileError) {
        return NextResponse.json({ error: fileError }, { status: 400 });
      }
      try {
        const sharp = (await import('sharp')).default;
        const photoBuffer = Buffer.from(await photo.arrayBuffer());
        const webpBuffer = await sharp(photoBuffer)
          .resize(1200, 1200, { fit: 'inside', withoutEnlargement: true })
          .webp({ quality: 80 })
          .toBuffer();
        photoImage = `data:image/webp;base64,${webpBuffer.toString('base64')}`;
      } catch (sharpErr) {
        console.warn('[CHINA-ORDERS] Sharp native library unavailable, fallback to raw base64:', sharpErr);
        const photoBuffer = Buffer.from(await photo.arrayBuffer());
        const mime = photo.type || 'image/jpeg';
        photoImage = `data:${mime};base64,${photoBuffer.toString('base64')}`;
      }
    }

    const newOrder = await createChinaOrder(tenantId, {
      partName,
      photoImage,
      quantity,
      factory,
      status,
      source,
      technicianId,
      technicianName,
    });

    // Best-effort automatic WhatsApp notification to the admin numbers when a
    // China part order is placed (by admin or technician). A failure here must
    // never fail the order creation itself — `notify` reports back exactly what
    // happened so the admin UI can explain why a message did/didn't go out.
    let notify: ChinaNotifyResult = { sent: false, sentCount: 0, reason: 'skipped' };
    try {
      const tenant = await getTenantById(tenantId);
      const businessName = tenant?.businessName || tenant?.name || 'העסק';
      const factoryLine = newOrder.factory ? `\n🏭 מפעל: ${newOrder.factory}` : '';
      const bySource = source === 'technician'
        ? `\n🔧 נפתחה ע"י טכנאי: ${technicianName || ''}`.trimEnd()
        : '\n👤 נפתחה מממשק הניהול';
      const statusLine = status === 'PENDING_APPROVAL' ? '\n⏳ ממתינה לאישור' : '';
      const message = `🆕 הזמנת חלק מסין חדשה ב-${businessName}\nחלק: ${newOrder.partName}\nכמות: ${newOrder.quantity}${factoryLine}${bySource}${statusLine}\nמספר הזמנה: #${newOrder.orderNumber}`;
      notify = await sendChinaOrderNotification(tenant || {}, message);
      console.log('[CHINA-ORDERS] CREATE notify:', { tenantId, orderId: newOrder.id, reason: notify.reason });
    } catch (notifyErr) {
      console.error('Error sending China-order creation WhatsApp notification:', notifyErr);
      notify = { sent: false, sentCount: 0, reason: `error: ${notifyErr instanceof Error ? notifyErr.message : 'unknown'}` };
    }

    return NextResponse.json({ success: true, order: newOrder, notify }, { status: 201 });
  } catch (err: unknown) {
    console.error('Error creating china order:', err);
    return NextResponse.json({ error: 'שגיאת שרת פנימית' }, { status: 500 });
  }
}
