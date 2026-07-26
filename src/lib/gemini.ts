import { AI_BOT_MODEL } from './aiBotConfig';

/**
 * AI inference client powered by BazaarLink AI (bazaarlink.ai) with fallback
 * to Google Gemini REST API.
 *
 * Contract: this module NEVER throws. Every failure — missing key, timeout,
 * quota, safety block, malformed JSON — comes back as { ok: false, kind, error }.
 * That mirrors sendWhatsAppMessage() in greenApi.ts, and it is what keeps a
 * model outage from turning a WhatsApp webhook into a 500.
 */

const BAZAARLINK_URL = 'https://bazaarlink.ai/api/v1/chat/completions';
const GEMINI_ENDPOINT_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

const BAZAARLINK_MODELS = [
  'openai/gpt-4o-mini',
  'google/gemini-2.0-flash-001',
  'meta-llama/llama-3.3-70b-instruct',
  'deepseek/deepseek-chat',
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
  return Boolean(process.env.BAZAARLINK_API_KEY || process.env.GEMINI_API_KEY);
}

const EMPTY_USAGE: GeminiUsage = { promptTokens: 0, outputTokens: 0, totalTokens: 0 };

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
    'CRITICAL: You MUST respond with valid JSON only. No markdown fences, no explanation, no extra text.',
    'The JSON object must have exactly these fields:',
    ...fields.map(f => `  ${f}`),
    `Required fields: ${JSON.stringify(s.required || ordering)}`,
  ].join('\n');
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

  const bazaarKey = process.env.BAZAARLINK_API_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;

  if (!bazaarKey && !geminiKey) {
    return {
      ok: false,
      kind: 'no_key',
      error: 'משתני הסביבה BAZAARLINK_API_KEY / GEMINI_API_KEY אינם מוגדרים בשרת הפריסה.',
      latencyMs: 0,
    };
  }

  const timeoutMs = opts.timeoutMs ?? 6000;
  const deadline = startedAt + timeoutMs;
  let lastError = 'No provider responded';
  let lastStatus: number | undefined;

  // --- Path 1: Try BazaarLink AI ---
  if (bazaarKey) {
    const remaining = deadline - Date.now();
    if (remaining > 500) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), remaining);

      const jsonInstruction = schemaToJsonInstruction(opts.responseSchema);
      const fullSystem = opts.systemInstruction + jsonInstruction;

      const messages = [
        { role: 'system', content: fullSystem },
        ...opts.turns.map(t => ({
          role: t.role === 'model' ? 'assistant' : 'user',
          content: t.text,
        })),
      ];

      try {
        const res = await fetch(BAZAARLINK_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${bazaarKey.trim()}`,
          },
          body: JSON.stringify({
            model: 'openai/gpt-4o-mini',
            models: BAZAARLINK_MODELS,
            route: 'fallback',
            messages,
            response_format: { type: 'json_object' },
            temperature: opts.temperature ?? 0.2,
            max_tokens: opts.maxOutputTokens ?? 1024,
          }),
          signal: controller.signal,
        });
        clearTimeout(timer);

        if (res.ok) {
          const body = await res.json();
          const raw = body?.choices?.[0]?.message?.content || '';
          const parsed = parseJson<T>(raw);
          if (parsed.ok) {
            const usage: GeminiUsage = body.usage
              ? {
                  promptTokens: body.usage.prompt_tokens ?? 0,
                  outputTokens: body.usage.completion_tokens ?? 0,
                  totalTokens: body.usage.total_tokens ?? 0,
                }
              : EMPTY_USAGE;

            const usedModel = body.model || 'openai/gpt-4o-mini';
            console.log(`[BAZAARLINK SUCCESS] Model: ${usedModel} in ${elapsed()}ms`);
            return { ok: true, data: parsed.data, raw, usage, model: usedModel, latencyMs: elapsed() };
          } else {
            lastError = `BazaarLink unparseable response: ${raw.slice(0, 200)}`;
          }
        } else {
          const text = await res.text().catch(() => '');
          lastStatus = res.status;
          lastError = `BazaarLink HTTP ${res.status}: ${text.slice(0, 250)}`;
          console.warn(`[BAZAARLINK FAILED] HTTP ${res.status}:`, text);
        }
      } catch (err) {
        clearTimeout(timer);
        const isAbort = err instanceof Error && err.name === 'AbortError';
        lastError = isAbort ? 'BazaarLink request timed out' : `BazaarLink network error: ${err instanceof Error ? err.message : String(err)}`;
        console.warn('[BAZAARLINK EXCEPTION]', lastError);
      }
    }
  }

  // --- Path 2: Try Google Gemini REST API ---
  if (geminiKey) {
    const remaining = deadline - Date.now();
    if (remaining > 500) {
      const primaryModel = opts.model || AI_BOT_MODEL;
      const modelChain = Array.from(new Set([primaryModel, 'gemini-3.1-flash-lite', 'gemini-flash-lite-latest']));

      const payload = {
        systemInstruction: { parts: [{ text: opts.systemInstruction }] },
        contents: opts.turns.map(turn => ({
          role: turn.role,
          parts: [{ text: turn.text }],
        })),
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: opts.responseSchema,
          temperature: opts.temperature ?? 0.2,
          maxOutputTokens: opts.maxOutputTokens ?? 1024,
        },
      };

      for (const model of modelChain) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), Math.max(500, deadline - Date.now()));

        try {
          const res = await fetch(`${GEMINI_ENDPOINT_BASE}/${model}:generateContent`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-goog-api-key': geminiKey.trim(),
            },
            body: JSON.stringify(payload),
            signal: controller.signal,
          });
          clearTimeout(timer);

          if (!res.ok) {
            const text = await res.text().catch(() => '');
            lastStatus = res.status;
            lastError = `Gemini (${model}) HTTP ${res.status}: ${text.slice(0, 250)}`;
            console.warn(`[GEMINI FAILED ${model}] HTTP ${res.status}:`, text);
            continue;
          }

          const body = await res.json();
          const candidate = body.candidates?.[0];
          const raw = candidate?.content?.parts?.map((p: { text?: string }) => p.text || '').join('') || '';
          const parsed = parseJson<T>(raw);
          if (!parsed.ok) {
            lastError = `Gemini (${model}) unparseable JSON: ${raw.slice(0, 200)}`;
            continue;
          }

          const usage: GeminiUsage = body.usageMetadata
            ? {
                promptTokens: body.usageMetadata.promptTokenCount ?? 0,
                outputTokens: body.usageMetadata.candidatesTokenCount ?? 0,
                totalTokens: body.usageMetadata.totalTokenCount ?? 0,
              }
            : EMPTY_USAGE;

          console.log(`[GEMINI SUCCESS] Model: ${model} in ${elapsed()}ms`);
          return { ok: true, data: parsed.data, raw, usage, model, latencyMs: elapsed() };
        } catch (err) {
          clearTimeout(timer);
          lastError = `Gemini (${model}) network error: ${err instanceof Error ? err.message : String(err)}`;
          continue;
        }
      }
    }
  }

  return {
    ok: false,
    kind: lastStatus === 429 ? 'rate_limited' : 'network',
    error: lastError,
    latencyMs: elapsed(),
    status: lastStatus,
  };
}
