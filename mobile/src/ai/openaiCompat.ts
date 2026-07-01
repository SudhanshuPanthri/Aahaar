/**
 * Generic OpenAI-compatible chat provider — works with ANY endpoint that speaks
 * the /v1/chat/completions API. This keeps the model layer swappable (a locked
 * project decision) and lets us tap free providers without one-off code each.
 *
 * Configure with:
 *   EXPO_PUBLIC_OPENAI_BASE_URL  base URL incl. /v1, e.g. https://api.llm7.io/v1
 *   EXPO_PUBLIC_OPENAI_KEY       optional — some free gateways need no key
 *   EXPO_PUBLIC_OPENAI_MODEL     model id at that endpoint (e.g. gpt-5.4-mini)
 *
 * Known free, key-optional, OpenAI-compatible endpoints (from research):
 *   - llm7.io      base https://api.llm7.io/v1        ~150 req/min, no key needed
 *   - g4f.dev / uncloseai.com — also OpenAI-compatible (set the base URL + model)
 * llm7.io is the recommended default: no signup and a higher rate limit than
 * Groq's 30 req/min free tier (the rate-limit pain we hit before).
 *
 * ⚠️ Like all EXPO_PUBLIC_* config, any key set here is bundled into the app JS.
 * Only use a key in dev; for production route through the Cloudflare Worker.
 *
 * We do NOT send response_format (many free proxies reject it); instead we
 * instruct JSON-only output in the prompt and extract the JSON leniently.
 */
import type { ParsedItem } from '../estimate/resolve';
import { PARSE_SYSTEM, ESTIMATE_SYSTEM, normalizeItems, normalizeNutrition, type AiNutrition } from './shared';

const BASE = process.env.EXPO_PUBLIC_OPENAI_BASE_URL;
const KEY = process.env.EXPO_PUBLIC_OPENAI_KEY;
const MODEL = process.env.EXPO_PUBLIC_OPENAI_MODEL || 'gpt-5.4-mini';

export const openaiCompatAvailable = !!BASE;

/** Extract a JSON object from a model reply that may be fenced or chatty. */
function looseJson(content: string): any {
  const trimmed = (content ?? '').trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    // Strip ```json fences / prose and grab the outermost {...}.
    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(trimmed.slice(start, end + 1));
      } catch {
        /* fall through */
      }
    }
    return {};
  }
}

async function chatJson(system: string, user: string, timeoutMs = 20000): Promise<any> {
  if (!BASE) throw new Error('EXPO_PUBLIC_OPENAI_BASE_URL not set');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (KEY) headers.Authorization = `Bearer ${KEY}`;
    const res = await fetch(`${BASE.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      signal: controller.signal,
      headers,
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.2,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      }),
    });
    if (!res.ok) throw new Error(`openai-compat ${res.status}: ${await res.text().catch(() => '')}`);
    const data = await res.json();
    return looseJson(data?.choices?.[0]?.message?.content ?? '{}');
  } finally {
    clearTimeout(timer);
  }
}

export async function openaiCompatParse(text: string): Promise<ParsedItem[]> {
  return normalizeItems(await chatJson(PARSE_SYSTEM, text));
}

export async function openaiCompatEstimate(food: string, quantity: number, unit: string): Promise<AiNutrition | null> {
  return normalizeNutrition(await chatJson(ESTIMATE_SYSTEM, `${quantity} ${unit} ${food}`));
}
