import { z } from "zod";

const base58Pattern = /^[1-9A-HJ-NP-Za-km-z]+$/;

export const walletSchema = z.string().regex(base58Pattern).min(32).max(44);
export const publicKeySchema = z.string().regex(base58Pattern).min(32).max(44);
export const signatureSchema = z.string().min(1).max(128);

export const watchlistPostSchema = z.object({
  wallet: walletSchema,
  marketPubkey: z.string().min(1).max(64),
});

export const watchlistGetSchema = z.object({
  wallet: walletSchema,
});

export const commentPostSchema = z.object({
  authorWallet: walletSchema,
  authorUsername: z.string().max(30).optional(),
  content: z.string().min(1).max(500),
  parentId: z.number().int().positive().nullish(),
});

export const syncTradeSchema = z.object({
  signature: signatureSchema.optional(),
  marketPubkey: publicKeySchema,
  trader: walletSchema,
  side: z.enum(["YES", "NO"]),
  // Signed values: buys are positive, sells are negative. The DB stores them
  // as-is and the reducer uses Math.abs() for volume/stats (see reconciler.ts:
  // `isBuy ? Math.abs(rawCost) : -Math.abs(rawCost)`).
  lamportsIn: z.number(),
  tokensOut: z.number(),
  pricePerToken: z.number().min(0).optional(),
  feePaidLamports: z.number().min(0).optional(),
  yesPoolSol: z.number().min(0).optional(),
  noPoolSol: z.number().min(0).optional(),
  // Real on-chain pool/supply snapshots AFTER the trade (lamports).
  yesPoolLamports: z.number().min(0).optional(),
  noPoolLamports: z.number().min(0).optional(),
  yesSupply: z.number().min(0).optional(),
  noSupply: z.number().min(0).optional(),
  yesPct: z.number().min(0).max(100).optional(),
});

export const syncMarketSchema = z.object({
  marketPubkey: publicKeySchema,
  marketId: z.number().int().optional(),
  question: z.string().min(1).max(500),
  description: z.string().max(2000).optional(),
  category: z.string().max(50).optional(),
  status: z.enum(["open", "closed", "resolved", "settled", "canceled", "cancelled"]).optional(),
  winningOutcome: z.enum(["yes", "no", "YES", "NO"]).optional(),
  yesPoolSol: z.number().min(0).optional(),
  noPoolSol: z.number().min(0).optional(),
  yesPoolLamports: z.number().min(0).optional(),
  noPoolLamports: z.number().min(0).optional(),
  yesSupply: z.number().min(0).optional(),
  noSupply: z.number().min(0).optional(),
  endTs: z.number().min(0).optional(),
  resolveTs: z.number().min(0).optional(),
});

export const analyzeMarketSchema = z.object({
  question: z.string().min(1).max(500),
  description: z.string().max(2000).optional(),
  yesProb: z.number().min(0).max(100),
  noProb: z.number().min(0).max(100),
  yesPool: z.number().min(0).optional(),
  noPool: z.number().min(0).optional(),
  category: z.string().max(50).optional(),
  marketPubkey: z.string().max(64).optional(),
});

export const positionsGetSchema = z.object({
  wallet: walletSchema,
});
