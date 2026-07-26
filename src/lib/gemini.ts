import { AI_BOT_MODEL } from './aiBotConfig';

/**
 * Minimal REST client for the Gemini generateContent API (Google AI Studio).
 *
 * Contract: this module NEVER throws. Every failure — missing key, timeout,
 * quota, safety block, malformed JSON — comes back as { ok: false, kind }.
 * That mirrors sendWhatsAppMessage() in greenApi.ts, and it is what keeps a
 * model outage from turning a WhatsApp webhook into a 500.
 *
 * Direct REST to Google: zero extra dependencies.
 */

const ENDPOINT_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

/**
 * Models ordered by preference. If the primary model encounters a transient error,
 * the fallback chain executes seamlessly.
 */
const GEMINI_MODELS = [
  'gemini-3.1-flash-lite',
  'gemini-flash-lite-latest',
  'gemini-3.5-flash-lite',
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
  return Boolean(process.env.GEMINI_API_KEY);
}

const EMPTY_USAGE: GeminiUsage = { promptTokens: 0, outputTokens: 0, totalTokens: 0 };

const SAFETY_SETTINGS = [
  'HARM_CATEGORY_HARASSMENT',
  'HARM_CATEGORY_HATE_SPEECH',
  'HARM_CATEGORY_SEXUALLY_EXPLICIT',
  'HARM_CATEGORY_DANGEROUS_CONTENT',
].map(category => ({ category, threshold: 'BLOCK_ONLY_HIGH' }));

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

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

  const timeoutMs = opts.timeoutMs ?? 6000;
  const deadline = startedAt + timeoutMs;
  const primaryModel = opts.model || AI_BOT_MODEL;
  
  // Use requested model first, followed by fallbacks
  const modelChain = Array.from(new Set([primaryModel, ...GEMINI_MODELS]));

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
      thinkingConfig: { thinkingBudget: 0 },
    },
    safetySettings: SAFETY_SETTINGS,
  };

  let lastError = 'unknown error';
  let lastKind: GeminiErrorKind = 'network';
  let lastStatus: number | undefined;

  for (const model of modelChain) {
    const remaining = deadline - Date.now();
    if (remaining < 500) {
      return { ok: false, kind: 'timeout', error: 'Budget exhausted before request', latencyMs: elapsed() };
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), remaining);

    try {
      const res = await fetch(`${ENDPOINT_BASE}/${model}:generateContent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey.trim(),
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

        // 429 or 404 -> try next model in fallback chain
        if (res.status === 429 || res.status === 404 || res.status >= 500) {
          console.warn(`[GEMINI] Model ${model} returned HTTP ${res.status}, attempting fallback...`);
          continue;
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
        const kind: GeminiErrorKind = finishReason === 'MAX_TOKENS' ? 'bad_json' : 'empty';
        return { ok: false, kind, error: `Empty response (finishReason: ${finishReason || 'none'})`, latencyMs: elapsed() };
      }

      const parsed = parseJson<T>(raw);
      if (!parsed.ok) {
        return { ok: false, kind: 'bad_json', error: `Unparseable JSON: ${raw.slice(0, 300)}`, latencyMs: elapsed() };
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

      const aborted = err instanceof Error && err.name === 'AbortError';
      if (aborted) {
        return { ok: false, kind: 'timeout', error: `Timed out after ${elapsed()}ms`, latencyMs: elapsed() };
      }

      lastKind = 'network';
      lastError = err instanceof Error ? err.message : 'network error';
      continue;
    }
  }

  return { ok: false, kind: lastKind, error: lastError, latencyMs: elapsed(), status: lastStatus };
}
