import { NextRequest, NextResponse } from 'next/server';
import { createOrder, getAgentById, getCustomerById, getDriverById, getOrders, getTenantById } from '@/lib/db';
import { requireTenantAdmin } from '@/lib/auth';
import { checkCsrf } from '@/lib/csrf';
import { sendWhatsAppMessage, sendQuoteNotificationToAdmins } from '@/lib/greenApi';

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
    const body = await req.json();
    const { customerId, deviceType, model, quantity, unitPrice, driverId, agentId, agentName } = body;

    const denied = requireTenantAdmin(req, tenantId);
    if (denied) {
      // Non-admin callers (the agent portal) may create an order only on behalf
      // of a real agent of this tenant — verify agentId actually resolves to one
      // instead of trusting any caller-supplied string.
      if (!agentId || typeof agentId !== 'string' || !(await getAgentById(tenantId, agentId))) {
        return denied;
      }
    }

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
      model: model?.trim() || undefined,
      quantity: qty,
      unitPrice: price,
      ...(driverId ? { driverId } : {}),
      ...(agentId ? { agentId } : {}),
      ...(agentName ? { agentName } : {}),
    });

    // Automatic WhatsApp notification to the customer
    let autoNotifySent = false;
    try {
      const tenant = await getTenantById(tenantId);
      const customerPhone = (customer.phone || '').trim();
      if (tenant?.greenApiInstanceId && tenant?.greenApiToken && customerPhone) {
        const businessName = tenant.businessName || tenant.name || 'העסק';
        const customerName = `${customer.firstName} ${customer.lastName}`.trim() || 'לקוח';
        const agentTag = newOrder.agentName ? `\n• 👔 סוכן מטפל: ${newOrder.agentName}` : '';
        const modelTag = newOrder.model ? ` - ${newOrder.model}` : '';
        const message = `📦 הזמנה חדשה (#${newOrder.orderNumber}) ב-${businessName}!\n\nשלום ${customerName},\nהזמנתך נקלטה במערכת וממתינה לשילוח 🚀\n\n📋 פרטי ההזמנה:\n• פריט: ${newOrder.deviceType}${modelTag}\n• כמות: ${newOrder.quantity}\n• מחיר ליחידה: ${newOrder.unitPrice} ₪\n• סה"כ לתשלום: ${newOrder.totalPrice} ₪${agentTag}\n\nנמשיך לעדכן אותך בכל שלב! ❤️`;

        const res = await sendWhatsAppMessage(tenant.greenApiInstanceId, tenant.greenApiToken, customerPhone, message);
        autoNotifySent = res.sent;

        // Notify quote/admin numbers as well
        const adminMsg = `📦 הזמנת סחורה חדשה (#${newOrder.orderNumber}) ב-${businessName}!\n\n👤 לקוח: ${customerName} (${customer.phone || 'ללא טלפון'})\n🛵 פריט / דגם: ${newOrder.deviceType}${modelTag}\n🔢 כמות: ${newOrder.quantity}\n💰 מחיר ליחידה: ${newOrder.unitPrice} ₪\n💵 סה"כ לתשלום: ${newOrder.totalPrice} ₪${agentTag}`;
        await sendQuoteNotificationToAdmins(tenant, adminMsg);
      }
    } catch (notifyErr) {
      console.error('Error sending order creation WhatsApp:', notifyErr);
    }

    return NextResponse.json({ success: true, order: newOrder, autoNotifySent });
  } catch (err: unknown) {
    console.error('Error creating order:', err);
    return NextResponse.json({ error: 'שגיאת שרת פנימית' }, { status: 500 });
  }
}
