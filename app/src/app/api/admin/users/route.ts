export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { getAdminUsers } from "@/lib/data/admin";
import { db } from "@/lib/db/client";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { ok, badRequest, serverError } from "@/lib/api-response";
import { apiHandler } from "@/lib/api-handler";
import { requireAdmin } from "@/lib/admin-guard";

export const GET = apiHandler(async (req: NextRequest) => {
  const guard = await requireAdmin(req);
  if (!guard.ok) return guard.response;

  try {
    const list = await getAdminUsers();
    return ok({ ok: true, users: list });
  } catch (err) {
    return serverError(err);
  }
});

export const PATCH = apiHandler(async (req: NextRequest) => {
  const guard = await requireAdmin(req);
  if (!guard.ok) return guard.response;

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return badRequest("Invalid JSON body");

  const { wallet, username, twitterHandle, isBanned } = body;
  if (!wallet) return badRequest("wallet is required");

  try {
    if (!db) return serverError("Database not available");

    const updateData: Record<string, unknown> = { lastActive: new Date() };
    if (username !== undefined) updateData.username = username;
    if (twitterHandle !== undefined) updateData.twitterHandle = twitterHandle;
    if (isBanned !== undefined) updateData.isBanned = Boolean(isBanned);

    const [updated] = await db
      .update(users)
      .set(updateData)
      .where(eq(users.wallet, wallet))
      .returning();

    return ok({ ok: true, user: updated });
  } catch (err) {
    return serverError(err);
  }
});
