# Business Requirements Document (BRD)

## AI-Driven Calorie & Macro Tracker — Indian-First

> **Working product name:** **Aahaar** (आहार — Sanskrit/Hindi for "diet/food/nourishment"). This is a placeholder; alternatives worth considering: *NutriThali*, *KitnaKhaya* ("how much did you eat"), *Poshan*, *Bhojan Log*. Rename freely.

| Field | Value |
|---|---|
| Document version | 0.2 (Draft) |
| Date | 2026-07-01 |
| Status | For review — MVP scoping |
| Owner | Sudhanshu Panthri |
| Author | Drafted with Claude Code |

---

## 1. Executive Summary

Aahaar is a **cross-platform mobile app (React Native + Expo)** — one codebase for iOS and Android — calorie and macronutrient tracker built for an **Indian audience**. Its differentiator is a **notes-style natural-language input**: instead of searching a database and tapping through portions, the user simply types (or dictates) what they ate in plain language — including Hinglish — e.g. *"i ate 200gm paneer and 3 roti"* or *"maine 2 katori dal aur ek bowl rice khaya"*. The app's AI parses this into structured food items with quantities, looks each up in an **Indian-food nutrition database**, and returns estimated calories and macros. A day-level slider/ring dashboard shows progress against the user's targets.

Onboarding offers **two paths**:
1. **Guided (recommended for most):** the app estimates daily calorie and macro targets from lifestyle, weight, height, age, sex, and goal.
2. **Custom:** experienced users enter their own calorie and macro targets directly.

The app is **privacy-first and local-first**: all personal and meal data lives **on the device** in a local database (SQLite); there is **no cloud server** in the MVP. The only thing that ever leaves the device is the **meal text** (e.g. "200gm paneer and 3 roti") sent to the AI parser — with **no name, identity, or device info attached** — since the AI only needs the food description to return an estimate. Access is via **guest/local by default**; login is **optional** and only relevant later if opt-in cloud sync is added.

The MVP uses a **free / open-source LLM** for the language-understanding step, combined with a curated nutrition database for the numbers — this hybrid keeps estimates far more accurate than asking an LLM to "guess calories."

---

## 2. Problem Statement & Motivation

- Existing calorie trackers (MyFitnessPal, HealthifyMe, etc.) are **tedious**: search → select the right entry among dozens of near-duplicates → set portion → repeat per item. This friction is the #1 reason people abandon tracking.
- Most databases are **Western-centric**. Indian foods (roti, dal, sabzi, idli, poha, rajma, biryani) are poorly represented, inconsistently defined, and portioned in unfamiliar units (grams instead of *katori*, *roti*, *glass*).
- Indian home cooking is **oil/ghee heavy and highly variable**, so portion and preparation assumptions matter a lot.
- Indian diets are often **carb-dominant and protein-deficient**; a tracker that surfaces protein clearly has real health value.
- People think and type in **Hinglish / regional languages**, not clean English food names.

**Opportunity:** remove input friction with natural language, and make Indian food a first-class citizen with realistic portions and units.

---

## 3. Goals & Success Metrics

### Product goals
- Make logging a meal take **< 10 seconds** via free-text.
- Provide calorie/macro estimates that users trust as "close enough" (±15–20% is fine for behavior change).
- Give a clear daily picture of progress toward calorie and macro goals.

### MVP success metrics (illustrative targets)
| Metric | Target |
|---|---|
| Median time to log a meal | < 15s |
| NL parse accuracy (item + quantity correctly extracted) | ≥ 85% on Indian test set |
| Day-1 → Day-7 retention | ≥ 30% |
| Users completing onboarding goal-setup | ≥ 80% |
| Avg. logging days/week (active users) | ≥ 4 |

*(Metrics are placeholders to be refined once we have baseline data.)*

---

## 4. Target Users & Personas

