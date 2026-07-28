import { NextRequest } from "next/server";
import { db } from "@/lib/db/client";
import { notifications } from "@/lib/db/schema";
import { ok, badRequest, serverError } from "@/lib/api-response";
import { apiHandler } from "@/lib/api-handler";

export const POST = apiHandler(async (req: NextRequest) => {
  if (!db) return serverError("Database not connected");
  const body = await req.json();
  const { wallet, type, marketPubkey, message } = body;
  if (!wallet || !type || !message) return badRequest("wallet, type, message required");
  try {
    const [row] = await db.insert(notifications).values({ wallet, type, marketPubkey: marketPubkey || null, message, read: false }).returning();
    return ok({ ok: true, notification: row });
  } catch {
    return serverError("Failed to insert notification");
  }
});
