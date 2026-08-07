export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { db } from "@/lib/db/client";
import { priceAlerts } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { ok, badRequest, serverError, serviceUnavailable } from "@/lib/api-response";
import { apiHandler } from "@/lib/api-handler";

export const GET = apiHandler(async (req: NextRequest) => {
  const wallet = req.nextUrl.searchParams.get("wallet");
  if (!wallet) return badRequest("wallet required");
  if (!db) return serviceUnavailable('Database not available');

  const rows = await db
    .select()
    .from(priceAlerts)
    .where(and(eq(priceAlerts.wallet, wallet), eq(priceAlerts.active, true)))
    .orderBy(desc(priceAlerts.createdAt));

  return ok({ ok: true, alerts: rows });
});

export const POST = apiHandler(async (req: NextRequest) => {
  if (!db) return serverError("Database not connected");
  const body = await req.json();
  const { wallet, marketPubkey, targetPrice, comparison } = body;
  if (!wallet || !marketPubkey || targetPrice === undefined) {
    return badRequest("wallet, marketPubkey, targetPrice required");
  }

  const [row] = await db.insert(priceAlerts).values({
    wallet,
    marketPubkey,
    targetPrice: String(targetPrice),
    comparison: comparison || "above",
  }).returning();

  return ok({ ok: true, alert: row });
});

export const DELETE = apiHandler(async (req: NextRequest) => {
  if (!db) return serverError("Database not connected");
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return badRequest("id required");

  const idNum = parseInt(id, 10);
  if (Number.isNaN(idNum)) return badRequest("Invalid alert id");
  await db.update(priceAlerts).set({ active: false }).where(eq(priceAlerts.id, idNum));
  return ok({ ok: true });
});
