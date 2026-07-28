import { db } from "./client";
import { notifications } from "./schema";

export interface NotificationInput {
  wallet: string;
  type: "trade" | "settlement" | "expiry";
  marketPubkey: string;
  message: string;
}

export async function insertNotification(input: NotificationInput) {
  if (!db) return null;
  try {
    const [row] = await db.insert(notifications).values({
      wallet: input.wallet,
      type: input.type,
      marketPubkey: input.marketPubkey,
      message: input.message,
      read: false,
    }).returning();
    return row;
  } catch {
    return null;
  }
}

export async function insertTradeNotification(wallet: string, marketPubkey: string, side: string, amount: number) {
  return insertNotification({
    wallet,
    type: "trade",
    marketPubkey,
    message: `${side === "YES" ? "Bought" : "Sold"} ${side} shares for ${(amount / 1e9).toFixed(4)} SOL`,
  });
}

export async function insertSettleNotification(wallet: string, marketPubkey: string, outcome: string) {
  return insertNotification({
    wallet,
    type: "settlement",
    marketPubkey,
    message: `Market settled: ${outcome === "yes" ? "YES" : "NO"} won`,
  });
}
