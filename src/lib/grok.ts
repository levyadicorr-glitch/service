export interface GrokMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/**
 * Sends a chat completion request to the xAI Grok API (https://api.x.ai/v1/chat/completions).
 */
export async function generateGrokResponse(
  messages: GrokMessage[],
  apiKey?: string
): Promise<string> {
  const key = apiKey || process.env.GROK_API_KEY || process.env.XAI_API_KEY;
  if (!key) {
    throw new Error('GROK_API_KEY / XAI_API_KEY אינו מוגדר במערכת');
  }

  const res = await fetch('https://api.x.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${key.trim()}`,
    },
    body: JSON.stringify({
      model: 'grok-2-latest',
      messages,
      temperature: 0.7,
      max_tokens: 1000,
    }),
  });

  if (!res.ok) {
    const errorText = await res.text().catch(() => '');
    throw new Error(`שגיאה בתקשורת מול Grok API (${res.status}): ${errorText}`);
  }

  const data = await res.json();
  const choice = data?.choices?.[0];
  const reply = choice?.message?.content;

  if (!reply) {
    throw new Error('לא התקבלה תשובה מ-Grok API');
  }

  return reply;
}
