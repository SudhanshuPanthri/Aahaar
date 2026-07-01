/**
 * Aahaar — Drizzle schema for on-device SQLite (expo-sqlite).
 * Implements the data model in TECH_DESIGN.md §2.
 *
 * Two groups:
 *  - Bundled read-only: `food`, `foodPortion` (seeded from data/seed_foods.json).
 *  - User-writable: `profile`, `weightLog`, `goal`, `logItem`, `parseCache`.
 *
 * Dates are ISO-8601 text. `localDate` ("YYYY-MM-DD") drives calendar + trends.
 */
import { sql } from 'drizzle-orm';
import { sqliteTable, integer, text, real, index, uniqueIndex } from 'drizzle-orm/sqlite-core';

/* ── Bundled nutrition dataset (read-only) ─────────────────────────────── */

export const food = sqliteTable(
  'food',
  {
    id: integer('id').primaryKey(),
    canonicalName: text('canonical_name').notNull(),
    aliases: text('aliases'), // JSON array as text: ["cottage cheese","chhena"]
    category: text('category'),
    cuisineRegion: text('cuisine_region'),
    isVeg: integer('is_veg').default(1), // 0/1
    defaultUnit: text('default_unit').notNull(),
    caloriesPer100g: real('calories_per_100g').notNull(),
    proteinPer100g: real('protein_per_100g').notNull(),
    carbsPer100g: real('carbs_per_100g').notNull(),
    fatPer100g: real('fat_per_100g').notNull(),
    fiberPer100g: real('fiber_per_100g'),
    source: text('source'),
    updatedAt: text('updated_at'),
  },
  (t) => ({
    nameIdx: index('idx_food_name').on(t.canonicalName),
  })
);

export const foodPortion = sqliteTable(
  'food_portion',
  {
    id: integer('id').primaryKey(),
    foodId: integer('food_id')
      .notNull()
      .references(() => food.id),
    unit: text('unit').notNull(), // "katori","roti","piece","glass","tbsp","plate"
    grams: real('grams').notNull(),
    isDefault: integer('is_default').default(0),
  },
  (t) => ({
    foodIdx: index('idx_portion_food').on(t.foodId),
  })
);

/* ── User data (writable) ──────────────────────────────────────────────── */

// Single-row table (id is always 1).
export const profile = sqliteTable('profile', {
  id: integer('id').primaryKey(), // enforce =1 in app logic
  sex: text('sex'), // "male" | "female" | "other"
  birthYear: integer('birth_year'),
  heightCm: real('height_cm'),
  activityLevel: text('activity_level'), // sedentary | light | moderate | active | very_active
  dietPref: text('diet_pref'), // veg | nonveg | egg | vegan | jain
  createdAt: text('created_at'),
  updatedAt: text('updated_at'),
});

export const weightLog = sqliteTable('weight_log', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  weightKg: real('weight_kg').notNull(),
  loggedAt: text('logged_at').notNull(),
});

// Goal history; the current goal is the latest by effectiveFrom.
export const goal = sqliteTable('goal', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  mode: text('mode').notNull(), // "guided" | "custom"
  goalType: text('goal_type'), // "lose" | "maintain" | "gain"
  targetCalories: real('target_calories').notNull(),
  targetProteinG: real('target_protein_g').notNull(),
  targetCarbsG: real('target_carbs_g').notNull(),
  targetFatG: real('target_fat_g').notNull(),
  effectiveFrom: text('effective_from').notNull(),
  createdAt: text('created_at'),
});

// One row per food eaten. Macros are snapshotted at log time.
export const logItem = sqliteTable(
  'log_item',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    localDate: text('local_date').notNull(), // "YYYY-MM-DD" (user local day)
    loggedAt: text('logged_at').notNull(), // full ISO timestamp
    mealSlot: text('meal_slot'), // breakfast | lunch | dinner | snack
    foodId: integer('food_id').references(() => food.id), // nullable (custom/unmatched)
    foodName: text('food_name').notNull(), // snapshot of resolved name
    quantity: real('quantity').notNull(),
    unit: text('unit').notNull(),
    grams: real('grams'),
    calories: real('calories').notNull(),
    proteinG: real('protein_g').notNull(),
    carbsG: real('carbs_g').notNull(),
    fatG: real('fat_g').notNull(),
    source: text('source'), // ai | manual | quick
    confidence: text('confidence'), // high | medium | low
    rawText: text('raw_text'),
    createdAt: text('created_at'),
    updatedAt: text('updated_at'),
  },
  (t) => ({
    dateIdx: index('idx_log_date').on(t.localDate),
    foodIdx: index('idx_log_food').on(t.foodId),
  })
);

// Cache AI parses + power "recent/frequent foods" (skip the LLM on repeats).
export const parseCache = sqliteTable(
  'parse_cache',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    normalizedInput: text('normalized_input').notNull(),
    resolvedJson: text('resolved_json').notNull(),
    hitCount: integer('hit_count').default(1),
    lastUsedAt: text('last_used_at'),
  },
  (t) => ({
    inputIdx: uniqueIndex('idx_parse_input').on(t.normalizedInput),
  })
);

/* ── Inferred types for app code ───────────────────────────────────────── */

export type Food = typeof food.$inferSelect;
export type FoodPortion = typeof foodPortion.$inferSelect;
export type Profile = typeof profile.$inferSelect;
export type Goal = typeof goal.$inferSelect;
export type LogItem = typeof logItem.$inferSelect;
export type NewLogItem = typeof logItem.$inferInsert;
export type ParseCache = typeof parseCache.$inferSelect;

/** SQLite pragma to run at startup for reliable FK + WAL behavior. */
export const STARTUP_PRAGMAS = sql`PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;`;
