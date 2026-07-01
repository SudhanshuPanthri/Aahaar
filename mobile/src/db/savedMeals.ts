/**
 * Saved meals — user-curated dishes / combinations they can re-log with one tap,
 * bypassing the AI and the resolver entirely (the resolved items are stored).
 */
import { desc, eq, sql } from 'drizzle-orm';
import { db } from './client';
import { savedMeal, logItem, type SavedMeal } from './schema';
import type { Estimate } from '../estimate/resolve';

/** Save the given resolved items under a name. Returns the new row id. */
export function saveMeal(name: string, items: Estimate[], when = new Date()): number {
  const totals = items.reduce(
    (s, r) => ({ cal: s.cal + r.calories, p: s.p + r.protein, c: s.c + r.carbs, f: s.f + r.fat }),
    { cal: 0, p: 0, c: 0, f: 0 }
  );
  const now = when.toISOString();
  const res = db
    .insert(savedMeal)
    .values({
      name: name.trim() || 'Saved meal',
      itemsJson: JSON.stringify(items),
      calories: Math.round(totals.cal),
      proteinG: +totals.p.toFixed(1),
      carbsG: +totals.c.toFixed(1),
      fatG: +totals.f.toFixed(1),
      useCount: 0,
      createdAt: now,
      lastUsedAt: now,
    })
    .run();
  return Number(res.lastInsertRowId ?? 0);
}

/** Save an already-logged meal (all items sharing a loggedAt) as a reusable meal. */
export function saveMealFromLog(name: string, loggedAt: string): number {
  const items = db.select().from(logItem).where(eq(logItem.loggedAt, loggedAt)).all();
  if (items.length === 0) return 0;
  const estimates: Estimate[] = items.map((li) => ({
    name: li.foodName,
    quantity: li.quantity,
    unit: li.unit,
    grams: li.grams ?? 0,
    calories: li.calories,
    protein: li.proteinG,
    carbs: li.carbsG,
    fat: li.fatG,
    confidence: (li.confidence as Estimate['confidence']) ?? 'medium',
    matched: true,
    estimatedBy: li.source === 'ai' ? 'ai' : 'db',
  }));
  return saveMeal(name, estimates);
}

/** All saved meals, most-used first (then most-recent). */
export function listSavedMeals(): SavedMeal[] {
  return db.select().from(savedMeal).orderBy(desc(savedMeal.useCount), desc(savedMeal.lastUsedAt)).all();
}

/** The resolved items stored in a saved meal. */
export function getSavedMealItems(meal: SavedMeal): Estimate[] {
  try {
    const parsed = JSON.parse(meal.itemsJson);
    return Array.isArray(parsed) ? (parsed as Estimate[]) : [];
  } catch {
    return [];
  }
}

/** Bump usage stats after a saved meal is logged (drives the sort order). */
export function markSavedMealUsed(id: number, when = new Date()): void {
  db.update(savedMeal)
    .set({ useCount: sql`${savedMeal.useCount} + 1`, lastUsedAt: when.toISOString() })
    .where(eq(savedMeal.id, id))
    .run();
}

/** True if a meal with this name already exists (case-insensitive) — avoids dupes. */
export function savedMealExists(name: string): boolean {
  const row = db
    .select({ n: sql<number>`count(*)` })
    .from(savedMeal)
    .where(sql`lower(${savedMeal.name}) = ${name.trim().toLowerCase()}`)
    .get();
  return (row?.n ?? 0) > 0;
}

export function deleteSavedMeal(id: number): void {
  db.delete(savedMeal).where(eq(savedMeal.id, id)).run();
}
