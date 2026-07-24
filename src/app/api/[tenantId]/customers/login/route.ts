import { NextRequest, NextResponse } from 'next/server';
import { tenantExists, getCustomerByPhone, getTenantById } from '@/lib/db';
import { checkCsrf } from '@/lib/csrf';
import { checkRateLimit } from '@/lib/rateLimit';

export async function POST(req: NextRequest, props: { params: Promise<{ tenantId: string }> }) {
  const csrfError = checkCsrf(req);
  if (csrfError) return csrfError;

  const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
  const { allowed } = checkRateLimit(`cust_login_${ip}`, 15, 60000); // 15 attempts per min
  if (!allowed) {
    return NextResponse.json({ error: 'יותר מדי נסיונות. אנא נסה שוב בעוד דקה.' }, { status: 429 });
  }

  try {
    const { tenantId } = await props.params;
    if (!(await tenantExists(tenantId))) {
      return NextResponse.json({ error: 'עסק לא נמצא' }, { status: 404 });
    }

    const body = await req.json();
    const phone = typeof body?.phone === 'string' ? body.phone.trim() : '';

    if (!phone) {
      return NextResponse.json({ error: 'אנא הזן מספר טלפון' }, { status: 400 });
    }

    const customer = await getCustomerByPhone(tenantId, phone);
    if (!customer) {
      const tenant = await getTenantById(tenantId);
      const businessName = tenant?.businessName || tenant?.name || 'העסק';
      return NextResponse.json(
        {
          error: `מספר הטלפון ${phone} אינו רשום במערכת של ${businessName}. אנא פנה לעסק על מנת שיוסיפו אותך לקוחות.`,
          notFound: true,
          partsRequestPhone: tenant?.partsRequestPhone || '',
          businessName
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      customerId: customer.id,
      customerName: `${customer.firstName} ${customer.lastName}`.trim(),
    });
  } catch (err: unknown) {
    console.error('Error in customer login API:', err);
    return NextResponse.json({ error: 'שגיאת שרת פנימית' }, { status: 500 });
  }
}
