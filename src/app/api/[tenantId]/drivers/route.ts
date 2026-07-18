import { NextRequest, NextResponse } from 'next/server';
import { getDrivers, createDriver } from '@/lib/db';
import { requireTenantAdmin } from '@/lib/auth';
import { checkCsrf } from '@/lib/csrf';

export async function GET(req: NextRequest, { params }: { params: Promise<{ tenantId: string }> }) {
  try {
    const { tenantId } = await params;
    const denied = requireTenantAdmin(req, tenantId);
    if (denied) return denied;

    const drivers = await getDrivers(tenantId);
    return NextResponse.json({ drivers });
  } catch (err: unknown) {
    console.error('Error fetching drivers:', err);
    return NextResponse.json({ error: 'שגיאת שרת פנימית' }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ tenantId: string }> }) {
  const csrfError = checkCsrf(req);
  if (csrfError) return csrfError;

  try {
    const { tenantId } = await params;
    const denied = requireTenantAdmin(req, tenantId);
    if (denied) return denied;

    const body = await req.json();
    const { name, phone } = body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ error: 'שם הנהג הוא שדה חובה' }, { status: 400 });
    }

    const newDriver = await createDriver(tenantId, {
      name: name.trim(),
      phone: phone || undefined,
    });

    return NextResponse.json({ success: true, driver: newDriver });
  } catch (err: unknown) {
    console.error('Error creating driver:', err);
    return NextResponse.json({ error: 'שגיאת שרת פנימית' }, { status: 500 });
  }
}
