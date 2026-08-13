import { getDb } from "@/lib/db/client";
import {
  marketsCache,
  trades,
  users,
  priceHistory,
  notifications,
  positions,
  marketOutcomes,
  orders,
  liquidityPositions,
  disputes,
  rewards,
  treasuryLedger,
  platformConfig,
  indexerCursor,
} from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";
import { logger } from "@/lib/logger";
import { revalidateTag } from "@/lib/cache-control";
import { invalidatePlatformStats } from "@/lib/data/platform";
import { invalidateMarketList } from "@/lib/data/markets";

// ---------------------------------------------------------------------------
// Event types — one per on-chain event
// ---------------------------------------------------------------------------

export interface MarketEvent {
  type: "market";
  marketPubkey: string;
  marketId: number;
  creator?: string;
  question?: string;
  description?: string;
  category?: string;
  status?: string;
  winningOutcome?: string;
  oracleFeedId?: string;
  yesPoolLamports?: number;
  noPoolLamports?: number;
  yesSupply?: number;
  noSupply?: number;
  feeCollectedLamports?: number;
  totalPayoutPoolLamports?: number;
  feeBps?: number;
  endTs?: number;
  resolveTs?: number;
  settledAt?: number;
}

export interface TradeEvent {
  type: "trade";
  signature: string;
  marketPubkey: string;
  trader: string;
  side: "YES" | "NO";
  outcomeIndex?: number;
  lamportsIn: number;
  tokensOut: number;
  pricePerToken?: number;
  feePaidLamports?: number;
  blockTime?: number;
  slot?: number;
  // Real on-chain snapshot AFTER the trade (lamports/supply). Written so the
  // DB cache reflects the same pools the detail page reads from chain.
  yesPoolLamports?: number;
  noPoolLamports?: number;
  yesSupply?: number;
  noSupply?: number;
  yesPoolSol?: number;
  noPoolSol?: number;
  yesPct?: number;
}

export interface SettleEvent {
  type: "settle";
  marketPubkey: string;
  winningOutcome: "yes" | "no" | "cancel";
  settledPrice?: number;
  totalPayoutPool?: number;
  settledAt?: number;
}

export interface ProposalEvent {
  type: "proposal";
  proposalPubkey: string;
  proposer: string;
  question: string;
  description?: string;
  category?: string;
  bondLamports: number;
  status: string;
}

export interface DisputeEvent {
  type: "dispute";
  marketPubkey: string;
  disputer: string;
  claimedOutcome?: string;
  evidenceUrl?: string;
  bondLamports?: number;
  status: string;
}

export interface LiquidityEvent {
  type: "liquidity_added" | "liquidity_removed";
  signature: string;
  marketPubkey: string;
  provider: string;
  yesLamports: number;
  noLamports: number;
  lpTokensMinted?: number;
  lpTokensBurned?: number;
  /** Resulting on-chain pool reserves after the deposit/withdraw (lamports). */
  yesPoolLamports?: number;
  noPoolLamports?: number;
}

export interface OrderEvent {
  type: "order_placed" | "order_filled" | "order_cancelled";
  pubkey: string;
  marketPubkey: string;
  owner: string;
  side: string;
  priceBps: number;
  size: number;
  filled?: number;
}

export interface RewardClaimedEvent {
  type: "reward_claimed";
  signature: string;
  marketPubkey: string;
  claimer: string;
  payout: number;
}

export interface RefundClaimedEvent {
  type: "refund_claimed";
  signature: string;
  marketPubkey: string;
  user: string;
  refund: number;
}

export interface FeesWithdrawnEvent {
  type: "fees_withdrawn";
  signature: string;
  marketPubkey: string;
  amount: number;
}

export interface EmergencyPauseEvent {
  type: "emergency_pause";
  paused: boolean;
  pausedBy: string;
  timestamp: number;
}

export interface EmergencyWithdrawEvent {
  type: "emergency_withdraw";
  signature: string;
  marketPubkey: string;
  admin: string;
  amount: number;
}

