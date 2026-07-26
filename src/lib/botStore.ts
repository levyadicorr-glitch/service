import { randomUUID } from 'crypto';
import { getDb } from './db';
import type { GeminiTurn } from './gemini';

/**
 * Persistence for the WhatsApp customer-service bot.
 *
 * One document per message (not per thread): a thread document would grow
 * unbounded toward Mongo's 16MB cap for a chatty customer, and would turn
 * "show me the last 50 messages across all customers" into an aggregation.
 * One-per-message keeps that a plain indexed find().sort().
 *
 * Indexes live in ensureIndexes() in db.ts — notably the unique sparse index
 * on idMessage, which is what makes a Green API webhook retry a no-op.
 */

export const BOT_CONVERSATION_TTL_DAYS = 90;

export type BotDirection = 'IN' | 'OUT';

export type BotSource =
  | 'CUSTOMER'
  | 'BOT'
  | 'BOT_TEST'
  | 'FALLBACK_REGEX'
  | 'ADMIN_PLAYGROUND'
  | 'ESCALATION';

export interface BotUsage {
  promptTokens: number;
  outputTokens: number;
  totalTokens: number;
}

export interface BotConversationMessage {
  id: string;
  phone: string;
  chatId?: string;
  customerId?: string;
  customerName?: string;
  /** Green API message id. Unique+sparse — the dedup key. */
  idMessage?: string;
  direction: BotDirection;
  source: BotSource;
  text: string;
  intent?: string;
  confidence?: number;
  needsHuman?: boolean;
  escalationReason?: string;
  actions?: string[];
  /** false for test-mode replies that were analysed but never sent. */
  delivered?: boolean;
  testMode?: boolean;
  degraded?: boolean;
  model?: string;
  usage?: BotUsage;
  latencyMs?: number;
  error?: string;
  errorKind?: string;
  createdAt: string;
  /**
   * Must be a real Date, never an ISO string: Mongo TTL indexes silently
   * ignore string fields, and the collection would simply never expire.
   */
  expiresAt: Date;
}

const MAX_TEXT_LENGTH = 2000;

function expiryDate(): Date {
  return new Date(Date.now() + BOT_CONVERSATION_TTL_DAYS * 24 * 60 * 60 * 1000);
}

function clampText(text: string): string {
  return (text || '').slice(0, MAX_TEXT_LENGTH);
}

function isDuplicateKeyError(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { code?: number }).code === 11000;
}

/**
 * Drops undefined keys before insert. This is load-bearing for idMessage: the
 * driver would otherwise persist it as null, and a *sparse* unique index only
 * skips documents where the field is absent — a second null collides and would
 * reject every subsequent message that arrived without a Green API id.
 */
function stripUndefined<T extends object>(doc: T): T {
  for (const key of Object.keys(doc) as (keyof T)[]) {
    if (doc[key] === undefined) delete doc[key];
  }
  return doc;
}

/**
 * Records an inbound customer message. The unique index on idMessage makes
 * this the deduplication point for the whole pipeline: Green API resends the
 * same idMessage whenever we answer slowly, and the second insert loses.
 *
 * Returns { isNew: false } for a replay so the caller can bail out before
 * approving a quote or answering twice.
 */
export async function recordInboundMessage(
  tenantId: string,
  msg: Omit<BotConversationMessage, 'id' | 'direction' | 'createdAt' | 'expiresAt'>
): Promise<{ isNew: boolean }> {
  const db = await getDb(tenantId);
  const doc = stripUndefined<BotConversationMessage>({
    ...msg,
    id: randomUUID(),
    direction: 'IN',
    text: clampText(msg.text),
    createdAt: new Date().toISOString(),
    expiresAt: expiryDate(),
  });

  try {
    await db.collection('botConversations').insertOne(doc as unknown as import('mongodb').Document);
    return { isNew: true };
  } catch (err) {
    if (isDuplicateKeyError(err)) return { isNew: false };
    throw err;
  }
}

/**
 * Records an outbound message (bot reply, escalation notice, or a logged-only
 * test-mode reply). Never throws — logging must not be able to fail a webhook
 * that already did its real work.
 */
