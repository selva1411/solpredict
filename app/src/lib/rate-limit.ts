interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

const CLEANUP_INTERVAL = 60_000;

setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (entry.resetAt < now) store.delete(key);
  }
}, CLEANUP_INTERVAL);

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
}

const defaultConfig: RateLimitConfig = {
  windowMs: 60_000,
  maxRequests: 60,
};

const routeOverrides = new Map<string, RateLimitConfig>([
  ["/api/webhooks/helius", { windowMs: 60_000, maxRequests: 120 }],
  ["/api/sync", { windowMs: 60_000, maxRequests: 300 }],
  // High-traffic read endpoints: pages poll these on an interval (and e2e
  // tests poll during verification). 60/min per path is too tight and caused
  // real 429s — the markets directory, stats, user positions/leaderboard and
  // watchlist get read far more often than they get written.
  ["/api/markets", { windowMs: 60_000, maxRequests: 600 }],
  ["/api/market-data", { windowMs: 60_000, maxRequests: 600 }],
  ["/api/user", { windowMs: 60_000, maxRequests: 600 }],
  ["/api/leaderboard", { windowMs: 60_000, maxRequests: 600 }],
  ["/api/activity", { windowMs: 60_000, maxRequests: 600 }],
  ["/api/watchlist", { windowMs: 60_000, maxRequests: 600 }],
  ["/api/health", { windowMs: 60_000, maxRequests: 300 }],
]);

export function checkRateLimit(ip: string, path: string): { allowed: boolean; remaining: number; resetAt: number } {
  const config = [...routeOverrides.entries()]
    .find(([prefix]) => path.startsWith(prefix))
    ?.[1] || defaultConfig;

  // Development: never rate-limit. The in-memory store is per-process and
  // shared across all e2e workers/browsers on localhost, so the 60/min default
  // caused real 429s on busy pages and flaky test polls. Production keeps the
  // protection intact.
  if (process.env.NODE_ENV === "development") {
    return { allowed: true, remaining: config.maxRequests, resetAt: Date.now() + config.windowMs };
  }

  const now = Date.now();
  const key = `${ip}:${path}`;
  let entry = store.get(key);

  if (!entry || entry.resetAt < now) {
    entry = { count: 0, resetAt: now + config.windowMs };
    store.set(key, entry);
  }

  entry.count++;
  return {
    allowed: entry.count <= config.maxRequests,
    remaining: Math.max(0, config.maxRequests - entry.count),
    resetAt: entry.resetAt,
  };
}
