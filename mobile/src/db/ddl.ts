/**
 * Raw DDL run at startup. Expo doesn't run drizzle-kit migrations at runtime
 * without extra bundler setup, so we create tables idempotently here.
 * Keep in sync with schema.ts.
 */
export const DDL = `
CREATE TABLE IF NOT EXISTS food (
  id INTEGER PRIMARY KEY,
  canonical_name TEXT NOT NULL,
  aliases TEXT,
  category TEXT,
  cuisine_region TEXT,
  is_veg INTEGER DEFAULT 1,
  default_unit TEXT NOT NULL,
  calories_per_100g REAL NOT NULL,
  protein_per_100g REAL NOT NULL,
  carbs_per_100g REAL NOT NULL,
  fat_per_100g REAL NOT NULL,
  fiber_per_100g REAL,
  source TEXT,
  updated_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_food_name ON food(canonical_name);

CREATE TABLE IF NOT EXISTS food_portion (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  food_id INTEGER NOT NULL REFERENCES food(id),
  unit TEXT NOT NULL,
  grams REAL NOT NULL,
  is_default INTEGER DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_portion_food ON food_portion(food_id);

CREATE TABLE IF NOT EXISTS profile (
  id INTEGER PRIMARY KEY,
  sex TEXT,
  birth_year INTEGER,
  height_cm REAL,
  activity_level TEXT,
  diet_pref TEXT,
  created_at TEXT,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS weight_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  weight_kg REAL NOT NULL,
  logged_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS goal (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  mode TEXT NOT NULL,
  goal_type TEXT,
  target_calories REAL NOT NULL,
  target_protein_g REAL NOT NULL,
  target_carbs_g REAL NOT NULL,
  target_fat_g REAL NOT NULL,
  effective_from TEXT NOT NULL,
  created_at TEXT
);

CREATE TABLE IF NOT EXISTS log_item (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  local_date TEXT NOT NULL,
  logged_at TEXT NOT NULL,
  meal_slot TEXT,
  food_id INTEGER REFERENCES food(id),
  food_name TEXT NOT NULL,
  quantity REAL NOT NULL,
  unit TEXT NOT NULL,
  grams REAL,
  calories REAL NOT NULL,
  protein_g REAL NOT NULL,
  carbs_g REAL NOT NULL,
  fat_g REAL NOT NULL,
  source TEXT,
  confidence TEXT,
  raw_text TEXT,
  created_at TEXT,
  updated_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_log_date ON log_item(local_date);
CREATE INDEX IF NOT EXISTS idx_log_food ON log_item(food_id);

CREATE TABLE IF NOT EXISTS saved_meal (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  items_json TEXT NOT NULL,
  calories REAL NOT NULL,
  protein_g REAL NOT NULL,
  carbs_g REAL NOT NULL,
  fat_g REAL NOT NULL,
  use_count INTEGER DEFAULT 0,
  created_at TEXT,
  last_used_at TEXT
);

CREATE TABLE IF NOT EXISTS parse_cache (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  normalized_input TEXT NOT NULL UNIQUE,
  resolved_json TEXT NOT NULL,
  hit_count INTEGER DEFAULT 1,
  last_used_at TEXT
);
`;
