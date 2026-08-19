import { db } from '@/lib/db/client';
import { priceAlerts } from '@/lib/db/schema';
import { eq, and, desc } from 'drizzle-orm';

export interface PriceAlertInput {
  wallet: string;
  marketPubkey: string;
  targetPrice: string;
  comparison: 'above' | 'below';
}

export async function getActiveAlerts(wallet: string) {
  if (!db) throw new Error("Database not available");
  return db
    .select()
    .from(priceAlerts)
    .where(and(eq(priceAlerts.wallet, wallet), eq(priceAlerts.active, true)))
    .orderBy(desc(priceAlerts.createdAt));
}

export async function createPriceAlert(input: PriceAlertInput) {
  if (!db) throw new Error("Database not available");
  const [row] = await db.insert(priceAlerts).values({
    wallet: input.wallet,
    marketPubkey: input.marketPubkey,
    targetPrice: input.targetPrice,
    comparison: input.comparison,
  }).returning();
  return row;
}

/** Soft-delete: marks the alert inactive so it stops firing. Scoped to the
 * owning wallet — a user can only deactivate their own alerts. */
export async function deactivateAlert(id: number, wallet: string) {
  if (!db) throw new Error("Database not available");
  await db.update(priceAlerts)
    .set({ active: false })
    .where(and(eq(priceAlerts.id, id), eq(priceAlerts.wallet, wallet)));
}
