import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/client';
import { marketsCache } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      marketPubkey,
      marketId,
      question,
      description,
      category,
      status,
      yesPoolSol,
      noPoolSol,
      yesSupply,
      noSupply,
      endTs,
      resolveTs,
    } = body;

    if (!marketPubkey || !question) {
      return NextResponse.json({ error: 'Missing marketPubkey or question' }, { status: 400 });
    }

    if (db) {
      await db.insert(marketsCache).values({
        marketPubkey,
        marketId: marketId || 0,
        question,
        description: description || '',
        category: category || 'Crypto',
        status: status || 'open',
        yesPoolSol: (yesPoolSol || 0).toString(),
        noPoolSol: (noPoolSol || 0).toString(),
        yesSupply: yesSupply || 0,
        noSupply: noSupply || 0,
        endTs: endTs ? new Date(endTs * 1000) : new Date(Date.now() + 3600000),
        resolveTs: resolveTs ? new Date(resolveTs * 1000) : new Date(Date.now() + 7200000),
        createdAt: new Date(),
        updatedAt: new Date(),
      }).onConflictDoUpdate({
        target: marketsCache.marketPubkey,
        set: {
          question,
          description: description || '',
          status: status || 'open',
          yesPoolSol: (yesPoolSol || 0).toString(),
          noPoolSol: (noPoolSol || 0).toString(),
          yesSupply: yesSupply || 0,
          noSupply: noSupply || 0,
          updatedAt: new Date(),
        }
      });
    }

    return NextResponse.json({ ok: true, marketPubkey });
  } catch (err: any) {
    console.error("Error syncing market to NeonDB:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
