import { NextRequest } from 'next/server';
import { db } from '@/lib/db/client';
import { liquidityPositions, lpPoolStats, marketsCache } from '@/lib/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { ok, badRequest, serverError } from '@/lib/api-response';
import { apiHandler } from '@/lib/api-handler';

export const POST = apiHandler(async (req: NextRequest, ctx?: { params?: Promise<Record<string, string>> }) => {
  const params = await ctx?.params;
  const marketPubkey = params?.id || '';
  const body = await req.json().catch(() => null);
  if (!body) return badRequest('Invalid JSON body');

  const { walletAddress, amountSol, action, option } = body;
  if (!walletAddress || typeof amountSol !== 'number' || !action) {
    return badRequest('Missing required parameters (walletAddress, amountSol, action)');
  }

  if (!db) return serverError('Database not configured');

  if (action === 'add') {
    const amount = String(amountSol);

    let yesAdd = 0;
    let noAdd = 0;
    if (option === 'yes') {
      yesAdd = amountSol;
    } else if (option === 'no') {
      noAdd = amountSol;
    } else {
      yesAdd = amountSol / 2;
      noAdd = amountSol / 2;
    }

    // Upsert liquidity position
    await db
      .insert(liquidityPositions)
      .values({
        wallet: walletAddress,
        marketPubkey,
        amountSol: amount,
        yesPoolSol: String(yesAdd),
        noPoolSol: String(noAdd),
        lpTokens: Math.floor(amountSol * 1000),
      })
      .onConflictDoUpdate({
        target: [liquidityPositions.wallet, liquidityPositions.marketPubkey],
        set: {
          amountSol: sql`${liquidityPositions.amountSol} + ${amountSol}`,
          yesPoolSol: sql`${liquidityPositions.yesPoolSol} + ${yesAdd}`,
          noPoolSol: sql`${liquidityPositions.noPoolSol} + ${noAdd}`,
          lpTokens: sql`${liquidityPositions.lpTokens} + ${Math.floor(amountSol * 1000)}`,
          updatedAt: new Date(),
        },
      });

    // Upsert lpPoolStats
    await db
      .insert(lpPoolStats)
      .values({
        marketPubkey,
        totalLiquiditySol: amount,
        totalLpTokens: Math.floor(amountSol * 1000),
      })
      .onConflictDoUpdate({
        target: [lpPoolStats.marketPubkey],
        set: {
          totalLiquiditySol: sql`${lpPoolStats.totalLiquiditySol} + ${amountSol}`,
          totalLpTokens: sql`${lpPoolStats.totalLpTokens} + ${Math.floor(amountSol * 1000)}`,
          updatedAt: new Date(),
        },
      });

    // Update marketsCache
    await db
      .update(marketsCache)
      .set({
        yesPoolSol: sql`${marketsCache.yesPoolSol} + ${yesAdd}`,
        noPoolSol: sql`${marketsCache.noPoolSol} + ${noAdd}`,
        updatedAt: new Date(),
      })
      .where(eq(marketsCache.marketPubkey, marketPubkey));

    return ok({
      ok: true,
      action: 'add',
      addedSol: amountSol,
      yesAdd,
      noAdd,
    });
  }

  if (action === 'remove') {
    const [position] = await db
      .select()
      .from(liquidityPositions)
      .where(
        and(
          eq(liquidityPositions.wallet, walletAddress),
          eq(liquidityPositions.marketPubkey, marketPubkey)
        )
      );

    if (!position || Number(position.amountSol || 0) < amountSol) {
      return badRequest('Insufficient LP position balance');
    }

    const removeRatio = amountSol / Math.max(0.0001, Number(position.amountSol));
    const yesRemove = Number(position.yesPoolSol || 0) * removeRatio;
    const noRemove = Number(position.noPoolSol || 0) * removeRatio;

    await db
      .update(liquidityPositions)
      .set({
        amountSol: sql`${liquidityPositions.amountSol} - ${amountSol}`,
        yesPoolSol: sql`${liquidityPositions.yesPoolSol} - ${yesRemove}`,
        noPoolSol: sql`${liquidityPositions.noPoolSol} - ${noRemove}`,
        lpTokens: sql`${liquidityPositions.lpTokens} - ${Math.floor(amountSol * 1000)}`,
        updatedAt: new Date(),
      })
      .where(eq(liquidityPositions.id, position.id));

    await db
      .update(marketsCache)
      .set({
        yesPoolSol: sql`GREATEST(0.1, ${marketsCache.yesPoolSol} - ${yesRemove})`,
        noPoolSol: sql`GREATEST(0.1, ${marketsCache.noPoolSol} - ${noRemove})`,
        updatedAt: new Date(),
      })
      .where(eq(marketsCache.marketPubkey, marketPubkey));

    return ok({
      ok: true,
      action: 'remove',
      removedSol: amountSol,
      yesRemove,
      noRemove,
    });
  }

  return badRequest('Invalid action. Use "add" or "remove"');
});
