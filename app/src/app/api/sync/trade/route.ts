export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { applyTradeEvent } from "@/lib/indexer/reducer";
import { verifyTradeSignature } from "@/lib/indexer/onchain";
import { recomputeUserStats } from "@/lib/indexer/user-stats";
import { serverError, ok, badRequest } from "@/lib/api-response";
import { apiHandler } from "@/lib/api-handler";
import { syncTradeSchema } from "@/lib/schemas";

export const POST = apiHandler(async (req: NextRequest) => {
  const body = await req.json().catch(() => null);
  if (!body) return badRequest("Invalid JSON body");

  const parsed = syncTradeSchema.safeParse(body);
  if (!parsed.success) {
    return badRequest(parsed.error.issues.map(i => `${i.path.join(".")}: ${i.message}`).join("; "));
  }

  const d = parsed.data;

  // A trade can only be recorded once it has been confirmed AND verified on
  // chain. The signature is required — the client-reported lamports/tokens
  // are discarded in favor of the values derived from the parsed transaction.
  if (!d.signature) {
    return badRequest("signature is required: trades are only recorded after on-chain confirmation");
  }

  try {
    const verified = await verifyTradeSignature(d.signature, {
      marketPubkey: d.marketPubkey,
      trader: d.trader,
      side: d.side,
    });

    await applyTradeEvent({
      type: "trade",
      signature: verified.signature,
      marketPubkey: verified.marketPubkey,
      trader: verified.trader,
      side: verified.side,
      outcomeIndex: verified.outcomeIndex,
      lamportsIn: verified.lamportsIn,
      tokensOut: verified.tokensOut,
      pricePerToken: verified.pricePerToken,
      blockTime: verified.blockTime,
      slot: verified.slot,
      // Real post-trade on-chain snapshots — the verified source of truth.
      yesPoolLamports: verified.yesPoolLamports,
      noPoolLamports: verified.noPoolLamports,
      yesSupply: verified.yesSupply,
      noSupply: verified.noSupply,
    });

    // Recompute the trader's leaderboard stats NOW so the leaderboard page
    // reflects the new volume/PnL immediately on the next WS push (instead of
    // waiting for the 20s user-stats cron). Fire-and-forget — never block the
    // trade sync response on a DB recompute.
    void recomputeUserStats(verified.trader).catch(() => 0);

    return ok({ ok: true, synced: true, verified: true });
  } catch (err) {
    // Verification failures are client errors (fake/duplicate/unconfirmed
    // signatures), not server errors — return 400 so the caller can react.
    const msg = err instanceof Error ? err.message : String(err);
    return ok({ ok: false, error: msg }, { status: 400 } as ResponseInit);
  }
});
