import { z } from "zod";
import { walletSchema, publicKeySchema } from "../schemas";

// ---------------------------------------------------------------------------
// Standard API Envelope
// ---------------------------------------------------------------------------

export const apiSuccessSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({
    ok: z.literal(true),
    data: dataSchema,
  });

export const apiErrorSchema = z.object({
  ok: z.literal(false),
  error: z.object({
    code: z.string(),
    message: z.string(),
  }),
});

export type ApiResponse<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string } };

// ---------------------------------------------------------------------------
// Domain Models
// ---------------------------------------------------------------------------

export const uiMarketSchema = z.object({
  marketPubkey: z.string(),
  marketId: z.number(),
  creator: z.string().nullable().optional(),
  question: z.string(),
  description: z.string().nullable().optional(),
  category: z.string(),
  status: z.enum(["open", "settled", "disputed", "cancelled", "paused", "pending"]),
  winningOutcome: z.string().nullable().optional(),
  resolutionSource: z.string().nullable().optional(),
  oracleFeedId: z.string().nullable().optional(),
  yesPoolSol: z.number().optional(),
  noPoolSol: z.number().optional(),
  yesSupply: z.number().optional(),
  noSupply: z.number().optional(),
  totalPool: z.number(),
  yesOdds: z.number(),
  feeBps: z.number().optional(),
  totalVolume: z.number().optional(),
  openInterest: z.number().optional(),
  rentDepositLamports: z.number().nullable().optional(),
  rentReclaimedAt: z.string().nullable().optional(),
  endTs: z.string().nullable().optional(),
  resolveTs: z.string().nullable().optional(),
  settledAt: z.string().nullable().optional(),
  thumbnailUrl: z.string().nullable().optional(),
  tags: z.array(z.string()).nullable().optional(),
  viewCount: z.number().optional(),
  watchlistCount: z.number().optional(),
});

export type UiMarket = z.infer<typeof uiMarketSchema>;

export const userStatsSchema = z.object({
  wallet: walletSchema,
  totalVolume: z.number(),
  tradeCount: z.number(),
  marketsTraded: z.number(),
  marketsResolved: z.number(),
  wins: z.number(),
  losses: z.number(),
  winRateBps: z.number().nullable(), // Null when 0 settled markets per spec §2.3
  realizedPnl: z.number(),
  unrealizedPnl: z.number(),
  roiBps: z.number().nullable(),
  bestTrade: z.number(),
  currentStreak: z.number(),
  rank: z.number().nullable(),
});

export type UserStats = z.infer<typeof userStatsSchema>;

export const userPositionSchema = z.object({
  marketPubkey: z.string(),
  question: z.string(),
  category: z.string(),
  status: z.string(),
  side: z.enum(["YES", "NO"]),
  shares: z.number(),
  avgPriceSol: z.number(),
  currentPriceSol: z.number(),
  valueSol: z.number(),
  pnlSol: z.number(),
  pnlPercent: z.number(),
});

export type UserPosition = z.infer<typeof userPositionSchema>;

export const rewardItemSchema = z.object({
  id: z.number(),
  wallet: walletSchema,
  epoch: z.number().optional(),
  kind: z.enum(["trading", "lp", "referral", "quest", "airdrop"]),
  amount: z.number(),
  status: z.enum(["accrued", "claimable", "claimed"]),
  claimSignature: z.string().nullable().optional(),
  claimedAt: z.string().nullable().optional(),
});

export type RewardItem = z.infer<typeof rewardItemSchema>;

export const treasuryLedgerSchema = z.object({
  id: z.number(),
  ts: z.string(),
  signature: z.string().nullable().optional(),
  direction: z.enum(["in", "out"]),
  kind: z.enum(["fee", "rent", "bond_forfeit", "withdrawal", "emergency_withdraw"]),
  amount: z.number(),
  mint: z.string().nullable().optional(),
  marketPubkey: z.string().nullable().optional(),
  actor: z.string().nullable().optional(),
  note: z.string().nullable().optional(),
});

export type TreasuryLedgerItem = z.infer<typeof treasuryLedgerSchema>;

export const platformConfigSchema = z.object({
  feeBps: z.number(),
  minLiquidity: z.number(),
  proposalBond: z.number(),
  disputeBond: z.number(),
  disputeWindowSecs: z.number(),
  paused: z.boolean(),
  pauseReason: z.string().nullable().optional(),
  treasuryWallet: z.string().nullable().optional(),
  adminWallets: z.array(z.string()).optional(),
});

export type PlatformConfig = z.infer<typeof platformConfigSchema>;

// ---------------------------------------------------------------------------
// Endpoint Request & Response Schemas
// ---------------------------------------------------------------------------

export const marketsQuerySchema = z.object({
  category: z.string().optional(),
  status: z.enum(["all", "open", "settled", "disputed", "cancelled", "paused"]).optional(),
  search: z.string().optional(),
  sort: z.enum(["newest", "ending", "volume", "popular", "liquidity", "trending"]).optional(),
  page: z.number().int().min(1).optional().default(1),
  limit: z.number().int().min(1).max(100).optional().default(20),
});

export const marketsResponseSchema = apiSuccessSchema(
  z.object({
    markets: z.array(uiMarketSchema),
    pagination: z.object({
      page: z.number(),
      limit: z.number(),
      total: z.number(),
      totalPages: z.number(),
    }),
  })
);

export const proposeMarketBodySchema = z.object({
  question: z.string().min(10).max(200),
  description: z.string().max(400).optional(),
  category: z.enum(["Crypto", "Sports", "Politics", "Tech", "Other"]),
  outcomes: z.array(z.string().min(1).max(50)).min(2).optional(),
  closeTs: z.number().int().positive(),
  oracleFeedId: z.string().length(64).optional(),
});

export const disputeBodySchema = z.object({
  claimedOutcome: z.enum(["YES", "NO"]),
  evidenceUrl: z.string().url().optional(),
  reason: z.string().min(10).max(1000),
});
