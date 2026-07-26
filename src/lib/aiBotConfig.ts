/**
 * Per-tenant configuration for the WhatsApp customer-service bot.
 *
 * Stored as one nested object on the tenant document rather than a dozen flat
 * fields, because the admin page selects tenant fields one by one — a nested
 * object costs three edits to thread through instead of two dozen.
 *
 * The Gemini API key is deliberately NOT here: getTenantsWithPasswords()
 * returns every tenant field except adminPassword to the super-admin browser,
 * so a key stored on the tenant would leak. It lives in process.env and is read
 * only inside gemini.ts.
 */

export interface AiBotConfig {
  enabled: boolean;
  /** When true the bot analyses and logs but never sends or approves. */
  testMode: boolean;
  model: string;
  persona: string;
  knowledgeBase: string;
  greeting: string;
  allowQuoteApproval: boolean;
  /** Minimum model confidence before a quote approval is executed. */
  approvalConfidence: number;
  /** Below this, the customer gets escalationMessage instead of the reply. */
  replyConfidence: number;
  /** Comma-separated. Empty falls back to getQuoteNotificationPhones(tenant). */
  escalationPhones: string;
  escalationMessage: string;
  /** After a handoff, the bot stays quiet on that thread for this long. */
  handoffFreezeMinutes: number;
  maxRepliesPerCustomerPerDay: number;
  maxRepliesPerTenantPerDay: number;
}

export const AI_BOT_LIMITS = {
  persona: 1000,
  knowledgeBase: 6000,
  greeting: 200,
  escalationMessage: 500,
  escalationPhones: 500,
} as const;

/** Pinned, not a "-latest" alias: a silent model swap that changes JSON
 *  adherence is exactly the failure you cannot debug from platform logs.
 *
 *  Chosen by measurement against this project's key, not by reputation:
 *    gemini-2.5-flash      404 — no longer served to new API keys
 *    gemini-3.6-flash      400 — rejects thinkingConfig.thinkingBudget
 *    gemini-3.5-flash      works, but ~5.7s p50 — eats the whole webhook budget
 *    gemini-3.1-flash-lite ~0.9s p50, honours thinkingBudget: 0, clean Hebrew
 *  Re-measure before changing this; latency is the binding constraint. */
export const AI_BOT_MODEL = 'gemini-3.1-flash-lite';

export const DEFAULT_AI_BOT_CONFIG: AiBotConfig = {
  enabled: false,
  testMode: true,
  model: AI_BOT_MODEL,
  persona: 'אתה נציג שירות לקוחות אדיב ומקצועי של העסק. אתה עונה בעברית, בקצרה ולעניין.',
  knowledgeBase: '',
  greeting: '',
  allowQuoteApproval: true,
  approvalConfidence: 0.8,
  replyConfidence: 0.55,
  escalationPhones: '',
  escalationMessage: 'תודה על פנייתך! העברתי את ההודעה לנציג שלנו, והוא יחזור אליך בהקדם.',
  handoffFreezeMinutes: 60,
  maxRepliesPerCustomerPerDay: 20,
  maxRepliesPerTenantPerDay: 200,
};

function toBool(value: unknown, fallback: boolean): boolean {
  if (typeof value === 'boolean') return value;
  if (value === 'true') return true;
  if (value === 'false') return false;
  return fallback;
}

function toText(value: unknown, maxLength: number, fallback: string): string {
  if (typeof value !== 'string') return fallback;
  return value.slice(0, maxLength);
}

function toNumber(value: unknown, min: number, max: number, fallback: number): number {
  const parsed = typeof value === 'number' ? value : parseFloat(String(value));
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function toInt(value: unknown, min: number, max: number, fallback: number): number {
  return Math.round(toNumber(value, min, max, fallback));
}

/**
 * The single validation point for this config. Everything that reads it — the
 * webhook, the playground route, the admin page — goes through here, so limits
 * are enforced server-side and not merely as a maxLength attribute on a
 * textarea. Always returns a complete object; never throws.
 */
export function normalizeAiBotConfig(raw: unknown): AiBotConfig {
  const input = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
  const d = DEFAULT_AI_BOT_CONFIG;

  return {
    enabled: toBool(input.enabled, d.enabled),
    testMode: toBool(input.testMode, d.testMode),
    // Not free text: an arbitrary model string would be a server-side request
    // forgery vector into the Google endpoint path.
    model: input.model === AI_BOT_MODEL ? AI_BOT_MODEL : d.model,
    persona: toText(input.persona, AI_BOT_LIMITS.persona, d.persona),
    knowledgeBase: toText(input.knowledgeBase, AI_BOT_LIMITS.knowledgeBase, d.knowledgeBase),
    greeting: toText(input.greeting, AI_BOT_LIMITS.greeting, d.greeting),
    allowQuoteApproval: toBool(input.allowQuoteApproval, d.allowQuoteApproval),
    approvalConfidence: toNumber(input.approvalConfidence, 0.5, 1, d.approvalConfidence),
    replyConfidence: toNumber(input.replyConfidence, 0.3, 1, d.replyConfidence),
    escalationPhones: toText(input.escalationPhones, AI_BOT_LIMITS.escalationPhones, d.escalationPhones),
    escalationMessage: toText(input.escalationMessage, AI_BOT_LIMITS.escalationMessage, d.escalationMessage)
      || d.escalationMessage,
    handoffFreezeMinutes: toInt(input.handoffFreezeMinutes, 0, 1440, d.handoffFreezeMinutes),
    maxRepliesPerCustomerPerDay: toInt(input.maxRepliesPerCustomerPerDay, 0, 1000, d.maxRepliesPerCustomerPerDay),
    maxRepliesPerTenantPerDay: toInt(input.maxRepliesPerTenantPerDay, 0, 10000, d.maxRepliesPerTenantPerDay),
  };
}
