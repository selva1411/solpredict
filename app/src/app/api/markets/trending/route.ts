export const dynamic = "force-dynamic";
import { getTrending } from "@/lib/data/markets";
import { ok, serverError } from "@/lib/api-response";
import { apiHandler } from "@/lib/api-handler";

export const GET = apiHandler(async () => {
  try {
    const markets = await getTrending(6);
    return ok({ ok: true, markets });
  } catch (err) {
    return serverError(err);
  }
}, { cacheMaxAge: 30, cacheTags: ["trending"] });
