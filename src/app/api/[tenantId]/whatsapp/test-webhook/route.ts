import { NextRequest, NextResponse } from 'next/server';
import { checkCsrf } from '@/lib/csrf';
import { requireTenantAdmin } from '@/lib/auth';
import { tenantExists } from '@/lib/db';

/**
 * Simulates a Green API incoming-message webhook against the real handler.
 *
 * Admin-only: unauthenticated, this endpoint forges quote approvals for any
 * phone number in any tenant, and once the AI bot is wired in it also becomes
 * a free channel for burning the model quota.
 *
 * Usage: POST /api/[tenantId]/whatsapp/test-webhook
 * Body: { "phone": "0509611808", "message": "מאשר" }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> }
) {
  const csrfError = checkCsrf(req);
  if (csrfError) return csrfError;

  const { tenantId } = await params;
  if (!(await tenantExists(tenantId))) {
    return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
  }

  const authError = requireTenantAdmin(req, tenantId);
  if (authError) return authError;

  const body = await req.json();
  const { phone, message } = body;

  if (!phone || !message) {
    return NextResponse.json({ error: 'phone and message are required' }, { status: 400 });
  }

  let intlPhone = String(phone).replace(/\D/g, '');
  if (intlPhone.startsWith('0')) {
    intlPhone = '972' + intlPhone.slice(1);
  }

  const fakePayload = {
    typeWebhook: 'incomingMessageReceived',
    // A fresh id per call, so the webhook's dedup index treats each simulation
    // as a new message. Send the same id twice to exercise the dedup path.
    idMessage: body.idMessage || `test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    instanceData: {
      idInstance: 0,
      // Deliberately NOT the sender's number: the webhook drops any message
      // whose sender equals instanceData.wid as a self-reply loop guard, which
      // would reject every simulation if these matched.
      wid: '0@c.us',
      typeInstance: 'whatsapp',
    },
    timestamp: Math.floor(Date.now() / 1000),
    senderData: {
      chatId: `${intlPhone}@c.us`,
      sender: `${intlPhone}@c.us`,
      chatName: 'Test',
      senderName: 'Test Customer',
    },
    messageData: {
      typeMessage: 'textMessage',
      textMessageData: {
        textMessage: message,
      },
    },
  };

  console.log('[TEST-WEBHOOK] Simulating for tenant:', tenantId, 'idMessage:', fakePayload.idMessage);

  const origin = req.headers.get('origin') || `http://${req.headers.get('host')}`;
  const webhookUrl = `${origin}/api/${tenantId}/whatsapp/webhook`;

  try {
    const webhookRes = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Forwarded so simulations keep working once the shared secret is set;
        // omitted from the header map entirely when it is not configured.
        ...(process.env.WHATSAPP_WEBHOOK_SECRET
          ? { 'x-webhook-token': process.env.WHATSAPP_WEBHOOK_SECRET }
          : {}),
      },
      body: JSON.stringify(fakePayload),
    });
    const webhookData = await webhookRes.json();
    return NextResponse.json({ testResult: webhookData, simulatedPayload: fakePayload });
  } catch (err) {
    console.error('[TEST-WEBHOOK] Error calling webhook:', err);
    return NextResponse.json({ error: 'Failed to call webhook', details: String(err) }, { status: 500 });
  }
}
