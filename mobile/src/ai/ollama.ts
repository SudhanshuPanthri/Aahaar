/**
 * Local Ollama provider — unlimited, free, private inference on your own machine.
 * Great for development (no rate limits). Not a production backend (a user's
 * phone can't reach your PC). Configure with:
 *   EXPO_PUBLIC_OLLAMA_URL   e.g. http://10.0.2.2:11434 (Android emulator → host)
 *                            or   http://192.168.x.x:11434 (physical device, PC LAN IP)
 *   EXPO_PUBLIC_OLLAMA_MODEL default "llama3.1"
 *
 * The host Ollama must bind to all interfaces to be reachable off-localhost:
 *   set OLLAMA_HOST=0.0.0.0 and restart Ollama (and allow port 11434 in firewall).
 */
import type { ParsedItem } from '../estimate/resolve';
import { PARSE_SYSTEM, ESTIMATE_SYSTEM, normalizeItems, normalizeNutrition, type AiNutrition } from './shared';

const BASE = process.env.EXPO_PUBLIC_OLLAMA_URL;
const MODEL = process.env.EXPO_PUBLIC_OLLAMA_MODEL || 'llama3.1';

export const ollamaAvailable = !!BASE;

async function ollamaJson(system: string, user: string, timeoutMs = 30000): Promise<any> {
  if (!BASE) throw new Error('EXPO_PUBLIC_OLLAMA_URL not set');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${BASE.replace(/\/$/, '')}/api/chat`, {
      method: 'POST',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: MODEL,
        stream: false,
        format: 'json', // constrain output to valid JSON
        options: { temperature: 0.2 },
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      }),
    });
    if (!res.ok) throw new Error(`ollama ${res.status}: ${await res.text().catch(() => '')}`);
    const data = await res.json();
    return JSON.parse(data?.message?.content ?? '{}');
  } finally {
    clearTimeout(timer);
  }
}

export async function ollamaParse(text: string): Promise<ParsedItem[]> {
  return normalizeItems(await ollamaJson(PARSE_SYSTEM, text));
}

export async function ollamaEstimate(food: string, quantity: number, unit: string): Promise<AiNutrition | null> {
  return normalizeNutrition(await ollamaJson(ESTIMATE_SYSTEM, `${quantity} ${unit} ${food}`));
}
