import { NextRequest, NextResponse } from 'next/server';
import { createOrder, getCustomerById, getDriverById, getOrders } from '@/lib/db';
import { requireTenantAdmin } from '@/lib/auth';
import { checkCsrf } from '@/lib/csrf';

export async function GET(req: NextRequest, { params }: { params: Promise<{ tenantId: string }> }) {
  try {
    const { tenantId } = await params;
    const denied = requireTenantAdmin(req, tenantId);
    if (denied) return denied;

    const orders = await getOrders(tenantId);
    return NextResponse.json({ orders });
  } catch (err: unknown) {
    console.error('Error fetching orders:', err);
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
    const { customerId, deviceType, quantity, unitPrice, driverId } = body;

    if (!customerId || typeof customerId !== 'string') {
      return NextResponse.json({ error: 'יש לבחור לקוח' }, { status: 400 });
    }
    if (!deviceType || typeof deviceType !== 'string' || !deviceType.trim()) {
      return NextResponse.json({ error: 'סוג המכשיר הוא שדה חובה' }, { status: 400 });
    }
    const qty = Number(quantity);
    if (!Number.isFinite(qty) || qty <= 0) {
      return NextResponse.json({ error: 'כמות לא תקינה' }, { status: 400 });
    }
    const price = Number(unitPrice);
    if (!Number.isFinite(price) || price < 0) {
      return NextResponse.json({ error: 'מחיר ליחידה לא תקין' }, { status: 400 });
    }

    const customer = await getCustomerById(tenantId, customerId);
    if (!customer) {
      return NextResponse.json({ error: 'לקוח לא נמצא במערכת' }, { status: 404 });
    }

    if (driverId !== undefined && driverId !== null && driverId !== '') {
      const driver = await getDriverById(tenantId, driverId);
      if (!driver) {
        return NextResponse.json({ error: 'נהג לא נמצא' }, { status: 400 });
      }
    }

    const newOrder = await createOrder(tenantId, {
      customerId,
      deviceType: deviceType.trim(),
      quantity: qty,
      unitPrice: price,
      ...(driverId ? { driverId } : {}),
    });

    return NextResponse.json({ success: true, order: newOrder });
  } catch (err: unknown) {
    console.error('Error creating order:', err);
    return NextResponse.json({ error: 'שגיאת שרת פנימית' }, { status: 500 });
  }
}
