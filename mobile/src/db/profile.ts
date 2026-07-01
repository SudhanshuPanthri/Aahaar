/**
 * Profile, weight, and goal persistence.
 *  - `profile` is a singleton row (id = 1): demographics used by the goal calc.
 *  - `weight_log` keeps a history; the latest entry is the "current" weight.
 *  - `goal` is append-only; the newest row (by effectiveFrom) is the active target.
 *
 * Onboarding is "complete" once both a profile and a goal exist.
 */
import { desc, eq, sql } from 'drizzle-orm';
import { db } from './client';
import { profile, weightLog, goal, type Profile, type Goal } from './schema';
import type { ActivityLevel, GoalType, MacroTargets, Sex } from '../goals/calc';

const PROFILE_ID = 1;

export type ProfileInput = {
  sex: Sex;
  birthYear: number;
  heightCm: number;
  activityLevel: ActivityLevel;
  dietPref?: string | null;
};

/** The singleton profile, or null if onboarding hasn't run. */
export function getProfile(): Profile | null {
  return db.select().from(profile).where(eq(profile.id, PROFILE_ID)).get() ?? null;
}

/** Upsert the singleton profile row. */
export function saveProfile(input: ProfileInput): void {
  const now = new Date().toISOString();
  const existing = getProfile();
  if (existing) {
    db.update(profile)
      .set({
        sex: input.sex,
        birthYear: input.birthYear,
        heightCm: input.heightCm,
        activityLevel: input.activityLevel,
        dietPref: input.dietPref ?? null,
        updatedAt: now,
      })
      .where(eq(profile.id, PROFILE_ID))
      .run();
  } else {
    db.insert(profile)
      .values({
        id: PROFILE_ID,
        sex: input.sex,
        birthYear: input.birthYear,
        heightCm: input.heightCm,
        activityLevel: input.activityLevel,
        dietPref: input.dietPref ?? null,
        createdAt: now,
        updatedAt: now,
      })
      .run();
  }
}

/** Append a weight measurement (kg). */
export function addWeight(weightKg: number, when = new Date()): void {
  db.insert(weightLog).values({ weightKg, loggedAt: when.toISOString() }).run();
}

/** Most recent logged weight in kg, or null if none. */
export function getLatestWeight(): number | null {
  const row = db.select().from(weightLog).orderBy(desc(weightLog.loggedAt)).limit(1).get();
  return row?.weightKg ?? null;
}

/** The active (newest) goal, or null if none set. */
export function getActiveGoal(): Goal | null {
  return db.select().from(goal).orderBy(desc(goal.effectiveFrom), desc(goal.id)).limit(1).get() ?? null;
}

/** Insert a new goal row; it becomes the active goal. */
export function saveGoal(
  targets: MacroTargets,
  mode: 'guided' | 'custom',
  goalType: GoalType,
  when = new Date()
): void {
  const now = when.toISOString();
  db.insert(goal)
    .values({
      mode,
      goalType,
      targetCalories: targets.targetCalories,
      targetProteinG: targets.targetProteinG,
      targetCarbsG: targets.targetCarbsG,
      targetFatG: targets.targetFatG,
      effectiveFrom: now,
      createdAt: now,
    })
    .run();
}

/** True once the user has both a profile and a goal. */
export function hasCompletedOnboarding(): boolean {
  const p = db.select({ n: sql<number>`count(*)` }).from(profile).get();
  const g = db.select({ n: sql<number>`count(*)` }).from(goal).get();
  return (p?.n ?? 0) > 0 && (g?.n ?? 0) > 0;
}
