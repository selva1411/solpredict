import { neon } from '@neondatabase/serverless';
import { drizzle, NeonHttpDatabase } from 'drizzle-orm/neon-http';
import * as schema from './schema';

// ---------------------------------------------------------------------------
// Module-level singleton.  Created lazily on first access.
// In production, a missing DATABASE_URL is a fatal configuration error — we
// throw immediately so the deploy fails loudly rather than serving zeros.
// ---------------------------------------------------------------------------

let dbInstance: NeonHttpDatabase<typeof schema> | null = null;
let initError: Error | null = null;

function createDb(): NeonHttpDatabase<typeof schema> {
  const url = process.env.DATABASE_URL;

  if (!url || url.trim().length === 0) {
    const err = new Error(
      '[DB] DATABASE_URL is not set. The application cannot start without a database connection. ' +
      'Set DATABASE_URL in your .env.local or environment variables.'
    );
    if (process.env.NODE_ENV === 'production') {
      throw err;
    }
    // In development, log a loud warning but allow the server to start
    // so pages that don't need DB can still render.
    console.error(err.message);
    throw err;
  }

  const sql = neon(url);
  const instance = drizzle(sql, { schema });
  console.log('[DB] Connected to Neon PostgreSQL');
  return instance;
}

function initDb(): NeonHttpDatabase<typeof schema> | null {
  if (dbInstance) return dbInstance;
  if (initError) return null;

  try {
    dbInstance = createDb();
    return dbInstance;
  } catch (e) {
    initError = e instanceof Error ? e : new Error(String(e));
    return null;
  }
}

/**
 * The database instance.  May be null if DATABASE_URL is not configured
 * (development only — in production, createDb() throws on import).
 *
 * Prefer `assertDb()` in route handlers for a clear error message.
 */
export const db = initDb();

/**
 * Returns the database instance or throws a descriptive error.
 * Use this in API route handlers instead of `if (!db) return ...`.
 *
 * @example
 * export const GET = apiHandler(async () => {
 *   const database = assertDb();
 *   const rows = await database.select()...
 * });
 */
export function assertDb(): NeonHttpDatabase<typeof schema> {
  const instance = dbInstance ?? initDb();
  if (!instance) {
    throw new Error(
      '[DB] Database is not available. ' +
      (initError ? `Init error: ${initError.message}` : 'DATABASE_URL may not be set.') +
      ' Check your environment configuration.'
    );
  }
  return instance;
}

/**
 * Get the database instance (nullable version for optional-DB paths).
 */
export function getDb(): NeonHttpDatabase<typeof schema> | null {
  return dbInstance ?? initDb();
}

/**
 * Check if the database is connected and ready.
 */
export function isDbConnected(): boolean {
  return (dbInstance ?? initDb()) !== null;
}

/**
 * Get database connection status for diagnostics.
 */
export function getDbStatus(): { connected: boolean; error: string | null } {
  return {
    connected: isDbConnected(),
    error: initError?.message ?? null,
  };
}
