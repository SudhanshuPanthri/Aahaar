/**
 * Orchestrates parsing. Order:
 *   0. parse_cache  (identical input → no network at all)
 *   1. Cloudflare Worker proxy    (production)
 *   2. local Ollama               (unlimited dev, if EXPO_PUBLIC_OLLAMA_URL set)
 *   3. OpenAI-compatible endpoint (PRIMARY free cloud, e.g. llm7.io, if BASE_URL set)
 *   4. direct Groq                (fallback, if EXPO_PUBLIC_GROQ_KEY set)
 *   5. offline heuristic parser   (always works)
 * Successful AI parses are cached.
 */
import type { ParsedItem } from '../estimate/resolve';
import { localParse } from './localParse';
import { remoteParse } from './remoteParse';
import { groqAvailable, groqParse } from './groq';
import { ollamaAvailable, ollamaParse } from './ollama';
import { openaiCompatAvailable, openaiCompatParse } from './openaiCompat';
import { getCachedParse, putCachedParse, normalizeInput } from '../db/parseCache';

const PARSER_URL = process.env.EXPO_PUBLIC_PARSER_URL;

export type ParseResult = { items: ParsedItem[]; via: 'ai' | 'local' | 'cache' };

export async function parseMeal(text: string): Promise<ParseResult> {
  const norm = normalizeInput(text);

  // 0. Cache — repeated meals cost nothing.
  const cached = getCachedParse(norm);
  if (cached && cached.length > 0) return { items: cached, via: 'cache' };

  // 1. Worker (production).
  if (PARSER_URL) {
    try {
      const items = await remoteParse(text, PARSER_URL);
      if (items.length > 0) { putCachedParse(norm, items); return { items, via: 'ai' }; }
    } catch { /* fall through */ }
  }
  // 2. Local Ollama (unlimited dev).
  if (ollamaAvailable) {
    try {
      const items = await ollamaParse(text);
      if (items.length > 0) { putCachedParse(norm, items); return { items, via: 'ai' }; }
    } catch { /* fall through */ }
  }
  // 3. Primary cloud: OpenAI-compatible endpoint (free gateways, e.g. llm7.io).
  if (openaiCompatAvailable) {
    try {
      const items = await openaiCompatParse(text);
      if (items.length > 0) { putCachedParse(norm, items); return { items, via: 'ai' }; }
    } catch { /* fall through */ }
  }
  // 4. Direct Groq (fallback if the primary is down / rate-limited).
  if (groqAvailable) {
    try {
      const items = await groqParse(text);
      if (items.length > 0) { putCachedParse(norm, items); return { items, via: 'ai' }; }
    } catch { /* fall through */ }
  }
  // 5. Offline.
  return { items: localParse(text), via: 'local' };
}
