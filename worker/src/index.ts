/**
 * Aahaar AI proxy (Cloudflare Worker).
 *
 * POST /          { text }                   → parse   → { items, unparsed }
 * POST /estimate  { food, quantity, unit }   → estimate → { grams, per100g:{...} }
 *
 * The Groq API key lives here as a Worker secret (never in the app).
 * Only meal text passes through — no PII.
 */

export interface Env {
  GROQ_API_KEY: string;
  GROQ_MODEL?: string; // default below
}

const SYSTEM_PROMPT = `You extract foods, quantities, and units from a meal description (which may be English or Hinglish).
Output ONLY a JSON object matching this shape:
{"items":[{"food":string,"quantity":number,"unit":string,"modifier":string|null,"raw":string}],"unparsed":string[]}

Rules:
- Do NOT estimate calories or nutrition. Extraction only.
- Normalize Hinglish/Hindi to common English food names (e.g. "chawal"->"rice", "anda"->"egg").
- Convert Hindi number words to numbers: ek=1, do=2, teen=3, aadha/half=0.5, paav=0.25, dedh=1.5.
- unit must be one of: g, ml, katori, roti, piece, glass, cup, tbsp, tsp, plate, bowl, handful, serving.
- If quantity/unit is unstated, use quantity 1 and unit "serving".
- Put anything you cannot interpret as food into "unparsed". Never invent foods.
Return only the JSON, no prose.`;

// Keep in sync with mobile/src/ai/shared.ts ESTIMATE_SYSTEM.
const ESTIMATE_PROMPT = `You estimate nutrition for ONE described food portion, assuming typical Indian home preparation.
Work in two steps:
1. "grams": total weight of the WHOLE portion (quantity × unit), as eaten.
   Typical Indian portions: 1 katori dal/curry = 150 g, 1 katori cooked rice = 125 g, 1 katori sabzi = 120 g,
   1 roti = 40 g, 1 paratha = 90 g, 1 plate = 220-300 g, 1 glass = 250 ml, 1 cup = 150 ml,
   1 tbsp = 15 g, 1 tsp = 7 g, 1 egg = 50 g, 1 samosa = 50 g, 1 piece mithai = 40 g, 1 idli = 40 g, 1 dosa = 100 g.
2. "per100g": standard nutrition-table values (USDA/IFCT) per 100 g of the food AS PREPARED
   (cooked weight, including typical oil/ghee for home cooking).
Return ONLY JSON: {"grams":number,"per100g":{"calories":number,"protein_g":number,"carbs_g":number,"fat_g":number}}
No commentary.`;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

/**
 * Groq free-tier daily quotas are PER MODEL (console.groq.com/docs/rate-limits),
 * so falling through this chain on 429/errors multiplies capacity on one key:
 * ~1K + 1K + 14.4K requests/day. Strongest model first; all have ≥128K context.
 */
const MODELS = [
  'openai/gpt-oss-120b', // best food-table recall; 1K req/day, 200K tokens/day
  'meta-llama/llama-4-scout-17b-16e-instruct', // 1K req/day, 30K TPM, 500K tokens/day
  'llama-3.1-8b-instant', // capacity workhorse: 14.4K req/day, 500K tokens/day
];

/** Call Groq with a system prompt + user text; falls through MODELS on any failure. */
async function groqJson(env: Env, system: string, user: string): Promise<unknown> {
  const models = env.GROQ_MODEL ? [env.GROQ_MODEL, ...MODELS] : MODELS;
  let lastError = 'no models attempted';
  for (const model of models) {
    let res: Response;
    try {
      res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.GROQ_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          temperature: 0.2,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: user },
          ],
        }),
      });
    } catch (e) {
      lastError = `${model}: ${String(e)}`;
      continue;
    }
    if (!res.ok) {
      // 429 = this model's quota is spent; 4xx/5xx = decommissioned/down. Try the next.
      lastError = `${model}: groq ${res.status} ${await res.text().catch(() => '')}`.slice(0, 300);
      continue;
    }
    const data = (await res.json()) as any;
    return JSON.parse(data?.choices?.[0]?.message?.content ?? '{}');
  }
  throw new Error(lastError);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });
    if (request.method !== 'POST') {
      return json({ error: 'POST only' }, 405);
    }

    let body: any;
    try {
      body = await request.json();
    } catch {
      return json({ error: 'invalid JSON body' }, 400);
    }

    if (new URL(request.url).pathname.endsWith('/estimate')) {
      const food = (body?.food ?? '').toString().slice(0, 200);
      const quantity = Number(body?.quantity) || 1;
      const unit = (body?.unit ?? 'serving').toString().slice(0, 30);
      if (!food.trim()) return json({ error: 'food required' }, 400);
      try {
        return json(await groqJson(env, ESTIMATE_PROMPT, `${quantity} ${unit} ${food}`), 200);
      } catch (e) {
        return json({ error: String(e) }, 502);
      }
    }

    // Default route: parse.
    const text = (body?.text ?? '').toString().slice(0, 2000);
    if (!text.trim()) return json({ items: [], unparsed: [] }, 200);
    try {
      return json(await groqJson(env, SYSTEM_PROMPT, text), 200);
    } catch (e) {
      return json({ error: String(e), items: [], unparsed: [text] }, 502);
    }
  },
};

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}
