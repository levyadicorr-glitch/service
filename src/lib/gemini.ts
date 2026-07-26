/**
 * AI inference client, routed through OpenRouter (openrouter.ai).
 *
 * Contract: this module NEVER throws. Every failure — missing key, timeout,
 * quota, safety block, malformed JSON — comes back as { ok: false, kind }.
 * That mirrors sendWhatsAppMessage() in greenApi.ts, and it is what keeps a
 * model outage from turning a WhatsApp webhook into a 500 (which Green API
 * would then retry, amplifying the outage).
 *
 * The interface (generateJson, GeminiTurn, GeminiUsage, etc.) is kept
 * identical so that botAgent.ts, botStore.ts and the admin playground
 * all work without any change.
 */

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

/**
 * OpenRouter free-tier models, ordered by measured reliability on THIS bot's
 * real Hebrew prompt and schema (scratch/check-models.mjs re-runs the check).
 *
 * The free tier gives no capacity guarantee: the same model measured 538ms on
 * one call and hard-timed-out on the next. So the chain is not an optimisation,
 * it is the availability strategy — and PER_MODEL_TIMEOUT_MS below is what
 * makes it one, by preventing the first model from eating the entire budget.
 *
 * Deliberately excluded, and why:
 *  - nvidia/nemotron-3-*      emit prose instead of JSON
 *  - nvidia/nemotron-nano-*   reasoning-only: spend the token budget on
 *                             `reasoning` and return message.content = null
 *  - google/gemma-4-31b-it    persistently rate-limited upstream (429)
 */
const FREE_MODELS: { id: string; structuredOutputs: boolean }[] = [
  { id: 'poolside/laguna-s-2.1:free', structuredOutputs: true },
  { id: 'poolside/laguna-xs-2.1:free', structuredOutputs: true },
  // Rejects response_format with a 400 rather than ignoring it, so never ask.
  { id: 'inclusionai/ling-3.0-flash:free', structuredOutputs: false },
  { id: 'google/gemma-4-26b-a4b-it:free', structuredOutputs: true },
  { id: 'poolside/laguna-m.1:free', structuredOutputs: true },
  { id: 'cohere/north-mini-code:free', structuredOutputs: true },
  { id: 'openai/gpt-oss-20b:free', structuredOutputs: true },
];

/**
 * Per-attempt ceiling. Without it the first model is handed the whole remaining
 * budget, so one hung free-tier model produces a timeout with the other six
 * never tried — which is exactly how a chain of seven models still failed every
 * message. 2.5s is above the measured latency of every model that passes, and
 * low enough to fit two or three attempts in the handler's ~6s.
 */
const PER_MODEL_TIMEOUT_MS = 2500;

export type GeminiErrorKind =
  | 'no_key'
  | 'timeout'
  | 'rate_limited'
  | 'blocked'
  | 'bad_json'
  | 'http'
  | 'network'
  | 'empty';

export interface GeminiUsage {
  promptTokens: number;
  outputTokens: number;
  totalTokens: number;
}

export interface GeminiTurn {
  role: 'user' | 'model';
  text: string;
}

export type GeminiJsonResult<T> =
  | { ok: true; data: T; raw: string; usage: GeminiUsage; model: string; latencyMs: number }
  | { ok: false; kind: GeminiErrorKind; error: string; latencyMs: number; status?: number };

export function isGeminiConfigured(): boolean {
  return Boolean(process.env.OPENROUTER_API_KEY);
}

const EMPTY_USAGE: GeminiUsage = { promptTokens: 0, outputTokens: 0, totalTokens: 0 };

/** Models often wrap JSON in a markdown fence despite instructions. */
function stripCodeFence(text: string): string {
  const trimmed = text.trim();
  if (!trimmed.startsWith('```')) return trimmed;
  return trimmed
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/, '')
    .trim();
}

function parseJson<T>(raw: string): { ok: true; data: T } | { ok: false } {
  try {
    return { ok: true, data: JSON.parse(raw) as T };
  } catch {
    try {
      return { ok: true, data: JSON.parse(stripCodeFence(raw)) as T };
    } catch {
      return { ok: false };
    }
  }
}

