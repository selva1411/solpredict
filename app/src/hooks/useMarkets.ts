import { useEffect, useState, useCallback, useRef } from "react";
import { useProgram } from "./useProgram";
import { PublicKey } from "@solana/web3.js";
import type { MarketCacheEntry } from "@/lib/db/store";
import { useRealtime } from "./useRealtime";

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

  const fetchFromCache = useCallback(async () => {
    try {
      const res = await fetch('/api/markets/cached');
      const data = await res.json();
      if (data.ok && data.markets?.length > 0) {
        const converted = data.markets.map((m: MarketCacheEntry) => {
          let pubkey = PublicKey.default;
          try {
            if (m.marketPubkey && m.marketPubkey.length >= 32) {
              pubkey = new PublicKey(m.marketPubkey);
            }
          } catch {}
          return {
            publicKey: pubkey,
            account: {
              marketId: Number(m.marketId || 0),
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
              yesPoolLamports: Math.round(Number(m.yesPoolSol || 0) * 1e9),
              noPoolLamports: Math.round(Number(m.noPoolSol || 0) * 1e9),
              yesSupply: Number(m.yesSupply || 0),
              noSupply: Number(m.noSupply || 0),
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
          };
        });
        const sorted = converted.sort((a: any, b: any) => b.account.marketId - a.account.marketId);
        setMarkets(sorted as MarketAccount[]);
        setError(null);
        return true;
      }
    } catch (e) {
      console.warn("DB cached markets fallback failed:", e);
    }
    return false;
  }, []);

  const fetchMarkets = useCallback(async () => {
    if (!program) {
      await fetchFromCache();
      setLoading(false);
      return;
    }
    try {
      const all = await program.account.market.all();
      if (all.length > 0) {
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
      } else {
        setError("Loading markets from database");
        await fetchFromCache();
      }
    } catch {
      setError("On-chain markets unavailable, loading from database");
      await fetchFromCache();
    } finally {
      setLoading(false);
    }
  }, [program, fetchFromCache]);

  const rt = useRealtime("markets");
  const pollingRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  useEffect(() => {
    fetchMarkets();
  }, [fetchMarkets]);

  useEffect(() => {
    if (rt.connected) {
      if (pollingRef.current) clearInterval(pollingRef.current);
      pollingRef.current = undefined;
    } else if (!pollingRef.current) {
      pollingRef.current = setInterval(fetchMarkets, pollIntervalMs);
    }
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [fetchMarkets, pollIntervalMs, rt.connected]);

  useEffect(() => {
    const unsub = rt.on("markets", () => fetchMarkets());
    return () => unsub?.();
  }, [fetchMarkets, rt]);

  return { markets, loading, error, refetch: fetchMarkets };
}