import { z } from "zod";

/**
 * API contracts for SolPredict. Every server response we render should be
 * validated here so a schema drift or a silent fallback surfaces as a clear
 * error rather than rendering `undefined` as a number.
 *
 * These mirror the shapes returned by `api/markets/*`, `api/user/*`,
 * `api/leaderboard`, and `api/admin/*`.
 */

export const paginationSchema = z.object({
  page: z.number(),
  limit: z.number(),
  total: z.number(),
  totalPages: z.number(),
});

export const cachedMarketSchema = z.object({
  marketPubkey: z.string(),
  marketId: z.number(),
  question: z.string(),
  description: z.string().nullable().optional(),
  category: z.string().nullable().optional(),
  status: z.string(),
  winningOutcome: z.string().nullable().optional(),
  yesPoolSol: z.number().optional(),
  noPoolSol: z.number().optional(),
  yesSupply: z.number().optional(),
  noSupply: z.number().optional(),
  endTs: z.string(),
  resolveTs: z.string().nullable().optional(),
  thumbnailUrl: z.string().nullable().optional(),
  tags: z.array(z.string()).nullable().optional(),
  viewCount: z.number().optional(),
  watchlistCount: z.number().optional(),
  totalPool: z.number().optional(),
  yesOdds: z.number().optional(),
  volume24h: z.number().optional(),
  traders: z.number().optional(),
  liquidity: z.number().optional(),
});

export const cachedMarketListSchema = z.object({
  ok: z.boolean(),
  markets: z.array(cachedMarketSchema).default([]),
});

export const cachedMarketsResponseSchema = z.object({
  ok: z.boolean(),
  markets: z.array(cachedMarketSchema).default([]),
  stats: z.object({
    totalMarkets: z.number(),
    openMarkets: z.number(),
    totalVolume: z.string(),
    totalLiquidity: z.string(),
    volume24h: z.string(),
    totalTraders: z.number(),
  }).optional(),
  pagination: z.object({
    total: z.number(),
    limit: z.number(),
    offset: z.number(),
    hasMore: z.boolean(),
  }).optional(),
});

export const marketStatsSchema = z.object({
  ok: z.boolean(),
  stats: z.object({
    totalMarkets: z.number(),
    openMarkets: z.number(),
    settledMarkets: z.number(),
    cancelledMarkets: z.number(),
    totalVolume: z.string(),
    totalLiquidity: z.string(),
    totalTrades: z.number(),
    volume24h: z.string(),
    trades24h: z.number(),
    totalTraders: z.number(),
    activeTraders24h: z.number(),
  }),
});

export const leaderboardEntrySchema = z.object({
  rank: z.number(),
  wallet: z.string(),
  username: z.string(),
  avatarUrl: z.string().optional(),
  totalWagered: z.number(),
  totalProfit: z.number(),
  winRate: z.number().nullable().optional(),
  pasScore: z.number().nullable().optional(),
  marketsTraded: z.number().optional(),
});

export const leaderboardSchema = z.object({
  ok: z.boolean(),
  leaderboard: z.array(leaderboardEntrySchema).default([]),
});

export const positionsSchema = z.object({
  ok: z.boolean(),
  positions: z.array(z.unknown()).default([]),
  lpPositions: z.array(z.unknown()).default([]),
  stats: z.object({
    netWorthSol: z.number(),
    pnl24hSol: z.number(),
    pnl24hPct: z.number(),
    winRate: z.number().nullable().optional(),
  }),
  fromDb: z.boolean().optional(),
});

export const healthSchema = z.object({
  ok: z.boolean(),
  checks: z.record(z.string(), z.unknown()),
  timestamp: z.number(),
});

/** Runtime schemas for validating the responses we trust on the client. */
export const contracts = {
  cachedMarketList: cachedMarketListSchema,
  cachedMarketsResponse: cachedMarketsResponseSchema,
  marketStats: marketStatsSchema,
  leaderboard: leaderboardSchema,
  positions: positionsSchema,
  health: healthSchema,
  cachedMarket: cachedMarketSchema,
} as const;