export interface RentReclaimedEvent {
  type: "rent_reclaimed";
  signature: string;
  marketPubkey: string;
  creator: string;
  lamports: number;
}

export type IndexerEvent =
  | MarketEvent
  | TradeEvent
  | SettleEvent
  | ProposalEvent
  | DisputeEvent
  | LiquidityEvent
  | OrderEvent
  | RewardClaimedEvent
  | RefundClaimedEvent
  | FeesWithdrawnEvent
  | EmergencyPauseEvent
  | EmergencyWithdrawEvent
  | RentReclaimedEvent;

// ---------------------------------------------------------------------------
// Normalization helpers
// ---------------------------------------------------------------------------

export function normalizeStatus(status?: string): string | undefined {
  if (!status) return undefined;
  const s = status.toLowerCase();
  if (s === "closed" || s === "resolved") return "settled";
  if (s === "canceled" || s === "cancelled") return "cancelled";
  return s;
}

export function normalizeOutcome(outcome?: string): string | undefined {
  if (!outcome) return undefined;
  const o = outcome.toLowerCase();
  if (o === "cancel" || o === "cancelled") return "cancelled";
  return o === "yes" || o === "no" ? o : undefined;
}

import { probabilityYesBps, DEFAULT_B } from "@/lib/amm/lmsr";

/**
 * Effective per-token price (SOL per share) for a trade.
 *
 * lamportsIn/tokensOut are signed (negative for sells). When pricePerToken is
 * not supplied (the frontend sync path), fall back to |lamportsIn|/|tokensOut|
 * so the computed avgPriceBps is correct for BOTH buys and sells.
 */
export function effectiveTradePrice(
  ev: Pick<TradeEvent, "pricePerToken" | "lamportsIn" | "tokensOut">
): number {
  if (ev.pricePerToken !== undefined && ev.pricePerToken > 0) return ev.pricePerToken;
  if (ev.lamportsIn === 0 || ev.tokensOut === 0) return 0;
  return Math.abs(ev.lamportsIn) / 1e9 / Math.abs(ev.tokensOut);
}

// ---------------------------------------------------------------------------
// Event handlers — each idempotent
// ---------------------------------------------------------------------------