1. **"Just tell me if I'm on track" (primary).** Wants weight loss/maintenance, not obsessive tracking. Values speed and low friction. Chooses **Guided** goals. Types in Hinglish.
2. **The experienced lifter / dieter.** Knows their macros, follows a coach's plan. Chooses **Custom** goals. Cares about protein accuracy and consistency.
3. **The curious first-timer / guest.** Wants to try the app with zero commitment. Uses **Guest mode**, may convert to an account later.
4. **(Future) The diabetic / medically-guided user.** Needs carb and sugar visibility, possibly GI info.

---

## 5. Scope

### In scope (MVP)
- **Local-first, on-device storage** (SQLite); no cloud server. Guest/local by default; optional login.
- Data **export/backup** (CSV/JSON) — important because there is no server backing up the data.
- Two-path onboarding (Guided goal calculation vs Custom).
- Natural-language meal logging (text; voice optional in MVP+).
- AI parsing (meal text only, no PII) → nutrition lookup → calorie & macro computation.
- Indian-food nutrition database with common portion units.
- Daily dashboard: calories + macros (protein/carbs/fat) with sliders/rings against goal.
- **Calendar view**: month grid showing per-day calories; tap a day to see that day's log.
- **Trends dashboard**: average calories & macros with **week / month / year** filter.
- Edit/confirm parsed items (correct quantity, swap food, delete).
- Meal history (per day, scrollable).

### Out of scope (MVP) — candidate for later
- **Cloud sync / multi-device / server-side accounts** (deliberately deferred — local-first for privacy).
- Barcode scanning of packaged foods.
- Photo-based food recognition.
- Micronutrients (vitamins, minerals) beyond a basic set.
- Social features, challenges, leaderboards.
- Wearable/fitness-tracker integration.
- Water/step/exercise-calorie tracking.
- Recipe builder / restaurant menu integration.
- Multi-language UI (Hindi/regional) — though Hinglish *input* is in scope.
- **Marketing / landing website** — planned, but built later (near launch), separate from the app.

---

## 6. Functional Requirements

### 6.1 Access & Data Ownership (local-first)
- **FR-1:** App works fully **without an account** — all data stored in a local on-device database. This is the default and only required mode for MVP.
- **FR-2:** User can **export their data** (CSV/JSON) at any time.
- **FR-3:** User can **back up / restore** to their own cloud storage (Google Drive / iCloud) — the file goes to *their* account, never our servers. *(Optional in MVP; important for device-loss protection.)*
- **FR-4:** User can **wipe all local data** from within the app.
- **FR-5 (deferred):** Optional login + opt-in cloud sync across devices — explicitly out of MVP scope.

### 6.2 Onboarding & Goal Setup
- **FR-6:** On first run, user picks **Guided** or **Custom**.
- **FR-7 (Guided):** Collect sex, age, height, weight, activity level, and goal (lose / maintain / gain, optionally target rate). Compute:
  - **BMR** via **Mifflin–St Jeor** equation.
  - **TDEE** = BMR × activity factor.
  - **Calorie target** = TDEE ± deficit/surplus (e.g. −500 kcal for ~0.5 kg/week loss).
  - **Macro split** — default protein ~1.6 g/kg body weight (with a note that Indian diets are typically protein-low), remainder split between carbs and fat; user can adjust the split.
- **FR-8 (Custom):** User directly enters daily calorie target and macro targets (g of protein/carbs/fat, or %).
- **FR-9:** User can revisit and edit goals anytime; recompute on weight change.
- **FR-10:** Show a plain-language explanation of the numbers ("You need ~1,800 kcal/day to lose ~0.5 kg/week").

