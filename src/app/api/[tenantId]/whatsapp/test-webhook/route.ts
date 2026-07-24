import { NextRequest, NextResponse } from 'next/server';

/**
 * Test endpoint to simulate a Green API incoming message webhook.
 * 
 * Usage: POST /api/[tenantId]/whatsapp/test-webhook
 * Body: { "phone": "0509611808", "message": "מאשר" }
 * 
 * This will internally call the real webhook handler with a properly
 * formatted Green API payload.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> }
) {
  const { tenantId } = await params;
  const body = await req.json();
  const { phone, message } = body;

  if (!phone || !message) {
    return NextResponse.json({ error: 'phone and message are required' }, { status: 400 });
  }

  // Convert phone to Green API format
  let intlPhone = phone.replace(/\D/g, '');
  if (intlPhone.startsWith('0')) {
    intlPhone = '972' + intlPhone.slice(1);
  }

  // Build a fake Green API webhook payload
  const fakePayload = {
    typeWebhook: 'incomingMessageReceived',
    instanceData: {
      idInstance: 0,
      wid: `${intlPhone}@c.us`,
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

  console.log('[TEST-WEBHOOK] Simulating webhook for tenant:', tenantId, 'phone:', phone, 'message:', message);

  // Call the real webhook handler internally
  const origin = req.headers.get('origin') || `http://${req.headers.get('host')}`;
  const webhookUrl = `${origin}/api/${tenantId}/whatsapp/webhook`;
  
  try {
    const webhookRes = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fakePayload),
    });
    const webhookData = await webhookRes.json();
    console.log('[TEST-WEBHOOK] Webhook response:', JSON.stringify(webhookData));
    return NextResponse.json({ testResult: webhookData, simulatedPayload: fakePayload });
  } catch (err) {
    console.error('[TEST-WEBHOOK] Error calling webhook:', err);
    return NextResponse.json({ error: 'Failed to call webhook', details: String(err) }, { status: 500 });
  }
}
