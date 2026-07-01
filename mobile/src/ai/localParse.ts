/**
 * Heuristic offline parser: turns free text / Hinglish into ParsedItem[].
 * No network, no AI. Used as the offline + no-key fallback, and as the app's
 * manual-mode parser. The cloud AI parser (remoteParse) is more robust; this
 * covers common cases so the app is fully usable without it.
 */
import type { ParsedItem } from '../estimate/resolve';

const NUM_WORDS: Record<string, number> = {
  ek: 1, one: 1, do: 2, two: 2, teen: 3, three: 3, char: 4, chaar: 4, four: 4,
  paanch: 5, panch: 5, five: 5, chhe: 6, che: 6, six: 6, saat: 7, seven: 7,
  aath: 8, eight: 8, nau: 9, nine: 9, das: 10, ten: 10,
  aadha: 0.5, adha: 0.5, half: 0.5, paav: 0.25, sava: 1.25, dedh: 1.5,
};

// token → canonical unit
const UNITS: Record<string, string> = {
  g: 'g', gm: 'g', gms: 'g', gram: 'g', grams: 'g',
  kg: 'kg', ml: 'ml', l: 'l', litre: 'l', liter: 'l',
  katori: 'katori', katoris: 'katori', bowl: 'bowl', bowls: 'bowl',
  glass: 'glass', glasses: 'glass', cup: 'cup', cups: 'cup',
  tbsp: 'tbsp', tablespoon: 'tbsp', chamach: 'tbsp', tsp: 'tsp', teaspoon: 'tsp',
  plate: 'plate', plates: 'plate', piece: 'piece', pieces: 'piece', pc: 'piece',
  roti: 'roti', rotis: 'roti', chapati: 'roti', chapatis: 'roti',
  slice: 'piece', slices: 'piece', handful: 'handful', mutthi: 'handful',
};

// filler words to drop from the food name
const STOP = new Set([
  'i', 'ate', 'had', 'eat', 'eaten', 'maine', 'khaya', 'khaaya', 'khaaye', 'khaye',
  'ka', 'ki', 'ke', 'ko', 'of', 'a', 'an', 'the', 'some', 'also', 'bhi', 'was', 'were', 'just',
]);

function splitChunks(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[.]/g, ' ')
    .split(/\s*(?:,|\+|&|\band\b|\baur\b|\bwith\b|\bthen\b)\s*/g)
    .map((c) => c.trim())
    .filter(Boolean);
}

function parseChunk(chunk: string): ParsedItem | null {
  const tokens = chunk.split(/\s+/).filter(Boolean);
  let quantity: number | null = null;
  let unit: string | null = null;
  const foodTokens: string[] = [];

  for (const tok of tokens) {
    // glued quantity+unit, e.g. "100g", "250ml"
    const glued = tok.match(/^(\d+(?:\.\d+)?)([a-z]+)$/);
    if (glued && UNITS[glued[2]]) {
      quantity = parseFloat(glued[1]);
      unit = UNITS[glued[2]];
      continue;
    }
    if (/^\d+(?:\.\d+)?$/.test(tok)) {
      quantity = parseFloat(tok);
      continue;
    }
    if (NUM_WORDS[tok] != null) {
      quantity = NUM_WORDS[tok];
      continue;
    }
    if (UNITS[tok]) {
      unit = UNITS[tok];
      // "2 roti" — the unit word is also the food
      if (tok === 'roti' || tok === 'rotis' || tok === 'chapati' || tok === 'chapatis') {
        if (foodTokens.length === 0) foodTokens.push('roti');
      }
      continue;
    }
    if (STOP.has(tok)) continue;
    foodTokens.push(tok);
  }

  const food = foodTokens.join(' ').trim();
  if (!food) return null;

  let qty = quantity ?? 1;
  let u = unit ?? 'serving';

  // normalize weight/volume units the resolver doesn't map
  if (u === 'kg') { qty *= 1000; u = 'g'; }
  else if (u === 'l') { qty *= 1000; u = 'ml'; }

  return { food, quantity: qty, unit: u };
}

export function localParse(text: string): ParsedItem[] {
  if (!text || !text.trim()) return [];
  return splitChunks(text)
    .map(parseChunk)
    .filter((x): x is ParsedItem => x !== null);
}
