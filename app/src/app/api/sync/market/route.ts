export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { applyMarketEvent } from "@/lib/indexer/reducer";
import { serverError, ok, badRequest } from "@/lib/api-response";
import { apiHandler } from "@/lib/api-handler";
import { syncMarketSchema } from "@/lib/schemas";

export const POST = apiHandler(async (req: NextRequest) => {
  const body = await req.json();
  const parsed = syncMarketSchema.safeParse(body);
  if (!parsed.success) {
    return badRequest(parsed.error.issues.map(i => `${i.path.join(".")}: ${i.message}`).join("; "));
  }

  const data = parsed.data;

  try {
    await applyMarketEvent({
      type: "market",
      marketPubkey: data.marketPubkey,
      marketId: data.marketId ?? 0,
      question: data.question,
      description: data.description ?? "",
      category: data.category ?? "Crypto",
      status: data.status ?? "open",
      winningOutcome: data.winningOutcome ?? undefined,
      yesSupply: data.yesSupply,
      noSupply: data.noSupply,
      endTs: data.endTs,
      resolveTs: data.resolveTs,
    });

    return ok({ ok: true, synced: true });
  } catch (err) {
    return serverError(err);
  }
});
