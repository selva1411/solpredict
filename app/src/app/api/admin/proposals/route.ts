export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { db } from "@/lib/db/client";
import { marketsCache, marketProposals } from "@/lib/db/schema";
import { desc, eq } from "drizzle-orm";
import { ok, badRequest } from "@/lib/api-response";
import { apiHandler } from "@/lib/api-handler";
import { createMarketInDb, settleMarketInDb, getAllMarkets } from "@/lib/db/markets-store";
import { requireAdmin } from "@/lib/admin-guard";

export const GET = apiHandler(async (req: NextRequest) => {
  const guard = await requireAdmin(req);
  if (!guard.ok) return guard.response;
  let pendingProposals: any[] = [];
  try {
    if (db) {
      const rows = await db.select().from(marketProposals).orderBy(desc(marketProposals.createdAt));
      pendingProposals = rows.map(r => ({
        id: String(r.id),
        proposalPubkey: r.proposalPubkey,
        creator: r.proposer,
        question: r.question,
        description: r.description,
        category: r.category,
        createdAt: r.createdAt?.toISOString?.() ?? new Date().toISOString(),
        status: r.status,
        bondLamports: r.bondLamports,
      }));
    }
  } catch (e) {
    console.warn("Could not query marketProposals:", e);
  }

  const allMarkets = await getAllMarkets({ limit: 100 });

  return ok({
    ok: true,
    markets: allMarkets,
    proposals: pendingProposals,
  });
});

// Aligns with ProposalsSection UI (PATCH { id, action: 'approve' | 'reject' })
export const PATCH = apiHandler(async (req: NextRequest) => {
  const guard = await requireAdmin(req);
  if (!guard.ok) return guard.response;

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return badRequest("Invalid JSON body");

  const { id, action } = body;
  if (!id || !action) return badRequest("id and action required");
  if (!db) return badRequest("Database not available");

  if (action === "approve") {
    await db.update(marketProposals).set({ status: "approved" }).where(eq(marketProposals.id, Number(id)));
    return ok({ ok: true, action: "approve", id });
  }
  if (action === "reject") {
    await db.update(marketProposals).set({ status: "rejected" }).where(eq(marketProposals.id, Number(id)));
    return ok({ ok: true, action: "reject", id });
  }
  return badRequest("Invalid action (use approve or reject)");
});

export const POST = apiHandler(async (req: NextRequest) => {
  const guard = await requireAdmin(req);
  if (!guard.ok) return guard.response;

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return badRequest("Invalid JSON body");

  const { action, marketId, outcome, title, description, category, expiresAt } = body;

  switch (action) {
    case 'settle':
      if (!marketId || !outcome) return badRequest("marketId and outcome required for settlement");
      await settleMarketInDb(marketId, outcome);
      return ok({ ok: true, action: 'settle', marketId, outcome });

    case 'cancel':
      if (!marketId) return badRequest("marketId required");
      await settleMarketInDb(marketId, 'cancel');
      return ok({ ok: true, action: 'cancel', marketId });

    case 'create':
      if (!title || !description) return badRequest("title and description required");
      const endTs = expiresAt ? new Date(expiresAt) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      const newMarket = await createMarketInDb({
        question: title,
        description,
        category: category || 'Crypto',
        endTs,
      });
      return ok({ ok: true, action: 'create', market: newMarket });

    case 'approve':
      if (marketId && db) {
        await db.update(marketProposals).set({ status: 'approved' }).where(eq(marketProposals.id, Number(marketId)));
      }
      return ok({ ok: true, action: 'approve', marketId });

    case 'withdraw_fees':
      if (marketId && db) {
        await db.update(marketsCache).set({ updatedAt: new Date() }).where(eq(marketsCache.marketId, Number(marketId)));
      }
      return ok({ ok: true, action: 'withdraw_fees', marketId });

    default:
      return badRequest("Invalid action parameter");
  }
});