/**
 * Converts the Gemini-style responseSchema into a plain-language JSON
 * instruction block appended to the system prompt. OpenRouter models don't
 * support Gemini's native responseSchema, so we instruct via prose instead.
 */
function schemaToJsonInstruction(schema: unknown): string {
  if (!schema || typeof schema !== 'object') return '';
  const s = schema as Record<string, unknown>;
  const props = s.properties as Record<string, unknown> | undefined;
  if (!props) return '';

  const fields: string[] = [];
  const ordering = (s.propertyOrdering as string[]) || Object.keys(props);
  for (const key of ordering) {
    const prop = props[key] as Record<string, unknown> | undefined;
    if (!prop) continue;
    let desc = `"${key}": `;
    const type = (prop.type as string || '').toUpperCase();
    if (prop.enum) {
      desc += `one of ${JSON.stringify(prop.enum)}`;
    } else if (type === 'ARRAY') {
      const itemType = (prop.items as Record<string, unknown>)?.type || 'any';
      desc += `array of ${String(itemType).toLowerCase()}`;
    } else {
      desc += type.toLowerCase();
    }
    fields.push(desc);
  }

  return [
    '',
    'CRITICAL: You MUST respond with valid JSON only. No markdown, no explanation, no text before or after the JSON.',
    'The JSON object must have exactly these fields in this order:',
    ...fields.map(f => `  ${f}`),
    `Required fields: ${JSON.stringify(s.required || ordering)}`,
  ].join('\n');
}

/**
 * Converts GeminiTurn[] into OpenAI-compatible message array,
 * and prepends the system instruction.
 */
function buildMessages(
  systemInstruction: string,
  turns: GeminiTurn[],
  responseSchema: unknown
): { role: string; content: string }[] {
  const jsonInstruction = schemaToJsonInstruction(responseSchema);
  const fullSystem = systemInstruction + jsonInstruction;

  const messages: { role: string; content: string }[] = [
    { role: 'system', content: fullSystem },
  ];

  for (const turn of turns) {
    messages.push({
      role: turn.role === 'model' ? 'assistant' : 'user',
      content: turn.text,
    });
  }

  return messages;
}

