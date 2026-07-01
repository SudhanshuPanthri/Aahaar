/**
 * Single on-device SQLite connection + Drizzle instance.
 * `expo` is used for raw DDL/pragmas at startup; `db` (Drizzle) for typed queries.
 */
import * as SQLite from 'expo-sqlite';
import { drizzle } from 'drizzle-orm/expo-sqlite';
import * as schema from './schema';

export const expo = SQLite.openDatabaseSync('aahaar.db');
export const db = drizzle(expo, { schema });
