/**
 * Aahaar meal-parser proxy (Cloudflare Worker).
 *
 * Receives { text } → calls Groq → returns strict JSON { items, unparsed }.
 * The Groq API key lives here as a Worker secret (never in the app).
 * Only the meal text passes through — no PII.
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

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });
    if (request.method !== 'POST') {
      return json({ error: 'POST only' }, 405);
    }

    let text = '';
    try {
      const body = (await request.json()) as { text?: string };
      text = (body.text ?? '').toString().slice(0, 2000);
    } catch {
      return json({ error: 'invalid JSON body' }, 400);
    }
    if (!text.trim()) return json({ items: [], unparsed: [] }, 200);

    const model = env.GROQ_MODEL || 'llama-3.3-70b-versatile';

    let groqRes: Response;
    try {
      groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
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
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: text },
          ],
        }),
      });
    } catch (e) {
      return json({ error: 'upstream fetch failed', items: [], unparsed: [text] }, 502);
    }

    if (!groqRes.ok) {
      const detail = await groqRes.text().catch(() => '');
      return json({ error: `groq ${groqRes.status}`, detail, items: [], unparsed: [text] }, 502);
    }

    const data = (await groqRes.json()) as any;
    const content: string = data?.choices?.[0]?.message?.content ?? '{"items":[],"unparsed":[]}';

    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      return json({ items: [], unparsed: [text], error: 'model returned non-JSON' }, 200);
    }
    return json(parsed, 200);
  },
};

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}
