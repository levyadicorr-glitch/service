import { NextRequest, NextResponse } from 'next/server';
import { getTenantById, tenantExists, ensureIndexes } from '@/lib/db';
import { requireTenantAdmin } from '@/lib/auth';
import { checkCsrf } from '@/lib/csrf';
import { checkRateLimit } from '@/lib/rateLimit';
import { normalizeAiBotConfig } from '@/lib/aiBotConfig';
import { generateJson, isGeminiConfigured } from '@/lib/gemini';
import { runBot } from '@/lib/botAgent';

/**
 * Admin playground and connectivity probe for the AI bot.
 *
 * Body: { message, phone?, probe? }
 *  - probe: true  -> one tiny round-trip, reports connectivity and latency
 *  - otherwise    -> a full dry run against the SAVED config, so what you test
 *                    is what is actually live
 *
 * Always a dry run: dryRun is enforced inside runBot rather than here, so
 * there is exactly one place that could get it wrong.
 */
export async function POST(req: NextRequest, props: { params: Promise<{ tenantId: string }> }) {
  const csrfError = checkCsrf(req);
  if (csrfError) return csrfError;

  try {
    const { tenantId } = await props.params;
    if (!(await tenantExists(tenantId))) {
      return NextResponse.json({ error: 'סביבה לא נמצאה' }, { status: 404 });
    }

    const denied = requireTenantAdmin(req, tenantId);
    if (denied) return denied;

    const limit = checkRateLimit(`ai:playground:${tenantId}`, 30, 60_000);
    if (!limit.allowed) {
      return NextResponse.json(
        { error: 'יותר מדי בדיקות. נסה שוב בעוד רגע.' },
        { status: 429 }
      );
    }

    if (!isGeminiConfigured()) {
      return NextResponse.json(
        { error: 'מפתח OPENROUTER_API_KEY אינו מוגדר בשרת. ללא מפתח הבוט אינו פעיל, ואישורי הצעות ממשיכים לעבוד לפי מילות מפתח בלבד.' },
        { status: 400 }
      );
    }

    const body = await req.json();

    if (body.probe === true) {
      const probe = await generateJson<{ ok: boolean }>({
        systemInstruction: 'Reply with {"ok":true} and nothing else.',
        turns: [{ role: 'user', text: 'ping' }],
        responseSchema: {
          type: 'OBJECT',
          properties: { ok: { type: 'BOOLEAN' } },
          required: ['ok'],
        },
        maxOutputTokens: 16,
        timeoutMs: 8000,
      });

      if (!probe.ok) {
        return NextResponse.json({
          connected: false,
          kind: probe.kind,
          error: probe.error,
          latencyMs: probe.latencyMs,
        });
      }

      return NextResponse.json({ connected: true, model: probe.model, latencyMs: probe.latencyMs });
    }

    const message = typeof body.message === 'string' ? body.message.trim() : '';
    if (!message) {
      return NextResponse.json({ error: 'יש להזין הודעה לבדיקה' }, { status: 400 });
    }

    const tenant = await getTenantById(tenantId);
    if (!tenant) {
      return NextResponse.json({ error: 'סביבה לא נמצאה' }, { status: 404 });
    }

    // The saved config, not whatever is currently unsaved in the form — the
    // point of the playground is to exercise what production would do.
    const config = normalizeAiBotConfig(tenant.aiBotConfig);

    // getRecentTurns reads botConversations; make sure its indexes exist.
    await ensureIndexes(tenantId);

    const phone = typeof body.phone === 'string' ? body.phone.trim() : '';

    const result = await runBot({
      tenantId,
      tenant,
      config,
      phone,
      text: message.slice(0, 1200),
      dryRun: true,
      budgetMs: 15000,
    });

    return NextResponse.json({
      degraded: result.degraded,
      errorKind: result.errorKind,
      error: result.error,
      intent: result.decision?.intent,
      confidence: result.decision?.confidence,
      needsHuman: result.decision?.needsHuman,
      reply: result.replyText,
      modelReply: result.decision?.reply,
      escalate: result.escalate,
      escalationReason: result.escalationReason,
      // What WOULD have happened, never what did.
      wouldApprove: { requestNumbers: result.wouldApprove },
      contextBlock: result.contextBlock,
      usage: result.usage,
      latencyMs: result.latencyMs,
      model: result.model,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'שגיאה בהרצת הבדיקה';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
