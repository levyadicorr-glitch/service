export interface GroqMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/**
 * Sends a chat completion request to the free Groq API (https://api.groq.com/openai/v1/chat/completions).
 * Free Tier Models supported on Groq:
 * - llama-3.3-70b-versatile (Recommended - Highest quality & great Hebrew support)
 * - llama-3.1-8b-instant (Super fast inference)
 * - mixtral-8x7b-32768
 * - gemma2-9b-it
 */
export async function generateGroqResponse(
  messages: GroqMessage[],
  apiKey?: string,
  model: string = 'llama-3.3-70b-versatile'
): Promise<string> {
  const key = apiKey || process.env.GROQ_API_KEY;
  if (!key) {
    throw new Error('GROQ_API_KEY אינו מוגדר במערכת. ניתן להנפיק מפתח בחינם ב-console.groq.com');
  }

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
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
    throw new Error(`שגיאה בתקשורת מול Groq API (${res.status}): ${errorText}`);
  }

  const data = await res.json();
  const choice = data?.choices?.[0];
  const reply = choice?.message?.content;

  if (!reply) {
    throw new Error('לא התקבלה תשובה מ-Groq API');
  }

  return reply;
}
