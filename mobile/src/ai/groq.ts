/**
 * DEV-ONLY direct Groq client so you can see the AI working without deploying
 * the Cloudflare Worker.
 *
 * ⚠️ EXPO_PUBLIC_* values are bundled into the app's JS — the key is visible in
 * a shipped build. NEVER ship a real key this way. For production, route through
 * the Worker in `worker/` (EXPO_PUBLIC_PARSER_URL). This path is for local dev.
 */
import type { ParsedItem } from '../estimate/resolve';
import { PARSE_SYSTEM, ESTIMATE_SYSTEM, normalizeItems, normalizeNutrition, type AiNutrition } from './shared';

const KEY = process.env.EXPO_PUBLIC_GROQ_KEY;
const MODEL = process.env.EXPO_PUBLIC_GROQ_MODEL || 'llama-3.3-70b-versatile';
const URL = 'https://api.groq.com/openai/v1/chat/completions';

export const groqAvailable = !!KEY;

async function groqJson(system: string, user: string, timeoutMs = 15000): Promise<any> {
  if (!KEY) throw new Error('EXPO_PUBLIC_GROQ_KEY not set');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(URL, {
      method: 'POST',
      signal: controller.signal,
      headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.2,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      }),
    });
    if (!res.ok) throw new Error(`groq ${res.status}: ${await res.text().catch(() => '')}`);
    const data = await res.json();
    return JSON.parse(data?.choices?.[0]?.message?.content ?? '{}');
  } finally {
    clearTimeout(timer);
  }
}

export async function groqParse(text: string): Promise<ParsedItem[]> {
  return normalizeItems(await groqJson(PARSE_SYSTEM, text));
}

export async function groqEstimate(food: string, quantity: number, unit: string): Promise<AiNutrition | null> {
  return normalizeNutrition(await groqJson(ESTIMATE_SYSTEM, `${quantity} ${unit} ${food}`));
}
