import { NextRequest, NextResponse } from 'next/server';
import { createPartRequest, getCustomerById, getPartRequests, getTenantById, tenantExists } from '@/lib/db';
import { requireTenantAdmin } from '@/lib/auth';
import { checkCsrf } from '@/lib/csrf';
import { sendWhatsAppMessage } from '@/lib/greenApi';

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

    const requests = await getPartRequests(tenantId);
    return NextResponse.json({ requests });
  } catch (err: unknown) {
    console.error('Error fetching part requests:', err);
    return NextResponse.json({ error: 'שגיאת שרת פנימית' }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ tenantId: string }> }) {
  const csrfError = checkCsrf(req);
  if (csrfError) return csrfError;

  try {
    const sharp = (await import('sharp')).default;
    const { tenantId } = await params;
    // Public endpoint (customer portal) — validate the tenant before touching its DB.
    if (!(await tenantExists(tenantId))) {
      return NextResponse.json({ error: 'סביבה לא נמצאה' }, { status: 404 });
    }

    const formData = await req.formData();
    const customerId = formData.get('customerId') as string;
    const description = (formData.get('description') as string || '').trim();
    const photo = formData.get('photo') as File | null;
    const agentId = formData.get('agentId') as string || undefined;
    const agentName = formData.get('agentName') as string || undefined;

    if (!customerId || !description) {
      return NextResponse.json({ error: 'שדות חובה חסרים' }, { status: 400 });
    }
    if (!photo || photo.size === 0) {
      return NextResponse.json({ error: 'חובה לצרף תמונה של החלק המבוקש' }, { status: 400 });
    }
    const fileError = validateImageFile(photo);
    if (fileError) {
      return NextResponse.json({ error: fileError }, { status: 400 });
    }

    const customer = await getCustomerById(tenantId, customerId);
    if (!customer) {
      return NextResponse.json({ error: 'לקוח לא נמצא במערכת' }, { status: 404 });
    }

    const photoBuffer = Buffer.from(await photo.arrayBuffer());
    const webpBuffer = await sharp(photoBuffer)
      .resize(1200, 1200, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer();
    const photoImage = `data:image/webp;base64,${webpBuffer.toString('base64')}`;

    const newRequest = await createPartRequest(tenantId, {
      customerId,
      description,
      photoImage,
      agentId,
      agentName,
    });

    // Best-effort automatic WhatsApp notification to the business when a
    // customer requests a part, via the tenant's own Green API instance. A
    // failure here must never fail the part request itself.
    let autoNotifySent = false;
    try {
      const tenant = await getTenantById(tenantId);
      if (tenant?.greenApiInstanceId && tenant?.greenApiToken) {
        // Primary recipient is the dedicated parts-request number; fall back to
        // the admin numbers only when no parts number is configured.
        const partsPhone = (tenant.partsRequestPhone || '').trim();
        const adminPhones = [tenant.adminWhatsappPhone, tenant.adminWhatsappPhone2, tenant.adminWhatsappPhone3]
          .map((p) => (p || '').trim())
          .filter((p) => p.length > 0);
        const recipients = Array.from(new Set(partsPhone ? [partsPhone] : adminPhones));
        if (recipients.length > 0) {
          const businessName = tenant.businessName || tenant.name || 'העסק';
          const customerName = `${customer.firstName} ${customer.lastName}`.trim() || 'לקוח';
          const origin = req.headers.get('origin') || `https://${req.headers.get('host')}`;
          const partUrl = `${origin}/${tenantId}/part/${newRequest.id}`;
          const agentTag = agentName ? `\n👔 סוכן מטפל: ${agentName}` : '';
          const message = `🔧 בקשת חלק חדשה (#${newRequest.requestNumber || ''}) ב-${businessName}\nלקוח: ${customerName}\nטלפון: ${customer.phone || 'לא צויין'}\nתיאור החלק: ${description}${agentTag}\n\nלצפייה בפרטי הבקשה והתמונה:\n${partUrl}`;

          const results = await Promise.allSettled(
            recipients.map((p) => sendWhatsAppMessage(tenant.greenApiInstanceId!, tenant.greenApiToken!, p, message))
          );
          autoNotifySent = results.some((r) => r.status === 'fulfilled' && r.value.sent);
        }
      }
    } catch (notifyErr) {
      console.error('Error sending automatic WhatsApp part-request notification:', notifyErr);
    }

    return NextResponse.json({ success: true, request: newRequest, autoNotifySent });
  } catch (err: unknown) {
    console.error('Error creating part request:', err);
    return NextResponse.json({ error: 'שגיאת שרת פנימית' }, { status: 500 });
  }
}
