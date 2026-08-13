export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { ok, badRequest, serverError } from "@/lib/api-response";
import { apiHandler } from "@/lib/api-handler";
import { getAchievements } from "@/lib/data/users";

export const GET = apiHandler(async (req: NextRequest) => {
  const wallet = req.nextUrl.searchParams.get("wallet");
  if (!wallet || wallet.length < 32) {
    return badRequest("Valid wallet address required");
  }

  try {
    const achievements = await getAchievements(wallet);
    return ok({ ok: true, achievements });
  } catch (err) {
    return serverError(err);
  }
});
