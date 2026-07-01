/**
 * Cloud AI parser: POSTs meal text to our Cloudflare Worker proxy, which calls
 * Groq and returns the strict-JSON item list (see worker/ + TECH_DESIGN §3).
 * Only the meal text is sent — no PII.
 */
import type { ParsedItem } from '../estimate/resolve';

type RawItem = { food?: unknown; quantity?: unknown; unit?: unknown };

function normalize(raw: RawItem): ParsedItem | null {
  const food = typeof raw.food === 'string' ? raw.food.trim() : '';
  if (!food) return null;
  const quantity = typeof raw.quantity === 'number' && raw.quantity > 0 ? raw.quantity : 1;
  const unit = typeof raw.unit === 'string' && raw.unit.trim() ? raw.unit.trim() : 'serving';
  return { food, quantity, unit };
}

export async function remoteParse(text: string, url: string, timeoutMs = 12000): Promise<ParsedItem[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`parser proxy ${res.status}`);
    const json = (await res.json()) as { items?: RawItem[] };
    return (json.items ?? []).map(normalize).filter((x): x is ParsedItem => x !== null);
  } finally {
    clearTimeout(timer);
  }
}