### 6.3 Natural-Language Meal Logging (core)
- **FR-11:** A single free-text box (Apple-Notes-like) where the user types what they ate. Accepts multiple items in one entry.
- **FR-12:** Supports **English and Hinglish**; common Indian food names, quantities, and units (see §7).
- **FR-13:** On submit, the app returns a **structured list** — `[{food, quantity, unit, calories, protein, carbs, fat}]` — where the AI supplies `{food, quantity, unit}` and the numbers come from the nutrition DB (see §6.4).
- **FR-14:** User sees the parsed items and can **confirm, edit quantity, change the matched food, or delete** before it's saved (critical for trust and for correcting mis-parses).
- **FR-15:** Ambiguous items prompt a lightweight disambiguation (e.g. "roti — plain / with ghee?", "1 katori dal = ~150g?").
- **FR-16:** Each logged item is timestamped and assigned to a meal slot (breakfast/lunch/dinner/snack — inferred by time, editable).
- **FR-17:** Recently/frequently logged foods are cached locally for instant re-logging **without any AI call**.
- **FR-18:** A **manual-entry fallback** lets the user pick foods directly from the local DB with **no AI call** (for offline use or maximum privacy).

### 6.4 Nutrition Estimation Engine
- **FR-19:** LLM performs **extraction only** (food-name normalization + quantity + unit) on the **meal text only** — no name, identity, or device data is sent. It does **not** invent calorie numbers.
- **FR-20:** Extracted items map to entries in the **local nutrition database**; calories/macros are computed = per-100g (or per-unit) values × quantity.
- **FR-21:** If no DB match, fall back to (a) fuzzy match, (b) a "generic similar food," or (c) LLM estimate flagged as **low-confidence**.
- **FR-22:** Portion/unit conversion: map Indian household units (katori, roti, glass, tbsp, piece, plate) to grams/ml.
- **FR-23:** Each estimate carries a **confidence indicator** so users know when to double-check.

### 6.5 Daily Dashboard
- **FR-24:** Show today's **total calories** vs goal (ring or slider).
- **FR-25:** Show **macro progress** for protein, carbs, fat (three sliders/rings) vs goal.
- **FR-26:** Show **remaining** budget ("you have 420 kcal / 30g protein left today").
- **FR-27:** Tapping a macro shows which foods contributed.
- **FR-28:** Date navigation to review past days.

### 6.6 Calendar View
- **FR-29:** **Month-grid calendar** where each day cell shows that day's **total calories** (with a color/ring cue for under / on / over goal).
- **FR-30:** Tapping a day opens that day's full meal log (view + edit).
- **FR-31:** Navigate forward/backward across months (and jump to today).
- **FR-32:** Days with no logged data are visually distinct from days at/under/over goal.

### 6.7 Trends & Averages Dashboard
- **FR-33:** Show **average daily calories and macros** (protein/carbs/fat) over a selected period.
- **FR-34:** **Period filter: week / month / year** (and a sensible default, e.g. this week).
- **FR-35:** Simple trend chart of calories over the period; **protein average highlighted** (given the Indian-diet protein gap).
- **FR-36:** Show **adherence** — how many days in the period were on/under/over the calorie goal, and logging consistency (days logged vs total).
- **FR-37:** Averages exclude **un-logged days** by default (with the option to see them included), so a missed day doesn't distort the average.

### 6.8 History & Data
- **FR-38:** Per-day meal log, viewable and editable (also reachable via the calendar).
- **FR-39:** **Export data (CSV/JSON)** — important for backup, since data is local-only (no server).

---

## 7. Indian-Specific Requirements (the differentiator)

