import { getCachedMarketsFromDb } from '@/lib/db/store';
import { ok } from '@/lib/api-response';
import { apiHandler } from '@/lib/api-handler';

export const GET = apiHandler(async () => {
  const markets = await getCachedMarketsFromDb();
  return ok({ ok: true, markets: markets ?? [] });
}, { cacheMaxAge: 10, cacheTags: ["markets"] });