export async function applyMarketEvent(ev: MarketEvent): Promise<void> {
  const db = getDb();
  if (!db) return;
  try {
    const status = normalizeStatus(ev.status) ?? "open";
    const outcome = normalizeOutcome(ev.winningOutcome);

    await db.insert(marketsCache).values({
      marketPubkey: ev.marketPubkey,
      marketId: ev.marketId ?? 0,
      creator: ev.creator,
      question: ev.question ?? "Untitled market",
      description: ev.description ?? "",
      category: ev.category ?? "Crypto",
      oracleFeedId: ev.oracleFeedId,
      status,
      winningOutcome: outcome,
      feeCollectedLamports: ev.feeCollectedLamports ?? 0,
      totalPayoutPoolLamports: ev.totalPayoutPoolLamports ?? 0,
      feeBps: ev.feeBps,
      // Pools/supply are REAL on-chain snapshots (undefined values are skipped
      // by drizzle, so absent fields never clobber existing rows).
      yesPoolLamports: ev.yesPoolLamports,
      noPoolLamports: ev.noPoolLamports,
      yesSupply: ev.yesSupply,
      noSupply: ev.noSupply,
      // Volume is trade activity only — never seeded from pool size.
      totalVolume: "0",
      settledAt: ev.settledAt ? new Date(ev.settledAt * 1000) : undefined,
      endTs: ev.endTs ? new Date(ev.endTs * 1000) : new Date(Date.now() + 3600000),
      resolveTs: ev.resolveTs ? new Date(ev.resolveTs * 1000) : new Date(Date.now() + 7200000),
      updatedAt: new Date(),
    }).onConflictDoUpdate({
      target: marketsCache.marketPubkey,
      set: {
        question: ev.question,
        description: ev.description,
        category: ev.category,
        creator: ev.creator,
        oracleFeedId: ev.oracleFeedId,
        status,
        winningOutcome: outcome,
        feeCollectedLamports: ev.feeCollectedLamports,
        totalPayoutPoolLamports: ev.totalPayoutPoolLamports,
        feeBps: ev.feeBps,
        yesPoolLamports: ev.yesPoolLamports,
        noPoolLamports: ev.noPoolLamports,
        yesSupply: ev.yesSupply,
        noSupply: ev.noSupply,
        settledAt: ev.settledAt ? new Date(ev.settledAt * 1000) : undefined,
        updatedAt: new Date(),
      },
    });

    // Mark price: pool-ratio when real pool reserves are present (matches the
    // detail page's AMM view and the trade/LP paths), else LMSR from supply.
    let yesPriceBps: number;
    if (
      typeof ev.yesPoolLamports === "number" &&
      typeof ev.noPoolLamports === "number"
    ) {
      const pTotal = Number(ev.yesPoolLamports) + Number(ev.noPoolLamports);
      yesPriceBps = pTotal > 0 ? Math.round((Number(ev.yesPoolLamports) / pTotal) * 10000) : 5000;
    } else {
      yesPriceBps = probabilityYesBps(
        DEFAULT_B,
        BigInt(ev.yesSupply ?? 0),
        BigInt(ev.noSupply ?? 0)
      );
    }

    await db.insert(marketOutcomes).values({
      marketPubkey: ev.marketPubkey,
      outcomeIndex: 0,
      label: "YES",
      sharesOutstanding: ev.yesSupply ?? 0,
      lastPriceBps: yesPriceBps,
    }).onConflictDoUpdate({
      target: [marketOutcomes.marketPubkey, marketOutcomes.outcomeIndex],
      set: {
        sharesOutstanding: ev.yesSupply ?? 0,
        lastPriceBps: yesPriceBps,
      },
    });

    await db.insert(marketOutcomes).values({
      marketPubkey: ev.marketPubkey,
      outcomeIndex: 1,
      label: "NO",
      sharesOutstanding: ev.noSupply ?? 0,
      lastPriceBps: 10000 - yesPriceBps,
    }).onConflictDoUpdate({
      target: [marketOutcomes.marketPubkey, marketOutcomes.outcomeIndex],
      set: {
        sharesOutstanding: ev.noSupply ?? 0,
        lastPriceBps: 10000 - yesPriceBps,
      },
    });

    revalidateTag("markets");
    invalidateMarketList();
  } catch (e) {
    logger.warn("applyMarketEvent failed:", e);
  }
}

