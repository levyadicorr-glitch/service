import { NextRequest, NextResponse } from 'next/server';
import { createTechnician, getTechnicians } from '@/lib/db';
import { requireTenantAdmin } from '@/lib/auth';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> }
) {
  const { tenantId } = await params;
  const authErr = requireTenantAdmin(req, tenantId);
  if (authErr) return authErr;

  try {
    const technicians = await getTechnicians(tenantId);
    return NextResponse.json({ technicians });
  } catch (err: unknown) {
    console.error('Error fetching technicians:', err);
    return NextResponse.json({ error: 'שגיאה בשליפת טכנאים' }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> }
) {
  const { tenantId } = await params;
  const authErr = requireTenantAdmin(req, tenantId);
  if (authErr) return authErr;

  try {
    const body = await req.json();
    const { name, phone, password } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'שם טכנאי הינו שדה חובה' }, { status: 400 });
    }
    if (!phone || !phone.trim()) {
      return NextResponse.json({ error: 'מספר טלפון הינו שדה חובה' }, { status: 400 });
    }
    if (!password || !password.trim()) {
      return NextResponse.json({ error: 'סיסמה הינה שדה חובה' }, { status: 400 });
    }

    const technician = await createTechnician(tenantId, {
      name: name.trim(),
      phone: phone.trim(),
      password: password.trim(),
    });

    return NextResponse.json({ technician }, { status: 201 });
  } catch (err: unknown) {
    console.error('Error creating technician:', err);
    return NextResponse.json({ error: 'שגיאה ביצירת טכנאי' }, { status: 500 });
  }
}
