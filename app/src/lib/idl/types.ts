// TODO Phase 2 — Regenerate after anchor build
// Types derived from the Anchor IDL through the generated TS type.
// Use the program.account.<name>.fetch() pattern from @coral-xyz/anchor.

export type MarketAccount = {
  marketId: { toString: () => string };
  question: string;
  description: string;
  category: number;
  oracleFeedId: number[];
  targetPrice: { toString: () => string };
  targetExpo: number;
  comparison: number;
  endTs: { toString: () => string };
  resolveTs: { toString: () => string };
  status: object;
  winningOutcome: object;
  yesPoolLamports: { toString: () => string };
  noPoolLamports: { toString: () => string };
  yesSupply: { toString: () => string };
  noSupply: { toString: () => string };
  feeCollected: { toString: () => string };
  totalPayoutPool: { toString: () => string };
  totalClaimed: { toString: () => string };
  settledPrice: { toString: () => string };
  sharePriceLamports: { toString: () => string };
  questionAsked: { toString: () => string };
  [key: string]: unknown;
};

export type OrderAccount = Record<string, unknown>;
export type PositionAccount = Record<string, unknown>;
export type ConfigAccount = Record<string, unknown>;

export type MarketProposalAccount = {
  proposalId: { toString: () => string };
  proposer: string;
  question: string;
  description: string;
  category: number;
  oracleFeedId: number[];
  targetPrice: { toString: () => string };
  targetExpo: number;
  comparison: number;
  endTs: { toString: () => string };
  resolveTs: { toString: () => string };
  sharePriceLamports: { toString: () => string };
  bondLamports: { toString: () => string };
  status: object;
  createdAt: { toString: () => string };
  [key: string]: unknown;
};