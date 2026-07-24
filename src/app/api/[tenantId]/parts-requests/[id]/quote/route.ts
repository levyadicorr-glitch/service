import { NextRequest, NextResponse } from 'next/server';
import { getTenantById, getCustomerById } from '@/lib/db';
import getClientPromise from '@/lib/mongodb';
import { requireTenantAdmin } from '@/lib/auth';
import { checkCsrf } from '@/lib/csrf';
import { sendWhatsAppMessage } from '@/lib/greenApi';

export async function POST(
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
    const { price } = body;

    if (typeof price !== 'number' || price <= 0) {
      return NextResponse.json({ error: 'מחיר אינו תקין' }, { status: 400 });
    }

    const client = await getClientPromise();
    const db = client.db(tenantId);
    const collection = db.collection('partRequests');

    const pr = await collection.findOne({ id });
    if (!pr) {
      return NextResponse.json({ error: 'בקשת חלק לא נמצאה' }, { status: 404 });
    }

    const tenant = await getTenantById(tenantId);
    const customer = pr.customerId ? await getCustomerById(tenantId, pr.customerId) : undefined;
    const customerPhone = (customer?.phone || '').trim();

    if (!tenant?.greenApiInstanceId || !tenant?.greenApiToken) {
       return NextResponse.json({ error: 'לא הוגדר חיבור ל-WhatsApp (Green API) עבור העסק' }, { status: 400 });
    }

    if (!customerPhone) {
      return NextResponse.json({ error: 'ללקוח זה אין מספר טלפון רשום' }, { status: 400 });
    }

    // 1. Update the part request in DB
    const updateResult = await collection.updateOne(
      { id },
      {
        $set: {
          quotePrice: price,
          quoteStatus: 'PENDING_APPROVAL',
          quoteSentAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      }
    );

    if (updateResult.modifiedCount === 0) {
      return NextResponse.json({ error: 'שגיאה בעדכון ההצעה במסד הנתונים' }, { status: 500 });
    }

    // 2. Send WhatsApp Message
    const businessName = tenant.businessName || tenant.name || 'העסק';
    const customerFirstName = customer?.firstName || 'לקוח';
    const message = `שלום ${customerFirstName},\n\nהצעת המחיר לחלק שביקשת מ-${businessName} ("${pr.description}") מוכנה.\n\n💰 מחיר: ${price} ₪\n(ההצעה בתוקף ל-7 ימים)\n\nכדי לאשר את ההזמנה, אנא השב/י להודעה זו במילה *"מאשר"*.`;

    let whatsappSent = false;
    try {
      const sendRes = await sendWhatsAppMessage(
        tenant.greenApiInstanceId,
        tenant.greenApiToken,
        customerPhone,
        message
      );
      whatsappSent = sendRes.sent;
    } catch (waErr) {
      console.error('Error sending quote via WhatsApp:', waErr);
    }

    return NextResponse.json({ success: true, whatsappSent });
  } catch (err: unknown) {
    console.error('Error in quote API:', err);
    return NextResponse.json({ error: 'שגיאת שרת פנימית' }, { status: 500 });
  }
}
