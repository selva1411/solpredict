import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/client';
import { trades, users, priceHistory, marketsCache } from '@/lib/db/schema';
import { eq, sql } from 'drizzle-orm';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      signature,
      marketPubkey,
      trader,
      side,
      lamportsIn,
      tokensOut,
      pricePerToken,
      yesPoolSol,
      noPoolSol,
      yesPct,
    } = body;

    if (!marketPubkey || !trader || !side) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    const solAmount = (lamportsIn || 0) / 1e9;
    const tokenAmount = tokensOut || 0;
    const price = pricePerToken || (solAmount > 0 && tokenAmount > 0 ? solAmount / tokenAmount : 0.01);
    const txSig = signature || `tx_${Date.now()}_${Math.floor(Math.random() * 100000)}`;

    if (db) {
      // 1. Record Trade in NeonDB
      await db.insert(trades).values({
        signature: txSig,
        marketPubkey,
        trader,
        side,
        lamportsIn: lamportsIn || 0,
        tokensOut: tokenAmount,
        pricePerToken: price.toString(),
        blockTime: new Date(),
        slot: 0,
      }).onConflictDoNothing();

      // 2. Record User Stats in NeonDB
      await db.insert(users).values({
        wallet: trader,
        username: `${trader.slice(0, 4)}...${trader.slice(-4)}`,
        avatarUrl: `https://api.dicebear.com/7.x/identicon/svg?seed=${trader}`,
        totalWagered: solAmount.toString(),
        totalWon: '0',
        totalProfit: '0',
        marketsTraded: 1,
        winRate: '50.00',
        pasScore: 75,
        lastActive: new Date(),
      }).onConflictDoUpdate({
        target: users.wallet,
        set: {
          totalWagered: sql`${users.totalWagered} + ${solAmount}`,
          marketsTraded: sql`${users.marketsTraded} + 1`,
          lastActive: new Date(),
        }
      });

      // 3. Record Price History Snapshot in NeonDB
      if (yesPct !== undefined) {
        await db.insert(priceHistory).values({
          marketPubkey,
          timestamp: new Date(),
          yesPct: yesPct.toString(),
          yesPoolSol: (yesPoolSol || 0).toString(),
          noPoolSol: (noPoolSol || 0).toString(),
          totalVolume: ((yesPoolSol || 0) + (noPoolSol || 0)).toString(),
        });
      }

      // 4. Update Market Pools in NeonDB
      if (yesPoolSol !== undefined && noPoolSol !== undefined) {
        await db.update(marketsCache).set({
          yesPoolSol: yesPoolSol.toString(),
          noPoolSol: noPoolSol.toString(),
          updatedAt: new Date(),
        }).where(eq(marketsCache.marketPubkey, marketPubkey));
      }
    }

    return NextResponse.json({ ok: true, signature: txSig });
  } catch (err: any) {
    console.error("Error syncing trade to NeonDB:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
