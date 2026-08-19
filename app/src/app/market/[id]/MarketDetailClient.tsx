"use client";

import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { 
  ArrowLeft, 
  Clock, 
  Coins, 
  TrendingUp, 
  Activity, 
  AlertCircle,
  Award,
  ChevronUp,
  ChevronDown,
  Share2,
  Send,
  Star
} from "lucide-react";
import * as anchor from "@coral-xyz/anchor";
import { EventParser } from "@coral-xyz/anchor";
import { getAssociatedTokenAddressSync, createAssociatedTokenAccountInstruction } from "@solana/spl-token";

import { useProgram } from "@/hooks/useProgram";
import { PublicKey, Transaction, TransactionInstruction } from "@solana/web3.js";
import { getFriendlyErrorMessage } from "@/lib/error-map";
import { lamportsToSol, bnToNum } from "@/lib/format";
import { buyCostLamports, sellRefundLamports as sellRefundFn } from "@/lib/amm/cpmm";
import { lpPreview } from "@/lib/amm/lp";
import { toast } from "sonner";
import { OrderBookDepth } from "@/components/OrderBookDepth";
const LivePriceChartPanel = dynamic(() => import("@/components/LivePriceChartPanel").then(m => m.LivePriceChartPanel), { ssr: false });
import { AiMarketWhisperer } from "@/components/AiMarketWhisperer";
import { MarketComments } from "@/components/MarketComments";
import { RelatedMarkets } from "@/components/RelatedMarkets";
import { getWatchlist, pruneWatchlist, toggleWatchlist, fetchWatchlistFromDb } from "@/lib/watchlist";
import { useQueryClient } from "@tanstack/react-query";
import { keys } from "@/lib/api/keys";
import { getMarketStatusString } from "@/lib/events";
import { getConfigPda, getMarketPda, getYesMintPda, getNoMintPda, getTreasuryPda, getUserPositionPda, getEmergencyPausePda, getOrderEscrowPda } from "@/lib/pda";
import { txAccounts, buildSignSendConfirm } from "@/lib/anchor-utils";
import { FlipCountdown } from "@/components/FlipCountdown";
import { feedIdBytesToHex, isOracleCategory } from "@/lib/pyth-feeds";
import { LivePriceBar } from "@/components/LivePriceBar";
import ProbabilityOrb3D from "@/components/ProbabilityOrb3D";

import { LoadingState, EmptyState, ErrorState, LiveIndicator } from "@/components/StatePanels";
import { GlassPanel } from "@/components/GlassPanel";
import { useDeviceCapability } from "@/hooks/useDeviceCapability";
import { fadeInUp, staggerContainer } from "@/lib/motion-variants";
import { TradingPanel } from "@/components/market/TradingPanel";
import { ActivityFeedSection } from "@/components/market/ActivityFeedSection";
import { TrustSignalsSection } from "@/components/market/TrustSignalsSection";

const CATEGORIES = ["Crypto", "Sports", "Politics", "Tech", "Other"];

interface SharesPurchasedEvent {
  side: { yes?: Record<string, never>; no?: Record<string, never> };
  quantity: anchor.BN;
  cost: anchor.BN;
  buyer: PublicKey;
  newYesPool: anchor.BN;
  newNoPool: anchor.BN;
}

interface MarketSettledEvent {
  winningOutcome: number;
  settledPrice: anchor.BN;
}

interface RewardsClaimedEvent {
  claimer: PublicKey;
  payout: anchor.BN;
}

interface MarketDetails {
  marketId: anchor.BN;
  authority: PublicKey;
  question: string;
  description: string;
  category: number;
  oracleFeedId: number[];
  targetPrice: anchor.BN;
  targetExpo: number;
  comparison: number;
  endTs: anchor.BN;
  resolveTs: anchor.BN;
  status: { open?: Record<string, never>; settled?: Record<string, never>; cancelled?: Record<string, never> };
  winningOutcome: { unset?: Record<string, never>; yes?: Record<string, never>; no?: Record<string, never> };
  yesMint: PublicKey;
  noMint: PublicKey;
  yesPoolLamports: anchor.BN;
  noPoolLamports: anchor.BN;
  yesSupply: anchor.BN;
  noSupply: anchor.BN;
  totalPayoutPool: anchor.BN;
  sharePriceLamports: anchor.BN;
  /** Market-frozen fee (market.fee_bps on-chain / markets_cache.fee_bps). */
  feeBps?: number;
}

interface ActivityItem {
  signature: string;
  slot: number;
  buyer: string;
  side: "YES" | "NO" | "SETTLE" | "CLAIM";
  quantity: number;
  cost: number;
  time: string;
}

/**
 * Convert a DB market row (from /api/markets/[id] / getMarket) into the
 * MarketDetails shape. Used both for the server-prefetch seed and the
 * on-chain-fetch-failed fallback so the two paths render identically.
 */
function dbRowToMarketDetails(row: any): MarketDetails | null {
  if (!row) return null;
  const catIdx = CATEGORIES.indexOf(row.category) >= 0 ? CATEGORIES.indexOf(row.category) : 0;
  const statusObj = row.status === "settled" ? { settled: {} } : row.status === "cancelled" ? { cancelled: {} } : { open: {} };
  const winNorm = (row.winningOutcome || "").toLowerCase();
  const winObj = winNorm === "yes" ? { yes: {} } : winNorm === "no" ? { no: {} } : { unset: {} };
  // Deterministic defaults (no Date.now() — this converter also runs during
  // SSR, and a nondeterministic fallback would cause a hydration mismatch).
  // The indexer always sets endTs, so these are only hit for malformed rows.
  const FALLBACK_END = 4102444800; // 2100-01-01 UTC
  const endTsVal = row.endTs ? Math.floor(new Date(row.endTs).getTime() / 1000) : FALLBACK_END;
  const resolveTsVal = row.resolveTs ? Math.floor(new Date(row.resolveTs).getTime() / 1000) : endTsVal + 3600;
  return {
    marketId: new anchor.BN(row.marketId || 0),
    authority: PublicKey.default,
    question: row.question,
    description: row.description || "",
    category: catIdx,
    oracleFeedId: Array(32).fill(0),
    targetPrice: new anchor.BN(20000),
    targetExpo: -2,
    comparison: 0,
    endTs: new anchor.BN(endTsVal),
    resolveTs: new anchor.BN(resolveTsVal),
    status: statusObj,
    winningOutcome: winObj,
    yesMint: PublicKey.default,
    noMint: PublicKey.default,
    // Real pool/supply snapshots mirrored in markets_cache (migration 0004).
    yesPoolLamports: new anchor.BN(row.yesPoolLamports || 0),
    noPoolLamports: new anchor.BN(row.noPoolLamports || 0),
    yesSupply: new anchor.BN(row.yesSupply || 0),
    noSupply: new anchor.BN(row.noSupply || 0),
    totalPayoutPool: new anchor.BN(0),
    sharePriceLamports: new anchor.BN(0.01 * 1e9),
    feeBps: row.feeBps ?? undefined,
  };
}

function ProbabilityChart({ data }: { data: number[] }) {
  if (data.length <= 1) {
    return (
      <div className="h-32 flex items-center justify-center text-xs font-mono text-ash border border-hairline/20 bg-panel rounded">
        Insufficient activity records for charting.
      </div>
    );
  }

  const width = 500;
  const height = 150;
  const padding = 20;

  const points = data.map((val, idx) => {
    const x = padding + (idx / (data.length - 1)) * (width - padding * 2);
    const y = height - padding - (val / 100) * (height - padding * 2);
    return `${x},${y}`;
  }).join(" ");

  return (
    <div className="w-full bg-panel border border-hairline/30 p-4 rounded space-y-2 select-none">
      <div className="flex justify-between items-center text-[10px] font-mono text-ash uppercase font-bold">
        <span>Probability History Trend</span>
        <span className="text-verdigris">YES %</span>
      </div>
      <div className="relative">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto overflow-visible">
          {/* Y Axis Grid Lines */}
          {[25, 50, 75].map((lvl) => {
            const y = height - padding - (lvl / 100) * (height - padding * 2);
            return (
              <line
                key={lvl}
                x1={padding}
                y1={y}
                x2={width - padding}
                y2={y}
                stroke="#353534"
                strokeWidth="1"
                strokeDasharray="4 4"
              />
            );
          })}
          
          {/* Line Path */}
          <polyline
            fill="none"
            stroke="#FFA500"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            points={points}
          />

          {/* Dots on points */}
          {data.map((val, idx) => {
            const x = padding + (idx / (data.length - 1)) * (width - padding * 2);
            const y = height - padding - (val / 100) * (height - padding * 2);
            return (
              <circle
                key={idx}
                cx={x}
                cy={y}
                r="4"
                className="fill-[#131313] stroke-gold"
                strokeWidth="2"
              />
            );
          })}
        </svg>
      </div>
    </div>
  );
}

const SOL_FEED_ID = "0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d";

/** Parse a route id that is either a market pubkey or a numeric market id. */
function marketPdaFromId(id: string | string[] | undefined): PublicKey | null {
  if (!id || Array.isArray(id)) return null;
  if (id.length >= 32) {
    try {
      return new PublicKey(id);
    } catch {
      return null;
    }
  }
  return null;
}

async function fetchSOLPrice(): Promise<number> {
  // Method 1 — Pyth Hermes (primary)
  try {
    const res = await fetch(
      `https://hermes.pyth.network/v2/updates/price/latest?ids[]=${SOL_FEED_ID}`,
      { cache: 'no-store' }
    );
    if (res.ok) {
      const json = await res.json();
      const p = json.parsed?.[0]?.price;
      if (p?.price && p?.expo !== undefined) {
        const price = Number(p.price) * Math.pow(10, Number(p.expo));
        if (price > 1 && price < 10000) return price;
      }
    }
  } catch { /* fall through */ }

  // Method 2 — CoinGecko (fallback, no API key needed)
  try {
    const res = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd',
      { cache: 'no-store' }
    );
    if (res.ok) {
      const json = await res.json();
      const price = json?.solana?.usd;
      if (price && price > 1) return price;
    }
  } catch { /* fall through */ }

  // Method 3 — Binance public API (second fallback, no key needed)
  try {
    const res = await fetch(
      'https://api.binance.com/api/v3/ticker/price?symbol=SOLUSDT',
      { cache: 'no-store' }
    );
    if (res.ok) {
      const json = await res.json();
      const price = parseFloat(json.price);
      if (price > 1) return price;
    }
  } catch { /* fall through */ }

  return 0;
}

