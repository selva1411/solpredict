import { NextRequest } from "next/server";
import { ok } from "@/lib/api-response";
import { apiHandler } from "@/lib/api-handler";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const WS_PORT = process.env.WS_PORT || "3001";

/**
 * Forced realtime refresh: proxies a POST to the WS server's /broadcast
 * endpoint so that, after a confirmed trade + DB sync, every connected client
 * (including other tabs/sessions) receives fresh data immediately — without
 * waiting for a poll. Optional `wallet` re-reads that user's positions.
 */
export const POST = apiHandler(async (req: NextRequest) => {
  let wallet: string | undefined;
  try {
    const body = await req.json().catch(() => null);
    wallet = body?.wallet;
  } catch { /* ignore */ }

  let res: Response;
  try {
    res = await fetch(`http://127.0.0.1:${WS_PORT}/broadcast`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ wallet: wallet ?? null }),
      signal: AbortSignal.timeout(3000),
    });
  } catch (e) {
    return ok({ ok: false, error: "ws_unavailable", pushed: false }, { status: 503 } as ResponseInit);
  }

  const status = res.status;
  return ok({ ok: status === 200, pushed: status === 200 }, { status } as ResponseInit);
});