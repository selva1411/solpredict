import { neon } from '@neondatabase/serverless';
import { drizzle, NeonHttpDatabase } from 'drizzle-orm/neon-http';
import * as schema from './schema';

let dbInstance: NeonHttpDatabase<typeof schema> | null = null;
let urlMissing = false;
let initError: string | null = null;
let lastInitAttempt = 0;
const RETRY_THROTTLE_MS = 2000;

function initDb(): NeonHttpDatabase<typeof schema> | null {
  if (dbInstance) return dbInstance;
  if (urlMissing) return null;

  const url = process.env.DATABASE_URL;

  if (!url || url.trim().length === 0) {
    urlMissing = true;
    initError = 'DATABASE_URL not configured';
    console.warn('[DB] DATABASE_URL is not set — running without database');
    return null;
  }

  // Retry creation lazily instead of permanently latching onto a single
  // failed attempt. neon() is lazy (it connects on first query), so this
  // only re-runs after a real transient failure and is throttled.
  const now = Date.now();
  if (now - lastInitAttempt < RETRY_THROTTLE_MS && initError) return null;
  lastInitAttempt = now;

  try {
    const sql = neon(url);
    dbInstance = drizzle(sql, { schema });
    initError = null;
    console.log('[DB] Connected to Neon PostgreSQL');
  } catch (e) {
    initError = e instanceof Error ? e.message : String(e);
    console.error('[DB] Failed to initialize Neon connection:', initError);
    dbInstance = null;
  }
  
  return dbInstance;
}

/**
 * Get the database instance. Returns the Drizzle ORM instance or null if not configured.
 * This is the primary way to access the database throughout the application.
 */
export function getDb(): NeonHttpDatabase<typeof schema> | null {
  return initDb();
}

/**
 * The database instance — either a real Drizzle ORM instance or null.
 * Always check for null before using: `if (!db) return fallback;`
 */
export const db = initDb();

/**
 * Check if the database is connected and ready.
 */
export function isDbConnected(): boolean {
  return getDb() !== null;
}

/**
 * Get database connection status for diagnostics.
 */
export function getDbStatus(): { connected: boolean; error: string | null } {
  return {
    connected: isDbConnected(),
    error: initError,
  };
}
