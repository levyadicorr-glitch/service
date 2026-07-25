import { NextRequest, NextResponse } from 'next/server';
import { getTenantById, getCustomerByPhone } from '@/lib/db';
import getClientPromise from '@/lib/mongodb';
import { sendWhatsAppMessage, getQuoteNotificationPhones } from '@/lib/greenApi';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> }
) {
  try {
    const { tenantId } = await params;
    const body = await req.json();

    console.log('=================== [GREEN API WEBHOOK INCOMING] ===================');
    console.log('[WEBHOOK TIMESTAMP]', new Date().toISOString());
    console.log('[WEBHOOK TENANT ID]', tenantId);
    console.log('[WEBHOOK RAW PAYLOAD]\n' + JSON.stringify(body, null, 2));
    console.log('====================================================================');

    // Check if it's an incoming message webhook
    const isIncoming = typeof body.typeWebhook === 'string' && body.typeWebhook.toLowerCase().startsWith('incoming');
    if (!isIncoming) {
      console.log(`[WEBHOOK IGNORED] typeWebhook is "${body.typeWebhook}" (ignored outgoing/system event)`);
      return NextResponse.json({ success: true, ignored: true, reason: `Ignored typeWebhook: ${body.typeWebhook}` });
    }

    const sender = body.senderData?.sender || body.senderData?.chatId;
    if (!sender || !sender.endsWith('@c.us')) {
      console.log(`[WEBHOOK IGNORED] Sender "${sender}" is not a direct user (@c.us)`);
      return NextResponse.json({ success: true, ignored: true, reason: 'Not a direct user message' });
    }

    // Extract the phone number (e.g., '972501234567@c.us' -> '972501234567' -> '0501234567')
    const rawPhone = sender.replace('@c.us', '');
    let phone = rawPhone;
    if (phone.startsWith('972')) {
      phone = '0' + phone.substring(3);
    }
    console.log('[WEBHOOK PARSED PHONE] Extracted:', phone, '(raw digits:', rawPhone, ')');

    // Extract message text
    const textMessage = body.messageData?.textMessageData?.textMessage ||
                        body.messageData?.extendedTextMessageData?.text || '';
    
    console.log('[WEBHOOK MESSAGE TEXT]', JSON.stringify(textMessage));

    if (!textMessage.trim()) {
      console.log('[WEBHOOK IGNORED] Message text is empty');
      return NextResponse.json({ success: true, ignored: true, reason: 'No text content' });
    }

    const approvalRegex = /מאשר|מאשרת|כן|סגור|תזמין|תשלח|אישור|אשר|אשמח|yes|ok/i;
    if (!approvalRegex.test(textMessage)) {
      console.log('[WEBHOOK IGNORED] Message text does not contain approval keywords');
      return NextResponse.json({ success: true, ignored: true, reason: 'Not an approval message' });
    }

    console.log('[WEBHOOK MATCH] Approval keyword matched in incoming message!');

    const client = await getClientPromise();
    const db = client.db(tenantId);
    
    // Find customer by phone
    const customer = await getCustomerByPhone(tenantId, phone);
    if (!customer) {
      console.log('[WEBHOOK IGNORED] Customer not found for phone number:', phone);
      return NextResponse.json({ success: true, ignored: true, reason: 'Customer not found' });
    }
    console.log('[WEBHOOK CUSTOMER FOUND]', customer.id, `${customer.firstName} ${customer.lastName}`);

    // Find pending quotes for this customer
    const collection = db.collection('partRequests');
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const pendingRequests = await collection.find({
      customerId: customer.id,
      quoteStatus: 'PENDING_APPROVAL',
      quoteSentAt: { $gte: sevenDaysAgo.toISOString() }
    }).toArray();

    console.log('[WEBHOOK PENDING QUOTES FOUND]', pendingRequests.length, 'active quotes for customer ID:', customer.id);

    if (pendingRequests.length === 0) {
      const allPending = await collection.find({
        customerId: customer.id,
        quoteStatus: 'PENDING_APPROVAL'
      }).toArray();
      console.log('[WEBHOOK DEBUG] Total PENDING_APPROVAL (ignoring 7-day window):', allPending.length);

      return NextResponse.json({ success: true, ignored: true, reason: 'No pending active quotes found for customer' });
    }

    const tenant = await getTenantById(tenantId);
    if (!tenant?.greenApiInstanceId || !tenant?.greenApiToken) {
       console.log('[WEBHOOK ERROR] Green API credentials missing for tenant:', tenantId);
       return NextResponse.json({ success: false, error: 'No Green API credentials configured' });
    }

    const notificationPhones = getQuoteNotificationPhones(tenant);
    console.log('[WEBHOOK NOTIFICATION PHONES]', notificationPhones);

    // Mark all pending quotes as APPROVED
    for (const pr of pendingRequests) {
      await collection.updateOne(
        { id: pr.id },
        {
          $set: {
            quoteStatus: 'APPROVED',
            updatedAt: new Date().toISOString()
          }
        }
      );
      console.log('[WEBHOOK STATUS UPDATED] Part request ID:', pr.id, '-> quoteStatus: APPROVED');

      // Send confirmation WhatsApp message to the customer
      const custMessage = `תודה ${customer.firstName}! אישורך התקבל בהצלחה ✅\nההזמנה לחלק ("${pr.description}") נקלטה ותועבר להמשך טיפול.`;
      try {
        const custResult = await sendWhatsAppMessage(tenant.greenApiInstanceId, tenant.greenApiToken, phone, custMessage);
        console.log('[WEBHOOK CUSTOMER NOTIFY RESULT]', JSON.stringify(custResult));
      } catch (err) {
        console.error('[WEBHOOK ERROR] Failed to send confirmation WhatsApp to customer:', err);
      }

      // Send notification WhatsApp message to all admin/quote numbers
      const adminMessage = `🎉 אישור הצעת מחיר התקבל ב-${tenant.businessName || tenant.name}!\n\nלקוח: ${customer.firstName} ${customer.lastName} (${phone})\nחלק: ${pr.description}\nמחיר מאושר: ${pr.quotePrice} ₪`;

      for (const adminPhone of notificationPhones) {
        if (adminPhone) {
          try {
            const adminResult = await sendWhatsAppMessage(tenant.greenApiInstanceId, tenant.greenApiToken, adminPhone, adminMessage);
            console.log(`[WEBHOOK ADMIN NOTIFY RESULT] Phone ${adminPhone}:`, JSON.stringify(adminResult));
          } catch (err) {
            console.error(`[WEBHOOK ERROR] Failed to notify admin ${adminPhone}:`, err);
          }
        }
      }
    }

    return NextResponse.json({ success: true, approvedCount: pendingRequests.length });

  } catch (err: unknown) {
    console.error('[WEBHOOK UNHANDLED ERROR]', err);
    return NextResponse.json({ error: 'שגיאת שרת פנימית' }, { status: 500 });
  }
}
