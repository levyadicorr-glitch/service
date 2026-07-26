export interface OpenRouterMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

const DEFAULT_FREE_MODELS = [
  'inclusionai/ling-3.0-flash:free',
  'google/gemma-4-26b-a4b-it:free',
  'nvidia/nemotron-3-ultra-550b-a55b:free',
];

/**
 * Sends a chat completion request to OpenRouter API (https://openrouter.ai/api/v1/chat/completions).
 * Default Model: inclusionai/ling-3.0-flash:free with automatic fallbacks.
 */
export async function generateOpenRouterResponse(
  messages: OpenRouterMessage[],
  apiKey?: string,
  model?: string
): Promise<string> {
  const key = apiKey || process.env.OPENROUTER_API_KEY;
  if (!key) {
    throw new Error('OPENROUTER_API_KEY אינו מוגדר במערכת');
  }

  const modelsToTry = model ? [model, ...DEFAULT_FREE_MODELS.filter((m) => m !== model)] : DEFAULT_FREE_MODELS;
  let lastError: Error | null = null;

  for (const m of modelsToTry) {
    try {
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${key.trim()}`,
          'HTTP-Referer': 'https://sherut.netlify.app',
          'X-Title': 'Sherut AI Bot',
        },
        body: JSON.stringify({
          model: m,
          messages,
          temperature: 0.7,
          max_tokens: 1000,
        }),
      });

      if (!res.ok) {
        const errorText = await res.text().catch(() => '');
        throw new Error(`OpenRouter API (${res.status}): ${errorText}`);
      }

      const data = await res.json();
      const choice = data?.choices?.[0];
      const reply = choice?.message?.content;

      if (reply) {
        return reply;
      }
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      console.warn(`OpenRouter model ${m} failed, trying next fallback...`, lastError.message);
    }
  }

  throw lastError || new Error('לא התקבלה תשובה מ-OpenRouter API');
}
