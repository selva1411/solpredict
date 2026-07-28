import { NextRequest } from "next/server";
import { db } from "@/lib/db/client";
import { notifications } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { ok, badRequest } from "@/lib/api-response";
import { apiHandler } from "@/lib/api-handler";

export const GET = apiHandler(async (req: NextRequest) => {
  const wallet = req.nextUrl.searchParams.get("wallet");
  if (!wallet) return badRequest("Wallet required");
  if (!db) return ok({ ok: true, notifications: [] });

  const rows = await db
    .select()
    .from(notifications)
    .where(eq(notifications.wallet, wallet))
    .orderBy(desc(notifications.createdAt))
    .limit(50);

  return ok({ ok: true, notifications: rows });
});
