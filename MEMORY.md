# Aahaar — Project Memory / Progress Log

> **Purpose:** single source of truth for project status. Claude reads this FIRST when resuming, and updates it after each implementation step — so we never have to re-read the whole codebase to know where we are.
>
> **📎 To resume in a new chat:** point Claude at this file — `C:\Projects\aahaar\MEMORY.md`. It reads this, then continues from the "Next up" list. Update it after every implementation step.
>
> **Last updated:** 2026-07-02 · **Current state:** core loop + onboarding/goals + 4 tabs + splash + backup/restore + quantity edit + calendar day-tap + streaks. **Seed = 287 foods** with top-up sync on app update. **Manual entry** (user-provided kcal/macros). **Full theming**: light/dark (system/manual) + **5 accent colors** (saffron/emerald/ocean/berry/violet), persisted in `app_setting`, Settings→Appearance. **Landing page LIVE ✅** at `https://aahaar-site.pages.dev` (Cloudflare Pages, direct-upload via wrangler — NOT git-connected; redeploy = `npx wrangler pages deploy . --project-name aahaar-site` from `C:\Projects\aahaar-site`). GitHub remote still not created (optional, for git-connected auto-deploys). **Cloudflare: worker DEPLOYED ✅** (2026-07-02) at `https://aahaar-parser.aahaar.workers.dev` (subdomain `aahaar.workers.dev` registered via API); `GROQ_API_KEY` secret set; `EXPO_PUBLIC_PARSER_URL` added to `mobile/.env` (restart Expo with `-c` to pick it up). Before prod build: REMOVE `EXPO_PUBLIC_GROQ_KEY` from `.env`. Import-error debug still pending user's error text.
>
> **AI runtime note:** **llm7.io is now PRIMARY** (2026-07-02). Order = cache → Worker → Ollama → **OpenAI-compat(llm7.io)** → Groq → offline, in both `parseMeal.ts` and `aiEstimate.ts`. Groq is the fallback. `EXPO_PUBLIC_OPENAI_MODEL=gpt-5.4-mini`. To revert, swap the llm7/Groq blocks back.

---

## What this is
**Aahaar** (working name) — a privacy-first, AI-driven calorie & macro tracker for an **Indian audience**. Core UX: type a meal in plain language / Hinglish ("2 roti aur ek katori dal") → AI parses → local nutrition DB computes calories & macros → daily dashboard + calendar + trends.

## Locked decisions
- **Platform:** React Native + Expo (TypeScript). Cross-platform iOS + Android.
- **Dev setup:** Windows machine (no Mac). Build iOS via **Expo EAS** cloud builds. Dev has an **iPhone** + can run **Android emulator** → full cross-platform testing.
- **Storage:** **privacy-first, local-first**. All user data on-device in **SQLite (`expo-sqlite`)**. No cloud DB / server / accounts in MVP.
- **AI:** does **language parsing only** (returns `{food, quantity, unit}`, never calorie numbers). Numbers come from the local nutrition DB. Only meal text (no PII) leaves the device.
- **AI model:** **cloud-hosted inference** (confirmed 2026-07-01 — NOT local Ollama). **Groq (Llama 3.3)** free tier is the recommended provider; called via a thin **Cloudflare Worker proxy** that holds the key and forwards only meal text. Ollama Cloud is an acceptable alternative if we want to stay in the Ollama ecosystem. Model layer stays swappable.
- **ORM:** **Drizzle** over `expo-sqlite` (confirmed 2026-07-01) — type-safe queries.
- **Backup:** CSV/JSON export + optional user-owned cloud backup.

## Recommended, NOT yet confirmed by user
- **Cloud provider:** Groq recommended; user confirmed "cloud not local" but hasn't picked Groq vs Ollama Cloud explicitly. Groq is the working assumption.
- **Product name** "Aahaar" is a placeholder.

## Repo
- **GitHub:** https://github.com/SudhanshuPanthri/Aahaar (pushed 2026-07-02, branch `main`). Single repo rooted at `C:\Projects\aahaar` (mobile/ was a nested git repo from Expo scaffold — its `.git` removed so it's tracked by the parent). `.gitignore` at root + `mobile/.gitignore` **exclude `.env`** (keep `.env.example`) and `node_modules`. **The real Groq key lives only in `mobile/.env` — never commit it.** git user: SudhanshuPanthri / panthrisudhanshu666@gmail.com. Push worked via Windows credential helper (gh not logged in).

## Artifacts
- `BRD.md` (v0.2) — full business requirements.
- `TECH_DESIGN.md` — SQLite schema, AI extraction JSON schema, resolution pipeline.
- `MEMORY.md` — this file.

