import { NextRequest, NextResponse } from 'next/server';
import { tenantExists, ensureIndexes, getTenantById } from '@/lib/db';
import { requireTenantAdmin } from '@/lib/auth';
import { normalizeAiBotConfig } from '@/lib/aiBotConfig';
import { listConversationThreads, listConversations, peekDailyUsage } from '@/lib/botStore';

/**
 * Read-only view of the bot's conversation log.
 *
 * Without ?phone= : the thread list plus today's usage counters.
 * With    ?phone= : the messages in that thread, oldest first.
 */
export async function GET(req: NextRequest, props: { params: Promise<{ tenantId: string }> }) {
  try {
    const { tenantId } = await props.params;
    if (!(await tenantExists(tenantId))) {
      return NextResponse.json({ error: 'סביבה לא נמצאה' }, { status: 404 });
    }

    const denied = requireTenantAdmin(req, tenantId);
    if (denied) return denied;

    await ensureIndexes(tenantId);

    const url = new URL(req.url);
    const phone = url.searchParams.get('phone') || '';
    const before = url.searchParams.get('before') || undefined;
    const onlyEscalated = url.searchParams.get('onlyEscalated') === '1';
    const rawLimit = parseInt(url.searchParams.get('limit') || '', 10);
    const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 1), 200) : 100;

    if (phone) {
      const messages = await listConversations(tenantId, phone, limit, before);
      return NextResponse.json({ messages });
    }

    const tenant = await getTenantById(tenantId);
    const config = normalizeAiBotConfig(tenant?.aiBotConfig);

    const [threads, usage] = await Promise.all([
      listConversationThreads(tenantId, limit, onlyEscalated),
      peekDailyUsage(tenantId),
    ]);

    return NextResponse.json({
      threads,
      usage: {
        tenantCount: usage.tenantCount,
        tenantTokens: usage.tenantTokens,
        maxPerTenantPerDay: config.maxRepliesPerTenantPerDay,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'שגיאה בטעינת השיחות';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