- **Foods:** roti/chapati, phulka, paratha, rice, jeera rice, dal (toor/moong/masoor/rajma/chana), sabzi (dozens), idli, dosa, sambar, poha, upma, paneer, curd/dahi, chole, biryani, khichdi, thali, samosa, pakora, chai, etc. Coverage across **North / South / East / West** cuisines.
- **Household portion units:** *katori* (bowl, ~150–200 ml), *roti* (piece), *glass* (~200–250 ml), *tablespoon/chamach*, *plate*, *piece*, *handful/mutthi*. Provide sensible defaults with the option to correct.
- **Preparation variance:** allow a modifier for oil/ghee level where it materially changes calories (e.g. dry sabzi vs gravy, plain roti vs ghee roti).
- **Hinglish & code-mixed input:** *"do roti aur ek katori dal"*, *"1 plate poha"*, *"chai with sugar"*. The parser must handle Devanagari numerals and Hindi quantity words (*ek, do, teen, aadha/half, paav*).
- **Diet flags:** veg / non-veg / egg / vegan / Jain; fasting (*vrat*) foods (sabudana, kuttu, singhara). Useful for filtering matches and future personalization.
- **Nutrition data sources (Indian-first):**
  - **IFCT 2017** — Indian Food Composition Tables, National Institute of Nutrition (NIN), Hyderabad — the authoritative reference for Indian raw foods.
  - **Open Food Facts** — open-source, has many Indian packaged products.
  - **USDA FoodData Central** — fallback for generic/global foods.
  - A **curated internal table of common cooked Indian dishes** with standard recipes (since IFCT is mostly raw ingredients) — likely the highest-value data asset to build.

> **Note on data:** cooked-dish calorie values require assembling standard recipes (ingredient × quantity × cooking loss). Building a well-curated table of ~200–300 common Indian dishes with realistic home portions will do more for perceived accuracy than any model choice.

---

## 8. AI / Model Approach

### 8.1 Architecture: extract-then-lookup (recommended)
Do **not** ask the LLM to output calorie numbers directly — LLMs are unreliable at recalling exact nutrition values and will hallucinate confident-but-wrong numbers. Instead:

```
User text ──► LLM (structured extraction) ──► [{food, qty, unit}] 
                                                    │
                                                    ▼
                          Normalize + unit-convert + fuzzy match
                                                    │
                                                    ▼
                        Nutrition DB (IFCT / OFF / curated dishes)
                                                    │
                                                    ▼
                       Compute calories & macros = per-unit × qty
                                                    │
                                                    ▼
                     Structured result + confidence ──► user confirms
```

The LLM's only job is **language understanding** (parse messy Hinglish into clean `{food, quantity, unit}` JSON). The **numbers come from the database**. This is the single most important design decision for accuracy and trust.

### 8.2 Open-source / free model options for MVP
The extraction task is well within reach of small open models:

| Option | How | Notes |
|---|---|---|
| **Llama 3.1 8B / Llama 3.3** | Local via **Ollama**, or free via **Groq** free tier | Strong instruction-following; Groq is fast and free-tier friendly. |
| **Qwen 2.5 7B** | Ollama | Good at structured/JSON output and multilingual (helps with Hinglish). |
| **Gemma 2 9B** | Ollama | Solid small model. |
| **Google Gemini Flash (free tier)** | Hosted API | Not open source, but a generous free tier; good multilingual. |

**MVP recommendation:** start with a **hosted free-tier API (Groq running Llama 3.3, or Gemini Flash)** to avoid infra work, using **structured/JSON output** with a strict schema. Keep the model behind an abstraction so we can swap to self-hosted Ollama (for cost/privacy) or to a higher-accuracy paid model later without touching the rest of the app.

### 8.3 Scale-up path (post-MVP)
If parse accuracy on messy Hinglish or ambiguous dishes becomes the bottleneck, a **frontier model (e.g. Claude)** as a fallback tier — or as the disambiguation step only — buys a big accuracy jump at low volume/cost, since it's called rarely and only on hard inputs. Keep the model layer pluggable.

### 8.4 Reliability practices
- Constrain output with a **JSON schema** (structured outputs) so parsing never breaks.
- Cache identical inputs; cache the user's frequent foods to skip the model entirely.
- Always show parsed items for **user confirmation** — the human is the accuracy backstop.
- Log low-confidence parses to improve the dish database over time.

---

## 9. Non-Functional Requirements

