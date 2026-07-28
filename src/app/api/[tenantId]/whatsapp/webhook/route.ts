import { timingSafeEqual } from 'crypto';
import { NextRequest, NextResponse, after } from 'next/server';
import { getTenantById, getCustomerByPhone, tenantExists, ensureIndexes, normalizePhone, type Tenant } from '@/lib/db';
import getClientPromise from '@/lib/mongodb';
import { sendWhatsAppMessage, getQuoteNotificationPhones } from '@/lib/greenApi';
import {
  recordInboundMessage,
  recordOutboundMessage,
  isHandedOff,
  markHandedOff,
  bumpDailyUsage,
  peekDailyUsage,
} from '@/lib/botStore';
import { checkRateLimit } from '@/lib/rateLimit';
import { normalizeAiBotConfig, type AiBotConfig } from '@/lib/aiBotConfig';
import { isGeminiConfigured } from '@/lib/gemini';
import { buildBotContext } from '@/lib/botContext';
import { runBot } from '@/lib/botAgent';

export const dynamic = 'force-dynamic';
// A hint to the platform only — the handler does not rely on it for correctness.
export const maxDuration = 26;

/** Max inbound characters we keep or act on. */
const MAX_INBOUND_TEXT = 1200;

/**
 * Self-imposed wall-clock budget for the whole handler. Green API retries a
 * webhook it considers slow, so the real constraint is finishing before it
 * gives up — not the platform's function timeout.
 */
const BUDGET_MS = 8000;

/** Reserved out of the budget for the outbound Green API send. */
const SEND_RESERVE_MS = 1500;

/** Last 4 digits only — full numbers must not reach the platform log retention. */
function phoneTail(phone: string): string {
  return phone ? `***${phone.slice(-4)}` : '';
}

interface AiAttemptArgs {
  tenantId: string;
  tenant: Tenant;
  config: AiBotConfig;
  phone: string;
  chatId?: string;
  text: string;
  startedAt: number;
}

/**
 * Runs the bot for one message.
 *
 * Returns a response body when the bot handled the message, or null to mean
 * "fall through to the keyword path" — which is the answer for every failure
 * mode, so a broken bot can never be worse than no bot.
 *
 * The model call and the customer send both run INLINE rather than in after().
 * after() only guarantees execution within the route's max duration, and on a
 * frozen container a deferred send simply never happens — an invisible,
 * unretryable failure, which is worse than a visible timeout. Running inline is
 * safe precisely because of the idMessage dedup above: if Green API retries, the
 * unique index rejects the replay before any of this runs a second time.
 */
