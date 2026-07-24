import { NextRequest, NextResponse } from 'next/server';
import { createAgent, getAgents } from '@/lib/db';
import { requireTenantAdmin } from '@/lib/auth';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> }
) {
  const { tenantId } = await params;
  const authErr = requireTenantAdmin(req, tenantId);
  if (authErr) return authErr;

  try {
    const agents = await getAgents(tenantId);
    return NextResponse.json({ agents });
  } catch (err: unknown) {
    console.error('Error fetching agents:', err);
    return NextResponse.json({ error: 'שגיאה בשליפת סוכני מכירות' }, { status: 500 });
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
      return NextResponse.json({ error: 'שם סוכן הינו שדה חובה' }, { status: 400 });
    }
    if (!phone || !phone.trim()) {
      return NextResponse.json({ error: 'מספר טלפון הינו שדה חובה' }, { status: 400 });
    }
    if (!password || !password.trim()) {
      return NextResponse.json({ error: 'סיסמה הינה שדה חובה' }, { status: 400 });
    }

    const agent = await createAgent(tenantId, {
      name: name.trim(),
      phone: phone.trim(),
      password: password.trim(),
    });

    return NextResponse.json({ agent }, { status: 201 });
  } catch (err: unknown) {
    console.error('Error creating agent:', err);
    return NextResponse.json({ error: 'שגיאה ביצירת סוכן מכירות' }, { status: 500 });
  }
}
