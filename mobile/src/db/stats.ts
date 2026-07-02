/**
 * Aggregate queries for Calendar (per-day kcal) and Trends (averages).
 * All grouping is on `local_date` so it matches the user's calendar days.
 */
import { and, gte, lte, sql } from 'drizzle-orm';
import { db } from './client';
import { logItem } from './schema';
import { todayLocalDate } from './log';

export type DayRow = { localDate: string; calories: number; protein: number; carbs: number; fat: number };

/** Shift a "YYYY-MM-DD" by a number of days, staying in local time. */
export function shiftLocalDate(localDate: string, deltaDays: number): string {
  const [y, m, d] = localDate.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + deltaDays);
  return todayLocalDate(dt);
}

/** Per-day totals within an inclusive date range (only days that have entries). */
export function getDailyTotalsInRange(startDate: string, endDate: string): DayRow[] {
  const rows = db
    .select({
      localDate: logItem.localDate,
      calories: sql<number>`coalesce(sum(${logItem.calories}), 0)`,
      protein: sql<number>`coalesce(sum(${logItem.proteinG}), 0)`,
      carbs: sql<number>`coalesce(sum(${logItem.carbsG}), 0)`,
      fat: sql<number>`coalesce(sum(${logItem.fatG}), 0)`,
    })
    .from(logItem)
    .where(and(gte(logItem.localDate, startDate), lte(logItem.localDate, endDate)))
    .groupBy(logItem.localDate)
    .all();

  return rows.map((r) => ({
    localDate: r.localDate,
    calories: Math.round(r.calories),
    protein: +r.protein.toFixed(1),
    carbs: +r.carbs.toFixed(1),
    fat: +r.fat.toFixed(1),
  }));
}

/**
 * Consecutive days with at least one logged item, ending today. A not-yet-logged
 * today doesn't break the streak (the day isn't over) — it just doesn't count.
 */
export function getLoggingStreak(end = todayLocalDate()): number {
  const start = shiftLocalDate(end, -365);
  const logged = new Set(getDailyTotalsInRange(start, end).map((r) => r.localDate));
  let streak = 0;
  let cursor = logged.has(end) ? end : shiftLocalDate(end, -1);
  while (logged.has(cursor)) {
    streak++;
    cursor = shiftLocalDate(cursor, -1);
  }
  return streak;
}

export type Averages = {
  avgCalories: number;
  avgProtein: number;
  avgCarbs: number;
  avgFat: number;
  activeDays: number; // days in the window that had at least one entry
  windowDays: number; // size of the window
};

/**
 * Averages over the last `windowDays` days ending today.
 * Averaged over ACTIVE days (days with entries), so a skipped day doesn't
 * deflate the numbers — this reflects "on days you logged, you ate ~X".
 */
export function getAverages(windowDays: number, end = todayLocalDate()): Averages {
  const start = shiftLocalDate(end, -(windowDays - 1));
  const rows = getDailyTotalsInRange(start, end);
  const activeDays = rows.length;
  if (activeDays === 0) {
    return { avgCalories: 0, avgProtein: 0, avgCarbs: 0, avgFat: 0, activeDays: 0, windowDays };
  }
  const sum = rows.reduce(
    (s, r) => ({ c: s.c + r.calories, p: s.p + r.protein, cb: s.cb + r.carbs, f: s.f + r.fat }),
    { c: 0, p: 0, cb: 0, f: 0 }
  );
  return {
    avgCalories: Math.round(sum.c / activeDays),
    avgProtein: +(sum.p / activeDays).toFixed(1),
    avgCarbs: +(sum.cb / activeDays).toFixed(1),
    avgFat: +(sum.f / activeDays).toFixed(1),
    activeDays,
    windowDays,
  };
}
