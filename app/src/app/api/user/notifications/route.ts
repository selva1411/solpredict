export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { getNotifications } from "@/lib/data/notifications";
import { walletSchema } from "@/lib/schemas";
import { ok, badRequest, serverError } from "@/lib/api-response";
import { apiHandler } from "@/lib/api-handler";
import { requireUser } from "@/lib/user-guard";

export const GET = apiHandler(async (req: NextRequest) => {
  const wallet = req.nextUrl.searchParams.get("wallet");
  if (!wallet) return badRequest("Wallet required");

  const parsed = walletSchema.safeParse(wallet);
  if (!parsed.success) return badRequest("Invalid wallet format");

  const auth = await requireUser(req, parsed.data);
  if (!auth.ok) return auth.response;

  const limit = Math.min(Math.max(Number(req.nextUrl.searchParams.get("limit") || 50), 1), 200);

  try {
    const rows = await getNotifications(auth.identity.wallet, limit);
    return ok({ ok: true, notifications: rows });
  } catch (err) {
    return serverError(err);
  }
});