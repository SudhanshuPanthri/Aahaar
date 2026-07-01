/**
 * Caches AI parse results so identical meal text never hits the model again.
 * Cuts API calls dramatically (helps every provider's rate limits).
 */
import { eq } from 'drizzle-orm';
import { db } from './client';
import { parseCache } from './schema';
import type { ParsedItem } from '../estimate/resolve';

export function normalizeInput(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, ' ');
}

/** Returns cached parsed items for this input, or null. Bumps hit count on hit. */
export function getCachedParse(norm: string): ParsedItem[] | null {
  const row = db.select().from(parseCache).where(eq(parseCache.normalizedInput, norm)).get();
  if (!row) return null;
  try {
    const items = JSON.parse(row.resolvedJson) as ParsedItem[];
    db.update(parseCache)
      .set({ hitCount: (row.hitCount ?? 0) + 1, lastUsedAt: new Date().toISOString() })
      .where(eq(parseCache.id, row.id))
      .run();
    return items;
  } catch {
    return null;
  }
}

/** Store (or refresh) an AI parse result for this input. */
export function putCachedParse(norm: string, items: ParsedItem[]): void {
  const now = new Date().toISOString();
  db.insert(parseCache)
    .values({ normalizedInput: norm, resolvedJson: JSON.stringify(items), hitCount: 1, lastUsedAt: now })
    .onConflictDoUpdate({
      target: parseCache.normalizedInput,
      set: { resolvedJson: JSON.stringify(items), lastUsedAt: now },
    })
    .run();
}