export async function applyTradeEvent(ev: TradeEvent): Promise<void> {
  const db = getDb();
  if (!db) return;
  try {
    const price = effectiveTradePrice(ev);

    // Idempotency guard: insert the trade row ONCE per signature. If the row
    // already exists (replay / repeated reconcile pass), skip ALL downstream
    // accumulation — otherwise positions, volume and user stats get inflated
    // every time a duplicate event is processed.
    const inserted = await db.insert(trades).values({
      signature: ev.signature,
      marketPubkey: ev.marketPubkey,
      outcomeIndex: ev.outcomeIndex ?? (ev.side === "YES" ? 0 : 1),
      trader: ev.trader,
      side: ev.side,
      shares: ev.tokensOut,
      cost: ev.lamportsIn,
      avgPriceBps: Math.round(price * 10000),
      lamportsIn: ev.lamportsIn,
      tokensOut: ev.tokensOut,
      pricePerToken: price.toString(),
      feePaidLamports: ev.feePaidLamports ?? 0,
      blockTime: ev.blockTime ? new Date(ev.blockTime * 1000) : new Date(),
      slot: ev.slot ?? 0,
    }).onConflictDoNothing().returning({ signature: trades.signature });

    if (inserted.length === 0) {
      // Duplicate event — already fully applied on a previous pass. Do not
      // re-accumulate positions/volume (would double-count).
      return;
    }

    // Ensure user record exists
    const solVolume = Math.abs(ev.lamportsIn || 0) / 1e9;
    await db.insert(users).values({
      wallet: ev.trader,
      lastActive: new Date(),
    }).onConflictDoUpdate({
      target: users.wallet,
      set: {
        lastActive: new Date(),
      },
    });

    // Update position
    const outcomeIndex = ev.outcomeIndex ?? (ev.side === "YES" ? 0 : 1);
    await db.insert(positions).values({
      wallet: ev.trader,
      marketPubkey: ev.marketPubkey,
      outcomeIndex,
      shares: ev.tokensOut,
      costBasis: ev.lamportsIn,
    }).onConflictDoUpdate({
      target: [positions.wallet, positions.marketPubkey, positions.outcomeIndex],
      set: {
        shares: sql`${positions.shares} + ${ev.tokensOut}`,
        costBasis: sql`${positions.costBasis} + ${ev.lamportsIn}`,
        updatedAt: new Date(),
      },
    });

    // Update market volume + pool/supply snapshots. Pool values are REAL
    // on-chain reads passed by the caller; only present keys are written.
    const marketSet: Record<string, unknown> = {
      totalVolume: sql`COALESCE(CAST(${marketsCache.totalVolume} AS NUMERIC), 0) + ${solVolume}`,
      updatedAt: new Date(),
    };
    if (typeof ev.yesPoolLamports === "number") marketSet.yesPoolLamports = ev.yesPoolLamports;
    if (typeof ev.noPoolLamports === "number") marketSet.noPoolLamports = ev.noPoolLamports;
    if (typeof ev.yesSupply === "number") marketSet.yesSupply = ev.yesSupply;
    if (typeof ev.noSupply === "number") marketSet.noSupply = ev.noSupply;
    await db.update(marketsCache).set(marketSet as any).where(eq(marketsCache.marketPubkey, ev.marketPubkey));

    // Price history snapshot
    const priceBpsVal = Math.round(price * 10000);
    await db.insert(priceHistory).values({
      marketPubkey: ev.marketPubkey,
      outcomeIndex,
      timestamp: new Date(),
      priceBps: priceBpsVal,
      volume: solVolume.toString(),
    });

    // Refresh the market_outcomes mark prices from the REAL post-trade pool
    // reserves (mirrors the AMM view the detail page shows). This table was
    // previously only written on market creation, so positions/leaderboard
    // consumers read frozen listing prices forever. Only written when real
    // pool snapshots are supplied (the frontend sync path always does).
    if (typeof ev.yesPoolLamports === "number" && typeof ev.noPoolLamports === "number") {
      const pYes = ev.yesPoolLamports;
      const pNo = ev.noPoolLamports;
      const pTotal = pYes + pNo;
      const yesPriceBps = pTotal > 0 ? Math.round((pYes / pTotal) * 10000) : 5000;
      await db.insert(marketOutcomes).values({
        marketPubkey: ev.marketPubkey,
        outcomeIndex: 0,
        label: "YES",
        sharesOutstanding: ev.yesSupply ?? 0,
        lastPriceBps: yesPriceBps,
      }).onConflictDoUpdate({
        target: [marketOutcomes.marketPubkey, marketOutcomes.outcomeIndex],
        set: { sharesOutstanding: ev.yesSupply ?? 0, lastPriceBps: yesPriceBps },
      });
      await db.insert(marketOutcomes).values({
        marketPubkey: ev.marketPubkey,
        outcomeIndex: 1,
        label: "NO",
        sharesOutstanding: ev.noSupply ?? 0,
        lastPriceBps: 10000 - yesPriceBps,
      }).onConflictDoUpdate({
        target: [marketOutcomes.marketPubkey, marketOutcomes.outcomeIndex],
        set: { sharesOutstanding: ev.noSupply ?? 0, lastPriceBps: 10000 - yesPriceBps },
      });
    }

    revalidateTag("markets");
    invalidateMarketList();
    invalidatePlatformStats();
  } catch (e) {
    logger.warn("applyTradeEvent failed:", e);
  }
}

