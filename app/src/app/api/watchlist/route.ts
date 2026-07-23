import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/client';
import { watchlist } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const wallet = searchParams.get('wallet');

    if (!wallet) {
      return NextResponse.json({ error: 'Missing wallet parameter' }, { status: 400 });
    }

    if (db) {
      const items = await db
        .select({ marketPubkey: watchlist.marketPubkey })
        .from(watchlist)
        .where(eq(watchlist.wallet, wallet));
      
      const keys = items.map(i => i.marketPubkey);
      return NextResponse.json({ ok: true, keys });
    }

    return NextResponse.json({ ok: true, keys: [] });
  } catch (err: any) {
    console.error("Watchlist GET error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { wallet, marketPubkey } = await req.json();

    if (!wallet || !marketPubkey) {
      return NextResponse.json({ error: 'Missing wallet or marketPubkey' }, { status: 400 });
    }

    if (db) {
      // Check existing
      const existing = await db
        .select()
        .from(watchlist)
        .where(and(eq(watchlist.wallet, wallet), eq(watchlist.marketPubkey, marketPubkey)));

      if (existing.length > 0) {
        // Delete item from watchlist
        await db
          .delete(watchlist)
          .where(and(eq(watchlist.wallet, wallet), eq(watchlist.marketPubkey, marketPubkey)));
        return NextResponse.json({ ok: true, action: 'removed', isWatched: false });
      } else {
        // Insert item into watchlist
        await db.insert(watchlist).values({
          wallet,
          marketPubkey,
          createdAt: new Date(),
        });
        return NextResponse.json({ ok: true, action: 'added', isWatched: true });
      }
    }

    return NextResponse.json({ ok: true, action: 'toggled', isWatched: true });
  } catch (err: any) {
    console.error("Watchlist POST error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
