/**
 * Market Adapter
 * Converts Solana on-chain Market accounts (Anchor decoded) into the
 * UI-friendly Market shape used by the SOLPredict components.
 *
 * Usage:
 *   import { onChainToUiMarket } from "@/lib/market-adapter";
 *   const uiMarkets = onChainMarkets.map(onChainToUiMarket);
 */
import type { PublicKey } from "@solana/web3.js";
import type { MarketCacheEntry } from "@/lib/db/markets-store";

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
 * The UI shape that SOLPredict components (MarketCard, TradePanel, etc.)
 * expect.
 */
export interface UiMarket {
  id: string;
  marketId: number;
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
  status?: "open" | "settled" | "cancelled" | "ended";
  trending?: boolean;
  hot?: boolean;
  viewCount?: number;
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
    feeBps?: number;
    [key: string]: unknown;
  };
  // DB enrichment fields (passed from useMarkets)
  _dbVolume24h?: number;
  _dbTraders?: number;
  _dbLiquidity?: number;
  _dbViewCount?: number;
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

import { probabilityYesBps, DEFAULT_B } from "@/lib/amm/lmsr";

/** Coerce a lamports field (number | anchor.BN | bigint) to bigint. */
function toBigIntValue(v: unknown): bigint {
  if (typeof v === "bigint") return v;
  if (typeof v === "number") return BigInt(Math.trunc(v));
  const obj = v as { toNumber?: () => number } | null;
  if (obj && typeof obj.toNumber === "function") return BigInt(obj.toNumber());
  return 0n;
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
    lastPriceBps?: number;
  },
): UiMarket {
  const yesSupply = BigInt(m.account.yesSupply ?? 0);
  const noSupply = BigInt(m.account.noSupply ?? 0);
  const yesLamports = toBigIntValue(m.account.yesPoolLamports);
  const noLamports = toBigIntValue(m.account.noPoolLamports);
  const poolTotal = yesLamports + noLamports;
  // Implied odds from the REAL reserves when known — matches the detail page
  // and the on-chain CPMM. LMSR/DB price is only the fallback for empty pools.
  const bps = poolTotal > 0n
    ? Number((yesLamports * 10000n) / poolTotal)
    : (enrichment?.lastPriceBps ?? probabilityYesBps(DEFAULT_B, yesSupply, noSupply));
  const yesPrice = bps / 10000;
  const liquidity = lamportsToSol(m.account.yesPoolLamports + m.account.noPoolLamports);

  // Use DB enrichment data if available (from useMarkets _db* fields)
  const volume24h = enrichment?.volume24h ?? m._dbVolume24h ?? 0;
  const traders = enrichment?.traders ?? m._dbTraders ?? 0;

  return {
    id: m.publicKey.toBase58(),
    marketId: m.account.marketId,
    question: m.account.question,
    description: m.account.description || "",
    category: categoryFromIndex(m.account.category),
    endDate: new Date(m.account.endTs * 1000).toISOString(),
    yesPool: lamportsToSol(m.account.yesPoolLamports),
    noPool: lamportsToSol(m.account.noPoolLamports),
    yesPrice,
    noPrice: 1 - yesPrice,
    volume24h,
    liquidity: m._dbLiquidity ?? liquidity,
    traders,
    icon: categoryIcon(m.account.category),
    sparkline: enrichment?.sparkline ?? [],
    oracleFeedId: Array.isArray(m.account.oracleFeedId) ? "0x" + Buffer.from(m.account.oracleFeedId).toString("hex") : "",
    // 0 = open, 1 = settled, 2 = cancelled (on-chain enum index). Lets cards
    // render the REAL board status instead of deriving it from the clock alone.
    status: m.account.status === 1 ? "settled" : m.account.status === 2 ? "cancelled" : "open",
    trending: enrichment?.trending ?? false,
    hot: enrichment?.hot ?? false,
    viewCount: m._dbViewCount ?? 0,
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
    lastPriceBps?: number;
  }>,
): UiMarket[] {
  return markets.map((m) =>
    onChainToUiMarket(m, enrichmentMap?.[m.publicKey.toBase58()]),
  );
}

/**
 * Convert a DB cache entry to a UiMarket.
 */
export function cacheToUiMarket(
  c: MarketCacheEntry & { lastPriceBps?: number; yesPoolSol?: number; noPoolSol?: number },
  opts?: { trending?: boolean; hot?: boolean },
): UiMarket {
  const category = (CATEGORY_NAMES as readonly string[]).includes(c.category)
    ? (c.category as CategoryName)
    : "Other";

  // Pool reserves come from the REAL DB snapshot columns (markets_cache
  // yes_pool_lamports / no_pool_lamports, written by the indexer and the trade
  // sync). When they are truly unknown we return 0 — we never fabricate pools
  // from volume or odds (see market-pools.ts).
  const yesPool = typeof c.yesPoolSol === "number" && c.yesPoolSol > 0 ? c.yesPoolSol : 0;
  const noPool = typeof c.noPoolSol === "number" && c.noPoolSol > 0 ? c.noPoolSol : 0;
  const totalVol = c.liquidity ?? Number((c as any).totalVolume ?? 0) ?? 0;
  const poolTotal = yesPool + noPool;
  // Implied odds from the REAL pool ratio (same as the detail page), falling
  // back to the persisted last-price / 50% only when pools are unknown.
  const bps = poolTotal > 0 ? Math.round((yesPool / poolTotal) * 10000) : (c.lastPriceBps ?? 5000);
  const yesPrice = bps / 10000;

  return {
    id: c.marketPubkey,
    marketId: c.marketId ?? 0,
    question: c.question,
    description: c.description ?? "",
    category,
    endDate: c.endTs ? new Date(c.endTs).toISOString() : new Date().toISOString(),
    yesPool,
    noPool,
    yesPrice,
    noPrice: 1 - yesPrice,
    volume24h: c.volume24h ?? 0,
    liquidity: (yesPool + noPool) > 0 ? (yesPool + noPool) : totalVol,
    traders: c.traders ?? 0,
    icon: categoryIcon(CATEGORY_NAMES.indexOf(category)),
    sparkline: [],
    oracleFeedId: "",
    status: c.status === "settled" ? "settled" : c.status === "cancelled" ? "cancelled" : "open",
    trending: opts?.trending ?? false,
    hot: opts?.hot ?? false,
    viewCount: c.viewCount ?? 0,
  };
}
