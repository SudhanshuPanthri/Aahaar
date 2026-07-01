# Technical Design — Aahaar

> Companion to `BRD.md`. Covers the on-device data model, the AI extraction contract, and the estimation pipeline. Stack: **React Native + Expo (TypeScript)**, **`expo-sqlite`** on-device, free-tier LLM behind a thin stateless proxy.

---

## 1. Core flow (recap)

```
User types meal text ("2 roti aur ek katori dal")
        │
        ▼
[proxy] LLM extraction  ──►  { items: [{food, quantity, unit}], unparsed: [...] }   ← text only, no PII
        │
        ▼
Resolve each item against local nutrition DB (name match + unit→grams)
        │
        ▼
Compute calories & macros = per-100g × grams   ← numbers come from the DB, NOT the LLM
        │
        ▼
Show parsed list → user confirms/edits → save to log_item (with snapshotted macros)
        │
        ▼
Daily dashboard · Calendar · Trends  (SQL aggregations over log_item.date)
```

---

## 2. On-device SQLite schema

Two groups of tables:
- **Bundled, read-only** (ship inside the app, updated via releases): `food`, `food_portion`.
- **User-writable** (created on first run, live on device): everything else.

All dates stored as **ISO-8601 text**. `local_date` is the user's local calendar day (`YYYY-MM-DD`) — the key that powers the calendar and week/month/year aggregations.

```sql
-- ── Bundled nutrition dataset (read-only) ───────────────────────────────

CREATE TABLE food (
  id                INTEGER PRIMARY KEY,
  canonical_name    TEXT NOT NULL,          -- "paneer", "roti", "toor dal (cooked)"
  aliases           TEXT,                   -- JSON array: ["cottage cheese","chhena"]
  category          TEXT,                   -- "dairy","grain","legume","sabzi","snack"...
  cuisine_region    TEXT,                   -- "north","south","east","west","pan-india"
  is_veg            INTEGER DEFAULT 1,      -- 0/1
  default_unit      TEXT NOT NULL,          -- "g","katori","piece","glass"...
  calories_per_100g REAL NOT NULL,
  protein_per_100g  REAL NOT NULL,
  carbs_per_100g    REAL NOT NULL,
  fat_per_100g      REAL NOT NULL,
  fiber_per_100g    REAL,
  source            TEXT,                   -- "IFCT2017","OpenFoodFacts","curated"
  updated_at        TEXT
);
CREATE INDEX idx_food_name ON food(canonical_name);

-- Household portion → grams, per food (falls back to a global default if absent)
CREATE TABLE food_portion (
  id        INTEGER PRIMARY KEY,
  food_id   INTEGER NOT NULL REFERENCES food(id),
  unit      TEXT NOT NULL,                  -- "katori","roti","piece","glass","tbsp","plate"
  grams     REAL NOT NULL,                  -- e.g. 1 katori dal = 150g
  is_default INTEGER DEFAULT 0
);
CREATE INDEX idx_portion_food ON food_portion(food_id);

-- ── User data (writable) ────────────────────────────────────────────────

CREATE TABLE profile (               -- single row
  id            INTEGER PRIMARY KEY CHECK (id = 1),
  sex           TEXT,                -- "male","female","other"
  birth_year    INTEGER,
  height_cm     REAL,
  activity_level TEXT,               -- "sedentary","light","moderate","active","very_active"
  diet_pref     TEXT,                -- "veg","nonveg","egg","vegan","jain"
  created_at    TEXT,
  updated_at    TEXT
);

CREATE TABLE weight_log (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  weight_kg  REAL NOT NULL,
  logged_at  TEXT NOT NULL
);

CREATE TABLE goal (                  -- history; current goal = latest by effective_from
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  mode             TEXT NOT NULL,    -- "guided" | "custom"
  goal_type        TEXT,             -- "lose" | "maintain" | "gain"
  target_calories  REAL NOT NULL,
  target_protein_g REAL NOT NULL,
  target_carbs_g   REAL NOT NULL,
  target_fat_g     REAL NOT NULL,
  effective_from   TEXT NOT NULL,
  created_at       TEXT
);

CREATE TABLE log_item (              -- one row per food eaten
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  local_date     TEXT NOT NULL,      -- "YYYY-MM-DD" (user local day) — drives calendar/trends
  logged_at      TEXT NOT NULL,      -- full ISO timestamp
  meal_slot      TEXT,               -- "breakfast","lunch","dinner","snack"
  food_id        INTEGER REFERENCES food(id),   -- nullable (custom/unmatched)
  food_name      TEXT NOT NULL,      -- snapshot of resolved name (survives DB updates)
  quantity       REAL NOT NULL,
  unit           TEXT NOT NULL,
  grams          REAL,               -- resolved grams (quantity × portion)
  calories       REAL NOT NULL,      -- snapshotted at log time
  protein_g      REAL NOT NULL,
  carbs_g        REAL NOT NULL,
  fat_g          REAL NOT NULL,
  source         TEXT,               -- "ai","manual","quick"
  confidence     TEXT,               -- "high","medium","low"
  raw_text       TEXT,               -- original phrase, for audit/learning
  created_at     TEXT,
  updated_at     TEXT
);
CREATE INDEX idx_log_date ON log_item(local_date);
CREATE INDEX idx_log_food ON log_item(food_id);

-- Cache AI parses + power "recent/frequent foods" (skip the LLM on repeats)
CREATE TABLE parse_cache (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  normalized_input TEXT NOT NULL UNIQUE,   -- lowercased/trimmed user text
  resolved_json    TEXT NOT NULL,          -- cached resolved items
  hit_count        INTEGER DEFAULT 1,
  last_used_at     TEXT
);
```

