/**
 * Backup / restore of USER data (the app is local-only, so this is how a user
 * moves their history to a new device). We dump the user-writable tables to a
 * portable JSON blob; the bundled `food`/`food_portion` tables are NOT included
 * (they re-seed on install). `parse_cache` is a regenerable cache — also skipped.
 *
 * The JSON file is handed to the OS share/save sheet (Drive, iCloud/Files, …) —
 * we never touch the user's cloud account, so the no-accounts architecture holds.
 */
import { expo, db } from './client';
import { profile, goal, weightLog, logItem, savedMeal } from './schema';

export const BACKUP_SCHEMA_VERSION = 1;

export type BackupFile = {
  app: 'aahaar';
  schemaVersion: number;
  exportedAt: string;
  data: {
    profile: unknown[];
    goal: unknown[];
    weight_log: unknown[];
    log_item: unknown[];
    saved_meal: unknown[];
  };
};

/** Snapshot all user data into a serialisable object. */
export function buildBackup(exportedAt: string): BackupFile {
  return {
    app: 'aahaar',
    schemaVersion: BACKUP_SCHEMA_VERSION,
    exportedAt,
    data: {
      profile: db.select().from(profile).all(),
      goal: db.select().from(goal).all(),
      weight_log: db.select().from(weightLog).all(),
      log_item: db.select().from(logItem).all(),
      saved_meal: db.select().from(savedMeal).all(),
    },
  };
}

export type RestoreSummary = { profile: number; goals: number; weights: number; logItems: number; savedMeals: number };

/**
 * Replace all user data with the backup's contents (device-switch semantics).
 * Runs in a single transaction so a bad file can't leave a half-restored DB.
 * Throws if the object isn't a recognisable Aahaar backup.
 */
export function restoreBackup(parsed: any): RestoreSummary {
  if (!parsed || parsed.app !== 'aahaar' || typeof parsed.data !== 'object') {
    throw new Error('This file is not an Aahaar backup.');
  }
  if (typeof parsed.schemaVersion === 'number' && parsed.schemaVersion > BACKUP_SCHEMA_VERSION) {
    throw new Error('This backup was made by a newer app version. Please update Aahaar first.');
  }
  const d = parsed.data ?? {};
  const rows = (x: unknown): any[] => (Array.isArray(x) ? x : []);

  expo.withTransactionSync(() => {
    // Clear existing user data (child-first ordering is moot — no FKs between these).
    db.delete(logItem).run();
    db.delete(savedMeal).run();
    db.delete(goal).run();
    db.delete(weightLog).run();
    db.delete(profile).run();

    rows(d.profile).forEach((r) => db.insert(profile).values(r).run());
    rows(d.goal).forEach((r) => db.insert(goal).values(r).run());
    rows(d.weight_log).forEach((r) => db.insert(weightLog).values(r).run());
    rows(d.log_item).forEach((r) => db.insert(logItem).values(r).run());
    rows(d.saved_meal).forEach((r) => db.insert(savedMeal).values(r).run());
  });

  return {
    profile: rows(d.profile).length,
    goals: rows(d.goal).length,
    weights: rows(d.weight_log).length,
    logItems: rows(d.log_item).length,
    savedMeals: rows(d.saved_meal).length,
  };
}
