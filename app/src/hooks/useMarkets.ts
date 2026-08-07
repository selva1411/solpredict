import { useEffect, useState, useCallback, useRef } from "react";
import { useProgram } from "./useProgram";
import { PublicKey } from "@solana/web3.js";
import type { MarketCacheEntry } from "@/lib/db/markets-store";
import { useRealtime } from "./useRealtime";
import { getMarketPda } from "@/lib/pda";
import * as anchor from "@coral-xyz/anchor";

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
  // DB enrichment data
  _dbVolume24h?: number;
  _dbTraders?: number;
  _dbLiquidity?: number;
  _dbViewCount?: number;
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

  // DB is the primary data source
  const fetchFromDb = useCallback(async (): Promise<boolean> => {
    try {
      const res = await fetch('/api/markets/cached');
      const data = await res.json();
      if (data.ok && data.markets?.length > 0) {
        const converted = data.markets.map((m: MarketCacheEntry & { volume24h?: number; traders?: number; liquidity?: number; viewCount?: number }) => {
          let pubkey: PublicKey;
          try {
            if (m.marketPubkey && m.marketPubkey.length >= 32) {
              pubkey = new PublicKey(m.marketPubkey);
            } else {
              throw new Error("invalid pubkey");
            }
          } catch {
            // DB market without a usable on-chain address — derive a deterministic
            // PDA from marketId so watchlist/navigation keys stay stable.
            pubkey = getMarketPda(new anchor.BN(Number(m.marketId || 0)), program.programId);
          }
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
              yesPoolLamports: Math.round(Number(m.liquidity || 0) * 0.5 * 1e9),
              noPoolLamports: Math.round(Number(m.liquidity || 0) * 0.5 * 1e9),
              yesSupply: 0,
              noSupply: 0,
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
            // Pass DB enrichment data through
            _dbVolume24h: m.volume24h ?? 0,
            _dbTraders: m.traders ?? 0,
            _dbLiquidity: m.liquidity ?? 0,
            _dbViewCount: m.viewCount ?? 0,
          };
        });
        const sorted = converted.sort((a: any, b: any) => b.account.marketId - a.account.marketId);
        setMarkets(sorted as MarketAccount[]);
        setError(null);
        return true;
      }
    } catch (e) {
      console.warn("DB cached markets fetch failed:", e);
    }
    return false;
  }, [program]);

  const fetchMarkets = useCallback(async () => {
    // Always try DB first (primary source of truth)
    const dbSuccess = await fetchFromDb();
    
    if (dbSuccess) {
      setLoading(false);
      // If on-chain is available, try to enrich with live data in background
      if (program) {
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
          }
        } catch {
          // On-chain unavailable — DB data is already set, that's fine
        }
      }
      return;
    }

    // DB returned nothing — try on-chain as fallback
    if (program) {
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
          setError("No markets found");
        }
      } catch {
        setError("Markets unavailable — database and blockchain both unreachable");
      }
    } else {
      setError("No data source available");
    }
    
    setLoading(false);
  }, [program, fetchFromDb]);

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