export async function applySettleEvent(ev: SettleEvent): Promise<void> {
  const db = getDb();
  if (!db) return;
  try {
    const status = ev.winningOutcome === "cancel" ? "cancelled" : "settled";
    const outcome = ev.winningOutcome === "cancel" ? undefined : ev.winningOutcome;

    await db.update(marketsCache).set({
      status,
      winningOutcome: outcome,
      settledAt: ev.settledAt ? new Date(ev.settledAt * 1000) : new Date(),
      totalPayoutPoolLamports: ev.totalPayoutPool ?? 0,
      updatedAt: new Date(),
    }).where(eq(marketsCache.marketPubkey, ev.marketPubkey));

    // Notify all traders who touched the market
    try {
      const traders = await db.select({ wallet: trades.trader })
        .from(trades)
        .where(eq(trades.marketPubkey, ev.marketPubkey));
      const unique = [...new Set(traders.map((t) => t.wallet))];
      for (const wallet of unique) {
        await db.insert(notifications).values({
          wallet,
          type: status === "settled" ? "settlement" : "expiry",
          marketPubkey: ev.marketPubkey,
          message: status === "settled"
            ? `Market settled. ${ev.winningOutcome.toUpperCase()} won.`
            : "Market was canceled. Refunds available.",
          read: false,
        }).onConflictDoNothing();
      }
    } catch { /* notification failures are non-critical */ }
    revalidateTag("markets");
    invalidateMarketList();
  } catch (e) {
    logger.warn("applySettleEvent failed:", e);
  }
}

export async function applyLiquidityEvent(ev: LiquidityEvent): Promise<void> {
  const db = getDb();
  if (!db) return;
  try {
    const deposited = ((ev.yesLamports + ev.noLamports) / 1e9).toString();
    const lpTokens = ev.lpTokensMinted ?? ev.lpTokensBurned ?? 0;
    const isAdd = ev.type === "liquidity_added";

    await db.insert(liquidityPositions).values({
      wallet: ev.provider,
      marketPubkey: ev.marketPubkey,
      lpShares: lpTokens,
      deposited,
    }).onConflictDoUpdate({
      target: [liquidityPositions.wallet, liquidityPositions.marketPubkey],
      set: {
        lpShares: isAdd
          ? sql`COALESCE(${liquidityPositions.lpShares}, 0) + ${lpTokens}`
          : sql`GREATEST(COALESCE(${liquidityPositions.lpShares}, 0) - ${lpTokens}, 0)`,
        deposited: isAdd
          ? sql`COALESCE(CAST(${liquidityPositions.deposited} AS NUMERIC), 0) + ${deposited}`
          : sql`GREATEST(COALESCE(CAST(${liquidityPositions.deposited} AS NUMERIC), 0) - ${deposited}, 0)`,
        updatedAt: new Date(),
      },
    });

    // Ensure user exists
    await db.insert(users).values({
      wallet: ev.provider,
      lastActive: new Date(),
    }).onConflictDoUpdate({
      target: users.wallet,
      set: { lastActive: new Date() },
    });

    // Mirror the resulting pool reserves on the market row so list pages show
    // the same numbers as the detail page immediately after an LP deposit.
    let yesLp = ev.yesPoolLamports;
    let noLp = ev.noPoolLamports;
    if (typeof yesLp !== "number" || typeof noLp !== "number") {
      const row = await db
        .select({ yes: marketsCache.yesPoolLamports, no: marketsCache.noPoolLamports })
        .from(marketsCache)
        .where(eq(marketsCache.marketPubkey, ev.marketPubkey))
        .limit(1);
      yesLp = typeof ev.yesPoolLamports === "number" ? ev.yesPoolLamports : Number(row[0]?.yes ?? 0) + ev.yesLamports;
      noLp = typeof ev.noPoolLamports === "number" ? ev.noPoolLamports : Number(row[0]?.no ?? 0) + ev.noLamports;
    }
    await db.update(marketsCache).set({
      yesPoolLamports: Math.round(yesLp),
      noPoolLamports: Math.round(noLp),
      updatedAt: new Date(),
    }).where(eq(marketsCache.marketPubkey, ev.marketPubkey));

    // Refresh the market_outcomes mark prices from the resulting pool reserves
    // so positions/leaderboard consumers revalue exactly like the detail page.
    // Carry the real supply through (never clobber it with 0).
    const supplyRow = await db
      .select({ yes: marketsCache.yesSupply, no: marketsCache.noSupply })
      .from(marketsCache)
      .where(eq(marketsCache.marketPubkey, ev.marketPubkey))
      .limit(1);
    const yesSupplyVal = Number(supplyRow[0]?.yes ?? 0);
    const noSupplyVal = Number(supplyRow[0]?.no ?? 0);
    const pTotal = Number(yesLp) + Number(noLp);
    const yesPriceBps = pTotal > 0 ? Math.round((Number(yesLp) / pTotal) * 10000) : 5000;
    await db.insert(marketOutcomes).values({
      marketPubkey: ev.marketPubkey,
      outcomeIndex: 0,
      label: "YES",
      sharesOutstanding: yesSupplyVal,
      lastPriceBps: yesPriceBps,
    }).onConflictDoUpdate({
      target: [marketOutcomes.marketPubkey, marketOutcomes.outcomeIndex],
      set: { sharesOutstanding: yesSupplyVal, lastPriceBps: yesPriceBps },
    });
    await db.insert(marketOutcomes).values({
      marketPubkey: ev.marketPubkey,
      outcomeIndex: 1,
      label: "NO",
      sharesOutstanding: noSupplyVal,
      lastPriceBps: 10000 - yesPriceBps,
    }).onConflictDoUpdate({
      target: [marketOutcomes.marketPubkey, marketOutcomes.outcomeIndex],
      set: { sharesOutstanding: noSupplyVal, lastPriceBps: 10000 - yesPriceBps },
    });

    revalidateTag("markets");
    invalidateMarketList();
  } catch (e) {
    logger.warn("applyLiquidityEvent failed:", e);
  }
}

