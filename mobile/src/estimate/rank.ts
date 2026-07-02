/**
 * Pure food-match ranking — no DB, no imports — so it is unit-testable
 * (scripts/test-matcher.mjs). resolveItem() collects LIKE candidates with one
 * SQL pass, then this picks the best one instead of taking an arbitrary row
 * (which used to match "paneer" → "paneer butter masala").
 */

/** Minimal shape rank needs; `aliases` is the JSON-array-as-text DB column. */
export type FoodCandidate = { canonicalName: string; aliases: string | null };

export type RankedMatch<T extends FoodCandidate> = {
  candidate: T;
  score: number;
  confidence: 'high' | 'medium' | 'low';
};

function tokenize(s: string): string[] {
  return s.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
}

function parseAliases(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.map((a) => String(a).toLowerCase()) : [];
  } catch {
    return [];
  }
}

/** True when every token of `inner` appears as a whole word in `outer`. */
function coversTokens(outer: string[], inner: string[]): boolean {
  return inner.length > 0 && inner.every((t) => outer.includes(t));
}

/**
 * Rank candidate foods against a query and return the best (or null).
 * Scoring: exact canonical 100 / exact alias 90 (high); all query tokens as
 * whole words 70 minus 5 per extra token — so "paneer" prefers "paneer"
 * (0 extra) over "paneer butter masala" (2 extra) — (medium); plain substring
 * 40 (medium, or low when the candidate name dwarfs the query). Ties break
 * toward the shorter canonical name.
 */
export function rankFoodMatches<T extends FoodCandidate>(
  query: string,
  candidates: T[]
): RankedMatch<T> | null {
  const q = query.trim().toLowerCase();
  if (!q) return null;
  const qTokens = tokenize(q);

  let best: RankedMatch<T> | null = null;
  for (const c of candidates) {
    const name = c.canonicalName.trim().toLowerCase();
    const aliases = parseAliases(c.aliases);
    const nTokens = tokenize(name);

    let score: number;
    let confidence: 'high' | 'medium' | 'low' = 'medium';
    if (name === q) {
      score = 100;
      confidence = 'high';
    } else if (aliases.includes(q)) {
      score = 90;
      confidence = 'high';
    } else if (coversTokens(nTokens, qTokens)) {
      score = Math.max(45, 70 - 5 * (nTokens.length - qTokens.length));
    } else if (coversTokens(qTokens, nTokens)) {
      score = Math.max(45, 70 - 5 * (qTokens.length - nTokens.length));
    } else if (aliases.some((a) => coversTokens(tokenize(a), qTokens))) {
      score = 55; // query tokens all inside one alias ("chai" ∈ "masala chai")
    } else if (name.includes(q) || q.includes(name)) {
      score = 40;
      if (name.length > q.length * 2) confidence = 'low';
    } else if (aliases.some((a) => a.includes(q) || q.includes(a))) {
      score = 35;
      confidence = 'low';
    } else {
      continue; // SQL LIKE over-collected; not a real match
    }

    if (
      !best ||
      score > best.score ||
      (score === best.score && name.length < best.candidate.canonicalName.trim().length)
    ) {
      best = { candidate: c, score, confidence };
    }
  }
  return best;
}