- **NFR-1 Performance:** parse + estimate round-trip < ~2s typical; calendar/trends queries feel instant (local DB).
- **NFR-2 Offline-first:** the app works offline for everything except the AI parse. Recent/frequent foods and manual entry (§6.3) work with no network; the AI call degrades gracefully when unreachable (queue, or fall back to manual entry).
- **NFR-3 Privacy (primary principle):** all personal and meal data stays **on the device**; there is no cloud store of user data in the MVP. The only outbound data is the **meal text** to the AI parser, carrying **no name, identity, or device identifier**. Encrypt data at rest (device-level) and use TLS for the AI call. Be transparent in-app about exactly what is sent, and offer a **no-AI manual mode**. Keep India's **DPDP Act 2023** obligations in view (a no-server, on-device design minimizes exposure).
- **NFR-4 Cost:** per-log AI cost near zero via free-tier model + caching of frequent foods; no server data-hosting cost (local-first).
- **NFR-5 Platform/UX:** **React Native + Expo**, cross-platform (iOS + Android from one codebase), developed on **Windows** (no Mac needed) using Expo's cloud builds (**EAS**). Aim for an iOS-quality feel; the Indian market is Android-heavy, so Android is a first-class target, not an afterthought.
- **NFR-6 Maintainability:** AI-model layer and nutrition dataset behind clean interfaces so the model provider (or a future on-device model) can be swapped without touching storage or UI.

### 9.1 Data Storage & Privacy Decision (do we need a DB?)

**Yes — but a *local, on-device* database, not a cloud one.** "Local storage vs database" is a false choice; the right answer is an **on-device database**.
- **On-device SQLite** — via **`expo-sqlite`** (optionally with the **Drizzle ORM** for type-safe queries) — is the recommendation. It is fully private (never leaves the device) *and* it is what makes the **calendar** and **week/month/year averages** fast: those are date-range and aggregation queries that a flat key-value store (`AsyncStorage`) handles poorly.
- **A cloud/server database is *not* needed for the MVP** and would only add a privacy surface and running cost. It becomes relevant *only* if you later add opt-in multi-device sync or accounts.
- **Backup:** because data is local-only, provide **export (CSV/JSON)** and optional backup to the *user's own* iCloud — device loss is the main risk of a no-server design.
- **One small server-side piece is worth it:** a **thin, stateless proxy** (e.g. a serverless function) for the AI call, so the model-provider API key isn't embedded in the shipped app where it could be extracted. It forwards meal text and stores nothing. This is the honest exception to "no server" — it exists for key safety, not for user data.

---

## 10. Suggested Tech Stack (proposal, not locked)

Given the constraints — **developer knows React Native, is on Windows with no Mac, privacy-first, local-first**:

- **App:** **React Native + Expo** (TypeScript). One codebase for iOS + Android. Develop entirely on **Windows**; use **Expo EAS Build** (cloud macOS) to produce the iOS binary and submit to the App Store — **no Mac required**.
- **Local database:** **`expo-sqlite`** (on-device SQLite), optionally with the **Drizzle ORM** for type-safe queries — stores goals, meal logs, and daily/period aggregates. Powers the calendar and trends views. (Use `AsyncStorage` only for tiny key-value settings, not the logs.)
- **Nutrition dataset:** bundled with the app as a **prepopulated read-only SQLite asset** (seeded Indian foods/dishes + portion units), updatable via app releases.
- **AI parsing:** a **thin stateless proxy** (e.g. Cloudflare Worker / small serverless function) holding the model-provider key and forwarding meal text to a free-tier model (Groq/Gemini) with a strict JSON schema. Stores no user data. Model layer kept swappable.
- **Backup/export:** CSV/JSON export; optional backup to the user's own cloud (iCloud / Google Drive).
- **Landing website (later):** a separate **static marketing site** (e.g. Astro or a simple static host), built near launch — not part of the app MVP.

