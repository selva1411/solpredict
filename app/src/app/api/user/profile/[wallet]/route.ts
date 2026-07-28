import { NextRequest } from "next/server";
import { db } from "@/lib/db/client";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { ok, notFound } from "@/lib/api-response";
import { apiHandler } from "@/lib/api-handler";

export const GET = apiHandler(async (req: NextRequest, context: any) => {
  const params = await Promise.resolve(context?.params);
  const wallet = params?.wallet as string | undefined;
  if (!wallet || wallet.length < 32) {
    return notFound("Invalid wallet");
  }
  if (!db) return ok({ ok: true, profile: null });

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.wallet, wallet))
    .limit(1);

  if (!user) {
    return ok({ ok: true, profile: null });
  }

  return ok({
    ok: true,
    profile: {
      wallet: user.wallet,
      username: user.username,
      avatarUrl: user.avatarUrl ?? `https://api.dicebear.com/7.x/identicon/svg?seed=${user.wallet}`,
      bio: user.bio,
      twitterHandle: user.twitterHandle,
      totalWagered: Number(user.totalWagered ?? 0),
      totalWon: Number(user.totalWon ?? 0),
      totalProfit: Number(user.totalProfit ?? 0),
      marketsTraded: user.marketsTraded ?? 0,
      winRate: Number(user.winRate ?? 0),
      pasScore: user.pasScore ?? 50,
      createdAt: user.createdAt,
      lastActive: user.lastActive,
    },
  });
});