export default function MarketDetailPage({
  initialMarket,
  initialHistory,
}: {
  /** DB market row prefetched server-side — seeds the first paint, no /api/markets/[id] round trip. */
  initialMarket?: any;
  /** Prefetched sparkline history ({yesPct}) so the chart fetch is skipped. */
  initialHistory?: Array<{ yesPct: number }>;
}) {
  const { id } = useParams();
  const router = useRouter();
  const { program, wallet, connection } = useProgram();
  const queryClient = useQueryClient();

  // The server-prefetched market may refer to a different market than the one
  // currently routed (client-side navigation), so only seed when it matches.
  const seedMatches =
    !!initialMarket &&
    (initialMarket.marketPubkey === id ||
      String(initialMarket.marketId) === String(id) ||
      initialMarket.marketPubkey === marketPdaFromId(id)?.toBase58());

  const [notFound, setNotFound] = useState(false);
  const [market, setMarket] = useState<MarketDetails | null>(() =>
    seedMatches ? dbRowToMarketDetails(initialMarket) : null
  );
  const [loading, setLoading] = useState<boolean>(!seedMatches);
  const [tradeSide, setTradeSide] = useState<"YES" | "NO">("YES");
  const [quantity, setQuantity] = useState<number>(10);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const activitySigRef = useRef<string>(""); // tracks last top sig to debounce setActivity
  const [successFlip, setSuccessFlip] = useState<boolean>(false);
  const [txState, setTxState] = useState<"idle" | "signing" | "confirming" | "success" | "error">("idle");
  const [txSig, setTxSig] = useState<string | null>(null);
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState<boolean>(false);
  const [isWatched, setIsWatched] = useState<boolean>(false);
  const [showShareOptions, setShowShareOptions] = useState<boolean>(false);
  const [feeBps, setFeeBps] = useState<number | null>(null);
  const [treasuryBalance, setTreasuryBalance] = useState<number>(0);
  const [userYesBalance, setUserYesBalance] = useState<number>(0);
  const [userNoBalance, setUserNoBalance] = useState<number>(0);
  const [sellQuantity, setSellQuantity] = useState<number>(10);
  const [sellSide, setSellSide] = useState<"YES" | "NO">("YES");
  const [showSellSection, setShowSellSection] = useState<boolean>(false);
  const [tradeTab, setTradeTab] = useState<"buy" | "sell" | "liquidity">("buy");
  const [lpOption, setLpOption] = useState<"balanced" | "yes" | "no">("balanced");
  const [lpDepositAmount, setLpDepositAmount] = useState<number>(1.0);
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);
  const [limitPriceSol, setLimitPriceSol] = useState<number>(0.5);
  const [isLimitOrder, setIsLimitOrder] = useState<boolean>(false);
  const [userOrders, setUserOrders] = useState<any[]>([]);
  // DB-backed LP data for THIS market (the same liquidity_positions /
  // lp_pool_stats rows the portfolio page reads), so the LP tab reflects
  // what's actually recorded — not just a deposit form.
  const [userLp, setUserLp] = useState<{
    lpShares: number;
    deposited: string | number;
    feesEarned: string | number;
  } | null>(null);
  const [marketLpStats, setMarketLpStats] = useState<{
    totalLiquiditySol: string | number | null;
    totalLpTokens: number | null;
    feeEarnedSol: string | number | null;
  } | null>(null);

  // Sparkline history — stores probability snapshots. When the server
  // prefetched the DB price history, seed it (no /api/markets/[id] fetch).
  const probHistory = useRef<number[]>(
    initialHistory && initialHistory.length > 1
      ? initialHistory.map((p) => Math.max(1, Math.min(99, Math.round(Number(p.yesPct))))).slice(-30)
      : [50]
  );
  // Ensures the DB price-history seed fetch runs at most once per market view
  // (it previously re-ran inside every fetchMarket: initial load + every
  // post-trade refresh + every account-change fallback, doubling detail-route
  // calls that cost hundreds of ms each on the remote database).
  // When the server prefetched the DB history (even an empty list — the server
  // always queries it), mark it as fetched so the dead-weight /api/markets/[id]
  // fire-and-forget fetch never fires.
  const historyFetchedRef = useRef(initialHistory !== undefined);

  // Determine feed ID for live Pyth price (re-computed on every render from market state)
  const marketCategory = market?.category ?? -1;
  const marketFeedId = market?.oracleFeedId ?? null;
  const feedHex = useMemo(() => {
    if (marketFeedId && isOracleCategory(marketCategory)) {
      const hex = feedIdBytesToHex(marketFeedId);
      const clean = hex ? hex.replace("0x", "") : "";
      if (clean && !/^0+$/.test(clean)) {
        return hex;
      }
      return SOL_FEED_ID;
    }
    return SOL_FEED_ID;
  }, [marketFeedId, marketCategory]);
  // NOTE: usePythPrices is now inside LivePriceBar — no parent re-renders from price ticks
  const marketPda = useMemo(() => {
    try {
      if (id && typeof id === "string" && id.length >= 32) {
        return new PublicKey(id);
      }
    } catch {}
    return PublicKey.default;
  }, [id]);

  // Pre-flight check: warn the user BEFORE sending a doomed transaction.
  // An unfunded wallet makes every system transfer fail with the cryptic
  // "Attempt to debit an account but found no record of a prior credit"
  // runtime error, so surface a friendly message instead.
  const assertSufficientBalance = async (requiredSol: number, action: string): Promise<boolean> => {
    if (!wallet?.publicKey) return true;
    // Fail-open on RPC errors: a transient getBalance failure must not block a
    // funded user. getFriendlyErrorMessage maps the real insufficient-funds
    // runtime error as the safety net if the tx still fails.
    const balLamports = await connection.getBalance(wallet.publicKey).catch(() => null);
    if (balLamports === null) return true;
    const balSol = balLamports / 1e9;
    // Buffer for gas + rent of up to 3 new accounts (2 ATAs + position/LP).
    const bufferSol = 0.02;
    if (balSol < requiredSol + bufferSol) {
      toast.error(
        `Insufficient SOL for ${action}. You have ${balSol.toFixed(4)} SOL but need ~${(requiredSol + bufferSol).toFixed(4)}. ` +
        `Click 'Airdrop SOL' in the header!`
      );
      return false;
    }
    return true;
  };

  // Phantom approval can take longer than the ~60s (150-slot) blockhash
  // lifetime on localnet, so a tx signed after its blockhash expired fails
  // with "Transaction simulation failed: Blockhash not found". Each rpc()
  // call re-fetches getLatestBlockhash, so retrying rebuilds the tx with a
  // fresh blockhash and succeeds. (Anchor's built-in maxRetries resends the
  // SAME raw bytes, so it cannot help here.)
  const isBlockhashError = (e: unknown): boolean => {
    const msg = typeof e === "string" ? e : String((e as { message?: unknown })?.message ?? e);
    return /blockhash/i.test(msg) && /not found|expired|too old|unavailable/i.test(msg);
  };
  const BLOCKHASH_HINT =
    " Blockhash expired — this usually means the Phantom approval took too long, or Phantom is pointed at the wrong network. In Phantom, set Settings → Developer Settings → Custom RPC to http://127.0.0.1:8899, then try again.";
  // Send-first: build + sign + sendRawTransaction returns the signature in one
  // RTT, then confirmation runs in the BACKGROUND. This replaces Anchor's
  // `.rpc()`, which blocks up to 30s waiting for confirmation and throws
  // `TransactionExpiredTimeoutError` even when the tx already landed. Preflight
  // simulation (default in buildSignSendConfirm) still surfaces bad txs fast.
  const sendTxWithBlockhashRetry = async (builder: { transaction(): Promise<Transaction> }): Promise<string> => {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        return await buildSignSendConfirm(program, builder);
      } catch (e: unknown) {
        if (!isBlockhashError(e) || attempt === 1) throw e;
        // buildSignSendConfirm fetches a fresh blockhash on every attempt, so
        // the retry already rebuilds the tx with a valid one. No priming needed.
      }
    }
    throw new Error("unreachable");
  };

  // Fetch this market's LP pool stats + the connected wallet's LP position
  // in this market from the DB (same source as the portfolio page).
  const fetchLpInfo = useCallback(async () => {
    const walletStr = wallet?.publicKey?.toBase58();
    const q = walletStr ? `?wallet=${walletStr}` : "";
    try {
      const res = await fetch(`/api/markets/${marketPda.toBase58()}/liquidity${q}`, { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      if (data?.ok) {
        setMarketLpStats(data.lpPoolStats ?? null);
        setUserLp(data.userLp ?? null);
      }
    } catch { /* non-critical — LP tab degrades to the deposit form */ }
  }, [marketPda, wallet?.publicKey]);

  const fetchUserBalances = async () => {
    if (!wallet?.publicKey) return;
    try {
      const yesMintPda = getYesMintPda(marketPda, program.programId);
      const noMintPda = getNoMintPda(marketPda, program.programId);
      const yesAta = getAssociatedTokenAddressSync(yesMintPda, wallet.publicKey);
      const noAta = getAssociatedTokenAddressSync(noMintPda, wallet.publicKey);
      const [yesAcc, noAcc] = await Promise.all([
        connection.getTokenAccountBalance(yesAta).catch(() => null),
        connection.getTokenAccountBalance(noAta).catch(() => null),
      ]);
      let yesBal = yesAcc ? yesAcc.value.uiAmount ?? 0 : 0;
      let noBal = noAcc ? noAcc.value.uiAmount ?? 0 : 0;

      if (yesBal === 0 || noBal === 0) {
        try {
          const res = await fetch(`/api/user/positions?wallet=${wallet.publicKey.toBase58()}`);
          const data = await res.json();
          if (data.ok && data.positions) {
            const mktPosList = data.positions.filter((p: any) => p.marketPubkey === marketPda.toBase58());
            for (const p of mktPosList) {
              if (p.side === "YES" && yesBal === 0) yesBal = p.shares;
              if (p.side === "NO" && noBal === 0) noBal = p.shares;
            }
          }
        } catch {}
      }

      setUserYesBalance(yesBal);
      setUserNoBalance(noBal);
    } catch (e) {
      console.error("Error fetching user balances:", e);
    }
  };

  const syncMarketToDb = useCallback(async (details: MarketDetails) => {
    try {
      // category may arrive as an enum object (from onAccountChange) or a number
      // (from the proxied account.fetch) — normalize both to a category index.
      const catRaw = details.category as unknown;
      let catIdx: number;
      if (typeof catRaw === "number") {
        catIdx = catRaw;
      } else {
        const c = catRaw as Record<string, unknown> | null;
        catIdx = !c ? 4 : c.crypto !== undefined ? 0 : c.sports !== undefined ? 1 : c.politics !== undefined ? 2 : c.tech !== undefined ? 3 : 4;
      }
      await fetch("/api/sync/market", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          marketPubkey: marketPda.toBase58(),
          marketId: details.marketId.toNumber(),
          question: details.question,
          description: details.description,
          category: CATEGORIES[catIdx] || "Crypto",
          status: details.status.open ? "open" : details.status.settled ? "settled" : "cancelled",
          yesPoolLamports: details.yesPoolLamports.toNumber(),
          noPoolLamports: details.noPoolLamports.toNumber(),
          yesSupply: details.yesSupply.toNumber(),
          noSupply: details.noSupply.toNumber(),
          endTs: details.endTs.toNumber(),
          resolveTs: details.resolveTs.toNumber(),
        }),
      });
    } catch {}
  }, [marketPda]);

  // Poll the on-chain market account until its pools change from the values we
  // had BEFORE the tx. Anchor's default provider commitment is "processed", so
  // rpc() can resolve before the block lands; this guarantees we sync the REAL
  // post-trade state, never a stale pre-trade snapshot.
  // Runs in the BACKGROUND (fire-and-forget) so it can never block the UI.
  const readFreshAccount = async (
    prevYesLamports: number,
    prevNoLamports: number
  ): Promise<MarketDetails | undefined> => {
    for (let i = 0; i < 12; i++) {
      try {
        const acc = await program.account.market.fetch(marketPda) as unknown as MarketDetails;
        const yes = acc.yesPoolLamports.toNumber();
        const no = acc.noPoolLamports.toNumber();
        if (yes !== prevYesLamports || no !== prevNoLamports) return acc;
      } catch {
        /* keep polling */
      }
      await new Promise((r) => setTimeout(r, 250));
    }
    return undefined;
  };

  // Shared post-trade background task: sync the REAL pools to the DB and
  // refresh market/activity views WITHOUT blocking the trade button. Any
  // errors here must not surface as a failed trade (the tx already landed).
  const runPostTradeSync = async (
    sync: () => Promise<void>,
    refresh: () => void
  ) => {
    try {
      await sync();
    } catch {
      /* background sync is best-effort; onAccountChange syncs the DB too */
    }
    try {
      refresh();
    } catch {
      /* ignore */
    }
    // Bust the dashboard/portfolio/leaderboard queries so they revalue the
    // moment the DB sync lands — without waiting for their polling interval.
    try {
      queryClient.invalidateQueries({ queryKey: ["user", "positions"] });
      queryClient.invalidateQueries({ queryKey: keys.markets.list() });
    } catch {
      /* ignore */
    }
    // Push a WS refresh so EVERY connected client (other tabs/sessions, the
    // leaderboard, activity feed, markets list) re-reads fresh DB data
    // immediately — genuine push instead of waiting for a poll.
    try {
      await fetch("/api/realtime/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          wallet: wallet?.publicKey?.toBase58(),
        }),
      });
    } catch {
      /* ws server down; pages fall back to polling */
    }
  };

  const syncTradeToDb = async (
    sig: string,
    side: "YES" | "NO",
    qty: number,
    isBuy: boolean = true,
    fresh?: { yesPoolLamports: number; noPoolLamports: number; yesSupply: number; noSupply: number }
  ) => {
    try {
      const currentYes = Math.max(0.01, yesPool);
      const currentNo = Math.max(0.01, noPool);

      // Mirror on-chain pool accounting: buying YES adds cost to yes_pool_lamports,
      // selling YES subtracts refund from it (buy_shares.rs / sell_shares.rs). The
      // opposite side's pool is untouched on-chain. When `fresh` is supplied it
      // is the REAL post-trade on-chain snapshot (preferred over this estimate).
      const amountSol = Math.max(0.01, qty * activeSharePriceSol);

      let newYesPool = currentYes;
      let newNoPool = currentNo;

      if (side === "YES") {
        newYesPool = Math.max(0.001, isBuy ? currentYes + amountSol : currentYes - amountSol);
      } else {
        newNoPool = Math.max(0.001, isBuy ? currentNo + amountSol : currentNo - amountSol);
      }

      // Optimistic UI values (estimate only — NEVER sent to the DB when the
      // fresh on-chain read failed; the unthrottled onAccountChange sync writes
      // the real pools, and sending an estimate could clobber it).
      const estYesLamports = Math.round(newYesPool * 1e9);
      const estNoLamports = Math.round(newNoPool * 1e9);
      const estTotal = newYesPool + newNoPool;
      const newYesPct =
        estTotal > 0
          ? Math.max(1, Math.min(99, Math.round((newYesPool / estTotal) * 100)))
          : 50;

      // Update local React state immediately for instant UI feedback
      if (market) {
        setMarket({
          ...market,
          yesPoolLamports: new anchor.BN(estYesLamports),
          noPoolLamports: new anchor.BN(estNoLamports),
        });
        probHistory.current = [...probHistory.current.slice(-29), newYesPct];
      }

      const lamportsIn = isBuy ? Math.round(amountSol * 1e9) : -Math.round(amountSol * 1e9);

      await fetch("/api/sync/trade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          signature: sig,
          marketPubkey: marketPda.toBase58(),
          trader: wallet!.publicKey!.toBase58(),
          side,
          lamportsIn,
          tokensOut: (isBuy ? 1 : -1) * Math.round(qty * 1_000_000),
          // Only REAL post-trade snapshots reach the DB (undefined is dropped).
          yesPoolLamports: fresh?.yesPoolLamports,
          noPoolLamports: fresh?.noPoolLamports,
          yesSupply: fresh?.yesSupply,
          noSupply: fresh?.noSupply,
          yesPct: newYesPct,
        }),
      });
    } catch {}
  };

  // Cache whether the market account exists on-chain, so buy/sell/LP clicks
  // don't re-issue a getAccountInfo round-trip on every single trade. The
  // answer never changes while viewing a page (unless the admin deploys it
  // mid-view — fetchMarket invalidates the cache on success).
  const marketDeployedRef = useRef<Map<string, boolean>>(new Map());
  const checkMarketDeployed = useCallback(async (): Promise<boolean> => {
    const key = marketPda.toBase58();
    const cached = marketDeployedRef.current.get(key);
    if (cached !== undefined) return cached;
    const acc = await connection.getAccountInfo(marketPda).catch(() => null);
    marketDeployedRef.current.set(key, !!acc);
    return !!acc;
  }, [connection, marketPda]);

  const fetchUserOrders = useCallback(async () => {
    if (!wallet?.publicKey || !program) return;
    try {
      // Use memcmp filters (Order layout: 8-byte discriminator, market @ 8,
      // maker @ 40) so the RPC only returns THIS market's orders for THIS
      // wallet instead of downloading every Order account on the cluster and
      // filtering client-side — much faster as the order book grows.
      const filters = [
        { memcmp: { offset: 8, bytes: marketPda.toBase58() } },
        { memcmp: { offset: 40, bytes: wallet.publicKey.toBase58() } },
      ];
      const allOrders = await program.account.order.all(filters);
      const myOrders = allOrders.filter((o: any) => {
        const status = o.account.status;
        const isOpen = typeof status === "object" && status !== null ? "open" in status : status === 0;
        return isOpen;
      });
      setUserOrders(myOrders);
    } catch (err) {
      console.error("Error fetching user orders:", err);
    }
  }, [wallet, program, marketPda]);

  // Fetch market details and transactions
  const fetchMarket = async () => {
    try {
      let marketAcc: MarketDetails | null = null;

      // 1. Try to fetch on-chain account
      try {
        marketAcc = await program.account.market.fetch(marketPda) as unknown as MarketDetails;
      } catch (err) {
        console.log("On-chain market account fetch failed, attempting database fallback...", err);
      }

      // 2. If on-chain fetch failed or not deployed, fetch from database API
      if (!marketAcc) {
        let cachedMarket: any = null;
        try {
          const res = await fetch(`/api/markets/${id}`);
          if (res.ok) {
            const json = await res.json();
            cachedMarket = json.market;
          }
          if (!cachedMarket) {
            const res2 = await fetch("/api/markets/cached");
            if (res2.ok) {
              const json2 = await res2.json();
              if (json2.markets) {
                cachedMarket = json2.markets.find((c: any) =>
                  c.marketPubkey === id ||
                  c.marketPubkey === marketPda.toBase58() ||
                  String(c.marketId) === String(id)
                );
              }
            }
          }
        } catch (e) {
          console.warn("Could not fetch market fallback from database:", e);
        }

        if (cachedMarket) {
          // Real pool/supply snapshots mirrored in markets_cache (migration
          // 0004) — the DB no longer fabricates pools from volume*odds, so the
          // fallback now agrees with the AMM/order book exactly like the
          // on-chain path.
          marketAcc = dbRowToMarketDetails(cachedMarket);
        }
      }

      if (!marketAcc) {
        // A missing market is NORMAL navigation (stale bookmark, an old
        // watchlist pubkey from a previous program deploy, a dead link) — not
        // an error. Render the "Contract Departed" EmptyState silently.
        // Self-heal: if this stale pubkey is still in the user's local
        // watchlist, drop it so it can't be clicked into again.
        setNotFound(true);
        // Drop just this stale pubkey from the local watchlist (the market no
        // longer exists, so keeping it would let users click into a dead board).
        const staleKey = marketPda.toBase58();
        if (getWatchlist().includes(staleKey)) {
          toggleWatchlist(staleKey, wallet?.publicKey?.toBase58(), {
            publicKey: wallet?.publicKey ?? null,
            signMessage: wallet?.signMessage,
          });
        }
        return;
      }

      // Market exists on-chain → invalidate the deployed cache so a fresh
      // account that was deployed mid-view is always recognized.
      marketDeployedRef.current.set(marketPda.toBase58(), true);

      setMarket(marketAcc);
      setIsWatched(getWatchlist().includes(marketPda.toBase58()));
      recordProbabilitySnapshot(marketAcc);

      // Seed the probability sparkline from persisted DB snapshots
      // (price_history table) — fire-and-forget so it never blocks the market
      // render, and only once per market view (not on every account change /
      // post-trade refresh, which used to re-fetch the whole detail route).
      if (!historyFetchedRef.current) {
        historyFetchedRef.current = true;
        fetch(`/api/markets/${id}`)
          .then((r) => r.ok ? r.json() : null)
          .then((detailJson) => {
            const dbHist = detailJson?.enrichment?.dbPriceHistory;
            if (Array.isArray(dbHist) && dbHist.length > 1) {
              const pts = dbHist.map((p: { yesPct: number }) =>
                Math.max(1, Math.min(99, Math.round(Number(p.yesPct))))
              );
              if (pts.length > probHistory.current.length) {
                probHistory.current = pts.slice(-30);
              }
            }
          })
          .catch(() => {});
      }

      // Fetch config fee bps and treasury balance in parallel from the blockchain
      const configPda = getConfigPda(program.programId);
      const treasuryPda = getTreasuryPda(marketPda, program.programId);
      const [configAcc, treasuryBal] = await Promise.all([
        program.account.config.fetch(configPda).catch(() => null),
        connection.getBalance(treasuryPda).catch(() => 0),
      ]);

      if (configAcc) {
        setFeeBps(configAcc.feeBps);
      }
      setTreasuryBalance(treasuryBal);

      fetchUserBalances();
      fetchUserOrders();
    } catch (err: unknown) {
      console.error("Error fetching market:", err);
      toast.error(`Market Notice: ${getFriendlyErrorMessage(err)}`);
    } finally {
      setLoading(false);
    }
  };

  const handlePlaceLimitOrder = async (isBuy: boolean = true) => {
    if (!wallet || !wallet.publicKey) {
      toast.error("Please connect your wallet first.");
      return;
    }
    if (limitPriceSol <= 0 || limitPriceSol >= 1) {
      toast.error("Limit price must be between 0.01 and 0.99 SOL per share");
      return;
    }
    const targetSide = isBuy ? tradeSide : sellSide;
    const targetQty = isBuy ? quantity : sellQuantity;

    if (!isBuy) {
      const currentHoldings = targetSide === "YES" ? userYesBalance : userNoBalance;
      if (currentHoldings < targetQty) {
        toast.error(`Insufficient ${targetSide} shares to place limit sell order (have ${currentHoldings.toFixed(1)}, need ${targetQty})`);
        return;
      }
    }

    try {
      setSubmitting(true);
      setTxState("signing");
      // Cryptographically random u64 order id (never Math.random) — the order
      // id is a PDA seed and must be unguessable/collision-free per wallet.
      // NOTE: keep the value within u64 (8 bytes): the raw Date.now() << 32 is
      // 73 bits and toArrayLike(..., "le", 8) throws, failing every limit
      // order before the tx is built. Mask the timestamp to 32 bits and OR in
      // 32 random bits — 64 bits total, collision odds negligible.
      const orderId = new anchor.BN(
        (((BigInt(Date.now()) & 0xffffffffn) << 32n) | BigInt(crypto.getRandomValues(new Uint32Array(1))[0]))
          .toString(10)
      );
      const priceBps = new anchor.BN(Math.round(limitPriceSol * 10000));
      const qtyBN = new anchor.BN(targetQty);

      const [orderPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("order"), marketPda.toBuffer(), wallet.publicKey.toBuffer(), orderId.toArrayLike(Buffer, "le", 8)],
        program.programId
      );

      const isYes = targetSide === "YES";
      const sideParam = isYes ? { yes: {} } : { no: {} };
      const yesMintPda = getYesMintPda(marketPda, program.programId);
      const noMintPda = getNoMintPda(marketPda, program.programId);
      const chosenMint = isYes ? yesMintPda : noMintPda;
      const makerTokenAta = getAssociatedTokenAddressSync(chosenMint, wallet.publicKey);
      const orderTokenEscrow = getAssociatedTokenAddressSync(chosenMint, orderPda, true);

      const preInstructions: TransactionInstruction[] = [];
      if (!isBuy) {
        const escrowInfo = await connection.getAccountInfo(orderTokenEscrow);
        if (!escrowInfo) {
          preInstructions.push(
            createAssociatedTokenAccountInstruction(
              wallet.publicKey,
              orderTokenEscrow,
              orderPda,
              chosenMint
            )
          );
        }
      }

      setTxState("confirming");
      let builder: any = program.methods.placeOrder(orderId, sideParam, isBuy, priceBps, qtyBN);

      if (preInstructions.length > 0) {
        builder = builder.preInstructions(preInstructions);
      }

      const sig = await sendTxWithBlockhashRetry(
        builder
          .accounts(txAccounts({
            maker: wallet.publicKey,
            market: marketPda,
            order: orderPda,
            makerTokenAta,
            orderTokenEscrow,
            orderEscrow: getOrderEscrowPda(marketPda, wallet.publicKey, orderId, program.programId),
            emergencyPause: getEmergencyPausePda(program.programId),
          }))
      );

      setTxState("success");
      setTxSig(sig);
      toast.success(`Limit ${isBuy ? "Buy Bid" : "Sell Ask"} placed! (Sig: ${sig.slice(0, 8)}...)`);
      fetchMarket();
      fetchUserOrders();
      fetchUserBalances();
    } catch (err: unknown) {
      setTxState("error");
      toast.error(`Order Placement Failed: ${getFriendlyErrorMessage(err)}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleFillOrder = async (orderAccount: any, fillQty: number) => {
    if (!wallet?.publicKey) {
      toast.error("Please connect your wallet first.");
      return;
    }
    try {
      setSubmitting(true);
      const ord = orderAccount.account;
      const isYes = typeof ord.side === "object" && "yes" in ord.side;
      const mint = isYes ? getYesMintPda(marketPda, program.programId) : getNoMintPda(marketPda, program.programId);

      const takerTokenAta = getAssociatedTokenAddressSync(mint, wallet.publicKey);
      const makerTokenAta = getAssociatedTokenAddressSync(mint, ord.maker);
      const orderTokenEscrow = getAssociatedTokenAddressSync(mint, orderAccount.publicKey, true);

      const sig = await sendTxWithBlockhashRetry(
        program.methods
          .fillOrder(new anchor.BN(fillQty))
          .accounts(txAccounts({
            taker: wallet.publicKey,
            maker: ord.maker,
            market: marketPda,
            order: orderAccount.publicKey,
            takerTokenAta,
            makerTokenAta,
            orderTokenEscrow,
            orderEscrow: getOrderEscrowPda(marketPda, ord.maker, new anchor.BN(ord.orderId), program.programId),
            emergencyPause: getEmergencyPausePda(program.programId),
          }))
      );

      toast.success(`Filled ${fillQty} shares order! (Sig: ${sig.slice(0, 8)}...)`);
      fetchMarket();
      fetchUserOrders();
      fetchUserBalances();
    } catch (err: unknown) {
      toast.error(`Fill Order Failed: ${getFriendlyErrorMessage(err)}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelOrder = async (orderAccount: any) => {
    if (!wallet?.publicKey || !program) return;
    try {
      setSubmitting(true);
      const isYes = "yes" in orderAccount.account.side;
      const chosenMint = isYes ? getYesMintPda(marketPda, program.programId) : getNoMintPda(marketPda, program.programId);
      const makerTokenAta = getAssociatedTokenAddressSync(chosenMint, wallet.publicKey);
      const orderTokenEscrow = getAssociatedTokenAddressSync(chosenMint, orderAccount.publicKey, true);

      const sig = await sendTxWithBlockhashRetry(
        program.methods
          .cancelOrder()
          .accounts(txAccounts({
            maker: wallet.publicKey,
            market: marketPda,
            order: orderAccount.publicKey,
            makerTokenAta,
            orderTokenEscrow,
            orderEscrow: getOrderEscrowPda(marketPda, wallet.publicKey, new anchor.BN(orderAccount.account.orderId), program.programId),
            emergencyPause: getEmergencyPausePda(program.programId),
          }))
      );

      toast.success(`Limit Order cancelled! (Sig: ${sig.slice(0, 8)}...)`);

      // Optimistic UI: the tx was sent (and preflight-passed), so drop the
      // cancelled order from the list immediately. With send-first the on-chain
      // order account closes a beat later, so a single refetch could still show
      // it — poll in the BACKGROUND until the account is really gone, then
      // reconcile once against the confirmed state.
      const cancelledKey = orderAccount.publicKey.toBase58();
      setUserOrders((prev) => prev.filter((o) => o.publicKey.toBase58() !== cancelledKey));
      let unmounted = false;
      void (async () => {
        for (let i = 0; i < 15; i++) {
          await new Promise((r) => setTimeout(r, 500));
          if (unmounted) return;
          const acc = await (program.account.order as any).fetch(orderAccount.publicKey).catch(() => null);
          if (!acc) break; // order account closed — cancel confirmed on-chain
        }
        if (!unmounted) {
          fetchUserOrders(); // reconcile to the confirmed on-chain truth
          // A cancelled limit SELL returns escrowed shares to the maker's ATA.
          fetchUserBalances();
        }
      })();
      // Best-effort guard against the background poll updating state after the
      // user navigates away mid-poll (the rest of this file uses the same pattern).
      setTimeout(() => { unmounted = true; }, 10_000);

      fetchMarket();
    } catch (err: unknown) {
      toast.error(`Cancel Order Failed: ${getFriendlyErrorMessage(err)}`);
    } finally {
      setSubmitting(false);
    }
  };

  const fetchActivity = async () => {
    try {
      const sigs = await connection.getSignaturesForAddress(marketPda, { limit: 15 }, "confirmed");
      const items: ActivityItem[] = [];
      const tempHistory: number[] = [];

      const eventParser = new EventParser(program.programId, program.coder);

      const txs = await Promise.all(
        sigs.map(async (sig) => {
          try {
            return await connection.getParsedTransaction(sig.signature, {
              maxSupportedTransactionVersion: 0,
              commitment: "confirmed"
            });
          } catch {
            return null;
          }
        })
      );

      const pairs = sigs.map((sig, idx) => ({ sig, tx: txs[idx] })).reverse();

      for (const pair of pairs) {
        const { sig, tx } = pair;
        if (!tx || !tx.meta || !tx.meta.logMessages) continue;

        const date = sig.blockTime ? new Date(sig.blockTime * 1000) : new Date();
        const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

        const events = eventParser.parseLogs(tx.meta.logMessages);
        for (const event of events) {
          if (event.name === "SharesPurchased") {
            const { side, quantity: q, cost, buyer, newYesPool, newNoPool } = event.data as unknown as SharesPurchasedEvent;
            const sideStr = side.yes ? "YES" : "NO";
            
            const yesP = newYesPool.toNumber();
            const noP = newNoPool.toNumber();
            const total = yesP + noP;
            const yesProbVal = total > 0 ? Math.round((yesP / total) * 100) : 50;
            
            tempHistory.push(yesProbVal);

            items.push({
              signature: sig.signature,
              slot: sig.slot,
              buyer: buyer.toBase58(),
              side: sideStr,
              quantity: q.toNumber(),
              cost: lamportsToSol(cost),
              time: timeStr,
            });
          } else if (event.name === "MarketSettled") {
            const { winningOutcome, settledPrice } = event.data as unknown as MarketSettledEvent;
            items.push({
              signature: sig.signature,
              slot: sig.slot,
              buyer: "BOARD SETTLEMENT",
              side: "SETTLE",
              quantity: winningOutcome, 
              cost: lamportsToSol(settledPrice),
              time: timeStr,
            });
          } else if (event.name === "RewardsClaimed") {
            const { claimer, payout } = event.data as unknown as RewardsClaimedEvent;
            items.push({
              signature: sig.signature,
              slot: sig.slot,
              buyer: claimer.toBase58(),
              side: "CLAIM",
              quantity: 0,
              cost: lamportsToSol(payout),
              time: timeStr,
            });
          }
        }
      }

      const reversed = items.reverse();
      const topSig = reversed[0]?.signature ?? "";
      if (topSig !== activitySigRef.current) {
        activitySigRef.current = topSig;
        setActivity(reversed);
      }

      if (tempHistory.length > 0) {
        probHistory.current = [50, ...tempHistory].slice(-30);
      }
    } catch (e) {
      console.log("Error loading transaction activity logs:", e);
    }
  };

  // Record a probability snapshot and append to sparkline history
  const recordProbabilitySnapshot = useCallback((acc: MarketDetails) => {
    const yesP = acc.yesPoolLamports.toNumber();
    const noP = acc.noPoolLamports.toNumber();
    const total = yesP + noP;
    const yesProbVal = total > 0 ? Math.round((yesP / total) * 100) : 50;
    probHistory.current = [...probHistory.current.slice(-29), yesProbVal];
  }, []);

  const lastMktUpdateRef = useRef<number>(0);
  const lastActUpdateRef = useRef<number>(0);
  const mktPoolSnapshotRef = useRef<string>(""); // tracks yes+no pool for dedup

  useEffect(() => {
    // Navigating between markets via the sidebar re-runs this effect — reset
    // the once-per-view history fetch guard for the new market.
    const idStr = String(id ?? "");
    const seededPubkey = (initialMarket as any)?.marketPubkey as string | undefined;
    const seedMismatch =
      !!initialMarket &&
      seededPubkey !== idStr &&
      String((initialMarket as any)?.marketId) !== idStr &&
      seededPubkey !== marketPdaFromId(id)?.toBase58();

    // Keep the prefetched-history guard when this IS the seeded market (the
    // server already provided the sparkline data); only reset it when the
    // route navigated to a different market, so the history fetch fires for
    // markets without a prefetch.
    if (seedMismatch || initialHistory === undefined) {
      historyFetchedRef.current = false;
    }
    mktPoolSnapshotRef.current = "";
    setNotFound(false);

    // If the server-prefetched market was for a DIFFERENT route id (client
    // navigation), drop the stale seed and show the loading skeleton until
    // fetchMarket resolves for the new id.
    if (seedMismatch) {
      setMarket(null);
      setLoading(true);
    }

    fetchMarket();
    fetchActivity();
    fetchLpInfo();

    // Throttled real-time market data stream
    const accountSub = connection.onAccountChange(
      marketPda,
      (accountInfo) => {
        const now = Date.now();
        if (now - lastMktUpdateRef.current < 5000) return;
        lastMktUpdateRef.current = now;
        try {
          const decoded = program.coder.accounts.decode("Market", accountInfo.data) as unknown as MarketDetails;
          const snapshot = `${decoded.yesPoolLamports}:${decoded.noPoolLamports}`;
          if (snapshot !== mktPoolSnapshotRef.current) {
            mktPoolSnapshotRef.current = snapshot;
            const now = Date.now();
            if (now - lastMktUpdateRef.current >= 5000) {
              lastMktUpdateRef.current = now;
              setMarket(decoded);
              recordProbabilitySnapshot(decoded);
            }
            // Persist the REAL pools every time on-chain state changes — the
            // DB sync is NEVER throttled (fast consecutive trades/LP deposits
            // must all land, or pages would drift apart).
            syncMarketToDb(decoded);
          }
        } catch {
          fetchMarket();
        }
      },
      "confirmed"
    );

    // Throttled transaction logs subscription
    const logSub = connection.onLogs(marketPda, () => {
      const now = Date.now();
      if (now - lastActUpdateRef.current < 10000) return;
      lastActUpdateRef.current = now;
      fetchActivity();
    }, "confirmed");

    return () => {
      connection.removeAccountChangeListener(accountSub);
      connection.removeOnLogsListener(logSub);
    };
  }, [id, program, connection, recordProbabilitySnapshot, syncMarketToDb, initialMarket, initialHistory, fetchLpInfo]);

  // Keep the watchlist star in sync with the wallet's DB watchlist. AppContext
  // loads the DB keys asynchronously after connect, so the initial read inside
  // fetchMarket may have raced it — re-sync once the DB copy lands.
  useEffect(() => {
    if (!wallet?.publicKey) return;
    let cancelled = false;
    fetchWatchlistFromDb(wallet.publicKey.toBase58(), { publicKey: wallet.publicKey, signMessage: wallet.signMessage })
      .then((keys) => {
        if (!cancelled) setIsWatched(keys.includes(marketPda.toBase58()));
      })
      .catch(() => {
        if (!cancelled) setIsWatched(getWatchlist().includes(marketPda.toBase58()));
      });
    return () => { cancelled = true; };
  }, [wallet?.publicKey, wallet?.signMessage, marketPda]);

  // (Live SOL price chart state is managed inside LivePriceChartPanel component)

  if (loading) {
    return (
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
        <div className="space-y-8">
          <div className="h-8 bg-panel-2 border border-hairline rounded w-1/3" />
          <div className="grid md:grid-cols-3 gap-8">
            <div className="md:col-span-2 space-y-8">
              <div className="holo-card p-10 h-96 shimmer bg-panel" />
              <div className="holo-card p-10 h-64 shimmer bg-panel" />
            </div>
            <div className="holo-card p-10 h-80 shimmer bg-panel" />
          </div>
        </div>
      </main>
    );
  }

  if (notFound || !market) {
    return (
      <EmptyState
        icon={AlertCircle}
        title="Contract Departed"
        description="The requested prediction board does not exist or has been removed from the registry."
        action={{ label: "Return to Explorer", href: "/markets" }}
      />
    );
  }

  const handleWatchlistToggle = () => {
    const next = toggleWatchlist(marketPda.toBase58(), wallet?.publicKey?.toBase58(), {
      publicKey: wallet?.publicKey ?? null,
      signMessage: wallet?.signMessage,
    });
    setIsWatched(next.includes(marketPda.toBase58()));
    toast.success(
      next.includes(marketPda.toBase58())
        ? "Added to watchlist (synced to database)!"
        : "Removed from watchlist!"
    );
  };

  const shareUrl = typeof window !== "undefined" ? window.location.href : "";
  const yesLamports = market.yesPoolLamports.toNumber();
  const noLamports = market.noPoolLamports.toNumber();
  const totalLamports = yesLamports + noLamports;
  const shareYesPct = Math.round((totalLamports > 0 ? (yesLamports / totalLamports) : 0.5) * 100);
  const twitterShareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(
    `Predicting "${market.question}" on SOLPredict! Current YES Probability: ${shareYesPct}%`
  )}&url=${encodeURIComponent(shareUrl)}`;
  const telegramShareUrl = `https://t.me/share/url?url=${encodeURIComponent(
    shareUrl
  )}&text=${encodeURIComponent(
    `Check out this prediction market on SOLPredict: "${market.question}"`
  )}`;

  const copyShareLink = () => {
    const copyToClipboard = async (text: string) => {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
    };
    copyToClipboard(shareUrl).catch(() => {});
    toast.success("Share link copied to clipboard!");
    setShowShareOptions(false);
  };

  const getFeedIdHexString = (feedId: number[] | Uint8Array | Buffer): string => {
    const arr = Array.from(feedId);
    return "0x" + arr.map(b => b.toString(16).padStart(2, '0')).join('');
  };

  const status = getMarketStatusString(market.status, market.endTs);
  const categoryStr = CATEGORIES[market.category] || "Other";
  
  const yesPool = lamportsToSol(market.yesPoolLamports);
  const noPool = lamportsToSol(market.noPoolLamports);
  const totalPool = yesPool + noPool;
  
  const yesProbRaw = totalPool > 0 ? Math.round((yesPool / totalPool) * 100) : 50;
  const yesProb = Math.max(1, Math.min(99, yesProbRaw));
  const noProb = 100 - yesProb;
  
  // Constant-product (xy=k) spot prices from the on-chain reserves. These
  // match what buy_shares/sell_shares actually charge (see amm_math.rs).
  const poolYesBI = BigInt(market.yesPoolLamports.toNumber());
  const poolNoBI = BigInt(market.noPoolLamports.toNumber());
  // The program freezes the fee on the market account at creation
  // (market.fee_bps, mirrored into markets_cache by the indexer). Quote with
  // the market's OWN fee — using the config's current fee would mismatch what
  // buy_shares/sell_shares actually charge if the admin changes the config
  // after the market was created. Config fee is the fallback for rows without
  // a cached fee.
  const fee = market.feeBps ?? feeBps ?? 0;
  const sharePriceLamportsBI = BigInt(market.sharePriceLamports.toNumber());
  const qtyBI = BigInt(Math.max(0, quantity));
  const dyOutBI = qtyBI * sharePriceLamportsBI; // value being traded, on-chain semantics

  // Exactly mirrors buy_shares.rs: flat baseline cost when either pool is
  // empty (Flat Linear Minting), else the probability-based CPMM curve.
  const quoteBuyCostLamports = (): bigint => {
    if (dyOutBI === 0n) return 0n;
    if (poolYesBI === 0n || poolNoBI === 0n) {
      return dyOutBI;
    }
    try {
      return buyCostLamports({ poolYes: poolYesBI, poolNo: poolNoBI, feeBps: fee }, tradeSide, dyOutBI);
    } catch {
      return dyOutBI;
    }
  };
  const quoteValueBI = quoteBuyCostLamports();
  const tradeCost = lamportsToSol(Number(quoteValueBI));

  // Marginal cost of buying ~1 share (the on-chain "spot" the next trade pays).
  const spotOneBI = dyOutBI > 0n ? ((): bigint => {
    const one = dyOutBI / qtyBI; // price of a single share (lamports)
    if (poolYesBI === 0n || poolNoBI === 0n) return one;
    try {
      return buyCostLamports({ poolYes: poolYesBI, poolNo: poolNoBI, feeBps: fee }, tradeSide, one);
    } catch { return one; }
  })() : 0n;

  // Estimated price impact: how much buying the whole qty moves the price vs
  // the marginal per-share cost.
const marginalPerShareSol = qtyBI > 0n ? lamportsToSol(Number(spotOneBI)) : 0;
const avgPerShareSol = quantity > 0 ? tradeCost / quantity : 0;
  const priceImpactPct = avgPerShareSol > 0 && marginalPerShareSol > 0
    ? (avgPerShareSol - marginalPerShareSol) / marginalPerShareSol * 100
    : 0;
  const slippageWarning = priceImpactPct >= 5;

  // Nominal share value (0.01 SOL default) — what a share redeems for on a win.
  const sharePriceSol = lamportsToSol(market.sharePriceLamports);
  const potentialPayout = quantity * sharePriceSol;

  // Active share price used by the UI (avg per share for the current qty).
  const activeSharePriceSol = quantity > 0 ? tradeCost / quantity : sharePriceSol;
  const yesSharePriceSol = tradeSide === "YES" ? activeSharePriceSol : sharePriceSol;
  const noSharePriceSol = tradeSide === "NO" ? activeSharePriceSol : sharePriceSol;

  // Sell refund quote — mirrors sell_shares.rs (get_sell_amount_out).
  const sellQtyBI = BigInt(Math.max(0, sellQuantity));
  const sellDyBI = sellQtyBI * sharePriceLamportsBI;
  const sellRefundLamportsV = ((): bigint => {
    if (sellDyBI === 0n) return 0n;
    if (poolYesBI === 0n || poolNoBI === 0n) {
      return sellDyBI;
    }
    try {
      return sellRefundFn({ poolYes: poolYesBI, poolNo: poolNoBI, feeBps: fee }, sellSide, sellDyBI);
    } catch {
      return sellDyBI;
    }
  })();
  // sell_shares.rs caps the refund by the treasury balance (keeping it
  // rent-exempt: treasury - 1) and reverts if the result is 0. Mirror the cap
  // so the displayed quote is what the chain will actually pay, and flag when
  // the sell would revert on-chain (refund would be 0).
  const sellRefundTreasuryCapBI =
    treasuryBalance > 0
      ? sellRefundLamportsV < BigInt(treasuryBalance)
        ? sellRefundLamportsV
        : BigInt(Math.max(0, treasuryBalance - 1))
      : sellRefundLamportsV;
  const sellRefundSol = lamportsToSol(Number(sellRefundTreasuryCapBI));
  const sellUnavailable = sellRefundTreasuryCapBI <= 0n;

  // ── LP deposit preview — mirrors add_liquidity.rs EXACTLY ────────────────
  // On-chain: `lp_tokens_minted = yes_lamports + no_lamports` (LP tokens are
  // minted 1:1 with lamports deposited — no curve, no fee, no sqrt invariant),
  // and each side's pool grows by exactly its deposit. The preview is computed
  // by the SAME shared module (lp.ts) the submit handler and the DB liquidity
  // route use, so the numbers shown are provably the numbers the tx produces.
  const lp = lpPreview(lpOption, lpDepositAmount, yesPool, noPool);
  const lpTokensMinted = lp.lpTokensMinted;
  const lpNewYesPoolSol = lp.newYesPoolSol;
  const lpNewNoPoolSol = lp.newNoPoolSol;

  const handleBuy = async () => {
    if (!wallet || !wallet.publicKey) {
      toast.error("Please connect your wallet first.");
      return;
    }

    // Run balance + deployed checks in PARALLEL so the wallet popup opens as
    // fast as possible (previously they ran sequentially — two RTTs before
    // the user ever saw the Phantom prompt).
    const t0 = performance.now();
    const [balOk, deployed] = await Promise.all([
      assertSufficientBalance(tradeCost, "buying shares"),
      checkMarketDeployed(),
    ]);
    if (balOk) console.info(`[perf] buy pre-popup checks: ${Math.round(performance.now() - t0)}ms`);
    if (!balOk) return;
    if (!deployed) {
      toast.error("This market is not deployed on-chain, so buying is unavailable. Only markets with an on-chain account can be traded.");
      return;
    }

    try {
      setTxState("signing");
      setSubmitting(true);
      const tBuild = performance.now();
      const sideParam: { yes?: Record<string, never>; no?: Record<string, never> } = tradeSide === "YES" ? { yes: {} } : { no: {} };
      const yesMintPda = getYesMintPda(marketPda, program.programId);
      const noMintPda = getNoMintPda(marketPda, program.programId);
      const treasuryPda = getTreasuryPda(marketPda, program.programId);
      
      const buyerYesAta = getAssociatedTokenAddressSync(yesMintPda, wallet.publicKey);
      const buyerNoAta = getAssociatedTokenAddressSync(noMintPda, wallet.publicKey);
      const userPositionPda = getUserPositionPda(marketPda, wallet.publicKey, program.programId);

      setTxState("confirming");
      const emergencyPause = getEmergencyPausePda(program.programId);
      const tSend = performance.now();
      // Slippage guard: quoteValueBI is the exact expected cost for this
      // quantity; allow 5% headroom so a small adverse price move fails the
      // tx instead of silently overcharging, while normal execution passes.
      const maxCostLamports = new anchor.BN((quoteValueBI * 105n) / 100n);
      const sig = await sendTxWithBlockhashRetry(
        program.methods
          .buyShares(sideParam, new anchor.BN(quantity), maxCostLamports)
          .accounts(txAccounts({
            buyer: wallet.publicKey,
            market: marketPda,
            treasury: treasuryPda,
            yesMint: yesMintPda,
            noMint: noMintPda,
            buyerYesAta: buyerYesAta,
            buyerNoAta: buyerNoAta,
            userPosition: userPositionPda,
            emergencyPause,
          }))
      );
      console.info(`[perf] buy build ${Math.round(tSend - tBuild)}ms + rpc ${Math.round(performance.now() - tSend)}ms`);

      setTxSig(sig);
      setTxState("success");
      setSuccessFlip(true);
      setTimeout(() => setSuccessFlip(false), 800);

      toast.success(`Position acquired: ${quantity} ${tradeSide} shares!`);
      setIsMobileDrawerOpen(false);

      // Re-enable the button immediately — the tx already landed. All DB
      // sync + view refresh work runs in the background so the trade button
      // is never blocked by polling or refetching.
      setSubmitting(false);
      setTimeout(() => setTxState("idle"), 1500);

      const prevYes = market.yesPoolLamports.toNumber();
      const prevNo = market.noPoolLamports.toNumber();
      void runPostTradeSync(
        async () => {
          const freshAcc = await readFreshAccount(prevYes, prevNo);
          await syncTradeToDb(
            sig,
            tradeSide,
            quantity,
            true,
            freshAcc
              ? {
                  yesPoolLamports: freshAcc.yesPoolLamports.toNumber(),
                  noPoolLamports: freshAcc.noPoolLamports.toNumber(),
                  yesSupply: freshAcc.yesSupply.toNumber(),
                  noSupply: freshAcc.noSupply.toNumber(),
                }
              : undefined
          );
        },
        () => {
          fetchMarket();
          fetchActivity();
        }
      );
    } catch (err: unknown) {
      setTxState("error");
      console.error("Buy shares error:", err);
      toast.error(`Purchase failed: ${getFriendlyErrorMessage(err)}${isBlockhashError(err) ? BLOCKHASH_HINT : ""}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSell = async () => {
    if (!wallet?.publicKey) {
      toast.error("Please connect your wallet first.");
      return;
    }
    // Selling returns SOL, but gas + rent still need a funded wallet.
    // Balance + deployed checks run in PARALLEL for a faster popup.
    const t0 = performance.now();
    const [balOk, deployed] = await Promise.all([
      assertSufficientBalance(0.01, "selling shares"),
      checkMarketDeployed(),
    ]);
    if (balOk) console.info(`[perf] sell pre-popup checks: ${Math.round(performance.now() - t0)}ms`);
    if (!balOk) return;
    if (!deployed) {
      toast.error("This market is not deployed on-chain, so selling is unavailable. Only markets with an on-chain account can be traded.");
      return;
    }

    try {
      setSubmitting(true);
      const sideParam: { yes?: Record<string, never>; no?: Record<string, never> } = sellSide === "YES" ? { yes: {} } : { no: {} };
      const yesMintPda = getYesMintPda(marketPda, program.programId);
      const noMintPda = getNoMintPda(marketPda, program.programId);
      const treasuryPda = getTreasuryPda(marketPda, program.programId);
      const sellerYesAta = getAssociatedTokenAddressSync(yesMintPda, wallet.publicKey);
      const sellerNoAta = getAssociatedTokenAddressSync(noMintPda, wallet.publicKey);
      const userPositionPda = getUserPositionPda(marketPda, wallet.publicKey, program.programId);

      const emergencyPause = getEmergencyPausePda(program.programId);
      // Slippage guard: sellRefundTreasuryCapBI is the exact expected refund
      // (already treasury-capped); require at least 95% of it so a small
      // adverse price move fails the tx instead of silently underpaying.
      const minProceedsLamports = new anchor.BN((sellRefundTreasuryCapBI * 95n) / 100n);
      const sig = await sendTxWithBlockhashRetry(
        program.methods
          .sellShares(sideParam, new anchor.BN(sellQuantity), minProceedsLamports)
          .accounts(txAccounts({
            seller: wallet.publicKey,
            market: marketPda,
            treasury: treasuryPda,
            yesMint: yesMintPda,
            noMint: noMintPda,
            sellerYesAta,
            sellerNoAta,
            userPosition: userPositionPda,
            emergencyPause,
          }))
      );

      toast.success(`Sold ${sellQuantity} ${sellSide} shares!`);

      // Re-enable the button immediately; sync + refetch run in the background.
      setSubmitting(false);
      const prevYes = market.yesPoolLamports.toNumber();
      const prevNo = market.noPoolLamports.toNumber();
      void runPostTradeSync(
        async () => {
          const freshAcc = await readFreshAccount(prevYes, prevNo);
          await syncTradeToDb(
            sig,
            sellSide,
            sellQuantity,
            false,
            freshAcc
              ? {
                  yesPoolLamports: freshAcc.yesPoolLamports.toNumber(),
                  noPoolLamports: freshAcc.noPoolLamports.toNumber(),
                  yesSupply: freshAcc.yesSupply.toNumber(),
                  noSupply: freshAcc.noSupply.toNumber(),
                }
              : undefined
          );
        },
        () => {
          fetchMarket();
          fetchActivity();
          fetchUserBalances();
        }
      );
    } catch (err: unknown) {
      console.error("Sell shares error:", err);
      toast.error(`Sell failed: ${getFriendlyErrorMessage(err)}${isBlockhashError(err) ? BLOCKHASH_HINT : ""}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleProvideLiquidity = async () => {
    if (!wallet?.publicKey) {
      toast.error("Please connect your wallet first.");
      return;
    }
    // Balance + deployed checks run in PARALLEL for a faster popup.
    const t0 = performance.now();
    const [balOk, deployed] = await Promise.all([
      assertSufficientBalance(lpDepositAmount, "providing liquidity"),
      checkMarketDeployed(),
    ]);
    if (balOk) console.info(`[perf] LP pre-popup checks: ${Math.round(performance.now() - t0)}ms`);
    if (!balOk) return;
    if (!deployed) {
      toast.error("This market is not deployed on-chain, so liquidity provision is unavailable.");
      return;
    }

    try {
      setSubmitting(true);
      let sig = "";
      
      // Same split the preview uses — the tx always matches the UI. lpPreview
      // (via the shared lp.ts module) is the single source of truth for LP
      // allocation: yesAddSol/noAddSol are the SOL split, and the lamports
      // passed to addLiquidity are the same rounded per-side values it computed.
      const lpDep = lpPreview(lpOption, lpDepositAmount, yesPool, noPool);
      const yesAddSol = lpDep.yesAddSol;
      const noAddSol = lpDep.noAddSol;
      const yesDepositLamports = new anchor.BN(lpDep.yesAddLamports);
      const noDepositLamports = new anchor.BN(lpDep.noAddLamports);
      const treasuryPda = getTreasuryPda(marketPda, program.programId);
      const yesMintPda = getYesMintPda(marketPda, program.programId);
      const noMintPda = getNoMintPda(marketPda, program.programId);
      const providerYesAta = getAssociatedTokenAddressSync(yesMintPda, wallet.publicKey);
      const providerNoAta = getAssociatedTokenAddressSync(noMintPda, wallet.publicKey);
      const [liquidityPositionPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("lp"), marketPda.toBuffer(), wallet.publicKey.toBuffer()],
        program.programId
      );
      const emergencyPause = getEmergencyPausePda(program.programId);

      sig = await sendTxWithBlockhashRetry(
        program.methods
          .addLiquidity(yesDepositLamports, noDepositLamports)
          .accounts(txAccounts({
            provider: wallet.publicKey,
            market: marketPda,
            treasury: treasuryPda,
            yesMint: yesMintPda,
            noMint: noMintPda,
            providerYesAta,
            providerNoAta,
            liquidityPosition: liquidityPositionPda,
            emergencyPause,
          }))
      );

      const newYesPool = yesPool + yesAddSol;
      const newNoPool = noPool + noAddSol;

      // Optimistic local update for instant feedback.
      if (market) {
        setMarket({
          ...market,
          yesPoolLamports: new anchor.BN(Math.round(newYesPool * 1e9)),
          noPoolLamports: new anchor.BN(Math.round(newNoPool * 1e9)),
        });
      }

      toast.success(`Successfully deposited ${lpDepositAmount} SOL liquidity!`);

      // Re-enable the button immediately; DB writes + pool sync + view
      // refresh all run in the background.
      setSubmitting(false);
      const walletAddress = wallet.publicKey.toBase58();
      const prevYes = market.yesPoolLamports.toNumber();
      const prevNo = market.noPoolLamports.toNumber();
      void runPostTradeSync(
        async () => {
          // Record the LP position (liquidityPositions + lpPoolStats). This is
          // the ONLY DB write for LP — no fake trade row, no volume inflation.
          // The server verifies the add_liquidity tx on-chain before recording
          // (never trusts the body) — so WAIT for confirmation first. Without
          // this, the POST races the block and the server's getParsedTransaction
          // returns null → 400, silently dropping the LP record.
          await connection.confirmTransaction(sig, "confirmed");
          await fetch(`/api/markets/${marketPda.toBase58()}/liquidity`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              walletAddress,
              // Confirmed add_liquidity tx — the server verifies it on-chain
              // before recording the LP position (never trusts the body).
              signature: sig,
              amountSol: lpDepositAmount,
              action: "add",
              option: lpOption,
            }),
          });
          // Persist the REAL resulting pools (polled on-chain) so every page
          // shows the same numbers.
          const freshAcc = await readFreshAccount(prevYes, prevNo);
          if (freshAcc) await syncMarketToDb(freshAcc);
        },
        () => {
          fetchMarket();
          fetchActivity();
          fetchLpInfo();
        }
      );
    } catch (err: unknown) {
      console.error("LP error:", err);
      toast.error(`Liquidity provision failed: ${getFriendlyErrorMessage(err)}${isBlockhashError(err) ? BLOCKHASH_HINT : ""}`);
    } finally {
      setSubmitting(false);
    }
  };

  const formatTargetPrice = (price: anchor.BN, expo: number): string => {
    const raw = price.toNumber();
    const divider = Math.pow(10, Math.abs(expo));
    const normalized = raw / divider;
    return `$${normalized.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
  };

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
      <Link href="/markets" className="label-lux inline-flex items-center gap-2 hover:text-ivory transition-colors">
        <ArrowLeft className="w-3.5 h-3.5" />
        <span>Directory</span>
      </Link>

      <div className="grid md:grid-cols-3 gap-12 items-start">
        {/* Left Column: Contract specs & visuals */}
        <section className="md:col-span-2 space-y-8">
          {/* Main info panel */}
          <div className="surface-feature p-6 sm:p-8 space-y-6">
            <div className="rule-gold absolute inset-x-0 top-0" />
            <div className="flex items-center gap-4">
              <span className="label-lux !text-gold-lite">{categoryStr}</span>
              <span className="font-mono text-[10px] text-ash-dim tracking-[.16em] uppercase">Board #{market.marketId?.toString()}</span>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
              <h1 className="text-[34px] sm:text-[44px] font-display text-ivory leading-[1.05] flex-1">
                {market.question}
              </h1>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleWatchlistToggle}
                  className={`p-2.5 rounded border transition-colors flex items-center justify-center cursor-pointer ${
                    isWatched
                      ? "border-gold bg-gold/10 text-gold"
                      : "border-hairline/30 bg-black/20 text-ash hover:text-ivory hover:border-hairline/60"
                  }`}
                  title={isWatched ? "Remove from watchlist" : "Add to watchlist"}
                >
                  <Star className={`w-4 h-4 ${isWatched ? "fill-current text-gold" : ""}`} />
                </button>

                <div className="relative">
                  <button
                    onClick={() => setShowShareOptions(!showShareOptions)}
                    className="p-2.5 rounded border border-hairline/30 bg-black/20 text-ash hover:text-ivory hover:border-hairline/60 transition-colors flex items-center justify-center cursor-pointer"
                    title="Share market"
                  >
                    <Share2 className="w-4 h-4" />
                  </button>
                  
                  {showShareOptions && (
                    <div className="absolute right-0 mt-2 w-40 bg-panel border border-hairline/50 p-1.5 rounded  z-30 font-mono text-[10px] space-y-1">
                      <button
                        onClick={copyShareLink}
                        className="w-full text-left px-2 py-1.5 rounded hover:bg-ivory/5 text-ivory transition-colors flex items-center gap-2 cursor-pointer"
                      >
                        Copy link
                      </button>
                      <a
                        href={twitterShareUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full text-left px-2 py-1.5 rounded hover:bg-ivory/5 text-ivory transition-colors flex items-center gap-2 block"
                      >
                        <svg className="w-3 h-3 fill-current text-gold" viewBox="0 0 24 24">
                          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                        </svg>
                        Share on X
                      </a>
                      <a
                        href={telegramShareUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full text-left px-2 py-1.5 rounded hover:bg-ivory/5 text-ivory transition-colors flex items-center gap-2 block"
                      >
                        <Send className="w-3 h-3 text-verdigris" /> Telegram
                      </a>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <p className="text-[13px] text-ash leading-relaxed font-medium">
              {market.description}
            </p>

            <div className="grid grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4 pt-4 border-t border-hairline/30">
              {isOracleCategory(market.category) ? (
                <>
                  <div className="space-y-1 font-mono">
                    <div className="text-[10px] text-ash uppercase tracking-wider font-display font-bold">Target Price</div>
                    <div className="text-[15px] sm:text-[21px] font-bold text-ivory">
                      {formatTargetPrice(market.targetPrice, market.targetExpo)}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="text-[10px] text-ash uppercase tracking-wider font-display font-bold">Comparison Rule</div>
                    <div className="text-[15px] sm:text-[21px] font-bold text-ivory font-display uppercase tracking-wide">
                      {market.comparison === 0 ? "Greater Than" : "Less Than"}
                    </div>
                  </div>
                </>
              ) : (
                <div className="col-span-2 xl:col-span-2 space-y-1">
                  <div className="text-[10px] text-ash uppercase tracking-wider font-display font-bold">Settlement Mode</div>
                  <div className="text-[13px] font-bold text-gold font-display uppercase tracking-wide flex items-center gap-1.5 pt-0.5">
                    Manual Settle
                  </div>
                </div>
              )}

              <div className="space-y-1 col-span-2 xl:col-span-1">
                <div className="text-[10px] text-ash uppercase tracking-wider font-display font-bold">Ending clock</div>
                <div className="pt-1">
                  <FlipCountdown endTs={market.endTs.toNumber()} compact />
                </div>
              </div>
            </div>

            {isOracleCategory(market.category) && feedHex && (
              <div className="pt-4 border-t border-hairline/30">
                <LivePriceBar
                  feedIdHex={feedHex}
                  category={market.category}
                  targetPrice={market.targetPrice.toNumber()}
                  targetExpo={market.targetExpo}
                  comparison={market.comparison}
                />
              </div>
            )}

            {isOracleCategory(market.category) && (
              <div className="pt-4 border-t border-hairline/30 text-xs font-mono text-ash flex flex-col gap-1 text-left">
                <div className="text-[10px] uppercase font-bold tracking-wider font-display text-ash">Settlement Method</div>
                <div className="text-gold">
                  Oracle Settle (via Pyth Network feed{" "}
                  <span className="text-ivory select-all">
                    {feedHex || getFeedIdHexString(market.oracleFeedId)}
                  </span>
                  )
                </div>
              </div>
            )}
          </div>

          {/* Live Crypto Price Chart — isolated component, no parent re-renders */}
          {isOracleCategory(market.category) && (
            <LivePriceChartPanel />
          )}

          {/* Semicircle Probability Dial and Sparkline Trend */}
          <div className="surface p-6 sm:p-8 space-y-6">
            <h3 className="text-xs font-bold uppercase tracking-wider font-display text-ash flex items-center space-x-2">
              <TrendingUp className="w-4 h-4 text-gold" />
              <span>Implied Odds & Trend Dial</span>
            </h3>

            <div className="flex flex-col sm:flex-row items-center justify-between gap-8 py-2">
              <div className="flex-1 w-full space-y-4">
                <div className="grid grid-cols-2 gap-4 text-xs font-mono pt-2">
                  <div className="p-3 bg-panel rounded border border-hairline/30">
                    <div className="text-ash text-[9px] uppercase tracking-wider font-display font-bold">YES Pool Weight</div>
                    <div className="font-bold text-verdigris text-[13px] pt-1">{yesPool.toFixed(2)} SOL</div>
                  </div>
                  <div className="p-3 bg-panel rounded border border-hairline/30">
                    <div className="text-ash text-[9px] uppercase tracking-wider font-display font-bold">NO Pool Weight</div>
                    <div className="font-bold text-bordeaux text-[13px] pt-1">{noPool.toFixed(2)} SOL</div>
                  </div>
                </div>

                {/* Probability trend Line Chart */}
                {probHistory.current.length >= 1 && (
                  <div className="pt-2 border-t border-hairline/20">
                    <ProbabilityChart data={probHistory.current} />
                  </div>
                )}
              </div>

              {/* Probability Gauge */}
              <div className="w-full sm:w-56 flex-shrink-0">
                <ProbabilityOrb3D yesProb={yesProb} />
              </div>
            </div>
          </div>

          {/* YES vs NO Pool Liquidity Depth */}
          <OrderBookDepth yesPoolLamports={market.yesPoolLamports.toNumber()} noPoolLamports={market.noPoolLamports.toNumber()} marketPda={marketPda.toBase58()} onFillOrder={handleFillOrder} />

          {/* AI Market Whisperer (Powered by Claude) */}
          <AiMarketWhisperer
            question={market.question}
            description={market.description}
            yesProb={yesProb}
            noProb={noProb}
            yesPool={yesPool}
            noPool={noPool}
            category={categoryStr}
            marketPubkey={marketPda.toBase58()}
          />

          {/* Community Discussions & Sentiment */}
          <MarketComments marketPubkey={marketPda.toBase58()} />

          {/* Decoded On-chain Activity logs */}
          <ActivityFeedSection activity={activity} />

          {/* Trust Signals & Settlement Explainer Card */}
          <TrustSignalsSection
            treasuryBalance={treasuryBalance}
            feeBps={feeBps}
            marketCategory={market.category}
          />

          {/* Related markets from same category (DB cache) */}
          <RelatedMarkets category={categoryStr} excludePubkey={marketPda.toBase58()} />
        </section>

        {/* Right Column: Desktop Trading dashboard */}
        <section className="hidden md:block">
          <div
            className={`surface-feature p-6 space-y-6 ${successFlip ? "animate-success-flip" : ""}`}
          >
            <div className="border-b border-hairline pb-3">
              <div className="flex items-center justify-between">
                <h3 className="label-lux !text-ash">Position</h3>
                <div className="flex items-center gap-1.5 font-mono text-[10px]">
                  <span className="w-1.5 h-1.5 rounded-[2px] bg-verdigris animate-pulse inline-block" />
                  <span className="text-ash-dim">Live · {yesProb}% YES</span>
                </div>
              </div>
            </div>
            <TradingPanel
              status={status}
              marketPdaB58={marketPda.toBase58()}
              yesProb={yesProb}
              noProb={noProb}
              yesPool={yesPool}
              noPool={noPool}
              sharePriceSol={sharePriceSol}
              activeSharePriceSol={activeSharePriceSol}
              yesSharePriceSol={yesSharePriceSol}
              noSharePriceSol={noSharePriceSol}
              tradeCost={tradeCost}
              potentialPayout={potentialPayout}
              priceImpactPct={priceImpactPct}
              slippageWarning={slippageWarning}
              sellRefundSol={sellRefundSol}
              sellUnavailable={sellUnavailable}
              lp={lp}
              lpTokensMinted={lpTokensMinted}
              lpNewYesPoolSol={lpNewYesPoolSol}
              lpNewNoPoolSol={lpNewNoPoolSol}
              userYesBalance={userYesBalance}
              userNoBalance={userNoBalance}
              userOrders={userOrders}
              userLp={userLp}
              marketLpStats={marketLpStats}
              tradeTab={tradeTab}
              tradeSide={tradeSide}
              quantity={quantity}
              sellSide={sellSide}
              sellQuantity={sellQuantity}
              isLimitOrder={isLimitOrder}
              limitPriceSol={limitPriceSol}
              showAdvanced={showAdvanced}
              lpOption={lpOption}
              lpDepositAmount={lpDepositAmount}
              submitting={submitting}
              txState={txState}
              txSig={txSig}
              setTradeTab={setTradeTab}
              setTradeSide={setTradeSide}
              setQuantity={setQuantity}
              setSellSide={setSellSide}
              setSellQuantity={setSellQuantity}
              setIsLimitOrder={setIsLimitOrder}
              setLimitPriceSol={setLimitPriceSol}
              setShowAdvanced={setShowAdvanced}
              setLpOption={setLpOption}
              setLpDepositAmount={setLpDepositAmount}
              handleBuy={handleBuy}
              handleSell={handleSell}
              handleProvideLiquidity={handleProvideLiquidity}
              handlePlaceLimitOrder={handlePlaceLimitOrder}
              handleCancelOrder={handleCancelOrder}
            />
          </div>
        </section>
      </div>

      {/* Mobile Sticky floating trade button for thumb-reach */}
      <div className="md:hidden fixed bottom-16 left-0 right-0 z-40 bg-panel border-t border-hairline/30 p-4 flex items-center justify-between ">
        <div className="text-left font-mono">
          <div className="text-[8px] uppercase tracking-wider text-ash">Current Odds</div>
          <div className="text-xs font-bold text-gold">YES: {yesProb}% | NO: {noProb}%</div>
        </div>
        <button
          onClick={() => setIsMobileDrawerOpen(true)}
          className="btn-amber px-6 py-2.5 text-xs font-bold"
        >
          Predict Outcome
        </button>
      </div>

      {/* Mobile trading sheet drawer overlay */}
      <AnimatePresence>
        {isMobileDrawerOpen && (
          <>
            {/* Backdrop */}
            <div 
              className="fixed inset-0 bg-black/75 z-40" 
              onClick={() => setIsMobileDrawerOpen(false)}
            />
            {/* Bottom Drawer */}
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              className="fixed bottom-16 left-0 right-0 z-50 bg-panel border-t border-hairline rounded-[2px] p-6 space-y-4"
            >
              <div className="flex justify-between items-center border-b border-hairline/30 pb-2">
                <h4 className="text-xs font-bold uppercase tracking-wider font-display text-gold">
                  [■] Mobile Prediction Desk
                </h4>
                <button 
                  onClick={() => setIsMobileDrawerOpen(false)}
                  className="text-xs text-ash hover:text-ivory font-mono px-2 py-1 rounded border border-hairline/30"
                >
                  CLOSE
                </button>
              </div>
              <TradingPanel
                status={status}
                marketPdaB58={marketPda.toBase58()}
                yesProb={yesProb}
                noProb={noProb}
                yesPool={yesPool}
                noPool={noPool}
                sharePriceSol={sharePriceSol}
                activeSharePriceSol={activeSharePriceSol}
                yesSharePriceSol={yesSharePriceSol}
                noSharePriceSol={noSharePriceSol}
                tradeCost={tradeCost}
                potentialPayout={potentialPayout}
                priceImpactPct={priceImpactPct}
                slippageWarning={slippageWarning}
                sellRefundSol={sellRefundSol}
                sellUnavailable={sellUnavailable}
                lp={lp}
                lpTokensMinted={lpTokensMinted}
                lpNewYesPoolSol={lpNewYesPoolSol}
                lpNewNoPoolSol={lpNewNoPoolSol}
                userYesBalance={userYesBalance}
                userNoBalance={userNoBalance}
                userOrders={userOrders}
                userLp={userLp}
                marketLpStats={marketLpStats}
                tradeTab={tradeTab}
                tradeSide={tradeSide}
                quantity={quantity}
                sellSide={sellSide}
                sellQuantity={sellQuantity}
                isLimitOrder={isLimitOrder}
                limitPriceSol={limitPriceSol}
                showAdvanced={showAdvanced}
                lpOption={lpOption}
                lpDepositAmount={lpDepositAmount}
                submitting={submitting}
                txState={txState}
                txSig={txSig}
                setTradeTab={setTradeTab}
                setTradeSide={setTradeSide}
                setQuantity={setQuantity}
                setSellSide={setSellSide}
                setSellQuantity={setSellQuantity}
                setIsLimitOrder={setIsLimitOrder}
                setLimitPriceSol={setLimitPriceSol}
                setShowAdvanced={setShowAdvanced}
                setLpOption={setLpOption}
                setLpDepositAmount={setLpDepositAmount}
                handleBuy={handleBuy}
                handleSell={handleSell}
                handleProvideLiquidity={handleProvideLiquidity}
                handlePlaceLimitOrder={handlePlaceLimitOrder}
                handleCancelOrder={handleCancelOrder}
              />
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </main>
  );
}
