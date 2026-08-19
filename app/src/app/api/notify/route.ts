export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { insertNotification } from "@/lib/data/notifications";
import { walletSchema } from "@/lib/schemas";
import { z } from "zod";
import { ok, badRequest, serverError } from "@/lib/api-response";
import { apiHandler } from "@/lib/api-handler";
import { requireUser } from "@/lib/user-guard";

const notifySchema = z.object({
  wallet: walletSchema,
  type: z.string().min(1).max(50),
  marketPubkey: z.string().min(1).max(64).nullable().optional(),
  message: z.string().min(1).max(1000),
});

export const POST = apiHandler(async (req: NextRequest) => {
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return badRequest("Invalid JSON body");

  const parsed = notifySchema.safeParse(body);
  if (!parsed.success) return badRequest("Invalid request data");

  const auth = await requireUser(req, parsed.data.wallet);
  if (!auth.ok) return auth.response;

  try {
    const row = await insertNotification({
      wallet: auth.identity.wallet,
      type: parsed.data.type,
      marketPubkey: parsed.data.marketPubkey ?? null,
      message: parsed.data.message,
    });
    return ok({ ok: true, notification: row });
  } catch (err) {
    return serverError(err);
  }
});