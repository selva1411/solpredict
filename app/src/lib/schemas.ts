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
  parentId: z.number().int().positive().optional(),
});

export const syncTradeSchema = z.object({
  signature: signatureSchema.optional(),
  marketPubkey: publicKeySchema,
  trader: walletSchema,
  side: z.enum(["YES", "NO"]),
  lamportsIn: z.number().min(0),
  tokensOut: z.number().min(0),
  pricePerToken: z.number().min(0).optional(),
  yesPoolSol: z.number().min(0).optional(),
  noPoolSol: z.number().min(0).optional(),
  yesPct: z.number().min(0).max(100).optional(),
});

export const syncMarketSchema = z.object({
  marketPubkey: publicKeySchema,
  marketId: z.number().int().optional(),
  question: z.string().min(1).max(500),
  description: z.string().max(2000).optional(),
  category: z.string().max(50).optional(),
  status: z.enum(["open", "closed", "resolved", "settled", "canceled"]).optional(),
  winningOutcome: z.string().max(10).optional(),
  yesPoolSol: z.number().min(0).optional(),
  noPoolSol: z.number().min(0).optional(),
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
});

export const positionsGetSchema = z.object({
  wallet: walletSchema,
});
