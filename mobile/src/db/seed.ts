/**
 * Loads the bundled nutrition seed into `food` / `food_portion` on first run.
 * Idempotent: no-ops if `food` already has rows.
 */
import { sql } from 'drizzle-orm';
import { db } from './client';
import { food, foodPortion } from './schema';
import seed from '../data/seed_foods.json';

type SeedFood = {
  canonical_name: string;
  aliases?: string[];
  category?: string;
  cuisine_region?: string;
  is_veg?: boolean;
  default_unit: string;
  per_100g: { calories: number; protein: number; carbs: number; fat: number; fiber?: number };
  portions?: { unit: string; grams: number; is_default?: boolean }[];
  source?: string;
};

export function seedIfEmpty(): number {
  const countRow = db.select({ c: sql<number>`count(*)` }).from(food).get();
  if (countRow && countRow.c > 0) return countRow.c;

  const foods = (seed as { foods: SeedFood[] }).foods;
  const now = new Date().toISOString();

  foods.forEach((f, i) => {
    const id = i + 1;
    db.insert(food)
      .values({
        id,
        canonicalName: f.canonical_name,
        aliases: JSON.stringify((f.aliases ?? []).map((a) => a.toLowerCase())),
        category: f.category ?? null,
        cuisineRegion: f.cuisine_region ?? null,
        isVeg: f.is_veg === false ? 0 : 1,
        defaultUnit: f.default_unit,
        caloriesPer100g: f.per_100g.calories,
        proteinPer100g: f.per_100g.protein,
        carbsPer100g: f.per_100g.carbs,
        fatPer100g: f.per_100g.fat,
        fiberPer100g: f.per_100g.fiber ?? null,
        source: f.source ?? null,
        updatedAt: now,
      })
      .run();

    (f.portions ?? []).forEach((p) => {
      db.insert(foodPortion)
        .values({ foodId: id, unit: p.unit, grams: p.grams, isDefault: p.is_default ? 1 : 0 })
        .run();
    });
  });

  return foods.length;
}
