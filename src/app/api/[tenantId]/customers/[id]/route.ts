import { NextRequest, NextResponse } from 'next/server';
import { Customer, deleteCustomer, updateCustomer } from '@/lib/db';
import { requireTenantAdmin } from '@/lib/auth';
import { checkCsrf } from '@/lib/csrf';

const VALID_REGIONS = ['CENTER', 'NORTH', 'SOUTH', 'JERUSALEM'];

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ tenantId: string; id: string }> }
) {
  const csrfError = checkCsrf(req);
  if (csrfError) return csrfError;

  try {
    const { tenantId, id } = await params;
    const denied = requireTenantAdmin(req, tenantId);
    if (denied) return denied;

    const body = await req.json();
    const { firstName, lastName, phone, email, address, region, approved } = body;

    if (region !== undefined && region !== null && !VALID_REGIONS.includes(region)) {
      return NextResponse.json({ error: 'אזור לא תקין' }, { status: 400 });
    }
    if (firstName !== undefined && (typeof firstName !== 'string' || !firstName.trim())) {
      return NextResponse.json({ error: 'שם פרטי הוא שדה חובה' }, { status: 400 });
    }
    if (lastName !== undefined && (typeof lastName !== 'string' || !lastName.trim())) {
      return NextResponse.json({ error: 'שם משפחה הוא שדה חובה' }, { status: 400 });
    }

    const update: Partial<Omit<Customer, 'id' | 'excelId'>> = {};
    if (firstName !== undefined) update.firstName = firstName.trim();
    if (lastName !== undefined) update.lastName = lastName.trim();
    if (phone !== undefined) update.phone = phone || undefined;
    if (email !== undefined) update.email = email || undefined;
    if (address !== undefined) update.address = address || undefined;
    if (region !== undefined) update.region = region || undefined;
    if (approved !== undefined) update.approved = !!approved;

    const updated = await updateCustomer(tenantId, id, update);
    if (!updated) {
      return NextResponse.json({ error: 'לקוח לא נמצא' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error('Error updating customer:', err);
    return NextResponse.json({ error: 'שגיאת שרת פנימית' }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ tenantId: string; id: string }> }
) {
  const csrfError = checkCsrf(req);
  if (csrfError) return csrfError;

  try {
    const { tenantId, id } = await params;
    const denied = requireTenantAdmin(req, tenantId);
    if (denied) return denied;

    const deleted = await deleteCustomer(tenantId, id);
    if (!deleted) {
      return NextResponse.json({ error: 'לקוח לא נמצא' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error('Error deleting customer:', err);
    return NextResponse.json({ error: 'שגיאת שרת פנימית' }, { status: 500 });
  }
}
