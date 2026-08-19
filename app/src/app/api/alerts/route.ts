export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { getActiveAlerts, createPriceAlert, deactivateAlert } from "@/lib/data/alerts";
import { walletSchema, publicKeySchema } from "@/lib/schemas";
import { z } from "zod";
import { ok, badRequest, serverError } from "@/lib/api-response";
import { apiHandler } from "@/lib/api-handler";
import { requireUser } from "@/lib/user-guard";

const alertPostSchema = z.object({
  wallet: walletSchema,
  marketPubkey: publicKeySchema,
  targetPrice: z.union([z.number().positive(), z.string().regex(/^\d+(\.\d+)?$/)]),
  comparison: z.enum(["above", "below"]).optional(),
});

export const GET = apiHandler(async (req: NextRequest) => {
  const wallet = req.nextUrl.searchParams.get("wallet");
  if (!wallet) return badRequest("wallet required");

  const parsed = walletSchema.safeParse(wallet);
  if (!parsed.success) return badRequest("Invalid wallet format");

  const auth = await requireUser(req, parsed.data);
  if (!auth.ok) return auth.response;

  try {
    const rows = await getActiveAlerts(auth.identity.wallet);
    return ok({ ok: true, alerts: rows });
  } catch (err) {
    return serverError(err);
  }
});

export const POST = apiHandler(async (req: NextRequest) => {
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return badRequest("Invalid JSON body");

  const parsed = alertPostSchema.safeParse(body);
  if (!parsed.success) return badRequest("Invalid request data");

  const auth = await requireUser(req, parsed.data.wallet);
  if (!auth.ok) return auth.response;

  try {
    const { marketPubkey, targetPrice, comparison } = parsed.data;
    const row = await createPriceAlert({
      wallet: auth.identity.wallet,
      marketPubkey,
      targetPrice: String(targetPrice),
      comparison: comparison ?? "above",
    });
    return ok({ ok: true, alert: row });
  } catch (err) {
    return serverError(err);
  }
});

export const DELETE = apiHandler(async (req: NextRequest) => {
  const wallet = req.nextUrl.searchParams.get("wallet");
  const id = req.nextUrl.searchParams.get("id");
  if (!wallet) return badRequest("wallet required");
  if (!id) return badRequest("id required");

  const walletParsed = walletSchema.safeParse(wallet);
  if (!walletParsed.success) return badRequest("Invalid wallet format");

  const auth = await requireUser(req, walletParsed.data);
  if (!auth.ok) return auth.response;

  const idNum = Number(id);
  if (!Number.isInteger(idNum) || idNum <= 0) return badRequest("Invalid alert id");

  try {
    await deactivateAlert(idNum, auth.identity.wallet);
    return ok({ ok: true });
  } catch (err) {
    return serverError(err);
  }
});