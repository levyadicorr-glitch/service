export interface CerebrasMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/**
 * Sends a chat completion request to Cerebras API (https://api.cerebras.ai/v1/chat/completions).
 * Models supported: gpt-oss-120b, gemma-4-31b, zai-glm-4.7
 */
export async function generateCerebrasResponse(
  messages: CerebrasMessage[],
  apiKey?: string,
  model: string = 'gpt-oss-120b'
): Promise<string> {
  const key = apiKey || process.env.CEREBRAS_API_KEY;
  if (!key) {
    throw new Error('CEREBRAS_API_KEY אינו מוגדר במערכת');
  }

  const res = await fetch('https://api.cerebras.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${key.trim()}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.7,
      max_tokens: 1000,
    }),
  });

  if (!res.ok) {
    const errorText = await res.text().catch(() => '');
    throw new Error(`שגיאה בתקשורת מול Cerebras API (${res.status}): ${errorText}`);
  }

  const data = await res.json();
  const choice = data?.choices?.[0];
  const reply = choice?.message?.content;

  if (!reply) {
    throw new Error('לא התקבלה תשובה מ-Cerebras API');
  }

  return reply;
}