async function tryAiReply(args: AiAttemptArgs): Promise<Record<string, unknown> | null> {
  const { tenantId, tenant, config, phone, chatId, text, startedAt } = args;

  // Layer 1: in-process. Honest about what it buys — the Map lives in one
  // container, so under concurrency there are N independent counters. It stops
  // a single customer hammering one container; it is not a global ceiling.
  // The global key matters most: the free tier is billed per Google project
  // across every tenant, so one busy tenant can starve all the others.
  const perPhone = checkRateLimit(`aibot:phone:${tenantId}:${phone}`, 6, 60_000);
  const perTenant = checkRateLimit(`aibot:tenant:${tenantId}`, 30, 60_000);
  const global = checkRateLimit('aibot:global', 8, 60_000);
  if (!perPhone.allowed || !perTenant.allowed || !global.allowed) {
    console.warn('[WEBHOOK AI] Rate limited, falling back to keyword path');
    await recordOutboundMessage(tenantId, {
      phone,
      chatId,
      source: 'BOT',
      text: '',
      delivered: false,
      degraded: true,
      errorKind: 'rate_limited',
    });
    return null;
  }

  // Layer 2: persistent and correct across containers.
  const usage = await peekDailyUsage(tenantId, phone);
  if (
    usage.tenantCount >= config.maxRepliesPerTenantPerDay ||
    usage.phoneCount >= config.maxRepliesPerCustomerPerDay
  ) {
    console.warn('[WEBHOOK AI] Daily quota reached, falling back to keyword path');
    await recordOutboundMessage(tenantId, {
      phone,
      chatId,
      source: 'BOT',
      text: '',
      delivered: false,
      degraded: true,
      errorKind: 'rate_limited',
      error: `daily quota (tenant ${usage.tenantCount}, phone ${usage.phoneCount})`,
    });
    return null;
  }

  const ctx = await buildBotContext(tenantId, phone);

  const budgetMs = BUDGET_MS - (Date.now() - startedAt) - SEND_RESERVE_MS;
  const result = await runBot({
    tenantId,
    tenant,
    config,
    phone,
    text,
    dryRun: false,
    budgetMs,
    context: ctx,
  });

  if (result.degraded) {
    console.warn('[WEBHOOK AI] Degraded:', result.errorKind, result.error);
    await recordOutboundMessage(tenantId, {
      phone,
      chatId,
      customerId: ctx.customer?.id,
      source: 'BOT',
      text: '',
      delivered: false,
      degraded: true,
      errorKind: result.errorKind,
      error: result.error,
      latencyMs: result.latencyMs,
    });
    return null;
  }

  const customerName = ctx.customer ? `${ctx.customer.firstName} ${ctx.customer.lastName}` : undefined;
  const actions: string[] = [];

  // --- Execute approvals. runBot already applied every guard; this only writes.
  if (result.approvals.length > 0) {
    const client = await getClientPromise();
    const partRequests = client.db(tenantId).collection('partRequests');
    for (const quote of result.approvals) {
      await partRequests.updateOne(
        { id: quote.id },
        { $set: { quoteStatus: 'APPROVED', updatedAt: new Date().toISOString() } }
      );
      actions.push(`approved:${quote.id}`);
      console.log('[WEBHOOK AI] Approved part request', quote.id);
    }
  }

  // --- Reply to the customer.
  let delivered = false;
  let sendError: string | undefined;

  if (result.replyToSend && tenant.greenApiInstanceId && tenant.greenApiToken) {
    const send = await sendWhatsAppMessage(
      tenant.greenApiInstanceId,
      tenant.greenApiToken,
      phone,
      result.replyToSend
    );
    delivered = send.sent;
    sendError = send.error;
  }

  await recordOutboundMessage(tenantId, {
    phone,
    chatId,
    customerId: ctx.customer?.id,
    customerName,
    source: config.testMode ? 'BOT_TEST' : 'BOT',
    text: result.replyText,
    intent: result.decision?.intent,
    confidence: result.decision?.confidence,
    needsHuman: result.decision?.needsHuman,
    escalationReason: result.escalationReason,
    actions,
    delivered,
    testMode: config.testMode,
    model: result.model,
    usage: result.usage,
    latencyMs: result.latencyMs,
    error: sendError,
  });

  // --- Tail work. Admins tolerate a couple of seconds; the customer does not.
  after(async () => {
    await bumpDailyUsage(tenantId, phone, result.usage?.totalTokens || 0);

    if (!result.escalate) return;

    await markHandedOff(tenantId, phone, config.handoffFreezeMinutes);

    if (config.testMode) return;
    if (!tenant.greenApiInstanceId || !tenant.greenApiToken) return;

    const configured = config.escalationPhones
      .split(',')
      .map(p => p.trim())
      .filter(Boolean);
    const recipients = configured.length > 0 ? configured : getQuoteNotificationPhones(tenant);
    if (recipients.length === 0) return;

    const alert = [
      `🔔 הבוט העביר פנייה לנציג — ${tenant.businessName || tenant.name}`,
      '',
      `לקוח: ${customerName || 'לא מזוהה'} (${phone})`,
      `סיבה: ${result.escalationReason}`,
      `ההודעה: ${text.slice(0, 300)}`,
    ].join('\n');

    await Promise.allSettled(
      recipients.map(recipient =>
        sendWhatsAppMessage(tenant.greenApiInstanceId!, tenant.greenApiToken!, recipient, alert)
      )
    );
  });

  return {
    success: true,
    ai: true,
    intent: result.decision?.intent,
    confidence: result.decision?.confidence,
    approved: actions.length,
    escalated: result.escalate,
    testMode: config.testMode,
    delivered,
  };
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> }
) {
  const startedAt = Date.now();

  try {
    const { tenantId } = await params;

    // Without this, any URL segment would open (and MongoDB would create) an
    // arbitrary database named after it.
    if (!(await tenantExists(tenantId))) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
    }

    // Optional shared secret. Green API sends neither Origin nor Referer, so
    // checkCsrf() would 403 every real delivery — this is the usable
    // equivalent. Skipped entirely when the env var is unset so the currently
    // registered webhook URL keeps working.
    //
    // Green API's own webhook-auth mechanism (SetSettings' `webhookUrlToken`)
    // delivers the configured value back verbatim as the `Authorization`
    // header on every webhook call — there is no custom header support. Set
    // WHATSAPP_WEBHOOK_SECRET here to the same value configured as
    // `webhookUrlToken` in Green API (e.g. `Bearer <random-secret>`).
    const expectedAuthHeader = process.env.WHATSAPP_WEBHOOK_SECRET;
    if (expectedAuthHeader) {
      const actual = Buffer.from(req.headers.get('authorization') || '');
      const expected = Buffer.from(expectedAuthHeader);
      const valid = actual.length === expected.length && timingSafeEqual(actual, expected);
      if (!valid) {
        console.warn('[WEBHOOK REJECTED] Bad or missing Authorization header');
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    const body = await req.json();

    const typeWebhook = (body.typeWebhook || '').toLowerCase();
    const idMessage: string | undefined = body.idMessage || undefined;

    // Accept incoming AND outgoing text messages.
    // "outgoingMessageReceived" fires when the connected device itself sends
    // a message — needed for testing (admin sends "מאשר" from the business
    // phone) and when the admin is also a customer.
    // The self-loop guard below (sender === ownWid) prevents infinite loops.
    const ACCEPTED_TYPES = [
      'incomingMessageReceived',
      'incomingMessage',
      'outgoingMessageReceived',
      'outgoingMessage',
    ];
    const isMessage = ACCEPTED_TYPES.some(t => t.toLowerCase() === typeWebhook);
    if (!isMessage) {
      return NextResponse.json({ success: true, ignored: true, reason: `Ignored typeWebhook: ${body.typeWebhook}` });
    }

    // Always extract the chat ID (the customer's WhatsApp ID) first.
    // For incoming messages, chatId === sender. For outgoing messages, chatId is
    // the target customer chat, while sender is the connected device itself.
    const rawSender = body.senderData?.chatId || body.senderData?.sender;
    if (!rawSender || !rawSender.endsWith('@c.us')) {
      return NextResponse.json({ success: true, ignored: true, reason: 'Not a direct user message' });
    }

    const phone = normalizePhone(rawSender.replace('@c.us', ''));

    const rawText = body.messageData?.textMessageData?.textMessage ||
                    body.messageData?.extendedTextMessageData?.text || '';

    // Redacted by default. The auditable record of message content now lives in
    // botConversations with a TTL, so the platform log no longer needs to carry
    // phone numbers or customer text.
    console.log('[WEBHOOK IN]', JSON.stringify({
      tenantId,
      typeWebhook: body.typeWebhook,
      idMessage,
      rawSender,
      phoneTail: phoneTail(phone),
      textLen: rawText.length,
      text: rawText.slice(0, 100),
    }));
    // Full payload for debugging — remove once stable
    console.log('[WEBHOOK RAW PAYLOAD]\n' + JSON.stringify(body, null, 2));

    if (!rawText.trim()) {
      return NextResponse.json({ success: true, ignored: true, reason: 'No text content' });
    }
    const textMessage = rawText.slice(0, MAX_INBOUND_TEXT);

    // Must run here: the dedup index does not exist in a cold container
    // otherwise, since nothing else on this path calls ensureIndexes.
    await ensureIndexes(tenantId);

    // Deduplication. Green API redelivers the same idMessage whenever we answer
    // slowly or non-2xx; the unique index turns the retry into a no-op instead
    // of a second approval and a second reply.
    let isNew = true;
    try {
      ({ isNew } = await recordInboundMessage(tenantId, {
        phone,
        chatId: body.senderData?.chatId,
        idMessage,
        source: 'CUSTOMER',
        text: textMessage,
      }));
    } catch (err) {
      // Fail open: a logging outage must not swallow a real approval. We lose
      // dedup for this delivery, which the regex path tolerates (an already
      // approved quote no longer matches PENDING_APPROVAL).
      console.error('[WEBHOOK] Dedup write failed, continuing without it:', err);
    }
    if (!isNew) {
      console.log('[WEBHOOK IGNORED] Duplicate idMessage:', idMessage);
      return NextResponse.json({ success: true, ignored: true, reason: 'duplicate' });
    }

    const tenant = await getTenantById(tenantId);

    // ---------------- 1. Deterministic Quote Approval Path (No AI) ----------------
    // Checks for keyword approval ("מאשר", "כן", etc.) and active pending quotes.
    // Executes 100% deterministically with zero AI latency or token cost.

    const approvalRegex = /מאשר|מאשרת|כן|סגור|תזמין|תשלח|אישור|אשר|אשמח|yes|ok/i;
    if (approvalRegex.test(textMessage)) {
      const customer = await getCustomerByPhone(tenantId, phone);
      if (customer) {
        const client = await getClientPromise();
        const db = client.db(tenantId);
        const collection = db.collection('partRequests');
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        const pendingRequests = await collection.find({
          customerId: customer.id,
          quoteStatus: 'PENDING_APPROVAL',
          quoteSentAt: { $gte: sevenDaysAgo.toISOString() }
        }).toArray();

        if (pendingRequests.length > 0 && tenant?.greenApiInstanceId && tenant?.greenApiToken) {
          console.log('[WEBHOOK REGEX APPROVAL]', pendingRequests.length, 'quotes for customer', customer.id);
          const notificationPhones = getQuoteNotificationPhones(tenant);

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

            const custMessage = `תודה ${customer.firstName}! אישורך התקבל בהצלחה ✅\nההזמנה לחלק ("${pr.description}") נקלטה ותועבר להמשך טיפול.`;
            const custResult = await sendWhatsAppMessage(tenant.greenApiInstanceId, tenant.greenApiToken, phone, custMessage);
            await recordOutboundMessage(tenantId, {
              phone,
              chatId: body.senderData?.chatId,
              customerId: customer.id,
              customerName: `${customer.firstName} ${customer.lastName}`,
              source: 'FALLBACK_REGEX',
              text: custMessage,
              actions: [`approved:${pr.id}`],
              delivered: custResult.sent,
              error: custResult.error,
            });

            const adminMessage = `🎉 אישור הצעת מחיר התקבל ב-${tenant.businessName || tenant.name}!\n\nלקוח: ${customer.firstName} ${customer.lastName} (${phone})\nחלק: ${pr.description}\nמחיר מאושר: ${pr.quotePrice} ₪`;

            for (const adminPhone of notificationPhones) {
              if (adminPhone) {
                await sendWhatsAppMessage(tenant.greenApiInstanceId, tenant.greenApiToken, adminPhone, adminMessage);
              }
            }
          }

          return NextResponse.json({ success: true, approvedCount: pendingRequests.length });
        }
      }
    }

    // ---------------- 2. AI Bot Path (General Customer Service & Support) ----------------
    // For non-approval messages (general questions, stock, info), run the AI bot.

    const config = normalizeAiBotConfig(tenant?.aiBotConfig);

    if (tenant && config.enabled && isGeminiConfigured() && !(await isHandedOff(tenantId, phone))) {
      const aiOutcome = await tryAiReply({
        tenantId,
        tenant,
        config,
        phone,
        chatId: body.senderData?.chatId,
        text: textMessage,
        startedAt,
      });
      if (aiOutcome) return NextResponse.json(aiOutcome);
    }

    return NextResponse.json({ success: true, ignored: true, reason: 'No action taken' });

  } catch (err: unknown) {
    console.error('[WEBHOOK UNHANDLED ERROR]', err);
    return NextResponse.json({ error: 'שגיאת שרת פנימית' }, { status: 500 });
  }
}
