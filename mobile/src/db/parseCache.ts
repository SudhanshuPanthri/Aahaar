/**
 * Caches AI results so identical inputs never hit the model again.
 * Cuts API calls dramatically (helps every provider's rate limits).
 * Two namespaces share the parse_cache table: whole-meal parses (raw text key)
 * and per-item nutrition estimates ("est:" prefixed key).
 */
import { eq } from 'drizzle-orm';
import { db } from './client';
import { parseCache } from './schema';
import type { ParsedItem } from '../estimate/resolve';
import type { AiNutrition } from '../ai/shared';

export function normalizeInput(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, ' ');
}

/** Cached JSON for a key, or null. Bumps hit count on hit. */
function getRaw(key: string): string | null {
  const row = db.select().from(parseCache).where(eq(parseCache.normalizedInput, key)).get();
  if (!row) return null;
  db.update(parseCache)
    .set({ hitCount: (row.hitCount ?? 0) + 1, lastUsedAt: new Date().toISOString() })
    .where(eq(parseCache.id, row.id))
    .run();
  return row.resolvedJson;
}

/** Store (or refresh) a JSON payload under a key. */
function putRaw(key: string, json: string): void {
  const now = new Date().toISOString();
  db.insert(parseCache)
    .values({ normalizedInput: key, resolvedJson: json, hitCount: 1, lastUsedAt: now })
    .onConflictDoUpdate({
      target: parseCache.normalizedInput,
      set: { resolvedJson: json, lastUsedAt: now },
    })
    .run();
}

/** Returns cached parsed items for this input, or null. */
export function getCachedParse(norm: string): ParsedItem[] | null {
  const json = getRaw(norm);
  if (!json) return null;
  try {
    return JSON.parse(json) as ParsedItem[];
  } catch {
    return null;
  }
}

/** Store (or refresh) an AI parse result for this input. */
export function putCachedParse(norm: string, items: ParsedItem[]): void {
  putRaw(norm, JSON.stringify(items));
}

// ponytail: estimates share parse_cache via a versioned key prefix — separate table if the namespaces ever clash
// Bump the version whenever the estimate prompt changes materially, so stale cached numbers don't stick.
function estimateKey(food: string, quantity: number, unit: string): string {
  return `est:v2:${quantity} ${normalizeInput(unit)} ${normalizeInput(food)}`;
}

/** Cached AI nutrition estimate for one item, or null. */
export function getCachedEstimate(food: string, quantity: number, unit: string): AiNutrition | null {
  const json = getRaw(estimateKey(food, quantity, unit));
  if (!json) return null;
  try {
    const r = JSON.parse(json) as AiNutrition;
    return typeof r?.calories === 'number' ? r : null;
  } catch {
    return null;
  }
}

/** Store a validated AI nutrition estimate for one item. */
export function putCachedEstimate(food: string, quantity: number, unit: string, est: AiNutrition): void {
  putRaw(estimateKey(food, quantity, unit), JSON.stringify(est));
}
