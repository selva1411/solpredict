/**
 * Market Adapter
 * Converts Solana on-chain Market accounts (Anchor decoded) into the
 * UI-friendly Market shape used by the PREDICT-X components.
 *
 * Usage:
 *   import { onChainToUiMarket } from "@/lib/market-adapter";
 *   const uiMarkets = onChainMarkets.map(onChainToUiMarket);
 */
import type { PublicKey } from "@solana/web3.js";

export const CATEGORY_NAMES = ["Crypto", "Sports", "Politics", "Tech", "Other"] as const;
export type CategoryName = (typeof CATEGORY_NAMES)[number];

export const CATEGORY_ICONS: Record<CategoryName, string> = {
  Crypto: "◎",
  Sports: "⚽",
  Politics: "🗳",
  Tech: "💻",
  Other: "🌐",
};

/**
 * The UI shape that PREDICT-X components (MarketCard, TradePanel, etc.)
 * expect.
 */
export interface UiMarket {
  id: string;
  question: string;
  description: string;
  category: CategoryName;
  endDate: string;
  yesPool: number;
  noPool: number;
  yesPrice: number;
  noPrice: number;
  volume24h: number;
  liquidity: number;
  traders: number;
  icon: string;
  sparkline: number[];
  oracleFeedId: string;
  trending?: boolean;
  hot?: boolean;
}

/**
 * The on-chain Market shape as decoded by Anchor.
 * Adjust the field names if your IDL differs.
 */
export interface OnChainMarket {
  publicKey: PublicKey;
  account: {
    marketId: number;
    question: string;
    description: string;
    category: number;
    oracleFeedId: number[];
    endTs: number;
    status: number;
    winningOutcome: number;
    yesPoolLamports: number;
    noPoolLamports: number;
    yesSupply: number;
    noSupply: number;
    [key: string]: unknown;
  };
}

export function categoryFromIndex(idx: number): CategoryName {
  return CATEGORY_NAMES[idx] ?? "Other";
}

export function categoryIcon(idx: number): string {
  return CATEGORY_ICONS[categoryFromIndex(idx)];
}

/**
 * Convert lamports (1e-9 SOL) to SOL.
 */
export function lamportsToSol(lamports: number): number {
  return lamports / 1e9;
}

/**
 * Core conversion function.
 * Pass an on-chain market + optional enrichment data (from Neon Postgres cache).
 */
export function onChainToUiMarket(
  m: OnChainMarket,
  enrichment?: {
    volume24h?: number;
    traders?: number;
    sparkline?: number[];
    trending?: boolean;
    hot?: boolean;
  },
): UiMarket {
  const yesLamports = m.account.yesPoolLamports;
  const noLamports = m.account.noPoolLamports;
  const totalLamports = yesLamports + noLamports;
  const yesPrice = totalLamports > 0 ? yesLamports / totalLamports : 0.5;

  return {
    id: m.publicKey.toBase58(),
    question: m.account.question,
    description: m.account.description || "",
    category: categoryFromIndex(m.account.category),
    endDate: new Date(m.account.endTs * 1000).toISOString(),
    yesPool: lamportsToSol(yesLamports),
    noPool: lamportsToSol(noLamports),
    yesPrice,
    noPrice: 1 - yesPrice,
    volume24h: enrichment?.volume24h ?? 0,
    liquidity: lamportsToSol(totalLamports),
    traders: enrichment?.traders ?? 0,
    icon: categoryIcon(m.account.category),
    sparkline: enrichment?.sparkline ?? [],
    oracleFeedId: Array.isArray(m.account.oracleFeedId) ? "0x" + Buffer.from(m.account.oracleFeedId).toString("hex") : "",
    trending: enrichment?.trending ?? false,
    hot: enrichment?.hot ?? false,
  };
}

/**
 * Batch helper: convert an array of on-chain markets + a map of enrichment data.
 */
export function onChainMarketsToUi(
  markets: OnChainMarket[],
  enrichmentMap?: Record<string, {
    volume24h?: number;
    traders?: number;
    sparkline?: number[];
    trending?: boolean;
    hot?: boolean;
  }>,
): UiMarket[] {
  return markets.map((m) =>
    onChainToUiMarket(m, enrichmentMap?.[m.publicKey.toBase58()]),
  );
}
