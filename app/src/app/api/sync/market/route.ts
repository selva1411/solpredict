export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { applyMarketEvent } from "@/lib/indexer/reducer";
import { fetchMarketAccount } from "@/lib/indexer/onchain";
import { serverError, ok, badRequest } from "@/lib/api-response";
import { apiHandler } from "@/lib/api-handler";
import { syncMarketSchema } from "@/lib/schemas";

export const POST = apiHandler(async (req: NextRequest) => {
  const body = await req.json().catch(() => null);
  if (!body) return badRequest("Invalid JSON body");

  const parsed = syncMarketSchema.safeParse(body);
  if (!parsed.success) {
    return badRequest(parsed.error.issues.map(i => `${i.path.join(".")}: ${i.message}`).join("; "));
  }

  const data = parsed.data;

  try {
    // The market cache is a mirror of the ON-CHAIN market account. Never trust
    // the client's reported pools/supply — re-read the account and use its
    // real values, so a forged POST cannot corrupt the read model.
    const onChain = await fetchMarketAccount(data.marketPubkey);
    if (!onChain) {
      return ok(
        { ok: false, error: "Market account does not exist on-chain; refusing to cache a phantom market" },
        { status: 400 } as ResponseInit,
      );
    }

    const acc = onChain as unknown as Record<string, unknown>;
    const toNum = (v: unknown): number | undefined => {
      if (v === null || v === undefined) return undefined;
      if (typeof v === "object" && v !== null && "toNumber" in v) {
        return Number((v as { toNumber(): number }).toNumber());
      }
      return Number(v);
    };

    await applyMarketEvent({
      type: "market",
      marketPubkey: data.marketPubkey,
      marketId: data.marketId ?? 0,
      question: data.question,
      description: data.description ?? "",
      category: data.category ?? "Crypto",
      status: data.status ?? "open",
      winningOutcome: data.winningOutcome ?? undefined,
      // On-chain truth for every financial field — client values discarded.
      yesPoolLamports: toNum(acc.yesPoolLamports),
      noPoolLamports: toNum(acc.noPoolLamports),
      yesSupply: toNum(acc.yesSupply),
      noSupply: toNum(acc.noSupply),
      endTs: toNum(acc.endTs),
      resolveTs: toNum(acc.resolveTs),
    });

    return ok({ ok: true, synced: true, verified: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return ok({ ok: false, error: msg }, { status: 400 } as ResponseInit);
  }
});
