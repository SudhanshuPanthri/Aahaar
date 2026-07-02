/**
 * Estimation pipeline (TECH_DESIGN.md §4): resolve a parsed {food, quantity, unit}
 * against the local nutrition DB and compute calories/macros.
 *
 * The LLM produces ParsedItem; the NUMBERS come from here, never the LLM.
 */
import { sql } from 'drizzle-orm';
import { db } from '../db/client';
import { food, foodPortion } from '../db/schema';
import { rankFoodMatches } from './rank';

/**
 * Obvious unit synonyms, tried when a food has no portion row for the raw
 * unit. `factor` scales the synonym's grams (a bowl is a biggish katori).
 */
const UNIT_SYNONYMS: Record<string, { unit: string; factor: number }> = {
  bowl: { unit: 'katori', factor: 1.3 },
  tumbler: { unit: 'glass', factor: 1 },
  mug: { unit: 'cup', factor: 1.3 },
  slice: { unit: 'piece', factor: 1 },
  pc: { unit: 'piece', factor: 1 },
  pcs: { unit: 'piece', factor: 1 },
  roti: { unit: 'piece', factor: 1 }, // "2 roti" of naan/paratha-type breads
  chapati: { unit: 'piece', factor: 1 },
  tablespoon: { unit: 'tbsp', factor: 1 },
  teaspoon: { unit: 'tsp', factor: 1 },
  spoon: { unit: 'tbsp', factor: 1 },
};

/**
 * Category-aware grams-per-unit defaults (typical Indian household portions),
 * used when the matched food has no portion row for the unit. Falls through
 * to GLOBAL_PORTIONS, then the 100 g last resort.
 */
const CATEGORY_PORTIONS: Record<string, Record<string, number>> = {
  grain: { katori: 140, piece: 40, plate: 220, serving: 120 }, // piece ≈ roti/idli; katori = cooked grain
  rice: { katori: 125, plate: 250, serving: 180 }, // cooked rice sits lighter in a katori than dal
  legume: { katori: 150, plate: 250, serving: 150, tbsp: 15 }, // dals/curries are ladled wet
  curry: { katori: 150, plate: 250, serving: 180, piece: 60 }, // gravy ≈ dal density; piece ≈ kofta chunk
  sabzi: { katori: 120, plate: 200, serving: 130, piece: 100 }, // between dry sabzi (100) and gravy (150)
  dairy: { glass: 250, cup: 150, katori: 150, tbsp: 15, serving: 100 },
  beverage: { glass: 250, cup: 150, serving: 250, can: 330, bottle: 500 },
  fruit: { piece: 100, katori: 120, serving: 150 }, // mid-size whole fruit ≈ 100 g
  vegetable: { piece: 100, katori: 100, plate: 150, serving: 100 },
  sweet: { piece: 40, katori: 100, plate: 120, serving: 60 }, // mithai piece ≈ laddu/barfi; halwa katori small but dense
  snack: { piece: 50, handful: 30, plate: 150, katori: 60, serving: 80 }, // samosa-scale piece; namkeen katori is light
  street: { piece: 90, plate: 200, serving: 150, roll: 190 }, // tikki/vada-pav-scale piece; chaat plate
  breakfast: { piece: 90, katori: 160, plate: 200, serving: 150 }, // paratha/dosa-scale piece; upma/poha katori
  bread: { piece: 60, serving: 70 }, // between roti (40) and naan (90)
  'non-veg': { piece: 60, katori: 150, plate: 250, serving: 150 }, // tikka/kebab-scale piece
  'indo-chinese': { piece: 40, katori: 150, plate: 220, serving: 180 }, // momo-scale piece; noodles plate
  'fast-food': { piece: 150, plate: 250, serving: 150 }, // burger-scale piece
  nuts: { handful: 25, tbsp: 15, piece: 3, serving: 30 }, // a single nut ≈ 3 g
  seeds: { tbsp: 12, tsp: 4, serving: 12 },
  fat: { tbsp: 15, tsp: 5, serving: 10 }, // oil/ghee/butter are spoon-dosed
  staple: { tsp: 5, tbsp: 15, serving: 10 }, // sugar/honey likewise
  condiment: { tbsp: 15, tsp: 7, katori: 100, serving: 30 }, // chutney/pickle side amounts
  spread: { tbsp: 15, tsp: 7, serving: 15 },
  protein: { scoop: 30, katori: 100, serving: 100 }, // whey scoop = 30 g
};

