import { useEffect, useState, useCallback } from "react";
import { useProgram } from "./useProgram";
import { PublicKey } from "@solana/web3.js";
import { getMarketPda } from "@/lib/pda";
import { MarketAccount } from "./useMarkets";

export function useMarket(marketId: number | null, pollIntervalMs = 10_000) {
  const { program } = useProgram();
  const [market, setMarket] = useState<MarketAccount | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMarket = useCallback(async () => {
    if (!program || marketId === null) return;
    try {
      const marketPda = getMarketPda(
        new (await import("@coral-xyz/anchor")).BN(marketId),
        program.programId
      );
      const acct = await program.account.market.fetch(marketPda);
      const statusObj = (acct as any).status;
      const statusNum = statusObj?.open !== undefined ? 0 : statusObj?.settled !== undefined ? 1 : statusObj?.cancelled !== undefined ? 2 : 0;
      const outcomeObj = (acct as any).winningOutcome;
      const outcomeNum = outcomeObj?.unset !== undefined ? 0 : outcomeObj?.yes !== undefined ? 1 : outcomeObj?.no !== undefined ? 2 : 0;
      setMarket({
        publicKey: marketPda,
        account: {
          marketId: (acct as any).marketId.toNumber(),
          authority: (acct as any).authority,
          question: (acct as any).question,
          description: (acct as any).description,
          category: (acct as any).category,
          oracleFeedId: (acct as any).oracleFeedId,
          targetPrice: (acct as any).targetPrice.toNumber(),
          targetExpo: (acct as any).targetExpo,
          comparison: (acct as any).comparison,
          endTs: (acct as any).endTs.toNumber(),
          resolveTs: (acct as any).resolveTs.toNumber(),
          status: statusNum,
          winningOutcome: outcomeNum,
          yesMint: (acct as any).yesMint,
          noMint: (acct as any).noMint,
          yesPoolLamports: (acct as any).yesPoolLamports.toNumber(),
          noPoolLamports: (acct as any).noPoolLamports.toNumber(),
          yesSupply: (acct as any).yesSupply.toNumber(),
          noSupply: (acct as any).noSupply.toNumber(),
          totalPayoutPool: (acct as any).totalPayoutPool.toNumber(),
          feeCollected: (acct as any).feeCollected.toNumber(),
          feeWithdrawn: (acct as any).feeWithdrawn,
          totalClaimed: (acct as any).totalClaimed?.toNumber() ?? 0,
          settledPrice: (acct as any).settledPrice?.toNumber() ?? 0,
          settledExpo: (acct as any).settledExpo ?? 0,
          settledAt: (acct as any).settledAt?.toNumber() ?? 0,
          sharePriceLamports: (acct as any).sharePriceLamports.toNumber(),
          bump: (acct as any).bump,
          treasuryBump: (acct as any).treasuryBump,
        },
      });
      setError(null);
    } catch {
      setError("Failed to fetch market");
    } finally {
      setLoading(false);
    }
  }, [program, marketId]);

  useEffect(() => {
    fetchMarket();
    const interval = setInterval(fetchMarket, pollIntervalMs);
    return () => clearInterval(interval);
  }, [fetchMarket, pollIntervalMs]);

  return { market, loading, error, refetch: fetchMarket };
}