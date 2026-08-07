export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { getMarketList } from "@/lib/data/markets";
import { ok, serverError } from "@/lib/api-response";
import { apiHandler } from "@/lib/api-handler";

export const GET = apiHandler(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") || searchParams.get("search") || undefined;
  const category = searchParams.get("category") || undefined;
  const status = searchParams.get("status") || "open";
  const sort = searchParams.get("sort") || "newest";
  const page = Math.max(1, Number(searchParams.get("page") || 1));
  const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit") || 20)));

  try {
    const { markets, total } = await getMarketList({
      category,
      status,
      search: q,
      sort,
      page,
      limit,
    });

    return ok({
      ok: true,
      markets,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    return serverError(err);
  }
}, { cacheMaxAge: 10 });
