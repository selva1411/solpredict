export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { serverError, ok, badRequest } from "@/lib/api-response";
import { apiHandler } from "@/lib/api-handler";
import { analyzeMarketSchema } from "@/lib/schemas";
import { getTradeMomentum } from "@/lib/data/trades";

export const POST = apiHandler(async (req: NextRequest) => {
  const body = await req.json();
  const parsed = analyzeMarketSchema.safeParse(body);
  if (!parsed.success) {
    return badRequest(parsed.error.issues.map(i => `${i.path.join(".")}: ${i.message}`).join("; "));
  }

  const { question, description, yesProb, noProb, yesPool, noPool, category, marketPubkey } = parsed.data;

  const totalVolume = Number(yesPool || 0) + Number(noPool || 0);
  const confidenceLevel = Math.abs(Number(yesProb) - 50) > 20 ? "High Conviction" : "Balanced Speculation";

  // Pull real trading momentum for this market from the trades table. A DB
  // failure here is a real error, never silently swallowed into a zero result.
  let momentum: { direction: string; trades24h: number; yesVolume24h: number; noVolume24h: number; priceChangePct: number } | null = null;
  if (marketPubkey) {
    momentum = await getTradeMomentum(marketPubkey);
  }

  const swingingFactors = [
    `Overall ${String(category || "Market")} momentum & macro economic sentiment`,
    `Whale liquidity positioning (${Number(yesPool).toFixed(2)} SOL YES vs ${Number(noPool).toFixed(2)} SOL NO)`,
    `Oracle price feed volatility leading up to resolution cutoff`,
  ];
  if (momentum && momentum.trades24h > 0) {
    swingingFactors.unshift(
      `On-chain flow: ${momentum.yesVolume24h.toFixed(2)} SOL into YES vs ${momentum.noVolume24h.toFixed(2)} SOL into NO (${momentum.trades24h} trades) — ${momentum.direction}`
    );
  }

  const verdict = Number(yesProb) > 55
    ? `Bulls hold a ${yesProb}% market lead backed by ${Number(yesPool).toFixed(2)} SOL in YES liquidity${momentum && momentum.trades24h > 0 ? `, reinforced by ${momentum.direction}.` : "."}`
    : Number(noProb) > 55
    ? `Bears dominate with ${noProb}% implied probability backed by ${Number(noPool).toFixed(2)} SOL in NO liquidity${momentum && momentum.trades24h > 0 ? `, reinforced by ${momentum.direction}.` : "."}`
    : "Market is in tight equilibrium (50/50). Expect high volatility near expiration.";

  const summary = {
    verdict,
    confidenceLevel,
    impliedProbability: `${yesProb}% YES / ${noProb}% NO`,
    swingingFactors,
    historicalBaseRate: category === "Crypto" ? "72% historical settlement accuracy for oracle price thresholds." : "64% historical resolution rate within 48 hours.",
    recommendation: Number(yesProb) > 65 ? "Bullish trend strongly favored by liquidity pool depth." : "Consider limit orders near spread extremes to maximize potential ROI.",
    tradingActivity: momentum ? {
      trades24h: momentum.trades24h,
      yesVolume24h: momentum.yesVolume24h,
      noVolume24h: momentum.noVolume24h,
      direction: momentum.direction,
    } : null,
  };

  return ok({ ok: true, summary });
});
