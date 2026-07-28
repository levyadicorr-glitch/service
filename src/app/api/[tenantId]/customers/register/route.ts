import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { tenantExists, createCustomer, getCustomerByPhone, getCustomerApprovalToken, getTenantById } from '@/lib/db';
import { checkCsrf } from '@/lib/csrf';
import { checkRateLimit } from '@/lib/rateLimit';
import { sendWhatsAppMessage } from '@/lib/greenApi';

export async function POST(req: NextRequest, props: { params: Promise<{ tenantId: string }> }) {
  const csrfError = checkCsrf(req);
  if (csrfError) return csrfError;

  const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
  const { allowed } = checkRateLimit(`cust_reg_${ip}`, 10, 60000); // 10 per min limit
  if (!allowed) {
    return NextResponse.json({ error: 'יותר מדי נסיונות. אנא נסה שוב בעוד דקה.' }, { status: 429 });
  }

  try {
    const { tenantId } = await props.params;
    if (!(await tenantExists(tenantId))) {
      return NextResponse.json({ error: 'עסק לא נמצא' }, { status: 404 });
    }

    const body = await req.json();
    const { storeName, phone, city, address } = body;

    if (!storeName || !storeName.trim()) {
      return NextResponse.json({ error: 'שם חנות הוא שדה חובה' }, { status: 400 });
    }

    if (!phone || phone.replace(/\D/g, '').length < 9) {
      return NextResponse.json({ error: 'מספר טלפון נייד אינו תקין' }, { status: 400 });
    }

    // Check if customer already exists by phone
    let customer = await getCustomerByPhone(tenantId, phone);
    if (!customer) {
      customer = await createCustomer(tenantId, {
        firstName: storeName.trim(),
        lastName: '',
        phone: phone.trim(),
        city: city ? city.trim() : undefined,
        address: address ? address.trim() : undefined,
        approved: false,
        approvalToken: crypto.randomUUID(),
      });
    }

    const tenant = await getTenantById(tenantId);
    const adminWhatsappPhone = tenant?.adminWhatsappPhone || tenant?.partsRequestPhone || '';
    const businessName = tenant?.businessName || tenant?.name || 'העסק';

    // Best-effort automatic WhatsApp notification to every configured admin
    // number, via the tenant's own Green API instance. A failure here must
    // never fail the registration itself — the client falls back to a manual
    // wa.me link when autoNotifySent comes back false.
    let autoNotifySent = false;
    if (tenant?.greenApiInstanceId && tenant?.greenApiToken) {
      const adminPhones = [tenant.adminWhatsappPhone, tenant.adminWhatsappPhone2, tenant.adminWhatsappPhone3].filter(
        (p): p is string => !!p && p.trim().length > 0
      );

      if (adminPhones.length > 0) {
        try {
          const origin = req.headers.get('origin') || `https://${req.headers.get('host')}`;
          const portalUrl = `${origin}/${tenantId}/portal/${customer.id}`;
          // The approval token never leaves the server (it's not part of the
          // JSON response below — getCustomerApprovalToken is the only reader),
          // so this one-click link only ever reaches the admin via the Green
          // API message sent here.
          const approvalToken = customer.approved === false ? await getCustomerApprovalToken(tenantId, customer.id) : undefined;
          const approveLine = approvalToken
            ? `\n\nלאישור הלקוח לחץ כאן:\n${origin}/${tenantId}/approve/${customer.id}?token=${approvalToken}`
            : '';
          const message = `שלום, נרשמתי כלקוח חדש ב-${businessName}.\nשם החנות: ${storeName.trim()}\nטלפון: ${phone}\nלצפייה בפורטל הלקוח:\n${portalUrl}${approveLine}`;

          const results = await Promise.allSettled(
            adminPhones.map((p) => sendWhatsAppMessage(tenant.greenApiInstanceId!, tenant.greenApiToken!, p, message))
          );
          autoNotifySent = results.some((r) => r.status === 'fulfilled' && r.value.sent);
        } catch (notifyErr) {
          console.error('Error sending automatic WhatsApp approval notification:', notifyErr);
        }
      }
    }

    // Defense in depth: createCustomer() echoes back exactly what it was given
    // (including approvalToken, for the new-customer path above), so strip it
    // again here before this object crosses into the browser response.
    const { approvalToken: _omit, ...publicCustomer } = customer as typeof customer & { approvalToken?: string };
    void _omit;

    return NextResponse.json({
      success: true,
      customer: publicCustomer,
      customerId: customer.id,
      customerName: `${customer.firstName} ${customer.lastName}`.trim(),
      customerPhone: customer.phone || phone,
      adminWhatsappPhone,
      businessName,
      autoNotifySent,
    });
  } catch (err: unknown) {
    console.error('Error registering customer:', err);
    return NextResponse.json({ error: 'שגיאת שרת פנימית בהרשמה' }, { status: 500 });
  }
}
