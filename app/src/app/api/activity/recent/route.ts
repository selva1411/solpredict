import { NextResponse } from 'next/server';
import { db } from '@/lib/db/client';
import { trades } from '@/lib/db/schema';
import { desc, sql } from 'drizzle-orm';

export async function GET() {
  if (!db) {
    return NextResponse.json({ ok: false, error: 'DB not available' });
  }
  try {
    const rows = await db.select({
      signature: trades.signature,
      marketPubkey: trades.marketPubkey,
      trader: trades.trader,
      side: trades.side,
      lamportsIn: trades.lamportsIn,
      tokensOut: trades.tokensOut,
      blockTime: trades.blockTime,
    })
      .from(trades)
      .orderBy(desc(trades.blockTime))
      .limit(50);

    return NextResponse.json({ ok: true, activities: rows });
  } catch (err: any) {
    console.error('Error fetching recent activity:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}