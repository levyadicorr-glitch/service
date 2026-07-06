import { NextRequest, NextResponse } from 'next/server';
import { createCustomer } from '@/lib/db';

export async function POST(req: NextRequest, props: { params: Promise<{ tenantId: string }> }) {
  try {
    const params = await props.params;
    const { tenantId } = params;
    const body = await req.json();
    const { firstName, lastName, phone, email, address, licensePlate, color, serialNumber } = body;

    if (!firstName || !lastName) {
      return NextResponse.json({ error: 'שם פרטי ושם משפחה הם שדות חובה' }, { status: 400 });
    }

    const newCustomer = await createCustomer(tenantId, {
      firstName,
      lastName,
      phone: phone || undefined,
      email: email || undefined,
      address: address || undefined,
      licensePlate: licensePlate || undefined,
      color: color || undefined,
      serialNumber: serialNumber || undefined,
    });

    return NextResponse.json({ success: true, customer: newCustomer });
  } catch (err: unknown) {
    console.error('Error creating customer:', err);
    const errorMessage = err instanceof Error ? err.message : 'שגיאת שרת פנימית';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
