import { NextRequest } from "next/server";
import { serverError } from "./api-response";
import { toError } from "./errors";
import { checkRateLimit } from "./rate-limit";
import { logAudit } from "./audit";
import { isDevAuthEnabled } from "./dev-auth";

type RouteHandler = (req: NextRequest, context: { params?: Promise<Record<string, string>> }) => Promise<Response>;
interface HandlerOptions {
  cacheMaxAge?: number;
  cacheTags?: string[];
  rateLimit?: boolean;
}

export function getClientIp(req: NextRequest): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || req.headers.get("x-real-ip")
    || "unknown";
}

export function requireServiceKey(req: NextRequest): boolean {
  const key = req.headers.get("x-service-key");
  const expected = process.env.SERVICE_API_KEY;
  // If no service key is configured, only allow the call when dev auth is
  // explicitly enabled (never in production or a bare dev build).
  if (!expected) return isDevAuthEnabled();
  return key === expected;
}

export function apiHandler(handler: RouteHandler, options?: HandlerOptions): RouteHandler {
  return async (req: NextRequest, context: { params?: Promise<Record<string, string>> } = {}) => {
    const start = Date.now();
    const method = req.method;
    const url = req.nextUrl.pathname;
    const ip = getClientIp(req);

    if (options?.rateLimit !== false) {
      const { allowed, remaining, resetAt } = checkRateLimit(ip, url);
      if (!allowed) {
        return new Response(JSON.stringify({ error: "Too many requests" }), {
          status: 429,
          headers: {
            "Content-Type": "application/json",
            "Retry-After": String(Math.ceil((resetAt - Date.now()) / 1000)),
            "X-RateLimit-Remaining": "0",
          },
        });
      }
    }

    try {
      const response = await handler(req, context);
      const duration = Date.now() - start;

      if (process.env.NODE_ENV === "development") {
        console.log(`[API] ${method} ${url} ${response.status} ${duration}ms`);
      }

      const cacheControl = method === "GET" && options?.cacheMaxAge
        ? `public, s-maxage=${options.cacheMaxAge}, stale-while-revalidate=${options.cacheMaxAge * 3}`
        : method === "GET"
        ? "public, s-maxage=10, stale-while-revalidate=30"
        : "private, no-cache, no-store, must-revalidate";

      const headers = new Headers(response.headers);
      headers.set("Cache-Control", cacheControl);
      headers.set("X-Response-Time", `${duration}ms`);

      if (options?.cacheTags) {
        headers.set("Cache-Tag", options.cacheTags.join(","));
      }

      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
    } catch (err: unknown) {
      const duration = Date.now() - start;
      const error = toError(err);
      console.error(`[API] ${method} ${url} ${duration}ms ERROR:`, error.message);

      logAudit({
        action: `${method} ${url}`,
        actor: ip,
        resource: url,
        details: { error: error.message, status: 500 },
        ip,
      });

      return serverError(err);
    }
  };
}
