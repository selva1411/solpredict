import { NextRequest } from "next/server";
import { db } from "@/lib/db/client";
import { marketProposals } from "@/lib/db/schema";
import { desc, eq } from "drizzle-orm";
import { ok, badRequest, unauthorized } from "@/lib/api-response";
import { apiHandler } from "@/lib/api-handler";

export const GET = apiHandler(async (req: NextRequest) => {
  const adminWallet = req.headers.get("x-admin-wallet");
  if (!adminWallet) return unauthorized("Admin auth required");

  if (!db) return ok({ ok: true, proposals: [] });

  const proposals = await db
    .select()
    .from(marketProposals)
    .where(eq(marketProposals.status, "pending"))
    .orderBy(desc(marketProposals.createdAt));

  return ok({ ok: true, proposals });
});

export const PATCH = apiHandler(async (req: NextRequest) => {
  const adminWallet = req.headers.get("x-admin-wallet");
  if (!adminWallet) return unauthorized("Admin auth required");

  if (!db) return badRequest("Database not available");

  const body = await req.json();
  const { id, action } = body as { id?: string; action?: "approve" | "reject" };

  if (!id || !action || !["approve", "reject"].includes(action)) {
    return badRequest("Missing or invalid id/action");
  }

  const idNum = Number(id);
  if (Number.isNaN(idNum)) return badRequest("Invalid proposal id");

  await db
    .update(marketProposals)
    .set({ status: action === "approve" ? "approved" : "rejected" })
    .where(eq(marketProposals.id, idNum));

  return ok({ ok: true, id, action });
});
