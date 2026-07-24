import { NextRequest, NextResponse } from 'next/server';
import { createCustomer } from '@/lib/db';
import { requireTenantAdmin } from '@/lib/auth';
import { checkCsrf } from '@/lib/csrf';

export async function POST(req: NextRequest, props: { params: Promise<{ tenantId: string }> }) {
  const csrfError = checkCsrf(req);
  if (csrfError) return csrfError;

  try {
    const params = await props.params;
    const { tenantId } = params;
    const denied = requireTenantAdmin(req, tenantId);
    if (denied) return denied;

    const body = await req.json();
    const { firstName, lastName, phone, email, address } = body;

    if (!firstName || !lastName) {
      return NextResponse.json({ error: 'שם פרטי ושם משפחה הם שדות חובה' }, { status: 400 });
    }

    const newCustomer = await createCustomer(tenantId, {
      firstName,
      lastName,
      phone: phone || undefined,
      email: email || undefined,
      address: address || undefined,
    });

    return NextResponse.json({ success: true, customer: newCustomer });
  } catch (err: unknown) {
    console.error('Error creating customer:', err);
    return NextResponse.json({ error: 'שגיאת שרת פנימית' }, { status: 500 });
  }
}
