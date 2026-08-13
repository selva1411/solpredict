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

/**
 * Number of attempts + backoff for transient Neon connection failures.
 *
 * Neon's serverless HTTP endpoint sleeps after ~5 min of inactivity and can
 * take several seconds to wake (observed 4–6 s total request time during a
 * cold start). The FIRST request(s) fired at the moment it wakes can fail with
 * `NeonDbError: Error connecting to database: TypeError: fetch failed` (a
 * connect-phase failure — nothing was executed server-side, so a retry is safe
 * and idempotent, even for writes). This surfaced in production-like bursts as
 * intermittent 500s on /api/markets/cached, /api/activity/recent and the
 * /markets directory page. A short 3×150/350/700 ms retry was NOT enough for
 * the slowest wakes (all attempts fired before the compute came up) — the
 * backoff below covers a ~6 s window.
 */
const CONNECT_RETRIES = 5;
const CONNECT_RETRY_DELAY_MS = [200, 400, 800, 1600, 3000];

function isTransientConnectError(err: unknown): boolean {
  const msg =
    err instanceof Error ? err.message : err && typeof err === 'object' && 'message' in err
      ? String((err as { message: unknown }).message)
      : String(err);
  // Connect-phase failure (endpoint unreachable while the compute wakes). The
  // request never reached Postgres, so retrying cannot double-execute writes.
  return msg.includes('Error connecting to database') && msg.includes('fetch failed');
}

/**
 * Wrap the neon tagged-template client so every query path (drizzle calls
 * `sql.query(...)`, the keep-alive uses the template form) retries transient
 * connect failures with a short backoff. Non-transient errors pass through.
 */
function withConnectRetry<T extends (...args: never[]) => unknown>(sql: T): T {
  const retry = async <A extends unknown[]>(run: () => Promise<Awaited<unknown>>): Promise<unknown> => {
    let attempt = 0;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      try {
        return await run();
      } catch (err: unknown) {
        if (!isTransientConnectError(err) || attempt >= CONNECT_RETRIES) throw err;
        await new Promise((r) => setTimeout(r, CONNECT_RETRY_DELAY_MS[attempt] ?? 700));
        attempt++;
      }
    }
  };

  return new Proxy(sql, {
    apply(target, thisArg, args) {
      // Tagged-template form: sql`SELECT 1` (keep-alive path).
      return retry(() => Reflect.apply(target, thisArg, args) as Promise<unknown>);
    },
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);
      if (prop === 'query' && typeof value === 'function') {
        // Drizzle calls client.query(sql, params, options) for every query.
        return (...args: unknown[]) => retry(() => value.apply(target, args) as Promise<unknown>);
      }
      if (prop === 'transaction' && typeof value === 'function') {
        return (...args: unknown[]) => retry(() => value.apply(target, args) as Promise<unknown>);
      }
      return value;
    },
  }) as T;
}

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

  const sql = withConnectRetry(neon(url));
  const instance = drizzle(sql, { schema });
  console.log('[DB] Connected to Neon PostgreSQL (with connect retry)');

  // Keep the Neon serverless compute warm so the first request after a period
  // of inactivity doesn't pay a ~10-15s cold-start (observed on every page
  // load after ~5 min idle). A trivial SELECT 1 every 60s keeps the pool warm
  // at negligible cost. Only on the server (this module never runs client-side).
  //
  // Registered on globalThis so Next.js HMR reloads re-use the existing timer
  // instead of stacking duplicate intervals that would keep pinging forever.
  try {
    const heartbeat = () => {
      sql`SELECT 1`.catch(() => {
        /* transient — retry next tick */
      });
    };
    const g = globalThis as unknown as { __neonKeepAlive?: ReturnType<typeof setInterval> };
    if (!g.__neonKeepAlive) {
      heartbeat();
      const interval = setInterval(heartbeat, 60_000);
      if (typeof interval.unref === "function") interval.unref();
      g.__neonKeepAlive = interval;
    }
  } catch {
    /* non-fatal */
  }

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
