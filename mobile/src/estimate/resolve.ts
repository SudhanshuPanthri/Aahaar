/**
 * Estimation pipeline (TECH_DESIGN.md §4): resolve a parsed {food, quantity, unit}
 * against the local nutrition DB and compute calories/macros.
 *
 * The LLM produces ParsedItem; the NUMBERS come from here, never the LLM.
 */
import { sql } from 'drizzle-orm';
import { db } from '../db/client';
import { food, foodPortion } from '../db/schema';

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
  estimatedBy: 'db' | 'ai' | 'none'; // where the numbers came from
};

export function resolveItem(item: ParsedItem): Estimate {
  const q = item.food.trim().toLowerCase();
  let confidence: 'high' | 'medium' | 'low' = 'high';

  // 1. exact canonical-name match
  let row = db.select().from(food).where(sql`lower(${food.canonicalName}) = ${q}`).get();

  // 2. fuzzy: partial name or alias match
  if (!row) {
    row = db
      .select()
      .from(food)
      .where(
        sql`lower(${food.canonicalName}) LIKE ${'%' + q + '%'} OR lower(${food.aliases}) LIKE ${'%"' + q + '"%'}`
      )
      .get();
    confidence = 'medium';
  }

  if (!row) {
    return {
      name: item.food, quantity: item.quantity, unit: item.unit,
      grams: 0, calories: 0, protein: 0, carbs: 0, fat: 0,
      confidence: 'low', matched: false, estimatedBy: 'none',
    };
  }

  // 3. unit → grams
  const u = item.unit.trim().toLowerCase();
  let grams: number;
  if (u === 'g' || u === 'ml') {
    grams = item.quantity;
  } else {
    const p = db
      .select()
      .from(foodPortion)
      .where(sql`${foodPortion.foodId} = ${row.id} AND lower(${foodPortion.unit}) = ${u}`)
      .get();
    if (p) {
      grams = item.quantity * p.grams;
    } else if (GLOBAL_PORTIONS[u] != null) {
      grams = item.quantity * GLOBAL_PORTIONS[u];
      if (confidence === 'high') confidence = 'medium';
    } else {
      grams = item.quantity * 100; // last-resort assumption
      confidence = 'low';
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
