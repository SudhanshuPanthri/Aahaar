/** Startup DB init: pragmas → create tables → seed if empty. */
import { expo } from './client';
import { DDL } from './ddl';
import { seedIfEmpty } from './seed';

export async function initDb(): Promise<{ foodCount: number }> {
  await expo.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  await expo.execAsync(DDL);
  const foodCount = seedIfEmpty();
  return { foodCount };
}