/** Last-resort flat defaults when even the category table has no entry. */
const GLOBAL_PORTIONS: Record<string, number> = {
  katori: 150, bowl: 200, glass: 250, cup: 150, plate: 300,
  tbsp: 15, tsp: 5, piece: 50, handful: 15, serving: 100,
};

export type ParsedItem = { food: string; quantity: number; unit: string };

export type Estimate = {
  name: string; // what the user/parser called it — this is what we display
  matchedName?: string; // the DB row we pulled numbers from (may differ, e.g. "egg (boiled)")
  quantity: number;
  unit: string;
  grams: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  confidence: 'high' | 'medium' | 'low';
  matched: boolean;
  estimatedBy: 'db' | 'ai' | 'user' | 'none'; // where the numbers came from
};

/** Grams for one `unit` of food `foodId` from its portion rows, if any. */
function portionGrams(foodId: number, unit: string): number | null {
  const p = db
    .select()
    .from(foodPortion)
    .where(sql`${foodPortion.foodId} = ${foodId} AND lower(${foodPortion.unit}) = ${unit}`)
    .get();
  return p ? p.grams : null;
}

export function resolveItem(item: ParsedItem): Estimate {
  const q = item.food.trim().toLowerCase();
  let confidence: 'high' | 'medium' | 'low' = 'high';

  // 1. exact canonical-name match
  let row = db.select().from(food).where(sql`lower(${food.canonicalName}) = ${q}`).get();

  // 2. fuzzy: collect all LIKE candidates in one pass (name contains query,
  //    alias contains query, or query contains name), then rank in JS.
  if (!row) {
    const like = '%' + q + '%';
    const candidates = db
      .select()
      .from(food)
      .where(
        sql`lower(${food.canonicalName}) LIKE ${like} OR lower(${food.aliases}) LIKE ${like} OR ${q} LIKE '%' || lower(${food.canonicalName}) || '%'`
      )
      .all();
    const best = rankFoodMatches(q, candidates);
    if (best) {
      row = best.candidate;
      confidence = best.confidence;
    }
  }

  if (!row) {
    return {
      name: item.food, quantity: item.quantity, unit: item.unit,
      grams: 0, calories: 0, protein: 0, carbs: 0, fat: 0,
      confidence: 'low', matched: false, estimatedBy: 'none',
    };
  }

  // 3. unit → grams: per-food portion row (raw unit, then synonym), then
  //    category defaults, then global defaults, then 100 g.
  const u = item.unit.trim().toLowerCase();
  let grams: number;
  if (u === 'g' || u === 'ml') {
    grams = item.quantity;
  } else {
    const syn = UNIT_SYNONYMS[u];
    let per = portionGrams(row.id, u);
    let factor = 1;
    if (per == null && syn) {
      per = portionGrams(row.id, syn.unit);
      factor = syn.factor;
    }
    if (per != null) {
      grams = item.quantity * per * factor;
    } else {
      const effUnit = syn ? syn.unit : u;
      const effFactor = syn ? syn.factor : 1;
      const cat = row.category ? CATEGORY_PORTIONS[row.category] : undefined;
      const base = cat?.[effUnit] ?? GLOBAL_PORTIONS[effUnit];
      if (base != null) {
        grams = item.quantity * base * effFactor;
        if (confidence === 'high') confidence = 'medium';
      } else {
        grams = item.quantity * 100; // last-resort assumption
        confidence = 'low';
      }
    }
  }

  const f = grams / 100;
  return {
    // Show the user's own words; keep the matched DB name as metadata only.
    name: item.food,
    matchedName: row.canonicalName,
    quantity: item.quantity,
    unit: item.unit,
    grams: Math.round(grams),
    calories: Math.round(row.caloriesPer100g * f),
    protein: +(row.proteinPer100g * f).toFixed(1),
    carbs: +(row.carbsPer100g * f).toFixed(1),
    fat: +(row.fatPer100g * f).toFixed(1),
    confidence,
    matched: true,
    estimatedBy: 'db',
  };
}