**Honest constraints of this setup:**
- Build, run, and debug on **Windows** with Expo; **Android testing is easy** (emulator on Windows, or a physical Android phone).
- **Testing the iOS build specifically requires a physical iPhone** (Expo Go / a dev build) — the iOS Simulator only runs on macOS, which Windows can't provide. Without an iPhone, develop/test on Android and rely on EAS + TestFlight for iOS checks.
- Shipping to the App Store needs an **Apple Developer account ($99/yr)**; EAS handles the macOS build and submission in the cloud.

---

## 11. MVP Definition (what ships first)

**MVP = the smallest thing that proves the core loop:**
1. **Local-first, no account** — data on-device (SQLite); manual data wipe + export.
2. Onboarding: Guided goal calc + Custom entry.
3. Free-text meal logging → AI parse (meal text only) → local DB lookup → confirm → save.
4. A seed nutrition DB of ~150–250 common Indian foods/dishes with household portions.
5. Daily dashboard: calories + 3 macro sliders vs goal.
6. **Calendar** (per-day calories) + **trends dashboard** (avg macros, week/month/year).
7. Meal history per day.

Everything in §5 "Out of scope" is explicitly **deferred**.

---

## 12. Phased Roadmap (proposed)

- **Phase 0 — Foundations:** finalize stack, build nutrition DB seed, stand up the AI extraction pipeline with JSON schema, basic auth + guest.
- **Phase 1 — MVP:** onboarding (both paths), NL logging with confirmation, dashboard, history. *(This is what §11 describes.)*
- **Phase 2 — Quality & delight:** voice input, frequent-foods quick-add, better Hinglish handling, richer disambiguation, prep-level modifiers, protein-nudge insights.
- **Phase 3 — Expansion:** barcode scan for packaged foods, photo recognition, water/exercise, micronutrients, weekly trends & insights, regional-language UI.
- **Phase 4 — Ecosystem:** wearables, coach/dietician mode, diabetic/GI mode, social/challenges, restaurant menus.
- **Landing website (near launch, parallel workstream):** static marketing site — App Store link, feature overview, privacy policy. Separate from the app; not part of the app MVP.

---

## 13. Additional Feature Ideas (my suggestions — pick what resonates)

- **Voice logging** — say your meal; huge friction reducer, especially in India.
- **"Photo of your plate" logging** (Phase 3) — multimodal model estimates items/portions from a photo.
- **Protein coach** — because Indian diets skew low-protein, surface a gentle daily protein nudge and high-protein Indian food suggestions (paneer, dal, curd, sprouts, eggs, soya).
- **Smart meal templates** — "my usual breakfast" one-tap logging.
- **Weekly insights** — trends, best/worst days, "you hit protein 4/7 days."
- **Streaks & gentle gamification** — retention without being gimmicky.
- **Barcode scanning** — for the growing packaged-food market (Open Food Facts India).
- **Family/household profiles** — one account, multiple eaters.
- **Fasting/vrat mode** — vrat-appropriate foods and intermittent-fasting windows.
- **Diabetic/GI mode** — carb & sugar emphasis, glycemic index where available.
- **Water & step tracking** — rounds out the "health" picture cheaply.
- **Offline recent-foods** — log common items with no network.
- **"Explain my number"** — tap any food to see how the calories were derived (builds trust).
- **Dietician/coach view** — shareable logs; potential B2B/premium angle.

---

## 14. Risks, Assumptions & Open Questions

### Risks
- **Estimate accuracy for cooked dishes** — the hardest problem; mitigated by a curated dish DB + user confirmation + confidence flags.
- **LLM hallucinating quantities/foods** — mitigated by extract-only design, JSON schema, and mandatory user confirmation.
- **Hinglish/regional parsing gaps** — mitigated by testing on a real Indian phrase set and a fallback disambiguation step.
- **Free-tier model limits** — mitigated by caching and a pluggable model layer.
- **Data privacy / DPDP compliance** — needs early attention, not an afterthought.

### Assumptions
- Users tolerate ±15–20% estimate error for behavior-change use (not medical-grade).
- Android-first is acceptable for the initial market.
- IFCT 2017 + Open Food Facts licensing permits our use (to verify).

