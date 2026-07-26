import { AI_BOT_MODEL } from './aiBotConfig';

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
 * OpenRouter free-tier models, ordered by preference.
 * The first model that responds successfully wins.
 * All are fully free on OpenRouter (`:free` suffix).
 */
const FREE_MODELS = [
  'poolside/laguna-m.1:free',
  'tencent/hy3:free',
  'nvidia/nemotron-3-ultra-550b-a55b:free',
  'poolside/laguna-xs-2.1:free',
  'cohere/north-mini-code:free',
];

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

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

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

  // Try free models with fallback
  for (const model of FREE_MODELS) {
    const remaining = deadline - Date.now();
    if (remaining < 800) {
      return { ok: false, kind: 'timeout', error: 'Budget exhausted before request', latencyMs: elapsed() };
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), remaining);

    try {
      const res = await fetch(OPENROUTER_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey.trim()}`,
          'HTTP-Referer': 'https://sherut-mocha.vercel.app',
          'X-Title': 'Sherut AI Bot',
        },
        body: JSON.stringify({
          model,
          messages,
          temperature: opts.temperature ?? 0.2,
          max_tokens: opts.maxOutputTokens ?? 512,
          response_format: { type: 'json_object' },
        }),
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        const status = res.status;

        if (status === 429) {
          // Rate limited on this model — try next
          console.warn(`[AI] OpenRouter ${model} rate limited (429), trying next...`);
          continue;
        }
        if (status === 404) {
          // Model not available — try next
          console.warn(`[AI] OpenRouter ${model} not available (404), trying next...`);
          continue;
        }
        // 400/403 are deterministic failures
        return {
          ok: false,
          kind: status === 429 ? 'rate_limited' : 'http',
          error: `OpenRouter HTTP ${status}: ${text.slice(0, 300)}`,
          latencyMs: elapsed(),
          status,
        };
      }

      const body = await res.json();

      const raw = body?.choices?.[0]?.message?.content || '';
      if (!raw.trim()) {
        console.warn(`[AI] OpenRouter ${model} returned empty, trying next...`);
        continue;
      }

      const parsed = parseJson<T>(raw);
      if (!parsed.ok) {
        console.warn(`[AI] OpenRouter ${model} returned unparseable JSON, trying next...`);
        continue;
      }

      const usage: GeminiUsage = body.usage
        ? {
            promptTokens: body.usage.prompt_tokens ?? 0,
            outputTokens: body.usage.completion_tokens ?? 0,
            totalTokens: body.usage.total_tokens ?? 0,
          }
        : EMPTY_USAGE;

      console.log(`[AI] OpenRouter SUCCESS with ${model} in ${elapsed()}ms`);
      return { ok: true, data: parsed.data, raw, usage, model, latencyMs: elapsed() };
    } catch (err) {
      clearTimeout(timer);

      const aborted = err instanceof Error && err.name === 'AbortError';
      if (aborted) {
        return { ok: false, kind: 'timeout', error: `Timed out after ${elapsed()}ms`, latencyMs: elapsed() };
      }

      // Network error on this model — try next
      console.warn(`[AI] OpenRouter ${model} network error, trying next...`, err instanceof Error ? err.message : err);
      continue;
    }
  }

  // All models exhausted
  return {
    ok: false,
    kind: 'network',
    error: `All OpenRouter free models exhausted within ${elapsed()}ms`,
    latencyMs: elapsed(),
  };
}
