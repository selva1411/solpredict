export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { applyTradeEvent } from "@/lib/indexer/reducer";
import { serverError, ok, badRequest } from "@/lib/api-response";
import { apiHandler } from "@/lib/api-handler";
import { syncTradeSchema } from "@/lib/schemas";

export const POST = apiHandler(async (req: NextRequest) => {
  const body = await req.json();
  const parsed = syncTradeSchema.safeParse(body);
  if (!parsed.success) {
    return badRequest(parsed.error.issues.map(i => `${i.path.join(".")}: ${i.message}`).join("; "));
  }

  const d = parsed.data;

  try {
    await applyTradeEvent({
      type: "trade",
      signature: d.signature ?? `SYNC_SIG_${Date.now()}`,
      marketPubkey: d.marketPubkey,
      trader: d.trader,
      side: d.side as "YES" | "NO",
      lamportsIn: d.lamportsIn,
      tokensOut: d.tokensOut,
      pricePerToken: d.pricePerToken,
      feePaidLamports: d.feePaidLamports,
      yesPoolLamports: d.yesPoolLamports ?? (d.yesPoolSol !== undefined ? Math.round(d.yesPoolSol * 1e9) : undefined),
      noPoolLamports: d.noPoolLamports ?? (d.noPoolSol !== undefined ? Math.round(d.noPoolSol * 1e9) : undefined),
      yesSupply: d.yesSupply,
      noSupply: d.noSupply,
    });

    return ok({ ok: true, synced: true });
  } catch (err) {
    return serverError(err);
  }
});