export async function applyOrderEvent(ev: OrderEvent): Promise<void> {
  const db = getDb();
  if (!db) return;
  try {
    const statusMap: Record<string, string> = {
      order_placed: "open",
      order_filled: "filled",
      order_cancelled: "cancelled",
    };
    await db.insert(orders).values({
      pubkey: ev.pubkey,
      marketPubkey: ev.marketPubkey,
      owner: ev.owner,
      side: ev.side,
      priceBps: ev.priceBps,
      size: ev.size,
      filled: ev.filled ?? 0,
      status: statusMap[ev.type] ?? "open",
    }).onConflictDoUpdate({
      target: orders.pubkey,
      set: {
        filled: ev.filled ?? 0,
        status: statusMap[ev.type] ?? "open",
      },
    });
  } catch (e) {
    logger.warn("applyOrderEvent failed:", e);
  }
}

export async function applyRewardClaimedEvent(ev: RewardClaimedEvent): Promise<void> {
  const db = getDb();
  if (!db) return;
  try {
    // Record in treasury ledger
    await db.insert(treasuryLedger).values({
      signature: ev.signature,
      direction: "out",
      kind: "fee",
      amount: ev.payout,
      marketPubkey: ev.marketPubkey,
      actor: ev.claimer,
    });
  } catch (e) {
    logger.warn("applyRewardClaimedEvent failed:", e);
  }
}

export async function applyFeesWithdrawnEvent(ev: FeesWithdrawnEvent): Promise<void> {
  const db = getDb();
  if (!db) return;
  try {
    await db.insert(treasuryLedger).values({
      signature: ev.signature,
      direction: "out",
      kind: "withdrawal",
      amount: ev.amount,
      marketPubkey: ev.marketPubkey,
    });
  } catch (e) {
    logger.warn("applyFeesWithdrawnEvent failed:", e);
  }
}

