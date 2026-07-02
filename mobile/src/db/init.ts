/** Startup DB init: pragmas → create tables → sync seed (first run + top-ups). */
import { expo } from './client';
import { DDL } from './ddl';
import { syncSeed } from './seed';

export async function initDb(): Promise<{ foodCount: number }> {
  await expo.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  await expo.execAsync(DDL);
  const foodCount = syncSeed();
  return { foodCount };
}
