export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { assertDb } from "@/lib/db/client";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { ok, badRequest, notFound, serverError } from "@/lib/api-response";
import { apiHandler } from "@/lib/api-handler";
import { getUserProfile } from "@/lib/data/users";

/**
 * GET /api/user/profile/[wallet]
 *
 * Renders full profile data for ANY valid wallet per spec §3.9.
 * Reads materialized aggregates from `user_stats` table as source of truth.
 * Returns `winRate: null` when user has 0 settled markets so UI renders `—`.
 * Shares its query logic with the server-rendered profile page via
 * `getUserProfile` in lib/data/users.ts, so every surface is identical.
 */
export const GET = apiHandler(async (_req: NextRequest, context: { params?: Promise<Record<string, string>> } = {}) => {
  const params = await context.params;
  const wallet = params?.wallet;

  if (!wallet || wallet.length < 32 || wallet.length > 44) {
    return notFound("Invalid wallet address");
  }

  try {
    const result = await getUserProfile(wallet);
    if (!result) return notFound("Wallet profile unavailable");

    return ok({ ok: true, ...result });
  } catch (err) {
    return serverError(err);
  }
});

/**
 * POST /api/user/profile/[wallet]
 *
 * Updates profile info (username, bio, avatarUrl, twitterHandle).
 * Enforces username uniqueness in DB.
 */
export const POST = apiHandler(async (req: NextRequest, context: { params?: Promise<Record<string, string>> } = {}) => {
  const params = await context.params;
  const wallet = params?.wallet;

  if (!wallet || wallet.length < 32) {
    return badRequest("Valid wallet address required");
  }

  const callerWallet = req.headers.get("x-wallet");
  if (!callerWallet || callerWallet !== wallet) {
    return badRequest("Unauthorized: You can only edit your own profile");
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return badRequest("Invalid JSON body");

  const { username, bio, avatarUrl, twitterHandle } = body as {
    username?: string;
    bio?: string;
    avatarUrl?: string;
    twitterHandle?: string;
  };

  try {
    const db = assertDb();

    // Check username uniqueness if changing
    if (username && username.trim().length > 0) {
      const existing = await db
        .select()
        .from(users)
        .where(eq(users.username, username.trim()))
        .limit(1);

      if (existing.length > 0 && existing[0].wallet !== wallet) {
        return badRequest(`Username '${username.trim()}' is already taken`);
      }
    }

    const [updated] = await db
      .update(users)
      .set({
        username: username?.trim() || undefined,
        bio: bio?.trim() ?? undefined,
        avatarUrl: avatarUrl?.trim() ?? undefined,
        twitterHandle: twitterHandle?.trim() ?? undefined,
        lastActive: new Date(),
      })
      .where(eq(users.wallet, wallet))
      .returning();

    return ok({
      ok: true,
      profile: updated,
      message: "Profile updated successfully",
    });
  } catch (err) {
    return serverError(err);
  }
});
