/**
 * Aahaar — Drizzle schema for on-device SQLite (expo-sqlite).
 * Implements the data model in TECH_DESIGN.md §2.
 *
 * Two groups:
 *  - Bundled read-only: `food`, `foodPortion` (seeded from src/data/seed_foods.json).
 *  - User-writable: `profile`, `weightLog`, `goal`, `logItem`, `parseCache`.
 *
 * Dates are ISO-8601 text. `localDate` ("YYYY-MM-DD") drives calendar + trends.
 */
import { sqliteTable, integer, text, real, index, uniqueIndex } from 'drizzle-orm/sqlite-core';

/* ── Bundled nutrition dataset (read-only) ─────────────────────────────── */

export const food = sqliteTable(
  'food',
  {
    id: integer('id').primaryKey(),
    canonicalName: text('canonical_name').notNull(),
    aliases: text('aliases'), // JSON array as text
    category: text('category'),
    cuisineRegion: text('cuisine_region'),
    isVeg: integer('is_veg').default(1),
    defaultUnit: text('default_unit').notNull(),
    caloriesPer100g: real('calories_per_100g').notNull(),
    proteinPer100g: real('protein_per_100g').notNull(),
    carbsPer100g: real('carbs_per_100g').notNull(),
    fatPer100g: real('fat_per_100g').notNull(),
    fiberPer100g: real('fiber_per_100g'),
    source: text('source'),
    updatedAt: text('updated_at'),
  },
  (t) => ({ nameIdx: index('idx_food_name').on(t.canonicalName) })
);

export const foodPortion = sqliteTable(
  'food_portion',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    foodId: integer('food_id')
      .notNull()
      .references(() => food.id),
    unit: text('unit').notNull(),
    grams: real('grams').notNull(),
    isDefault: integer('is_default').default(0),
  },
  (t) => ({ foodIdx: index('idx_portion_food').on(t.foodId) })
);

/* ── User data (writable) ──────────────────────────────────────────────── */

export const profile = sqliteTable('profile', {
  id: integer('id').primaryKey(), // always 1
  sex: text('sex'),
  birthYear: integer('birth_year'),
  heightCm: real('height_cm'),
  activityLevel: text('activity_level'),
  dietPref: text('diet_pref'),
  createdAt: text('created_at'),
  updatedAt: text('updated_at'),
});

export const weightLog = sqliteTable('weight_log', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  weightKg: real('weight_kg').notNull(),
  loggedAt: text('logged_at').notNull(),
});

export const goal = sqliteTable('goal', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  mode: text('mode').notNull(), // guided | custom
  goalType: text('goal_type'), // lose | maintain | gain
  targetCalories: real('target_calories').notNull(),
  targetProteinG: real('target_protein_g').notNull(),
  targetCarbsG: real('target_carbs_g').notNull(),
  targetFatG: real('target_fat_g').notNull(),
  effectiveFrom: text('effective_from').notNull(),
  createdAt: text('created_at'),
});

export const logItem = sqliteTable(
  'log_item',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    localDate: text('local_date').notNull(), // YYYY-MM-DD
    loggedAt: text('logged_at').notNull(),
    mealSlot: text('meal_slot'),
    foodId: integer('food_id').references(() => food.id),
    foodName: text('food_name').notNull(),
    quantity: real('quantity').notNull(),
    unit: text('unit').notNull(),
    grams: real('grams'),
    calories: real('calories').notNull(),
    proteinG: real('protein_g').notNull(),
    carbsG: real('carbs_g').notNull(),
    fatG: real('fat_g').notNull(),
    source: text('source'),
    confidence: text('confidence'),
    rawText: text('raw_text'),
    createdAt: text('created_at'),
    updatedAt: text('updated_at'),
  },
  (t) => ({
    dateIdx: index('idx_log_date').on(t.localDate),
    foodIdx: index('idx_log_food').on(t.foodId),
  })
);

/**
 * User-curated saved meals ("my dishes" / combinations). Stores the fully
 * resolved items as JSON so re-logging needs NO AI and NO re-resolution.
 */
export const savedMeal = sqliteTable('saved_meal', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  itemsJson: text('items_json').notNull(), // JSON of Estimate[]
  calories: real('calories').notNull(),
  proteinG: real('protein_g').notNull(),
  carbsG: real('carbs_g').notNull(),
  fatG: real('fat_g').notNull(),
  useCount: integer('use_count').default(0),
  createdAt: text('created_at'),
  lastUsedAt: text('last_used_at'),
});

/** Tiny key-value store for app preferences (theme, accent colour, …). */
export const appSetting = sqliteTable('app_setting', {
  key: text('key').primaryKey(),
  value: text('value'),
});

export const parseCache = sqliteTable(
  'parse_cache',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    normalizedInput: text('normalized_input').notNull(),
    resolvedJson: text('resolved_json').notNull(),
    hitCount: integer('hit_count').default(1),
    lastUsedAt: text('last_used_at'),
  },
  (t) => ({ inputIdx: uniqueIndex('idx_parse_input').on(t.normalizedInput) })
);

/* ── Inferred types ────────────────────────────────────────────────────── */

export type Food = typeof food.$inferSelect;
export type FoodPortion = typeof foodPortion.$inferSelect;
export type Profile = typeof profile.$inferSelect;
export type Goal = typeof goal.$inferSelect;
export type LogItem = typeof logItem.$inferSelect;
export type NewLogItem = typeof logItem.$inferInsert;
export type SavedMeal = typeof savedMeal.$inferSelect;
export type ParseCache = typeof parseCache.$inferSelect;
export type AppSetting = typeof appSetting.$inferSelect;
