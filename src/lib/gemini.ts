import { AI_BOT_MODEL } from './aiBotConfig';

/**
 * Minimal REST client for the Gemini generateContent API.
 *
 * Contract: this module NEVER throws. Every failure — missing key, timeout,
 * quota, safety block, malformed JSON — comes back as { ok: false, kind }.
 * That mirrors sendWhatsAppMessage() in greenApi.ts, and it is what keeps a
 * model outage from turning a WhatsApp webhook into a 500 (which Green API
 * would then retry, amplifying the outage).
 *
 * No SDK: fetch, AbortController and crypto are native on Node 22, so this
 * adds zero dependencies.
 */

const ENDPOINT_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

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
  return Boolean(process.env.GEMINI_API_KEY);
}

const EMPTY_USAGE: GeminiUsage = { promptTokens: 0, outputTokens: 0, totalTokens: 0 };

/**
 * Default thresholds block legitimate Hebrew complaints about broken equipment
 * ("this thing is dangerous", "I'll kill whoever assembled this") at a
 * surprising rate. BLOCK_ONLY_HIGH keeps real abuse blocked without eating
 * ordinary customer frustration.
 */
const SAFETY_SETTINGS = [
  'HARM_CATEGORY_HARASSMENT',
  'HARM_CATEGORY_HATE_SPEECH',
  'HARM_CATEGORY_SEXUALLY_EXPLICIT',
  'HARM_CATEGORY_DANGEROUS_CONTENT',
].map(category => ({ category, threshold: 'BLOCK_ONLY_HIGH' }));

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/** Models often wrap JSON in a markdown fence despite responseMimeType. */
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

interface GeminiResponseBody {
  candidates?: {
    content?: { parts?: { text?: string }[] };
    finishReason?: string;
  }[];
  promptFeedback?: { blockReason?: string };
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    totalTokenCount?: number;
  };
  error?: { message?: string; status?: string };
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

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return { ok: false, kind: 'no_key', error: 'GEMINI_API_KEY is not configured', latencyMs: 0 };
  }

  const model = opts.model || AI_BOT_MODEL;
  const timeoutMs = opts.timeoutMs ?? 6000;
  const maxAttempts = 1 + (opts.retries ?? 1);
  const deadline = startedAt + timeoutMs;

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
      maxOutputTokens: opts.maxOutputTokens ?? 512,
      // The single most important line in this file. Current Gemini flash
      // models think by default, and thinking tokens are billed against
      // maxOutputTokens: measured on this project's key, 3.5-flash with
      // thinking on burned 490 of the 512 budget on thoughts and returned
      // truncated JSON (finishReason MAX_TOKENS) — a bad_json on every single
      // call. Disabled, the pinned model answers in roughly 0.9s.
      // Note this is also why the model is pinned: 3.6-flash rejects this
      // field outright with a 400.
      thinkingConfig: { thinkingBudget: 0 },
    },
    safetySettings: SAFETY_SETTINGS,
  };

  let lastError = 'unknown error';
  let lastKind: GeminiErrorKind = 'network';
  let lastStatus: number | undefined;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const remaining = deadline - Date.now();
    if (remaining < 500) {
      return { ok: false, kind: 'timeout', error: 'Budget exhausted before request', latencyMs: elapsed() };
    }

    // Manual controller rather than AbortSignal.timeout: a retry needs a fresh
    // one, and the per-attempt window is derived from the shared deadline.
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), remaining);

    try {
      const res = await fetch(`${ENDPOINT_BASE}/${model}:generateContent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Header, not ?key= — a key in the query string ends up in proxy,
          // CDN and access logs.
          'x-goog-api-key': apiKey,
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        lastStatus = res.status;
        lastError = `Gemini HTTP ${res.status}: ${text.slice(0, 300)}`;
        lastKind = res.status === 429 ? 'rate_limited' : 'http';

        // 400/403 are deterministic (bad request, bad key, quota disabled) —
        // retrying just burns the remaining budget.
        const retryable = res.status === 429 || res.status >= 500;
        if (retryable && attempt < maxAttempts - 1) {
          const backoff = 600 + Math.floor(Math.random() * 400);
          if (deadline - Date.now() > backoff + 1200) {
            await sleep(backoff);
            continue;
          }
        }
        return { ok: false, kind: lastKind, error: lastError, latencyMs: elapsed(), status: res.status };
      }

      const body = (await res.json()) as GeminiResponseBody;

      const blockReason = body.promptFeedback?.blockReason;
      if (blockReason) {
        return { ok: false, kind: 'blocked', error: `Prompt blocked: ${blockReason}`, latencyMs: elapsed() };
      }

      const candidate = body.candidates?.[0];
      const finishReason = candidate?.finishReason;
      if (finishReason === 'SAFETY' || finishReason === 'PROHIBITED_CONTENT') {
        return { ok: false, kind: 'blocked', error: `Response blocked: ${finishReason}`, latencyMs: elapsed() };
      }

      const raw = candidate?.content?.parts?.map(p => p.text || '').join('') || '';
      if (!raw.trim()) {
        // MAX_TOKENS here means the model was cut off mid-object, so the
        // failure is structural rather than an empty answer.
        const kind: GeminiErrorKind = finishReason === 'MAX_TOKENS' ? 'bad_json' : 'empty';
        return { ok: false, kind, error: `Empty response (finishReason: ${finishReason || 'none'})`, latencyMs: elapsed() };
      }

      const parsed = parseJson<T>(raw);
      if (!parsed.ok) {
        // Includes the MAX_TOKENS case: output truncated mid-object is
        // indistinguishable from any other malformed payload downstream.
        return { ok: false, kind: 'bad_json', error: `Unparseable JSON: ${raw.slice(0, 300)}`, latencyMs: elapsed() };
      }

      const usage: GeminiUsage = body.usageMetadata
        ? {
            promptTokens: body.usageMetadata.promptTokenCount ?? 0,
            outputTokens: body.usageMetadata.candidatesTokenCount ?? 0,
            totalTokens: body.usageMetadata.totalTokenCount ?? 0,
          }
        : EMPTY_USAGE;

      return { ok: true, data: parsed.data, raw, usage, model, latencyMs: elapsed() };
    } catch (err) {
      clearTimeout(timer);

      const aborted = err instanceof Error && err.name === 'AbortError';
      if (aborted) {
        return { ok: false, kind: 'timeout', error: `Timed out after ${elapsed()}ms`, latencyMs: elapsed() };
      }

      lastKind = 'network';
      lastError = err instanceof Error ? err.message : 'network error';
      if (attempt < maxAttempts - 1) {
        const backoff = 600 + Math.floor(Math.random() * 400);
        if (deadline - Date.now() > backoff + 1200) {
          await sleep(backoff);
          continue;
        }
      }
      return { ok: false, kind: lastKind, error: lastError, latencyMs: elapsed() };
    }
  }

  return { ok: false, kind: lastKind, error: lastError, latencyMs: elapsed(), status: lastStatus };
}