export async function recordOutboundMessage(
  tenantId: string,
  msg: Omit<BotConversationMessage, 'id' | 'direction' | 'createdAt' | 'expiresAt'>
): Promise<void> {
  try {
    const db = await getDb(tenantId);
    const doc = stripUndefined<BotConversationMessage>({
      ...msg,
      id: randomUUID(),
      direction: 'OUT',
      text: clampText(msg.text),
      createdAt: new Date().toISOString(),
      expiresAt: expiryDate(),
    });
    await db.collection('botConversations').insertOne(doc as unknown as import('mongodb').Document);
  } catch (err) {
    console.error('[BOT STORE] Failed to record outbound message:', err);
  }
}

// ---------------- Conversation history ----------------

const HISTORY_TURN_MAX_CHARS = 400;

/**
 * Recent turns for this phone, oldest first, ready to hand to the model.
 *
 * Test-mode and undelivered replies are excluded on purpose: the customer
 * never saw them, so replaying them as model turns would build a shared
 * history that only one side of the conversation actually has.
 */
export async function getRecentTurns(
  tenantId: string,
  phone: string,
  limit = 6,
  withinHours = 24
): Promise<GeminiTurn[]> {
  try {
    const db = await getDb(tenantId);
    const since = new Date(Date.now() - withinHours * 60 * 60 * 1000).toISOString();

    const docs = await db.collection('botConversations')
      .find(
        {
          phone,
          createdAt: { $gte: since },
          $or: [{ direction: 'IN' }, { direction: 'OUT', delivered: true }],
        },
        { projection: { _id: 0, direction: 1, text: 1, createdAt: 1 } }
      )
      .sort({ createdAt: -1 })
      .limit(limit)
      .toArray();

    return docs
      .reverse()
      .map(d => ({
        role: (d.direction === 'IN' ? 'user' : 'model') as GeminiTurn['role'],
        text: String(d.text || '').slice(0, HISTORY_TURN_MAX_CHARS),
      }))
      .filter(t => t.text.length > 0);
  } catch (err) {
    console.error('[BOT STORE] Failed to load history:', err);
    return [];
  }
}

// ---------------- Daily usage counters ----------------

/**
 * Counters live in Mongo rather than in the in-process Map used by
 * rateLimit.ts, because that Map is per-container: under any concurrency there
 * are N independent counters and no real ceiling. An atomic $inc is correct
 * across containers, which is what a daily quota actually needs.
 */

const USAGE_TTL_DAYS = 3;