**Aggregations are plain SQL** — no extra machinery needed:

```sql
-- Calendar: total calories per day for a month
SELECT local_date, SUM(calories) AS kcal
FROM log_item
WHERE local_date BETWEEN ?startOfMonth AND ?endOfMonth
GROUP BY local_date;

-- Trends: average daily macros over a period (excludes un-logged days by default)
SELECT
  AVG(day_kcal) AS avg_kcal, AVG(day_p) AS avg_protein,
  AVG(day_c) AS avg_carbs, AVG(day_f) AS avg_fat, COUNT(*) AS days_logged
FROM (
  SELECT local_date,
         SUM(calories) day_kcal, SUM(protein_g) day_p,
         SUM(carbs_g) day_c, SUM(fat_g) day_f
  FROM log_item
  WHERE local_date BETWEEN ?start AND ?end
  GROUP BY local_date
);
```

*(Optional later: a `daily_summary` cache table if row counts ever get large — not needed for MVP.)*

---

## 3. AI extraction contract

**The LLM extracts structure only. It never returns calories or macros.** Enforced with a strict JSON schema.

### Output schema
```json
{
  "type": "object",
  "additionalProperties": false,
  "required": ["items"],
  "properties": {
    "items": {
      "type": "array",
      "items": {
        "type": "object",
        "additionalProperties": false,
        "required": ["food", "quantity", "unit"],
        "properties": {
          "food":     { "type": "string", "description": "Normalized English food name, singular, e.g. 'paneer', 'roti', 'toor dal', 'rice'." },
          "quantity": { "type": "number", "description": "Numeric amount. Convert Hindi words: ek=1, do=2, teen=3, aadha/half=0.5, paav=0.25." },
          "unit": {
            "type": "string",
            "enum": ["g","ml","katori","roti","piece","glass","cup","tbsp","tsp","plate","bowl","handful","serving"],
            "description": "Unit of the quantity. Use 'roti' for rotis/chapatis, 'katori' for a small bowl, 'serving' if truly unspecified."
          },
          "modifier": { "type": ["string","null"], "description": "Preparation note if stated: 'with ghee','fried','gravy','without sugar'. Else null." },
          "raw":      { "type": "string", "description": "The exact phrase from the input this item came from." }
        }
      }
    },
    "unparsed": {
      "type": "array",
      "items": { "type": "string" },
      "description": "Phrases that could not be interpreted as food/quantity."
    }
  }
}
```

### Example
**Input:** `"maine 2 roti aur ek katori dal khaya, chai with sugar"`

**Output:**
```json
{
  "items": [
    { "food": "roti", "quantity": 2, "unit": "roti", "modifier": null, "raw": "2 roti" },
    { "food": "toor dal", "quantity": 1, "unit": "katori", "modifier": null, "raw": "ek katori dal" },
    { "food": "tea with milk and sugar", "quantity": 1, "unit": "cup", "modifier": "with sugar", "raw": "chai with sugar" }
  ],
  "unparsed": []
}
```

### Prompt guardrails (system prompt for the parser)
- "You extract foods, quantities, and units from a meal description. Output only the JSON schema. **Do not estimate calories or nutrition.**"
- "Normalize Hinglish/Hindi to common English food names. Convert Hindi number/quantity words to numbers."
- "If quantity/unit is unstated, use quantity 1 and unit 'serving'."
- "Put anything you cannot interpret in `unparsed`; never invent foods."

---

## 4. Resolution & estimation pipeline (app-side, deterministic)

For each `item` from the AI (or a manual pick):

1. **Cache check** — if `normalized_input` is in `parse_cache`, reuse the resolved result (no LLM call).
2. **Name match** — match `item.food` against `food.canonical_name` + `aliases` (exact → fuzzy/trigram). Record match confidence.
3. **Unit → grams** —
   - if `unit` is `g`/`ml`: grams = quantity.
   - else look up `food_portion(food_id, unit)`; fall back to a global default map (`katori`≈150g, `glass`≈250ml, `roti`≈40g, `tbsp`≈15g, `plate`≈300g).
4. **Compute** — `calories = calories_per_100g × grams / 100` (same for protein/carbs/fat).
5. **Confidence** — high (exact name + known portion) / medium (fuzzy or default portion) / low (no match → generic fallback or flagged LLM estimate).
6. **Present** for confirmation; on save, **snapshot** name + macros into `log_item` so later DB updates don't rewrite history.

---

## 5. Build decisions

- **Model (confirmed):** **cloud-hosted inference** — the app never talks to a local model. Recommended provider: **Groq (Llama 3.3)** free tier (fast, strong strict-JSON output). Ollama Cloud is an acceptable swap-in. Use a JSON-schema-constrained prompt.
- **Proxy host (confirmed):** **Cloudflare Worker** (free tier) — holds the provider key, forwards only the meal text, stores nothing. The model layer behind it stays swappable (Groq ↔ Ollama Cloud ↔ others) as a config change.
- **ORM (confirmed):** **Drizzle** over `expo-sqlite` — type-safe queries and migrations.
- **Seed data:** build the initial `food` + `food_portion` rows for ~150–250 common Indian foods (highest-leverage task).