---

## Progress

### ✅ Done
- [x] BRD written and iterated (privacy-first, local-first, calendar, trends, native→RN pivot).
- [x] Tech stack decided (RN + Expo, expo-sqlite, EAS).
- [x] Data model designed (SQLite tables: food, food_portion, profile, weight_log, goal, log_item, parse_cache).
- [x] AI extraction JSON schema designed.
- [x] Estimation/resolution pipeline designed.

### ✅ Done (continued)
- [x] Seed nutrition dataset **starter** (~55 foods) → `data/seed_foods.json` (marked `curated-approx`; expand to ~250 + validate vs IFCT before launch).
- [x] **Expo app scaffolded** at `mobile/` (blank-typescript, SDK 57). Deps: `expo-sqlite`, `drizzle-orm`, `drizzle-kit`.
- [x] **DB layer wired**: `mobile/src/db/{schema,ddl,client,seed,init}.ts` — Drizzle schema, raw DDL (CREATE TABLE IF NOT EXISTS at startup), single expo-sqlite connection, seed loader (loads `seed_foods.json` into `food`/`food_portion` on first run, idempotent).
- [x] **Estimation resolver** → `mobile/src/estimate/resolve.ts` (name/alias match → unit→grams → compute macros + confidence).
- [x] **Demo screen** → `mobile/App.tsx` proves the loop: inits DB, seeds, resolves a hardcoded parsed meal, shows per-item + total calories/macros. **`npx tsc --noEmit` passes.**
- [x] Verified expo-sqlite API against Expo v57 docs (openDatabaseSync/execAsync confirmed).
- [x] **App runs on device** (Android emulator confirmed by user) — demo list renders. (Fixed: App.tsx write had failed earlier and left the default template.)
- [x] **AI parser built**:
  - `worker/` — Cloudflare Worker proxy → Groq (`src/index.ts`, `wrangler.toml`, `README.md` deploy guide). Holds the key; only meal text passes through. NOT deployed yet (needs user's Cloudflare + Groq key).
  - `mobile/src/ai/remoteParse.ts` — calls the worker (URL via `EXPO_PUBLIC_PARSER_URL`).
  - `mobile/src/ai/localParse.ts` — offline heuristic parser (Hinglish numbers/units/foods) → works with no key/network; also the app's offline mode.
  - `mobile/src/ai/parseMeal.ts` — uses AI if configured, else local fallback; returns `via: 'ai'|'local'`.
- [x] **Input screen** (`App.tsx`): free-text box → parseMeal → estimateMeal → list; **total pinned as a fixed footer**, list scrolls independently. Typecheck passes.
- [x] **Dev direct-Groq path** (`mobile/src/ai/groq.ts`): set `EXPO_PUBLIC_GROQ_KEY` to use real AI without deploying the Worker (dev only — key is bundled into JS, never ship). `parseMeal` order: Worker → direct Groq → offline `localParse`.
- [x] **AI nutrition estimation for DB misses** (`mobile/src/estimate/estimateMeal.ts`): DB-first for known foods; if unmatched + AI available, Groq estimates the food's nutrition (flagged `estimatedBy: 'ai'`, confidence low, shown as "AI est." in UI). This is how the AI "calculates" for foods outside the seed list.

- [x] **AI enabled (dev):** user set `EXPO_PUBLIC_GROQ_KEY` in `mobile/.env` → `parseMeal` now uses real Groq parsing; DB misses get AI nutrition estimates.
- [x] **Save to log_item** (`mobile/src/db/log.ts`): `addLogItems` (snapshots macros, infers meal slot, `local_date`=today), `getDayTotals`, `todayLocalDate`. Wired into `App.tsx`: "Add to today" button + a **TODAY** total card that reads from the log.
- [x] **iOS-inspired font:** Inter via `@expo-google-fonts/inter` + `expo-font` (SF Pro substitute; SF itself isn't licensable to bundle). Applied across all text. Full UI polish deferred per user.
- [x] **Today's log view** (`getDayItems`, `deleteLogItem` in `log.ts`): the main list shows saved items for today (with ✕ delete) when not mid-estimate; shows the pending "THIS MEAL" estimate while estimating. Add-to-today refreshes both totals and the list.
- [x] **Multi-provider AI + caching** (to fight Groq rate limits):
  - `src/ai/shared.ts` — shared prompts + normalizers.
  - `src/ai/ollama.ts` — **local Ollama** provider (unlimited/free/private; `EXPO_PUBLIC_OLLAMA_URL` + `_MODEL`). Uses `/api/chat` with `format:'json'`.
  - `src/ai/groq.ts` — refactored to use shared.
  - `src/ai/aiEstimate.ts` — provider-agnostic estimate (Ollama → Groq).
  - `src/db/parseCache.ts` — `getCachedParse`/`putCachedParse` (upsert). `parseMeal` checks cache first (via `'cache'`), caches AI results. **Repeated meals never re-hit the model.**
  - Provider order in `parseMeal`: cache → Worker → Ollama → Groq → offline.
  - Reminder: no free hosted model is truly unlimited; "unlimited" = self-host (local Ollama for dev; a server for prod).
- [x] **Onboarding + goals** (2026-07-02):
  - `src/goals/calc.ts` — pure Mifflin–St Jeor: BMR → TDEE (activity factors) → goal delta (lose −500 / gain +350) → macro split (protein 1.6 g/kg, fat 25%, carbs remainder). Calorie floor 1500♂/1200♀.
  - `src/db/profile.ts` — get/save singleton `profile`, add/get latest `weight_log`, get/save active `goal` (newest wins), `hasCompletedOnboarding()`.
  - `src/screens/Onboarding.tsx` — Guided (demographics form) / Custom (enter kcal) modes with live target preview; writes profile+weight+goal. Reused as "Edit goal" (prefills existing).
  - `App.tsx` — first run shows Onboarding; Today card shows **progress bars** vs goal (kcal + P/C/F, over-goal turns red) + "Edit goal" link. (Bars not SVG rings — avoids native rebuild; proper rings deferred to UI pass.)
- [x] **Generic OpenAI-compatible AI provider** (2026-07-02): `src/ai/openaiCompat.ts` — works with ANY `/v1/chat/completions` endpoint via `EXPO_PUBLIC_OPENAI_BASE_URL`/`_KEY`(optional)/`_MODEL`. Lenient JSON extraction (no `response_format`, since free proxies reject it). Wired into `parseMeal` (…→Groq→OpenAI-compat→offline) and `aiEstimate`. **Recommended free provider: llm7.io** (`https://api.llm7.io/v1`, no signup, ~150 req/min > Groq's 30/min; models at `/v1/models`). g4f.dev/uncloseai also work by config. From user-shared repo github.com/zebbern/no-cost-ai.

- [x] **Splash screen** (2026-07-02): `expo-splash-screen` config plugin in app.json (uses `assets/splash-icon.png`, white bg); `App.tsx` holds native splash via `preventAutoHideAsync` until fonts+DB ready then `hideAsync`. App display name → "Aahaar". Skipped `setOptions`/fade (warns in Expo Go). Config-plugin visuals only apply in a dev/prod build, not Expo Go.
- [x] **Bottom-tab navigation** (2026-07-02): chose **state-based tabs** (no expo-router — avoided a risky blind entry-point migration). `App.tsx` = init/splash/onboarding gate + tab bar (🍽️ Log / 📅 Calendar / 📈 Trends); renders only the active tab so each remounts with fresh DB reads.
  - `src/ui/theme.ts` (FONT + COLORS tokens), `src/ui/Progress.tsx` (ProgressBar + MacroStat, extracted from App).
  - `src/screens/LogScreen.tsx` — the old main UI, now self-contained.
  - `src/screens/CalendarScreen.tsx` — month grid, per-day kcal dot coloured under/on/over goal, ‹ › month nav, month summary.
  - `src/screens/TrendsScreen.tsx` — 7/30-day averages (per **logged** day) + last-7-days kcal bar chart. Uses `src/db/stats.ts` (`getDailyTotalsInRange`, `getAverages`, `shiftLocalDate`).
- [x] **Meal-grouped display + parse fix** (2026-07-02): user complaint — "5 eggs cheese toast" showed 3 ingredient rows each with qty 5, and they only want to see the line they typed.
  - Display: `log.ts` `getDayMeals()` groups items by shared `loggedAt` into one **Meal** (title = raw typed text; total kcal; small ×qty breakdown only if >1 item); `deleteMeal()` removes the whole meal. Estimate preview now leads with the typed line + total, breakdown is a secondary dim line. Footer total merged into the Add button.
  - Parse: hardened `PARSE_SYSTEM` (shared.ts) — a number binds ONLY to the next food, others default to qty 1, never copy one number across foods; added few-shot examples. (Root cause was the AI parser; offline `localParse` already kept it as one chunk.)

- [x] **"Why boiled egg?" fix** (2026-07-02): root cause = `resolve.ts` displayed the matched DB row's `canonicalName` instead of the user's word, and the seed's generic egg was named `"egg (boiled)"`. Fix: `Estimate.name` now = the parsed/user term (added `matchedName` for the DB row as metadata only, not shown); renamed seed `egg (boiled)` → `egg` (both `mobile/src/data/` and root `data/` copies; aliases now include scrambled egg/eggs/ande). NOTE: seed rename only affects **fresh** installs (seedIfEmpty); the display fix works on existing DBs. Remaining caveat: nutrition still comes from the generic egg row (~155 kcal/100g) — scrambled-in-oil under-counts fat; finer variants are a seed-expansion (post-MVP) matter.

- [x] **Seed expansion → 106 foods** (2026-07-02): added ~54 common composite dishes (masala dosa, biryani, paneer gravies, chaat, indo-chinese, sweets, breads, beverages…) as single-entry foods so common meals resolve from DB with NO AI call. `curated-approx`; still validate vs IFCT before launch. Both copies (`mobile/src/data/` + root `data/`) kept identical. (Storage is a non-issue: ~150 KB.)
- [x] **Saved meals** (2026-07-02): user-curated dishes/combinations re-logged with one tap, bypassing AI + resolver (stores resolved `Estimate[]` JSON). `saved_meal` table (schema.ts + ddl.ts), `db/savedMeals.ts` (save/list/getItems/markUsed/delete/exists). LogScreen: **star icon (☆/★)** saves a meal — both on the estimate card AND on each already-logged meal in TODAY'S LOG (footer is a single full-width "Add to today"). Saving a logged meal uses `saveMealFromLog` (rebuilds `Estimate[]` from stored log rows, no AI). Horizontal "SAVED MEALS · tap to log" chip row (with ✕ delete) when idle; sorted most-used first; star shows filled when a meal of that name is already saved.
- [x] **Tab icons** (2026-07-02): swapped emoji for **Ionicons** (`@expo/vector-icons`) — restaurant / calendar / stats-chart, filled+orange when active, outline+grey when not.

- [x] **Local backup / restore (account-free)** (2026-07-02): `db/backup.ts` (`buildBackup` dumps profile/goal/weight_log/log_item/saved_meal to JSON; `restoreBackup` replaces them in one `expo.withTransactionSync`). `backup/backupFile.ts` — export writes JSON to cache (new SDK57 `File`/`Paths` API) then `Sharing.shareAsync` (OS save-to Drive/iCloud/Files); import via `DocumentPicker` → read → restore. **Settings tab** (`SettingsScreen.tsx`, 4th tab, gear icon) hosts Export/Import + Edit goal. Import re-checks onboarding and remounts screens via `dataEpoch` key. **Architecture note:** no OAuth/accounts — OS mediates the user's own cloud; we only produce/read a file. (OAuth Drive/iCloud auto-sync = deferred v2 below.)

- [x] **Per-item quantity edit** (2026-07-02): `log.ts` — `Meal.items` (underlying rows) + `updateLogItemQuantity(id, qty)` (rescales snapshotted grams/kcal/macros by newQty/oldQty — no AI/re-resolution). LogScreen: tap a logged meal card → expands into item rows with −/+ steppers (step 1; 0.5 stop between 1 and min) + per-item trash (deleting the last item removes the meal).
- [x] **Calendar: tap a day → that day's meals** (2026-07-02): cells are Pressable (selected = orange outline); panel below the grid lists the day's meals (`getDayMeals(date)`) with kcal/macros/breakdown; tap again or change month to deselect.
- [x] **Production-polish pass #1** (2026-07-02, user asked to treat as a production app): delete **confirmations** (logged meal + saved meal, destructive Alert); Today card shows **"N left / N over"** vs goal (green/red) + **🔥 streak badge** (shown at 2+); today's log grouped under **meal-slot headers** (BREAKFAST/LUNCH/…, removed from per-card line); subtle card shadows; Trends **stat tiles** (🔥 day streak via `getLoggingStreak()` in stats.ts — consecutive logged days, unlogged *today* doesn't break it; ✓ days within goal ≤ target×1.05 in the window).
- [x] **Import-error groundwork** (2026-07-02): user reported a JSON import error (details pending). Verified `File.textSync()` IS valid in expo-file-system v57 (checked docs), so the read path is API-correct. `restoreBackup` now wraps per-table inserts → errors read "Restore failed at log_item row 12 of 300: …" instead of a bare SQLite message. **Waiting on the user's actual error text.**

- [x] **Seed expansion → 287 foods** (2026-07-02): +181 across all categories (incl. health foods, street/fast food, alcohol, condiments); generator script kept in session scratchpad only; both JSON copies identical. `seedIfEmpty` → **`syncSeed`** (top-up: inserts seed foods missing from DB by canonical name on every init, so app updates deliver new foods; ids = max+1; never overwrites). Still `curated-approx` — IFCT validation pending.
- [x] **Manual entry** (2026-07-02, user request): `ManualEntry.tsx` bottom-sheet (name, qty/unit, TOTAL kcal + optional P/C/F) via "Manual" button beside Estimate; logs with `estimatedBy:'user'` → `log_item.source='user'` (Estimate union + addLogItems updated); works with qty steppers.
- [x] **Theming — dark mode + 5 accents** (2026-07-02, user request, built via subagent): `ui/theme.tsx` (renamed from .ts) = LIGHT/DARK palettes + ACCENTS (saffron default/emerald/ocean/berry/violet — accent replaces `calories`/`accent`/`accentSoft` tokens; protein/carbs/fat/danger fixed) + ThemeProvider/useTheme. Persisted in new **`app_setting`** table (`theme_pref`, `accent_color`) via `db/settings.ts` (lazy CREATE TABLE guard). All screens = `makeStyles(colors)` pattern, zero hex outside theme.tsx; StatusBar + keyboardAppearance adapt. Settings → APPEARANCE (segmented System/Light/Dark + swatch row).
- [x] **Landing page** (2026-07-02, user request): separate repo **`C:\Projects\aahaar-site`** (user wants independent hosting) — self-contained `index.html`, app design tokens, CSS phone mock, features/how/privacy sections, dark toggle + same 5 accent swatches (localStorage). Committed locally; **user must create the GitHub remote** (`git remote add origin …aahaar-site.git && git push -u origin main`), then host via Cloudflare Pages or GitHub Pages.

### 🔜 Next up (not started)
- [ ] **User re-tests backup import** — fix shipped 2026-07-02 (see changelog: legacy `readAsStringAsync` fallback in `backupFile.ts`); awaiting confirmation on device.
- [ ] **Remove `EXPO_PUBLIC_GROQ_KEY` from `mobile/.env` before any production build** — the deployed worker now covers the Groq path, so the dev key must not ship in the app bundle. (llm7.io is keyless so direct-from-app is fine in prod.)
- [ ] **(Optional) Push aahaar-site to GitHub** (user creates repo) and connect it to the Pages project for auto-deploys — site is already live via direct upload.
- [ ] **Cloud AUTO-sync v2 (user request, "for later"):** the manual export/import above already covers device-switch. v2 = automatic background sync to the user's own cloud — Google Drive (needs `expo-auth-session` OAuth) / iCloud (needs native entitlements + dev build). Keep privacy-first (user-owned storage, not our server). Only build if manual proves insufficient. data is local-only (SQLite), so switching devices loses history. Provide opt-in sync to the user's own cloud — **Google Drive** (Android) + **iCloud/Files** (iOS) — to export/import the DB or a JSON dump so a new device can restore. Design notes: privacy-first (user-owned storage, not our server); simplest v1 = export whole DB / JSON to Drive/iCloud + import on new device; later = auto background sync w/ conflict handling. Overlaps with existing "CSV/JSON export" backup decision — build export first, then cloud targets. Libraries: `expo-file-system` + `expo-sharing` for export; Google Drive via GDrive REST + `expo-auth-session`, iCloud via iOS Files/document picker.
- [ ] Calendar/Trends niceties: year view (day-tap ✅ done).
- [ ] Expand seed dataset toward ~250 foods; validate vs IFCT 2017.
- [ ] Full UI/design pass (per user: "work on UI later").

### 📌 Repo notes
- `mobile/AGENTS.md` (via `CLAUDE.md`) says: read the exact Expo **v57** docs (https://docs.expo.dev/versions/v57.0.0/) before writing Expo code. Honor this.

### ▶️ How to run (Windows) + known gotchas
- **Run from `mobile/`**, not repo root: `cd C:\Projects\aahaar\mobile && npx expo start`. (Root has no package.json → `ConfigError`.)
- Expo Go **"request timed out"** on LAN → use **tunnel**: `npx expo start --tunnel`.
- Tunnel error **"Install @expo/ngrok and try again"** even after global install → install it **locally**: `npm install --save-dev @expo/ngrok@^4.1.0` (already done). Then `--tunnel` works.
- Zero-network fallback: press **`a`** for Android emulator (no phone/network needed) to sanity-check the app.
- [ ] Onboarding (Guided goal calc via Mifflin–St Jeor / Custom).
- [ ] Meal logging screen + AI proxy + parse→confirm→save loop.
- [ ] Daily dashboard (calories + 3 macro rings).
- [ ] Calendar view.
- [ ] Trends dashboard (avg macros, week/month/year).
- [ ] Export/backup.

### 🧠 Open questions (deferred, non-blocking)
- Login providers if/when cloud sync is ever added.
- Regional-language input beyond Hinglish.
- Monetization (free / freemium / coach-B2B).

### 📦 Post-MVP features (specced, deferred)
- **Barcode scanning** for packaged foods — full spec in `BRD.md` §16. Uses `expo-camera` + Open Food Facts lookup by barcode; caches to a `custom_food` table for offline reuse; only the barcode number leaves the device. Build in Phase 3.

---

## How to resume
1. Read this file.
2. Check the "Next up" list for the current task.
3. Confirm any "Recommended, not yet confirmed" items with the user before building on them.

## File map (as built)
- `BRD.md`, `TECH_DESIGN.md`, `MEMORY.md` — docs (repo root).
- `data/seed_foods.json` — starter nutrition seed (canonical copy; also copied to `mobile/src/data/`).
- `src/db/schema.ts` — original staging copy of the schema (superseded by `mobile/src/db/schema.ts`).
- `mobile/` — the Expo app (React Native + TS, SDK 57).
  - `mobile/App.tsx` — demo screen.
  - `mobile/src/db/` — schema, ddl, client, seed, init.
  - `mobile/src/estimate/resolve.ts` — estimation pipeline.
  - `mobile/src/data/seed_foods.json` — bundled seed.

## Changelog
- **2026-07-02 (latest)** — **Import fix CONFIRMED working by user on device.** **Calorie engine accuracy pass** (subagent build, verified: 11 matcher tests + typecheck ✓, pushed `91dae94`): `estimate/rank.ts` ranked matching (exact>alias>token-cover w/ extra-word penalty>substring; fixes 'paneer'→paneer-butter-masala class of errors), category-aware portion defaults + unit synonyms in resolve.ts, `validateAiNutrition` (density clamps + 4-4-9 reconciliation) in aiEstimate.ts, +19 seed portion rows (both copies), syncSeed now tops up portion rows on existing installs, test via `node scripts/test-matcher.mjs`. NEXT accuracy step (user aware, not started): IFCT 2017 validation sweep of all 287 per-100g values. **Landing-page mystery SOLVED**: user's 'misalignment' = ALL section vertical padding was zero — `.wrap{padding:0 24px}` (class) beat `section{padding:56px 0}` (element) in specificity. Fixed as `section.wrap{padding:56px 24px}` + scroll-margin-top for sticky nav; deployed + visually verified via emulator Chrome. LESSON: verify deploys VISUALLY, not just by curl-ing the served CSS.
- **2026-07-02 (earlier)** — **Dev build verified on emulator**: gradle build succeeded (needs `JAVA_HOME`=Android Studio jbr + `ANDROID_HOME`=%LOCALAPPDATA%\Android\Sdk — NOT set globally yet, export per-shell), APK installed on Pixel_9_Pro AVD, आ icon confirmed on launcher (screenshot). `mobile/android/` exists now (gitignored). **Wordmark added** per user: "आhaar" (आ Devanagari saffron + "haar" Noto Sans Bold ink) — `brand/make-wordmark.mjs` → `brand/wordmark.svg` (opentype.js gotcha: use `charToGlyph().getPath()` for Devanagari, `font.getPath()` emits NaN). Landing nav now uses the wordmark (theme-aware via .aa/.haar classes). **App icon is the ONE-LINE lockup** (user iterated: stacked → one line): आhaar on a shared baseline — `brand/make-icon-mark.mjs` → `icon-mark.svg`; generator two-tones by default, flattens to one colour for monochrome. Verified on emulator launcher (screenshot). Brand preview artifact: https://claude.ai/code/artifact/8a7a608d-cbfa-49c4-aa71-3e2515bc230d opentype.js 2nd gotcha: layout at small fractional font sizes emits NaN — extract at size 100 + fit with an SVG transform. Nemotron 3 Ultra question answered: usable via existing openaiCompat provider (OpenRouter :free / NVIDIA NIM), recommended against as primary (550B reasoning model = slow for parse UX); not wired.
- **2026-07-02 (earlier)** — **Brand identity shipped**: user picked the **आ monogram** (concept B of 3; artifact page shown). Hand-drawn versions kept mis-reading (ना) per user → final mark = the **real आ glyph outline extracted from Noto Sans Devanagari Bold** (SIL OFL, font kept at `brand/fonts/`; `brand/extract-glyph.mjs` via opentype.js writes the path into logo.svg). Master SVG = `brand/logo.svg`; generator = `brand/generate-icons.mjs` (reads logo.svg, recolours) (sharp; `npm install && node generate-icons.mjs` from brand/, node_modules gitignored) → writes mobile/assets: icon.png (1024 cream #fdf1e9 + saffron mark), android-icon-foreground/monochrome (safe-zone 560px/1024), splash-icon.png (512 transparent), favicon.png. app.json: adaptiveIcon bg → #fdf1e9 (backgroundImage removed + file deleted), splash bg → cream, imageWidth 160. **Landing page**: mark added as favicon (SVG data URI) + nav logo lockup; overflow-x clip fix; redeployed. NOTE: icon/splash visuals only show in a dev/prod build, not Expo Go. **Animations SHIPPED** (subagent build, typecheck ✓, user to verify in Expo Go): installed `react-native-reanimated` 4.5 + `react-native-worklets` (v57 docs: NO babel config needed — babel-preset-expo auto-configures). New `ui/PressableScale.tsx` (press scale 0.97 + opacity, adopted by all buttons/chips/tab bar); Progress bars animate width (450ms out-cubic, grow from 0); tab switch = FadeInDown 220ms keyed on tab+dataEpoch; LogScreen estimate card FadeInDown, meal cards FadeIn/FadeOut + LinearTransition (animated expand/collapse), streak badge ZoomIn; ManualEntry = shared-value bottom sheet (slide+backdrop fade, animates out before close); Calendar month grid slides ‹/› directionally, day panel FadeInDown. Gotcha fixed: `StyleSheet.absoluteFillObject` missing from RN 0.86 types.
- **2026-07-02 (earlier)** — **Import-error FIXED**: user's screenshot showed `FileSystemFile.textSync` rejected with "Missing 'READ' permission" (Android). Known Expo bug (expo/expo#21792): new `File` API permission check can reject picker URIs even with `copyToCacheDirectory: true`. Fix in `backup/backupFile.ts`: try `File.textSync()` first, catch → legacy `readAsStringAsync(uri)` (reads file:// AND content:// via content resolver). Typecheck ✓; user to re-test on device. Also fixed landing-page misalignment (step-card chips now bottom-aligned via flex column + `margin-top:auto`) → committed in aahaar-site + redeployed to Pages; `.wrangler/` gitignored there.
- **2026-07-02 (earlier)** — **Landing page deployed** to Cloudflare Pages: created project `aahaar-site` + direct-upload deploy from `C:\Projects\aahaar-site` → live at `https://aahaar-site.pages.dev` (verified 200). Direct-upload mode (no git connection); redeploy by re-running `wrangler pages deploy`. First request after deploy returned a transient 522 (cold start) — retry, it's fine.
- **2026-07-02 (earlier)** — **Cloudflare Worker deployed**: user ran `wrangler login`; registered account subdomain `aahaar.workers.dev` via CF API (wrangler 4 has no CLI command for it; new-subdomain TLS cert takes ~1 min to provision); set `GROQ_API_KEY` secret; deployed → `https://aahaar-parser.aahaar.workers.dev`; curl-tested Hinglish parse ✓. **Gotcha:** piping the secret via PowerShell 5.1 appended `\r` → Groq 401 "Invalid API Key"; fixed by re-uploading via bash `printf '%s'`. Added `EXPO_PUBLIC_PARSER_URL` to `mobile/.env` (parseMeal now: cache → Worker → Ollama → llm7 → Groq → offline; restart Expo with `-c`). Remaining: strip `EXPO_PUBLIC_GROQ_KEY` before prod build.
- **2026-07-02 (earlier)** — Theming shipped (dark mode + 5 accents, app_setting persistence, all screens tokenized — subagent build, verified + pushed `8a11498`). Seed 106→287 + syncSeed top-up + ManualEntry (pushed `057d011`). Quantity-edit/calendar-tap/streak/polish batch pushed `2bf6484`. Landing page repo created at C:\Projects\aahaar-site (2 local commits, no remote yet). Cloudflare: account ✓, wrangler installed; awaiting user's `wrangler login`.
- **2026-07-02 (earlier)** — Per-item quantity edit (expandable meal cards, −/+ steppers, per-item delete; `updateLogItemQuantity` rescales macros). Calendar day-tap → day's meals panel. Polish: delete confirmations, kcal left/over on Today card, 🔥 streak (Today badge + Trends tiles + `getLoggingStreak`), days-within-goal tile, meal-slot headers, card shadows. Restore errors now name the failing table/row (user hit an import error — details pending). Verified `File.textSync()` valid per v57 docs. Typecheck passes. (Not yet committed.)
- **2026-07-02 (earlier)** — Onboarding now has a **Cancel** (‹) when opened via Edit goal (App tracks `editingGoal`; first-run stays mandatory). Export offers **Save to device** (Android SAF, no share) vs **Share** (`backupFile.ts`: `shareBackup`/`saveBackupToFolder`/`canSaveToFolder`); iOS uses the share sheet's built-in "Save to Files". Typecheck passes. (Not yet committed to git.)
- **2026-07-02** — Added local backup/restore (account-free, OS share sheet + document picker; `db/backup.ts`, `backup/backupFile.ts`) + Settings tab (4th tab). Promoted llm7.io to primary AI. Clearing the meal input now cancels a pending estimate. Star-save on estimate card AND logged meals. Initialised git, pushed to github.com/SudhanshuPanthri/Aahaar (secrets kept out via .gitignore). Typecheck passes.
- **2026-07-02** — Expanded seed to 106 foods (+54 composite dishes) to cut AI calls; added Saved Meals feature (`saved_meal` table + `savedMeals.ts` + LogScreen ☆Save / tap-to-log chips); swapped tab emoji for Ionicons. Fixed "boiled egg" (display user's word, renamed seed egg). Logged cloud-sync request as a "for later" next-up item. Typecheck passes. Note: TypeScript got pruned by `expo install`; restored via `npm install` in mobile/.
- **2026-07-02** — Bottom-tab navigation (state-based: Log/Calendar/Trends) + `ui/theme.ts`, `ui/Progress.tsx`, `db/stats.ts`, three screen files; App.tsx slimmed to shell. Fixed meal display: log now groups items into one meal showing the typed line (not per-ingredient); hardened parse prompt so a quantity binds to one food only. Typecheck passes.
- **2026-07-02** — Splash screen (`expo-splash-screen` config plugin in app.json using `assets/splash-icon.png`, white bg; `App.tsx` holds native splash until fonts+DB ready then `hideAsync`). App display `name` → "Aahaar". Cleared the pre-filled meal input (was demo text). **Enabled llm7.io in `.env`** as a free fallback (`EXPO_PUBLIC_OPENAI_BASE_URL=https://api.llm7.io/v1`, model `gpt-5.4-mini`) — Groq still primary, llm7 takes over on rate-limit. NOTE: splash config-plugin visuals only apply in a dev/prod build (prebuild), not Expo Go; env changes need `npx expo start -c`.
- **2026-07-02** — Built onboarding + goals: `goals/calc.ts` (Mifflin–St Jeor), `db/profile.ts`, `screens/Onboarding.tsx` (Guided/Custom + live preview, reused as Edit goal). App gates onboarding on first run; Today card now shows progress bars vs goal. Added generic OpenAI-compatible AI provider (`ai/openaiCompat.ts`) wired into parse + estimate chains; recommended free endpoint llm7.io (~150 rpm, no signup). Typecheck passes.
- **2026-07-01 (latest)** — Added save-to-log (`log.ts`: addLogItems/getDayTotals) with a "TODAY" total card + "Add to today" button. Added AI nutrition estimation for DB misses (`estimateMeal` + direct-Groq dev path `groq.ts`). User enabled Groq via `.env`. Switched typography to **Inter** (iOS/SF-inspired) via expo-font. Typecheck passes.
- **2026-07-01 (earlier)** — Built AI parser: Cloudflare Worker proxy → Groq (`worker/`, not deployed), client `remoteParse`, offline `localParse` fallback, `parseMeal` orchestrator. Turned `App.tsx` into a free-text input screen with a **pinned total footer** + scrollable list. App confirmed running on Android emulator.
- **2026-07-01 (earlier)** — Scaffolded Expo app in `mobile/` (SDK 57), installed expo-sqlite + Drizzle, built full DB layer (schema/ddl/client/seed/init) + estimation resolver + demo screen. Verified expo-sqlite API vs v57 docs.
- **2026-07-01 (earlier)** — Wrote seed dataset starter (`data/seed_foods.json`, ~55 foods) and Drizzle schema. Next: scaffold Expo app + seed loader.
- **2026-07-01** — Project kicked off. BRD v0.1 → v0.2. Pivoted from native Swift (no Mac) to React Native + Expo. Locked privacy-first/local-first/on-device SQLite. Added calendar + trends. Wrote TECH_DESIGN.md (schema + AI contract). Confirmed ORM = Drizzle. AI model: first chose local Ollama, then switched to **cloud-hosted** (Groq recommended) via Cloudflare Worker proxy — resolves production hosting. No code written yet.
