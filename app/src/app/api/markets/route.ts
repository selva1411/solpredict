import { NextRequest } from 'next/server';
import { db } from '@/lib/db/client';
import { marketsCache } from '@/lib/db/schema';
import { ok, serverError } from '@/lib/api-response';
import { apiHandler } from '@/lib/api-handler';
import { desc, asc, eq, and, ilike, or, sql } from 'drizzle-orm';

export const GET = apiHandler(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const category  = searchParams.get('category');
  const status    = searchParams.get('status') || 'open';
  const search    = searchParams.get('search');
  const sort      = searchParams.get('sort') || 'newest';
  const page      = Math.max(1, Number(searchParams.get('page') || 1));
  const limit     = Math.min(100, Math.max(1, Number(searchParams.get('limit') || 20)));
  const offset    = (page - 1) * limit;

  if (!db) {
    return ok({ ok: true, markets: [], pagination: { page, limit, total: 0, totalPages: 0 } });
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const conditions: any[] = [];

    if (status && status !== 'all') {
      conditions.push(eq(marketsCache.status, status));
    }
    if (category && category !== 'All' && category !== 'all') {
      conditions.push(eq(marketsCache.category, category));
    }
    if (search && search.trim()) {
      conditions.push(
        or(
          ilike(marketsCache.question, `%${search.trim()}%`),
          ilike(marketsCache.description, `%${search.trim()}%`),
        ),
      );
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const sortExpr = {
      newest:   desc(marketsCache.createdAt),
      ending:   asc(marketsCache.endTs),
      volume:   desc(sql`CAST(${marketsCache.yesPoolSol} AS NUMERIC) + CAST(${marketsCache.noPoolSol} AS NUMERIC)`),
      popular:  desc(marketsCache.viewCount),
      liquidity: desc(sql`CAST(${marketsCache.yesPoolSol} AS NUMERIC) + CAST(${marketsCache.noPoolSol} AS NUMERIC)`),
    }[sort] ?? desc(marketsCache.createdAt);

    const [rows, countRows] = await Promise.all([
      db.select().from(marketsCache).where(where).orderBy(sortExpr).limit(limit).offset(offset),
      db.select({ count: sql<number>`COUNT(*)::int` }).from(marketsCache).where(where),
    ]);

    const total = countRows[0]?.count ?? 0;

    const markets = rows.map(r => ({
      marketPubkey: r.marketPubkey,
      marketId: r.marketId,
      question: r.question,
      description: r.description,
      category: r.category,
      status: r.status,
      winningOutcome: r.winningOutcome,
      yesPoolSol: Number(r.yesPoolSol ?? 0),
      noPoolSol: Number(r.noPoolSol ?? 0),
      yesSupply: r.yesSupply ?? 0,
      noSupply: r.noSupply ?? 0,
      endTs: r.endTs,
      resolveTs: r.resolveTs,
      thumbnailUrl: r.thumbnailUrl,
      tags: r.tags,
      viewCount: r.viewCount ?? 0,
      watchlistCount: r.watchlistCount ?? 0,
      // Derived fields
      totalPool: Number(r.yesPoolSol ?? 0) + Number(r.noPoolSol ?? 0),
      yesOdds: (() => {
        const yes = Number(r.yesPoolSol ?? 0);
        const no = Number(r.noPoolSol ?? 0);
        const total = yes + no;
        return total > 0 ? yes / total : 0.5;
      })(),
    }));

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

export const POST = apiHandler(async (req: NextRequest) => {
  if (!db) return ok({ ok: false, error: 'Database not configured' }, { status: 503 });

  try {
    const body = await req.json();
    const { question, description, category, endTs, resolveTs, thumbnailUrl, tags, yesPoolSol, noPoolSol, marketPubkey } = body;

    if (!question || !endTs) {
      return ok({ ok: false, error: 'question and endTs are required' }, { status: 400 });
    }

    const countRes = await db.select({ count: sql<number>`COUNT(*)::int` }).from(marketsCache);
    const nextId = (countRes[0]?.count ?? 0) + 1;
    const pubkey = marketPubkey || generateB58Pubkey();

    const [inserted] = await db.insert(marketsCache).values({
      marketPubkey: pubkey,
      marketId: nextId,
      question: String(question),
      description: description ? String(description) : null,
      category: category ? String(category) : 'Crypto',
      status: 'open',
      yesPoolSol: String(yesPoolSol ?? 0),
      noPoolSol: String(noPoolSol ?? 0),
      yesSupply: 0,
      noSupply: 0,
      endTs: new Date(endTs),
      resolveTs: resolveTs ? new Date(resolveTs) : new Date(endTs),
      thumbnailUrl: thumbnailUrl ?? null,
      tags: tags ?? null,
    }).returning();

    return ok({ ok: true, market: inserted }, { status: 201 });
  } catch (err) {
    return serverError(err);
  }
});

// Generate a valid-looking base58 pubkey for demo markets
function generateB58Pubkey(): string {
  const ALPHA = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  let out = '';
  while (out.length < 44) out += ALPHA[Math.floor(Math.random() * ALPHA.length)];
  return out;
}
