/**
 * Writing/reading the daily meal log (`log_item`).
 * Macros are snapshotted at save time so later DB edits don't rewrite history.
 */
import { asc, eq, sql } from 'drizzle-orm';
import { db } from './client';
import { logItem, type LogItem } from './schema';
import type { Estimate } from '../estimate/resolve';

/** User-local calendar day, "YYYY-MM-DD" (drives calendar + trends). */
export function todayLocalDate(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Infer a meal slot from the current hour. */
export function inferMealSlot(d = new Date()): string {
  const h = d.getHours();
  if (h < 11) return 'breakfast';
  if (h < 16) return 'lunch';
  if (h < 21) return 'dinner';
  return 'snack';
}

export type DayTotals = { calories: number; protein: number; carbs: number; fat: number; count: number };

/** Insert estimates into today's log. Returns number of rows written. */
export function addLogItems(estimates: Estimate[], rawText?: string, when = new Date()): number {
  const localDate = todayLocalDate(when);
  const loggedAt = when.toISOString();
  const mealSlot = inferMealSlot(when);
  let written = 0;

  for (const e of estimates) {
    db.insert(logItem)
      .values({
        localDate,
        loggedAt,
        mealSlot,
        foodId: null, // name is snapshotted; id linkage can be added later
        foodName: e.name,
        quantity: e.quantity,
        unit: e.unit,
        grams: e.grams,
        calories: e.calories,
        proteinG: e.protein,
        carbsG: e.carbs,
        fatG: e.fat,
        source: e.estimatedBy === 'ai' ? 'ai' : e.estimatedBy === 'user' ? 'user' : 'db',
        confidence: e.confidence,
        rawText: rawText ?? null,
        createdAt: loggedAt,
        updatedAt: loggedAt,
      })
      .run();
    written++;
  }
  return written;
}

/** Aggregate totals for a given local day (default: today). */
export function getDayTotals(localDate = todayLocalDate()): DayTotals {
  const row = db
    .select({
      calories: sql<number>`coalesce(sum(${logItem.calories}), 0)`,
      protein: sql<number>`coalesce(sum(${logItem.proteinG}), 0)`,
      carbs: sql<number>`coalesce(sum(${logItem.carbsG}), 0)`,
      fat: sql<number>`coalesce(sum(${logItem.fatG}), 0)`,
      count: sql<number>`count(*)`,
    })
    .from(logItem)
    .where(eq(logItem.localDate, localDate))
    .get();

  return {
    calories: Math.round(row?.calories ?? 0),
    protein: +(row?.protein ?? 0).toFixed(1),
    carbs: +(row?.carbs ?? 0).toFixed(1),
    fat: +(row?.fat ?? 0).toFixed(1),
    count: row?.count ?? 0,
  };
}

/** All logged items for a given local day (default: today), oldest first. */
export function getDayItems(localDate = todayLocalDate()): LogItem[] {
  return db
    .select()
    .from(logItem)
    .where(eq(logItem.localDate, localDate))
    .orderBy(asc(logItem.loggedAt))
    .all();
}

/** Delete a single logged item by id. */
export function deleteLogItem(id: number): void {
  db.delete(logItem).where(eq(logItem.id, id)).run();
}

/**
 * Change a logged item's quantity. Macros were snapshotted at save time, so we
 * rescale them proportionally (newQty/oldQty) — no re-resolution, no AI.
 */
export function updateLogItemQuantity(id: number, quantity: number): void {
  const row = db.select().from(logItem).where(eq(logItem.id, id)).get();
  if (!row || quantity <= 0 || row.quantity <= 0 || quantity === row.quantity) return;
  const k = quantity / row.quantity;
  db.update(logItem)
    .set({
      quantity,
      grams: row.grams == null ? null : row.grams * k,
      calories: row.calories * k,
      proteinG: row.proteinG * k,
      carbsG: row.carbsG * k,
      fatG: row.fatG * k,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(logItem.id, id))
    .run();
}

/**
 * A meal = the set of items saved together in one "Add to today" (they share an
 * exact `loggedAt` timestamp). This is what the user sees — the line they typed,
 * not each parsed ingredient.
 */
export type Meal = {
  key: string; // loggedAt, groups the items
  loggedAt: string;
  mealSlot: string | null;
  title: string; // the raw text the user typed, else the item names joined
  itemSummary: string; // "egg ×5, cheese ×1, toast ×1"
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  itemCount: number;
  items: LogItem[]; // the underlying rows, for expand/edit
};

/** Today's log grouped into meals (oldest first). */
export function getDayMeals(localDate = todayLocalDate()): Meal[] {
  const items = getDayItems(localDate);
  const byKey = new Map<string, LogItem[]>();
  for (const it of items) {
    const key = it.loggedAt;
    (byKey.get(key) ?? byKey.set(key, []).get(key)!).push(it);
  }

  const meals: Meal[] = [];
  for (const [key, group] of byKey) {
    const rawText = group.find((g) => g.rawText)?.rawText?.trim();
    const summary = group.map((g) => `${g.foodName} ×${g.quantity}`).join(', ');
    meals.push({
      key,
      loggedAt: key,
      mealSlot: group[0].mealSlot,
      title: rawText || group.map((g) => g.foodName).join(', '),
      itemSummary: summary,
      calories: Math.round(group.reduce((s, g) => s + g.calories, 0)),
      protein: +group.reduce((s, g) => s + g.proteinG, 0).toFixed(1),
      carbs: +group.reduce((s, g) => s + g.carbsG, 0).toFixed(1),
      fat: +group.reduce((s, g) => s + g.fatG, 0).toFixed(1),
      itemCount: group.length,
      items: group,
    });
  }
  return meals.sort((a, b) => a.loggedAt.localeCompare(b.loggedAt));
}

/** Delete a whole meal (all items sharing that loggedAt). */
export function deleteMeal(loggedAt: string): void {
  db.delete(logItem).where(eq(logItem.loggedAt, loggedAt)).run();
}