export async function applyEmergencyPauseEvent(ev: EmergencyPauseEvent): Promise<void> {
  const db = getDb();
  if (!db) return;
  try {
    // Update platform_config
    await db.insert(platformConfig).values({
      paused: ev.paused,
      pauseReason: ev.paused ? "Emergency pause" : undefined,
    }).onConflictDoUpdate({
      target: platformConfig.id,
      set: {
        paused: ev.paused,
        pauseReason: ev.paused ? "Emergency pause" : null,
        updatedAt: new Date(),
      },
    });
  } catch (e) {
    logger.warn("applyEmergencyPauseEvent failed:", e);
  }
}

export async function applyEmergencyWithdrawEvent(ev: EmergencyWithdrawEvent): Promise<void> {
  const db = getDb();
  if (!db) return;
  try {
    await db.insert(treasuryLedger).values({
      signature: ev.signature,
      direction: "out",
      kind: "emergency_withdraw",
      amount: ev.amount,
      marketPubkey: ev.marketPubkey,
      actor: ev.admin,
    });
  } catch (e) {
    logger.warn("applyEmergencyWithdrawEvent failed:", e);
  }
}

export async function applyRentReclaimedEvent(ev: RentReclaimedEvent): Promise<void> {
  const db = getDb();
  if (!db) return;
  try {
    await db.update(marketsCache).set({
      rentReclaimedAt: new Date(),
      updatedAt: new Date(),
    }).where(eq(marketsCache.marketPubkey, ev.marketPubkey));
  } catch (e) {
    logger.warn("applyRentReclaimedEvent failed:", e);
  }
}

// ---------------------------------------------------------------------------
// Cursor management
// ---------------------------------------------------------------------------

export async function saveCursor(signature: string, slot: number): Promise<void> {
  const db = getDb();
  if (!db) return;
  try {
    // Upsert: always update the single cursor row
    const existing = await db.select().from(indexerCursor).limit(1);
    if (existing.length === 0) {
      await db.insert(indexerCursor).values({
        lastSignature: signature,
        lastSlot: slot,
        updatedAt: new Date(),
      });
    } else {
      await db.update(indexerCursor).set({
        lastSignature: signature,
        lastSlot: slot,
        updatedAt: new Date(),
      }).where(eq(indexerCursor.id, existing[0].id));
    }
  } catch (e) {
    logger.warn("saveCursor failed:", e);
  }
}

export async function getCursor(): Promise<{ lastSignature: string | null; lastSlot: number | null } | null> {
  const db = getDb();
  if (!db) return null;
  try {
    const rows = await db.select().from(indexerCursor).limit(1);
    if (rows.length === 0) return null;
    return {
      lastSignature: rows[0].lastSignature,
      lastSlot: rows[0].lastSlot,
    };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Main dispatcher — single switch, idempotent
// ---------------------------------------------------------------------------

export async function applyEvent(ev: IndexerEvent): Promise<void> {
  switch (ev.type) {
    case "market":
      return applyMarketEvent(ev);
    case "trade":
      return applyTradeEvent(ev);
    case "settle":
      return applySettleEvent(ev);
    case "liquidity_added":
    case "liquidity_removed":
      return applyLiquidityEvent(ev);
    case "order_placed":
    case "order_filled":
    case "order_cancelled":
      return applyOrderEvent(ev);
    case "reward_claimed":
      return applyRewardClaimedEvent(ev);
    case "refund_claimed":
      // Refund is just a special case of reward claimed
      return;
    case "fees_withdrawn":
      return applyFeesWithdrawnEvent(ev);
    case "emergency_pause":
      return applyEmergencyPauseEvent(ev);
    case "emergency_withdraw":
      return applyEmergencyWithdrawEvent(ev);
    case "rent_reclaimed":
      return applyRentReclaimedEvent(ev);
    default:
      return;
  }
}