export async function generateJson<T>(opts: {
  model?: string;
  systemInstruction: string;
  turns: GeminiTurn[];
  responseSchema: unknown;
  timeoutMs?: number;
  temperature?: number;
  maxOutputTokens?: number;
  retries?: number;
}): Promise<GeminiJsonResult<T>> {
  const startedAt = Date.now();
  const elapsed = () => Date.now() - startedAt;

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return { ok: false, kind: 'no_key', error: 'OPENROUTER_API_KEY is not configured', latencyMs: 0 };
  }

  const timeoutMs = opts.timeoutMs ?? 6000;
  const deadline = startedAt + timeoutMs;
  const messages = buildMessages(opts.systemInstruction, opts.turns, opts.responseSchema);

  /** One HTTP round-trip. Never throws; classifies its own outcome. */
  async function callOnce(
    model: string,
    useResponseFormat: boolean
  ): Promise<
    | { outcome: 'ok'; data: T; raw: string; usage: GeminiUsage }
    | { outcome: 'no_structured_outputs' }
    | { outcome: 'next'; reason: string; status?: number }
    | { outcome: 'budget_exhausted' }
  > {
    const budgetLeft = deadline - Date.now();
    if (budgetLeft < 700) return { outcome: 'budget_exhausted' };

    // Whichever runs out first: this model's share, or the whole budget.
    const attemptMs = Math.min(PER_MODEL_TIMEOUT_MS, budgetLeft);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), attemptMs);

    // The whole request body, minus response_format when the model rejects it.
    const payload: Record<string, unknown> = {
      model,
      messages,
      temperature: opts.temperature ?? 0.2,
      // 512 truncated mid-string on models that emit `reasoning` before the
      // answer, which surfaced as "unparseable JSON" from a model that was
      // actually answering correctly.
      max_tokens: opts.maxOutputTokens ?? 900,
    };
    if (useResponseFormat) payload.response_format = { type: 'json_object' };

    try {
      const res = await fetch(OPENROUTER_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey!.trim()}`,
          'HTTP-Referer': 'https://sherut.netlify.app',
          'X-Title': 'Sherut AI Bot',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (!res.ok) {
        const text = await res.text().catch(() => '');

        // Some models (ling-3.0-flash) hard-400 on response_format instead of
        // ignoring it. That is a capability mismatch, not a broken model — the
        // prompt already spells out the JSON contract, so retry without it.
        if (res.status === 400 && /structured[- ]outputs|response_format/i.test(text)) {
          return { outcome: 'no_structured_outputs' };
        }

        // Everything else advances to the next model. A single deterministic
        // failure must not end the chain: the point of the chain is that no one
        // free model can take the bot down.
        return { outcome: 'next', reason: `HTTP ${res.status}: ${text.slice(0, 200)}`, status: res.status };
      }

      const body = await res.json();
      const message = body?.choices?.[0]?.message;
      const raw: string = message?.content || '';

      if (!raw.trim()) {
        // Reasoning models spend the token budget on `reasoning` and leave
        // content null. Nothing to salvage — next model.
        const reasoningChars = String(message?.reasoning || '').length;
        return {
          outcome: 'next',
          reason: `empty content (finish=${body?.choices?.[0]?.finish_reason}, reasoning=${reasoningChars} chars)`,
        };
      }

      const parsed = parseJson<T>(raw);
      if (!parsed.ok) {
        const truncated = body?.choices?.[0]?.finish_reason === 'length';
        return {
          outcome: 'next',
          reason: truncated
            ? `truncated at max_tokens: ${raw.slice(0, 120)}`
            : `unparseable JSON: ${raw.slice(0, 120)}`,
        };
      }

      const usage: GeminiUsage = body.usage
        ? {
            promptTokens: body.usage.prompt_tokens ?? 0,
            outputTokens: body.usage.completion_tokens ?? 0,
            totalTokens: body.usage.total_tokens ?? 0,
          }
        : EMPTY_USAGE;

      return { outcome: 'ok', data: parsed.data, raw, usage };
    } catch (err) {
      clearTimeout(timer);
      // An abort here is THIS model being slow, not the end of the road. It is
      // reported as 'next' so the chain moves on; only the budget check at the
      // top of callOnce ends the loop.
      if (err instanceof Error && err.name === 'AbortError') {
        return { outcome: 'next', reason: `no response within ${attemptMs}ms` };
      }
      return { outcome: 'next', reason: `network: ${err instanceof Error ? err.message : String(err)}` };
    }
  }

  let attempts = 0;
  let lastReason = 'no model was reached';
  let lastStatus: number | undefined;
  let budgetExhausted = false;

  for (const model of FREE_MODELS) {
    attempts++;
    let result = await callOnce(model.id, model.structuredOutputs);

    // A model flagged structuredOutputs: true that turns out to reject them
    // (OpenRouter reroutes to a different upstream provider without notice).
    if (result.outcome === 'no_structured_outputs') {
      console.warn(`[AI] ${model.id} rejects response_format, retrying without it...`);
      result = await callOnce(model.id, false);
    }

    if (result.outcome === 'ok') {
      console.log(`[AI] OpenRouter SUCCESS with ${model.id} after ${attempts} attempt(s) in ${elapsed()}ms`);
      return { ok: true, data: result.data, raw: result.raw, usage: result.usage, model: model.id, latencyMs: elapsed() };
    }

    if (result.outcome === 'budget_exhausted') {
      attempts--;
      budgetExhausted = true;
      break;
    }

    lastReason =
      result.outcome === 'next'
        ? `${model.id} → ${result.reason}`
        : `${model.id} → response_format rejected twice`;
    lastStatus = result.outcome === 'next' ? result.status : undefined;
    console.warn(`[AI] ${lastReason}, trying next...`);
  }

  // Reported as the LAST concrete reason rather than a generic message: "which
  // model failed how, after how many tries" is the only thing that makes a
  // degraded reply in botConversations diagnosable after the fact.
  return {
    ok: false,
    kind: budgetExhausted ? 'timeout' : lastStatus === 429 ? 'rate_limited' : lastStatus ? 'http' : 'network',
    error: `${attempts} of ${FREE_MODELS.length} OpenRouter models tried in ${elapsed()}ms${
      budgetExhausted ? ' (budget exhausted)' : ''
    }. Last: ${lastReason}`,
    latencyMs: elapsed(),
    status: lastStatus,
  };
}
