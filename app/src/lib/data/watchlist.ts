import { db } from '@/lib/db/client';
import { watchlist } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

export async function getWatchlistKeys(wallet: string): Promise<string[]> {
  if (!db) throw new Error("Database not available");
  const items = await db
    .select({ marketPubkey: watchlist.marketPubkey })
    .from(watchlist)
    .where(eq(watchlist.wallet, wallet));
  return items.map(i => i.marketPubkey);
}

/** Toggle: returns true if the market is now watched, false if removed. */
export async function toggleWatch(wallet: string, marketPubkey: string): Promise<boolean> {
  if (!db) throw new Error("Database not available");
  const existing = await db
    .select()
    .from(watchlist)
    .where(and(eq(watchlist.wallet, wallet), eq(watchlist.marketPubkey, marketPubkey)));

  if (existing.length > 0) {
    await db
      .delete(watchlist)
      .where(and(eq(watchlist.wallet, wallet), eq(watchlist.marketPubkey, marketPubkey)));
    return false;
  }

  await db.insert(watchlist).values({ wallet, marketPubkey, createdAt: new Date() });
  return true;
}

/** Unconditional removal (used by self-heal to purge dead market pubkeys). */
export async function removeWatch(wallet: string, marketPubkey: string): Promise<void> {
  if (!db) throw new Error("Database not available");
  await db
    .delete(watchlist)
    .where(and(eq(watchlist.wallet, wallet), eq(watchlist.marketPubkey, marketPubkey)));
}
