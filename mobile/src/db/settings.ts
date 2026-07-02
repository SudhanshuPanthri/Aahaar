/**
 * Tiny key-value store (`app_setting`) for lightweight app preferences
 * (theme, accent colour, …). Values are plain strings.
 *
 * The theme provider reads this BEFORE initDb() has run the startup DDL, so
 * we create the table on demand here (idempotent; also present in ddl.ts).
 */
import { eq } from 'drizzle-orm';
import { db, expo } from './client';
import { appSetting } from './schema';

let ensured = false;
function ensureTable(): void {
  if (ensured) return;
  expo.execSync('CREATE TABLE IF NOT EXISTS app_setting (key TEXT PRIMARY KEY, value TEXT);');
  ensured = true;
}

/** The stored value for `key`, or null if unset. */
export function getSetting(key: string): string | null {
  ensureTable();
  const row = db.select().from(appSetting).where(eq(appSetting.key, key)).get();
  return row?.value ?? null;
}

/** Upsert `key` = `value`. */
export function setSetting(key: string, value: string): void {
  ensureTable();
  db.insert(appSetting)
    .values({ key, value })
    .onConflictDoUpdate({ target: appSetting.key, set: { value } })
    .run();
}
