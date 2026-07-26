import { NextRequest, NextResponse } from 'next/server';
import { getTenantById, tenantExists } from '@/lib/db';
import { normalizeAiBotConfig } from '@/lib/aiBotConfig';
import { isGeminiConfigured } from '@/lib/gemini';
import { runBot } from '@/lib/botAgent';
import { buildBotContext } from '@/lib/botContext';

export const dynamic = 'force-dynamic';

/**
 * TEMPORARY local verification harness, with per-phase timing so a slow reply
 * can be attributed to Mongo or to the model. Refuses to run in production.
 * dryRun: true => no WhatsApp send, no quote approval, no usage bump.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ tenantId: string }> }) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'not available' }, { status: 404 });
  }

  const { tenantId } = await params;
  if (!(await tenantExists(tenantId))) return NextResponse.json({ error: 'no tenant' }, { status: 404 });

  const { phone, message } = await req.json();

  const t0 = Date.now();
  const tenant = await getTenantById(tenantId);
  if (!tenant) return NextResponse.json({ error: 'no tenant' }, { status: 404 });
  const tenantMs = Date.now() - t0;

  const t1 = Date.now();
  const ctx = await buildBotContext(tenantId, phone);
  const contextMs = Date.now() - t1;

  const config = normalizeAiBotConfig(tenant.aiBotConfig);

  const t2 = Date.now();
  const result = await runBot({
    tenantId,
    tenant,
    config,
    phone,
    text: message,
    dryRun: true,
    budgetMs: 6500,
    context: ctx,
  });
  const runBotMs = Date.now() - t2;

  return NextResponse.json({
    timing: { tenantMs, contextMs, runBotMs, modelPhaseMs: result.latencyMs },
    configured: isGeminiConfigured(),
    handled: result.handled,
    degraded: result.degraded,
    errorKind: result.errorKind,
    error: result.error,
    model: result.model,
    intent: result.decision?.intent,
    confidence: result.decision?.confidence,
    escalate: result.escalate,
    escalationReason: result.escalationReason,
    replyText: result.replyText,
    wouldApprove: result.wouldApprove,
    usage: result.usage,
  });
}
