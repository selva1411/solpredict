// Type-safe decoders for Anchor account fields.
// Replaces `(acct as any).field` patterns across the codebase.

import { PublicKey } from "@solana/web3.js";

interface BNLike { toNumber(): number; toString(): string }

function isBNLike(v: unknown): v is BNLike {
  return typeof v === "object" && v !== null && typeof (v as Record<string, unknown>).toNumber === "function";
}

function toNum(v: unknown): number {
  if (v === null || v === undefined) return 0;
  if (typeof v === "number") return v;
  if (typeof v === "bigint") return Number(v);
  if (isBNLike(v)) return v.toNumber();
  return Number(v);
}

function toStr(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "string") return v;
  return String(v);
}

function toPubkey(v: unknown): PublicKey {
  if (v instanceof PublicKey) return v;
  return new PublicKey(toStr(v));
}

function toCategory(v: unknown): number {
  if (typeof v === "number") return v;
  if (v === null || v === undefined) return 4;
  const obj = v as Record<string, unknown>;
  if (typeof obj === "object") {
    if (obj.crypto !== undefined || obj.Crypto !== undefined) return 0;
    if (obj.sports !== undefined || obj.Sports !== undefined) return 1;
    if (obj.politics !== undefined || obj.Politics !== undefined) return 2;
    if (obj.tech !== undefined || obj.Tech !== undefined) return 3;
    if (obj.other !== undefined || obj.Other !== undefined) return 4;
  }
  return 4;
}

export interface TypedMarketAccount {
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
}

export function decodeMarket(acct: unknown): TypedMarketAccount {
  const a = acct as Record<string, unknown>;

  const statusObj = a.status as Record<string, unknown> | undefined;
  const statusNum =
    statusObj?.open !== undefined ? 0 :
    statusObj?.settled !== undefined ? 1 :
    statusObj?.cancelled !== undefined ? 2 : 0;

  const outcomeObj = a.winningOutcome as Record<string, unknown> | undefined;
  const outcomeNum =
    outcomeObj?.unset !== undefined ? 0 :
    outcomeObj?.yes !== undefined ? 1 :
    outcomeObj?.no !== undefined ? 2 : 0;

  return {
    marketId: toNum(a.marketId),
    authority: toPubkey(a.authority),
    question: toStr(a.question),
    description: toStr(a.description),
    category: toCategory(a.category),
    oracleFeedId: (a.oracleFeedId as number[]) ?? [],
    targetPrice: toNum(a.targetPrice),
    targetExpo: toNum(a.targetExpo),
    comparison: toNum(a.comparison),
    endTs: toNum(a.endTs),
    resolveTs: toNum(a.resolveTs),
    status: statusNum,
    winningOutcome: outcomeNum,
    yesMint: toPubkey(a.yesMint),
    noMint: toPubkey(a.noMint),
    yesPoolLamports: toNum(a.yesPoolLamports),
    noPoolLamports: toNum(a.noPoolLamports),
    yesSupply: toNum(a.yesSupply),
    noSupply: toNum(a.noSupply),
    totalPayoutPool: toNum(a.totalPayoutPool),
    feeCollected: toNum(a.feeCollected),
    feeWithdrawn: Boolean(a.feeWithdrawn),
    totalClaimed: toNum(a.totalClaimed),
    settledPrice: toNum(a.settledPrice),
    settledExpo: toNum(a.settledExpo),
    settledAt: toNum(a.settledAt),
    sharePriceLamports: toNum(a.sharePriceLamports),
    bump: toNum(a.bump),
    treasuryBump: toNum(a.treasuryBump),
  };
}

export interface TypedPositionAccount {
  owner: PublicKey;
  market: PublicKey;
  yesAmount: number;
  noAmount: number;
  totalSpentLamports: number;
  claimed: boolean;
  bump: number;
}

export function decodePosition(acct: unknown): TypedPositionAccount {
  const a = acct as Record<string, unknown>;
  return {
    owner: toPubkey(a.owner),
    market: toPubkey(a.market),
    yesAmount: toNum(a.yesAmount),
    noAmount: toNum(a.noAmount),
    totalSpentLamports: toNum(a.totalSpentLamports),
    claimed: Boolean(a.claimed),
    bump: toNum(a.bump),
  };
}