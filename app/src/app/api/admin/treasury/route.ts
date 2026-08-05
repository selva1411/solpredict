import { NextRequest } from 'next/server';
import { db } from '@/lib/db/client';
import { marketsCache, trades, adminSettings, lpPoolStats } from '@/lib/db/schema';
import { sql, eq } from 'drizzle-orm';
import { ok, serverError } from '@/lib/api-response';
import { apiHandler } from '@/lib/api-handler';
import { requireAdmin } from '@/lib/admin-guard';

export const GET = apiHandler(async (req: NextRequest) => {
  const guard = await requireAdmin(req);
  if (!guard.ok) return guard.response;
  if (!db) {
    return ok({
      ok: true,
      treasury: {
        totalFeeCollectedSol: 0,
        totalFeeWithdrawnSol: 0,
        pendingFeesSol: 0,
        totalTreasuryBalanceSol: 0,
        marketsWithFees: 0,
        recentWithdrawals: [],
      },
    });
  }

  try {
    // Read configured fee bps from admin_settings (default 200 = 2%)
    let feeBps = 200;
    try {
      const [feeSetting] = await db.select({ value: adminSettings.value })
        .from(adminSettings)
        .where(eq(adminSettings.key, 'feeBps'))
        .limit(1);
      const parsed = feeSetting ? Number(feeSetting.value) : NaN;
      if (Number.isFinite(parsed) && parsed > 0) feeBps = parsed;
    } catch {}

    // Tracked LP fee earnings (updated by indexers/LP withdrawal flows)
    let lpFeeEarned = 0;
    try {
      const [lpFee] = await db.select({
        total: sql<string>`COALESCE(SUM(CAST(fee_earned_sol AS NUMERIC)), 0)::text`,
      }).from(lpPoolStats);
      lpFeeEarned = Number(lpFee?.total || 0);
    } catch {}

    // Fees withdrawn so far (admin_settings, set on each withdrawal)
    let totalWithdrawn = 0;
    try {
      const [wd] = await db.select({ value: adminSettings.value })
        .from(adminSettings)
        .where(eq(adminSettings.key, 'feesWithdrawnSol'))
        .limit(1);
      const parsed = wd ? Number(wd.value) : NaN;
      if (Number.isFinite(parsed) && parsed > 0) totalWithdrawn = parsed;
    } catch {}

    const [feeStats] = await db.select({
      totalMarkets: sql<number>`COUNT(*)::int`,
      totalLiquidity: sql<string>`COALESCE(SUM(CAST(yes_pool_sol AS NUMERIC) + CAST(no_pool_sol AS NUMERIC)), 0)::text`,
    }).from(marketsCache);

    // Fees are charged on buy-side cost at the configured fee rate
    const [tradeStats] = await db.select({
      totalVolume: sql<string>`COALESCE(SUM(ABS(lamports_in)) / 1e9, 0)::text`,
      buyVolume: sql<string>`COALESCE(SUM(CASE WHEN lamports_in > 0 THEN lamports_in ELSE 0 END) / 1e9, 0)::text`,
      estimatedFees: sql<string>`COALESCE(SUM(CASE WHEN lamports_in > 0 THEN ABS(lamports_in) ELSE 0 END) / 1e9 * ${feeBps} / 10000, 0)::text`,
    }).from(trades);

    const totalVolume = Number(tradeStats?.totalVolume || 0);
    const estimatedFees = Number(tradeStats?.estimatedFees || 0);
    const buyVolume = Number(tradeStats?.buyVolume || 0);

    // Best-available collected fees: tracked LP fees, else trade-based estimate
    const collected = lpFeeEarned > 0 ? lpFeeEarned : estimatedFees;
    const pending = Math.max(0, collected - totalWithdrawn);

    return ok({
      ok: true,
      treasury: {
        totalFeeCollectedSol: Number(collected.toFixed(4)),
        totalFeeWithdrawnSol: Number(totalWithdrawn.toFixed(4)),
        pendingFeesSol: Number(pending.toFixed(4)),
        totalTreasuryBalanceSol: Number((feeStats?.totalLiquidity || 0)),
        marketsWithFees: feeStats?.totalMarkets || 0,
        totalTradeVolume: totalVolume,
        buyVolume,
        feeBps,
        feeSource: lpFeeEarned > 0 ? "tracked LP fee earnings" : "estimated from on-chain trade volume",
      },
    });
  } catch (e) {
    return serverError(e);
  }
});
