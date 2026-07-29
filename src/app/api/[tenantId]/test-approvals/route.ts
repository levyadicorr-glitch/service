import { NextRequest, NextResponse } from 'next/server';
import { createTestApproval, getCustomerById, getTenantById, getTestApprovals, normalizePhone, tenantExists } from '@/lib/db';
import { requireTenantAdmin } from '@/lib/auth';
import { checkCsrf } from '@/lib/csrf';

// Admin-only module: the outbound WhatsApp message is prepared here but sent
// manually by the admin (Green API's free tier can't reliably auto-send to
// arbitrary customer numbers). The customer's "מאשר" reply is picked up
// automatically by the existing webhook, matched by phone — see
// getPendingTestApprovalsByPhone in src/lib/db.ts and its use in
// src/app/api/[tenantId]/whatsapp/webhook/route.ts.
export async function GET(req: NextRequest, { params }: { params: Promise<{ tenantId: string }> }) {
  try {
    const { tenantId } = await params;
    const denied = requireTenantAdmin(req, tenantId);
    if (denied) return denied;

    const approvals = await getTestApprovals(tenantId);
    return NextResponse.json({ approvals });
  } catch (err: unknown) {
    console.error('Error fetching test approvals:', err);
    return NextResponse.json({ error: 'שגיאת שרת פנימית' }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ tenantId: string }> }) {
  const csrfError = checkCsrf(req);
  if (csrfError) return csrfError;

  try {
    const { tenantId } = await params;
    if (!(await tenantExists(tenantId))) {
      return NextResponse.json({ error: 'סביבה לא נמצאה' }, { status: 404 });
    }

    const denied = requireTenantAdmin(req, tenantId);
    if (denied) return denied;

    const body = await req.json();
    const { customerId, toolDescription, price: priceRaw } = body;

    if (!customerId || typeof customerId !== 'string') {
      return NextResponse.json({ error: 'יש לבחור לקוח' }, { status: 400 });
    }

    const customer = await getCustomerById(tenantId, customerId);
    if (!customer) {
      return NextResponse.json({ error: 'לקוח לא נמצא במערכת' }, { status: 404 });
    }
    const customerPhone = normalizePhone(customer.phone || '');
    if (!customerPhone) {
      return NextResponse.json({ error: 'ללקוח זה אין מספר טלפון תקין במערכת' }, { status: 400 });
    }

    const tenant = await getTenantById(tenantId);
    const defaultPrice = tenant?.testApprovalPrice ?? 150;
    const price = priceRaw !== undefined && priceRaw !== null && priceRaw !== '' ? Number(priceRaw) : defaultPrice;
    if (!Number.isFinite(price) || price < 0) {
      return NextResponse.json({ error: 'מחיר לא תקין' }, { status: 400 });
    }

    const newApproval = await createTestApproval(tenantId, {
      customerId,
      customerName: `${customer.firstName} ${customer.lastName}`.trim() || 'לקוח',
      customerPhone,
      toolDescription: typeof toolDescription === 'string' ? toolDescription.trim() : undefined,
      price,
    });

    return NextResponse.json({ success: true, approval: newApproval }, { status: 201 });
  } catch (err: unknown) {
    console.error('Error creating test approval:', err);
    return NextResponse.json({ error: 'שגיאת שרת פנימית' }, { status: 500 });
  }
}
