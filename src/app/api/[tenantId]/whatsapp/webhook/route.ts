import { NextRequest, NextResponse } from 'next/server';
import { getTenantById, getCustomerByPhone } from '@/lib/db';
import getClientPromise from '@/lib/mongodb';
import { sendWhatsAppMessage } from '@/lib/greenApi';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> }
) {
  try {
    const { tenantId } = await params;
    const body = await req.json();

    console.log('[WEBHOOK] Received webhook for tenant:', tenantId);
    console.log('[WEBHOOK] typeWebhook:', body.typeWebhook);
    console.log('[WEBHOOK] senderData:', JSON.stringify(body.senderData));
    console.log('[WEBHOOK] messageData:', JSON.stringify(body.messageData));

    // Check if it's an incoming message webhook
    if (body.typeWebhook !== 'incomingMessageReceived' && body.typeWebhook !== 'incomingMessage') {
      console.log('[WEBHOOK] Ignored: typeWebhook is', body.typeWebhook);
      return NextResponse.json({ success: true, ignored: true });
    }

    const sender = body.senderData?.sender || body.senderData?.chatId;
    if (!sender || !sender.endsWith('@c.us')) {
      console.log('[WEBHOOK] Ignored: sender is', sender);
      return NextResponse.json({ success: true, ignored: true, reason: 'Not a direct user message' });
    }

    // Extract the phone number (e.g., '972501234567@c.us' -> '972501234567' -> '0501234567')
    const rawPhone = sender.replace('@c.us', '');
    let phone = rawPhone;
    if (phone.startsWith('972')) {
      phone = '0' + phone.substring(3);
    }
    console.log('[WEBHOOK] Extracted phone:', phone, '(raw:', rawPhone, ')');

    // Extract message text
    const textMessage = body.messageData?.textMessageData?.textMessage ||
                        body.messageData?.extendedTextMessageData?.text || '';
    
    console.log('[WEBHOOK] Message text:', textMessage);

    if (!textMessage) {
      console.log('[WEBHOOK] Ignored: no text content');
      return NextResponse.json({ success: true, ignored: true, reason: 'No text content' });
    }

    const approvalRegex = /מאשר|מאשרת|כן|סגור|תזמין|תשלח|אישור|אשר|אשמח|yes|ok/i;
    if (!approvalRegex.test(textMessage)) {
      console.log('[WEBHOOK] Ignored: not an approval message');
      return NextResponse.json({ success: true, ignored: true, reason: 'Not an approval message' });
    }

    console.log('[WEBHOOK] Approval keyword detected!');

    const client = await getClientPromise();
    const db = client.db(tenantId);
    
    // Find customer by phone
    const customer = await getCustomerByPhone(tenantId, phone);
    if (!customer) {
      console.log('[WEBHOOK] Customer not found for phone:', phone);
      return NextResponse.json({ success: true, ignored: true, reason: 'Customer not found' });
    }
    console.log('[WEBHOOK] Found customer:', customer.id, customer.firstName, customer.lastName);

    // Find pending quotes for this customer
    const collection = db.collection('partRequests');
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const pendingRequests = await collection.find({
      customerId: customer.id,
      quoteStatus: 'PENDING_APPROVAL',
      quoteSentAt: { $gte: sevenDaysAgo.toISOString() }
    }).toArray();

    console.log('[WEBHOOK] Found', pendingRequests.length, 'pending quotes for customer', customer.id);

    if (pendingRequests.length === 0) {
      // Debug: let's also check without the date filter
      const allPending = await collection.find({
        customerId: customer.id,
        quoteStatus: 'PENDING_APPROVAL'
      }).toArray();
      console.log('[WEBHOOK] Total PENDING_APPROVAL (no date filter):', allPending.length);
      if (allPending.length > 0) {
        console.log('[WEBHOOK] First pending quoteSentAt:', allPending[0].quoteSentAt, 'sevenDaysAgo:', sevenDaysAgo.toISOString());
      }
      
      // Also check all part requests for this customer
      const allForCustomer = await collection.find({ customerId: customer.id }).toArray();
      console.log('[WEBHOOK] All part requests for customer:', allForCustomer.length);
      for (const pr of allForCustomer) {
        console.log('[WEBHOOK]   - id:', pr.id, 'quoteStatus:', pr.quoteStatus, 'quoteSentAt:', pr.quoteSentAt);
      }

      return NextResponse.json({ success: true, ignored: true, reason: 'No pending active quotes found' });
    }

    const tenant = await getTenantById(tenantId);
    if (!tenant?.greenApiInstanceId || !tenant?.greenApiToken) {
       console.log('[WEBHOOK] No Green API configured for tenant');
       return NextResponse.json({ success: false, error: 'No Green API configured' });
    }

    console.log('[WEBHOOK] Tenant quoteNotificationPhones:', tenant.quoteNotificationPhones);
    console.log('[WEBHOOK] Tenant adminWhatsappPhone:', tenant.adminWhatsappPhone);

    // Mark all as APPROVED
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
      console.log('[WEBHOOK] Marked part request', pr.id, 'as APPROVED');

      // Notify customer
      const custMessage = `תודה ${customer.firstName}! אישורך התקבל בהצלחה ✅\nההזמנה לחלק ("${pr.description}") נקלטה ותועבר להמשך טיפול.`;
      try {
        const custResult = await sendWhatsAppMessage(tenant.greenApiInstanceId, tenant.greenApiToken, phone, custMessage);
        console.log('[WEBHOOK] Customer notification result:', JSON.stringify(custResult));
      } catch (err) {
        console.error('[WEBHOOK] Failed to send confirmation to customer', err);
      }

      // Notify admins
      let notificationPhones: string[] = [];
      if (tenant.quoteNotificationPhones && tenant.quoteNotificationPhones.trim()) {
        notificationPhones = tenant.quoteNotificationPhones
          .split(/[,;\n]+/)
          .map(p => p.trim())
          .filter(Boolean);
      }
      
      if (notificationPhones.length === 0) {
        notificationPhones = [
          tenant.adminWhatsappPhone,
          tenant.adminWhatsappPhone2,
          tenant.adminWhatsappPhone3
        ].map(p => (p || '').trim()).filter(Boolean);
      }

      console.log('[WEBHOOK] Notification phones resolved to:', notificationPhones);

      const adminMessage = `🎉 אישור הצעת מחיר התקבל ב-${tenant.businessName || tenant.name}!\n\nלקוח: ${customer.firstName} ${customer.lastName} (${phone})\nחלק: ${pr.description}\nמחיר מאושר: ${pr.quotePrice} ₪`;

      for (const adminPhone of notificationPhones) {
        if (adminPhone) {
          try {
            const adminResult = await sendWhatsAppMessage(tenant.greenApiInstanceId, tenant.greenApiToken, adminPhone, adminMessage);
            console.log('[WEBHOOK] Admin notification to', adminPhone, 'result:', JSON.stringify(adminResult));
          } catch (err) {
            console.error(`[WEBHOOK] Failed to notify admin ${adminPhone}`, err);
          }
        }
      }
    }

    return NextResponse.json({ success: true, approvedCount: pendingRequests.length });

  } catch (err: unknown) {
    console.error('[WEBHOOK] Error in webhook:', err);
    return NextResponse.json({ error: 'שגיאת שרת פנימית' }, { status: 500 });
  }
}
