import { useEffect, useState, useCallback } from "react";
import { useProgram } from "./useProgram";
import { PublicKey } from "@solana/web3.js";
import type { MarketCacheEntry } from "@/lib/db/store";

export interface MarketAccount {
  publicKey: PublicKey;
  account: {
    marketId: number;
    authority: PublicKey;
    question: string;
    description: string;
    category: number;
    oracleFeedId: number[];
    targetPrice: number;
    targetExpo: number;
    comparison: number;
    endTs: number;
    resolveTs: number;
    status: number;
    winningOutcome: number;
    yesMint: PublicKey;
    noMint: PublicKey;
    yesPoolLamports: number;
    noPoolLamports: number;
    yesSupply: number;
    noSupply: number;
    totalPayoutPool: number;
    feeCollected: number;
    feeWithdrawn: boolean;
    totalClaimed: number;
    settledPrice: number;
    settledExpo: number;
    settledAt: number;
    sharePriceLamports: number;
    bump: number;
    treasuryBump: number;
  };
}

const CATEGORY_MAP: Record<string, number> = {
  Crypto: 0, Sports: 1, Politics: 2, Tech: 3, Other: 4,
};
const STATUS_MAP: Record<string, number> = {
  open: 0, Open: 0, settled: 1, Settled: 1, cancelled: 2, Cancelled: 2,
};

export function useMarkets(pollIntervalMs = 10_000) {
  const { program } = useProgram();
  const [markets, setMarkets] = useState<MarketAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMarkets = useCallback(async () => {
    if (!program) return;
    try {
      const all = await program.account.market.all();
      const parsed = all.map((item: any) => {
        const acct = item.account;
        const statusObj = acct.status;
        const statusNum = statusObj?.open !== undefined ? 0 : statusObj?.settled !== undefined ? 1 : statusObj?.cancelled !== undefined ? 2 : 0;
        const outcomeObj = acct.winningOutcome;
        const outcomeNum = outcomeObj?.unset !== undefined ? 0 : outcomeObj?.yes !== undefined ? 1 : outcomeObj?.no !== undefined ? 2 : 0;
        return {
          publicKey: item.publicKey as PublicKey,
          account: {
            marketId: acct.marketId.toNumber(),
            authority: acct.authority as PublicKey,
            question: acct.question,
            description: acct.description,
            category: acct.category,
            oracleFeedId: acct.oracleFeedId,
            targetPrice: acct.targetPrice.toNumber(),
            targetExpo: acct.targetExpo,
            comparison: acct.comparison,
            endTs: acct.endTs.toNumber(),
            resolveTs: acct.resolveTs.toNumber(),
            status: statusNum,
            winningOutcome: outcomeNum,
            yesMint: acct.yesMint as PublicKey,
            noMint: acct.noMint as PublicKey,
            yesPoolLamports: acct.yesPoolLamports.toNumber(),
            noPoolLamports: acct.noPoolLamports.toNumber(),
            yesSupply: acct.yesSupply.toNumber(),
            noSupply: acct.noSupply.toNumber(),
            totalPayoutPool: acct.totalPayoutPool.toNumber(),
            feeCollected: acct.feeCollected.toNumber(),
            feeWithdrawn: acct.feeWithdrawn,
            totalClaimed: acct.totalClaimed?.toNumber() ?? 0,
            settledPrice: acct.settledPrice?.toNumber() ?? 0,
            settledExpo: acct.settledExpo ?? 0,
            settledAt: acct.settledAt?.toNumber() ?? 0,
            sharePriceLamports: acct.sharePriceLamports.toNumber(),
            bump: acct.bump,
            treasuryBump: acct.treasuryBump,
          },
        };
      });
      const sorted = parsed.sort((a: any, b: any) => b.account.marketId - a.account.marketId);
      setMarkets(sorted as MarketAccount[]);
      setError(null);
    } catch {
      setError("On-chain markets unavailable, falling back to cache");
      try {
        const res = await fetch('/api/markets/cached');
        const data = await res.json();
        if (data.ok && data.markets?.length > 0) {
          const converted = data.markets.map((m: MarketCacheEntry) => ({
            publicKey: new PublicKey(m.marketPubkey),
            account: {
              marketId: m.marketId,
              authority: PublicKey.default,
              question: m.question,
              description: m.description || '',
              category: CATEGORY_MAP[m.category] ?? 4,
              oracleFeedId: [],
              targetPrice: 0,
              targetExpo: 0,
              comparison: 0,
              endTs: Math.floor(new Date(m.endTs).getTime() / 1000),
              resolveTs: Math.floor(new Date(m.resolveTs).getTime() / 1000),
              status: STATUS_MAP[m.status] ?? 0,
              winningOutcome: m.winningOutcome === 'yes' ? 1 : m.winningOutcome === 'no' ? 2 : 0,
              yesMint: PublicKey.default,
              noMint: PublicKey.default,
              yesPoolLamports: Math.round(m.yesPoolSol * 1e9),
              noPoolLamports: Math.round(m.noPoolSol * 1e9),
              yesSupply: m.yesSupply,
              noSupply: m.noSupply,
              totalPayoutPool: 0,
              feeCollected: 0,
              feeWithdrawn: false,
              totalClaimed: 0,
              settledPrice: 0,
              settledExpo: 0,
              settledAt: 0,
              sharePriceLamports: 0,
              bump: 0,
              treasuryBump: 0,
            },
          }));
          const sorted = converted.sort((a: any, b: any) => b.account.marketId - a.account.marketId);
          setMarkets(sorted as MarketAccount[]);
        }
      } catch (dbErr) {
        console.warn("DB cached markets fallback failed:", dbErr);
      }
    } finally {
      setLoading(false);
    }
  }, [program]);

  useEffect(() => {
    fetchMarkets();
    const interval = setInterval(fetchMarkets, pollIntervalMs);
    return () => clearInterval(interval);
  }, [fetchMarkets, pollIntervalMs]);

  return { markets, loading, error, refetch: fetchMarkets };
}