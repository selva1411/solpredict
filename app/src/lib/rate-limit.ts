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
]);

export function checkRateLimit(ip: string, path: string): { allowed: boolean; remaining: number; resetAt: number } {
  const config = [...routeOverrides.entries()]
    .find(([prefix]) => path.startsWith(prefix))
    ?.[1] || defaultConfig;

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