function dayKey(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

function usageExpiry(): Date {
  return new Date(Date.now() + USAGE_TTL_DAYS * 24 * 60 * 60 * 1000);
}

export interface DailyUsage {
  tenantCount: number;
  tenantTokens: number;
  phoneCount: number;
}

export async function peekDailyUsage(tenantId: string, phone?: string): Promise<DailyUsage> {
  try {
    const db = await getDb(tenantId);
    const day = dayKey();
    const ids = [`tenant:${day}`];
    if (phone) ids.push(`phone:${phone}:${day}`);

    // Counter documents use a string _id (e.g. 'tenant:2026-07-25'), not the
    // driver's default ObjectId, so the result is re-typed to match.
    const docs = (await db.collection('botUsage').find({ _id: { $in: ids } } as never).toArray()) as unknown as
      { _id: string; count?: number; tokens?: number }[];

    const tenantDoc = docs.find(d => d._id === `tenant:${day}`);
    const phoneDoc = phone ? docs.find(d => d._id === `phone:${phone}:${day}`) : undefined;

    return {
      tenantCount: tenantDoc?.count || 0,
      tenantTokens: tenantDoc?.tokens || 0,
      phoneCount: phoneDoc?.count || 0,
    };
  } catch (err) {
    // Fail open: a counter outage must not silence the bot entirely.
    console.error('[BOT STORE] Failed to read usage:', err);
    return { tenantCount: 0, tenantTokens: 0, phoneCount: 0 };
  }
}

export async function bumpDailyUsage(tenantId: string, phone: string, tokens = 0): Promise<void> {
  try {
    const db = await getDb(tenantId);
    const day = dayKey();
    const expiresAt = usageExpiry();

    await Promise.all([
      db.collection('botUsage').updateOne(
        { _id: `tenant:${day}` } as never,
        { $inc: { count: 1, tokens }, $set: { expiresAt } },
        { upsert: true }
      ),
      db.collection('botUsage').updateOne(
        { _id: `phone:${phone}:${day}` } as never,
        { $inc: { count: 1, tokens }, $set: { expiresAt } },
        { upsert: true }
      ),
    ]);
  } catch (err) {
    console.error('[BOT STORE] Failed to bump usage:', err);
  }
}

// ---------------- Human handoff freeze ----------------

/**
 * After an escalation the bot goes quiet on that thread, so a customer who
 * asked for a human does not keep getting robot replies while they wait.
 *
 * Stored in botUsage to reuse its TTL index: the document disappears on its
 * own when the freeze ends. The explicit `until` comparison still matters,
 * since Mongo's TTL sweep only runs about once a minute.
 */
export async function markHandedOff(tenantId: string, phone: string, minutes: number): Promise<void> {
  if (minutes <= 0) return;
  try {
    const db = await getDb(tenantId);
    const until = new Date(Date.now() + minutes * 60 * 1000);
    await db.collection('botUsage').updateOne(
      { _id: `handoff:${phone}` } as never,
      { $set: { until, expiresAt: until } },
      { upsert: true }
    );
  } catch (err) {
    console.error('[BOT STORE] Failed to mark handoff:', err);
  }
}

// ---------------- Admin viewer queries ----------------

export interface BotThreadSummary {
  phone: string;
  customerName?: string;
  lastText: string;
  lastDirection: BotDirection;
  lastAt: string;
  messageCount: number;
  escalated: boolean;
  testMode: boolean;
}

/**
 * One row per phone number, most recently active first. This is the shape that
 * one-document-per-message buys: a thread list is a plain grouped sort rather
 * than an unpacking of nested arrays.
 */
export async function listConversationThreads(
  tenantId: string,
  limit = 50,
  onlyEscalated = false
): Promise<BotThreadSummary[]> {
  try {
    const db = await getDb(tenantId);

    const match: Record<string, unknown> = {};
    if (onlyEscalated) match.escalationReason = { $nin: [null, ''] };

    const rows = await db.collection('botConversations').aggregate([
      ...(Object.keys(match).length ? [{ $match: match }] : []),
      { $sort: { createdAt: -1 } },
      {
        $group: {
          _id: '$phone',
          lastText: { $first: '$text' },
          lastDirection: { $first: '$direction' },
          lastAt: { $first: '$createdAt' },
          customerName: { $first: '$customerName' },
          messageCount: { $sum: 1 },
          escalations: { $sum: { $cond: [{ $ifNull: ['$escalationReason', false] }, 1, 0] } },
          testModes: { $sum: { $cond: ['$testMode', 1, 0] } },
        },
      },
      { $sort: { lastAt: -1 } },
      { $limit: Math.min(limit, 200) },
    ]).toArray();

    return rows.map(r => ({
      phone: String(r._id || ''),
      customerName: r.customerName || undefined,
      lastText: String(r.lastText || ''),
      lastDirection: (r.lastDirection === 'OUT' ? 'OUT' : 'IN') as BotDirection,
      lastAt: String(r.lastAt || ''),
      messageCount: Number(r.messageCount || 0),
      escalated: Number(r.escalations || 0) > 0,
      testMode: Number(r.testModes || 0) > 0,
    }));
  } catch (err) {
    console.error('[BOT STORE] Failed to list threads:', err);
    return [];
  }
}

export async function listConversations(
  tenantId: string,
  phone: string,
  limit = 100,
  before?: string
): Promise<BotConversationMessage[]> {
  try {
    const db = await getDb(tenantId);
    const query: Record<string, unknown> = { phone };
    if (before) query.createdAt = { $lt: before };

    const docs = await db.collection('botConversations')
      .find(query, { projection: { _id: 0 } })
      .sort({ createdAt: -1 })
      .limit(Math.min(limit, 200))
      .toArray();

    return docs.reverse() as unknown as BotConversationMessage[];
  } catch (err) {
    console.error('[BOT STORE] Failed to list conversations:', err);
    return [];
  }
}

export async function isHandedOff(tenantId: string, phone: string): Promise<boolean> {
  try {
    const db = await getDb(tenantId);
    const doc = await db.collection('botUsage').findOne({ _id: `handoff:${phone}` } as never);
    if (!doc?.until) return false;
    return new Date(doc.until as Date).getTime() > Date.now();
  } catch (err) {
    console.error('[BOT STORE] Failed to read handoff state:', err);
    return false;
  }
}