### Open questions (for you)
1. **Platform first:** mobile app (Android) or web app for the MVP?
2. **Preferred model route:** hosted free tier (fastest to build) vs self-hosted Ollama (cost/privacy)?
3. **Login providers:** email only, or Google/phone-OTP from day one?
4. **Regional-language input priority:** Hinglish only for MVP, or also Devanagari/Tamil/etc.?
5. **Monetization intent** (affects data/privacy choices): free, freemium, or coach-B2B later?

---

## 15. Next Steps

1. You review this BRD and answer the open questions in §14.
2. Lock MVP scope (§11) and the tech stack (§10).
3. Build the **nutrition DB seed** (highest-leverage asset) in parallel with the **AI extraction pipeline** (JSON-schema'd, model-agnostic).
4. Prototype the core loop end-to-end (type → parse → confirm → dashboard) before polishing UI.

---

## 16. Post-MVP Feature Spec: Barcode Scanning

> **Status:** deferred to **after MVP** (Phase 3). Spec captured now so it's not lost. Complements — does not replace — the natural-language logging flow.

### 16.1 Purpose
Let users log **packaged/branded foods** (biscuits, namkeen, drinks, protein bars, packaged dairy, etc.) by scanning the product barcode, instead of typing. Packaged foods carry a printed nutrition label, so a barcode lookup gives accurate per-serving/per-100g values — higher precision than estimating a home-cooked dish.

### 16.2 User flow
1. On the logging screen, user taps a **"Scan barcode"** action.
2. Camera opens; user points at the product barcode (EAN-13 / UPC).
3. On a successful scan, the app looks the barcode up (local cache → Open Food Facts).
4. **Found** → show the product name + nutrition; user sets quantity/servings → confirm → save to `log_item` (same confirm step as AI parsing).
5. **Not found** → offer **manual add**: user enters name + per-100g (or per-serving) macros from the label; saved as a **user custom food** and remembered for next time.

### 16.3 Functional requirements
- **FR-B1:** Scan EAN-13 / UPC-A barcodes via the device camera.
- **FR-B2:** Resolve barcode → product + nutrition using **Open Food Facts** (`GET /api/v2/product/{barcode}.json`), with a local cache so a re-scanned product needs no network.
- **FR-B3:** On a hit, prefill name + per-100g macros; user picks servings/grams; compute like any other item.
- **FR-B4:** On a miss (or offline), let the user enter label values manually and **save as a reusable custom food**.
- **FR-B5:** Cached/custom scanned products are reusable **offline** and appear in search/recent.
- **FR-B6:** Camera permission requested only when the user first taps "Scan," with a clear rationale (no background camera use).

### 16.4 Technical notes
- **Camera/scanning:** Expo's **`expo-camera`** (`CameraView` with `onBarcodeScanned`) — the current SDK-57 path (the old `expo-barcode-scanner` is merged into it). **Verify against the exact Expo v57 docs at build time** (per `mobile/AGENTS.md`).
- **Data source:** **Open Food Facts** — open, free, decent Indian packaged-product coverage. Barcode lookup returns `nutriments` (energy-kcal_100g, proteins_100g, carbohydrates_100g, fat_100g).
- **Storage:** persist scanned/OFF products and manual entries into a **`custom_food`** table (or extend `food` with a `barcode` column + `is_user` flag) so they behave like any other DB food in the estimation pipeline. Cache raw OFF responses keyed by barcode.
- **Privacy (consistent with our model):** only the **barcode number** leaves the device for the OFF lookup — no name, identity, or device info. Disclose the network lookup in-app; manual entry works fully offline.

### 16.5 Out of scope for this feature (even later)
- OCR of nutrition labels from a photo (separate, harder feature).
- Building our own packaged-product database (rely on OFF + user contributions).

---

*This is a living document. Edit, cut, or expand any section — especially the open questions in §14, which will most shape the build.*
