// Type-safe decoders for Anchor account fields.
// Replaces `(acct as any).field` patterns across the codebase.

import { PublicKey } from "@solana/web3.js";

function toNum(v: unknown): number {
  if (v === null || v === undefined) return 0;
  if (typeof v === "number") return v;
  if (typeof v === "bigint") return Number(v);
  if (typeof (v as any).toNumber === "function") return (v as any).toNumber();
  if (typeof (v as any).toString === "function") return Number((v as any).toString());
  return Number(v);
}

function toStr(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "string") return v;
  if (typeof (v as any).toString === "function") return (v as any).toString();
  return String(v);
}

function toPubkey(v: unknown): PublicKey {
  if (v instanceof PublicKey) return v;
  return new PublicKey(toStr(v));
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
    category: toNum(a.category),
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