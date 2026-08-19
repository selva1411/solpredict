import { db } from '@/lib/db/client';
import { notifications } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';

export interface NotificationInput {
  wallet: string;
  type: string;
  marketPubkey: string | null;
  message: string;
}

export async function getNotifications(wallet: string, limit = 50) {
  if (!db) throw new Error("Database not available");
  const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 200);
  return db
    .select()
    .from(notifications)
    .where(eq(notifications.wallet, wallet))
    .orderBy(desc(notifications.createdAt))
    .limit(safeLimit);
}

export async function insertNotification(input: NotificationInput) {
  if (!db) throw new Error("Database not available");
  const [row] = await db.insert(notifications).values({
    wallet: input.wallet,
    type: input.type,
    marketPubkey: input.marketPubkey,
    message: input.message,
    read: false,
  }).returning();
  return row;
}
