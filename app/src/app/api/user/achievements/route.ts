export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { ok, badRequest, serverError } from "@/lib/api-response";
import { apiHandler } from "@/lib/api-handler";
import { walletSchema } from "@/lib/schemas";
import { getAchievements } from "@/lib/data/users";

export const GET = apiHandler(async (req: NextRequest) => {
  const rawWallet = req.nextUrl.searchParams.get("wallet");
  const parsed = walletSchema.safeParse(rawWallet ?? "");
  if (!parsed.success) {
    return badRequest("Valid wallet address required");
  }

  try {
    const achievements = await getAchievements(parsed.data);
    return ok({ ok: true, achievements });
  } catch (err) {
    return serverError(err);
  }
});
