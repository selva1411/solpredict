"use client";

import React, { createContext, useContext } from "react";
import { useQuery } from "@tanstack/react-query";
import { useProgram } from "@/hooks/useProgram";
import type { MarketAccount } from "@/hooks/useMarkets";
import type { MarketCacheEntry } from "@/lib/db/store";
import { PublicKey } from "@solana/web3.js";

const CATEGORY_MAP: Record<string, number> = {
  Crypto: 0, Sports: 1, Politics: 2, Tech: 3, Other: 4,
};
const STATUS_MAP: Record<string, number> = {
  open: 0, Open: 0, settled: 1, Settled: 1, cancelled: 2, Cancelled: 2,
};

interface MarketDataState {
  markets: MarketAccount[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

const MarketDataContext = createContext<MarketDataState | null>(null);

function toNumber(val: unknown): number {
  if (val == null) return 0;
  if (typeof val === "number") return val;
  if (typeof val === "bigint") return Number(val);
  const obj = val as { toNumber?: () => number };
  if (typeof obj.toNumber === "function") return obj.toNumber();
  return Number(val);
}

function parseOnChainMarket(item: Record<string, unknown>): MarketAccount {
  const acct = item.account as Record<string, unknown>;
  const statusObj = acct.status as Record<string, unknown> | undefined;
  const statusNum = statusObj?.open !== undefined ? 0 : statusObj?.settled !== undefined ? 1 : statusObj?.cancelled !== undefined ? 2 : 0;
  const outcomeObj = acct.winningOutcome as Record<string, unknown> | undefined;
  const outcomeNum = outcomeObj?.unset !== undefined ? 0 : outcomeObj?.yes !== undefined ? 1 : outcomeObj?.no !== undefined ? 2 : 0;

  return {
    publicKey: item.publicKey as PublicKey,
    account: {
      marketId: toNumber(acct.marketId),
      authority: acct.authority as PublicKey,
      question: acct.question as string,
      description: acct.description as string,
      category: toNumber(acct.category),
      oracleFeedId: (acct.oracleFeedId as number[]) ?? [],
      targetPrice: toNumber(acct.targetPrice),
      targetExpo: (acct.targetExpo as number) ?? 0,
      comparison: toNumber(acct.comparison),
      endTs: toNumber(acct.endTs),
      resolveTs: toNumber(acct.resolveTs),
      status: statusNum,
      winningOutcome: outcomeNum,
      yesMint: acct.yesMint as PublicKey,
      noMint: acct.noMint as PublicKey,
      yesPoolLamports: toNumber(acct.yesPoolLamports),
      noPoolLamports: toNumber(acct.noPoolLamports),
      yesSupply: toNumber(acct.yesSupply),
      noSupply: toNumber(acct.noSupply),
      totalPayoutPool: toNumber(acct.totalPayoutPool),
      feeCollected: toNumber(acct.feeCollected),
      feeWithdrawn: Boolean(acct.feeWithdrawn),
      totalClaimed: toNumber(acct.totalClaimed),
      settledPrice: toNumber(acct.settledPrice),
      settledExpo: (acct.settledExpo as number) ?? 0,
      settledAt: toNumber(acct.settledAt),
      sharePriceLamports: toNumber(acct.sharePriceLamports),
      bump: (acct.bump as number) ?? 0,
      treasuryBump: (acct.treasuryBump as number) ?? 0,
    },
  };
}

function convertCacheToMarket(m: MarketCacheEntry): MarketAccount {
  return {
    publicKey: new PublicKey(m.marketPubkey),
    account: {
      marketId: m.marketId,
      authority: PublicKey.default,
      question: m.question,
      description: m.description || "",
      category: CATEGORY_MAP[m.category] ?? 4,
      oracleFeedId: [],
      targetPrice: 0,
      targetExpo: 0,
      comparison: 0,
      endTs: Math.floor(new Date(m.endTs).getTime() / 1000),
      resolveTs: Math.floor(new Date(m.resolveTs).getTime() / 1000),
      status: STATUS_MAP[m.status] ?? 0,
      winningOutcome: m.winningOutcome === "yes" ? 1 : m.winningOutcome === "no" ? 2 : 0,
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
  };
}

async function fetchMarkets(program: { account: { market: { all: () => Promise<Array<Record<string, unknown>>> } } } | null): Promise<MarketAccount[]> {
  if (!program) return [];

  try {
    const all = await program.account.market.all();
    const parsed = all.map((item) => parseOnChainMarket(item as unknown as Record<string, unknown>));
    return parsed.sort((a, b) => b.account.marketId - a.account.marketId);
  } catch {
    const res = await fetch("/api/markets/cached");
    const data: { ok: boolean; markets?: MarketCacheEntry[] } = await res.json();
    if (data.ok && data.markets?.length) {
      return data.markets.map(convertCacheToMarket)
        .sort((a, b) => b.account.marketId - a.account.marketId);
    }
    return [];
  }
}

export function MarketDataProvider({ children }: { children: React.ReactNode }) {
  const { program } = useProgram();

  const { data: markets = [], isLoading, error, refetch } = useQuery({
    queryKey: ["markets", program?.programId.toBase58()],
    queryFn: () => fetchMarkets(program),
    enabled: !!program,
    refetchInterval: 10_000,
    staleTime: 8_000,
    gcTime: 60_000,
    retry: 2,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });

  return (
    <MarketDataContext.Provider value={{
      markets,
      loading: isLoading,
      error: error instanceof Error ? error.message : null,
      refetch: () => { refetch(); },
    }}>
      {children}
    </MarketDataContext.Provider>
  );
}

export function useMarketData(): MarketDataState {
  const ctx = useContext(MarketDataContext);
  if (!ctx) throw new Error("useMarketData must be used within MarketDataProvider");
  return ctx;
}
