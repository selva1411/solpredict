"use client";

import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import Link from "next/link";
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
import { PublicKey, TransactionInstruction } from "@solana/web3.js";
import { getFriendlyErrorMessage } from "@/lib/error-map";
import { lamportsToSol, bnToNum } from "@/lib/format";
import { toast } from "sonner";
import { OrderBookDepth } from "@/components/OrderBookDepth";
import { LivePriceChartPanel } from "@/components/LivePriceChartPanel";
import { AiMarketWhisperer } from "@/components/AiMarketWhisperer";
import { MarketComments } from "@/components/MarketComments";
import { getWatchlist, toggleWatchlist } from "@/lib/watchlist";
import { getMarketStatusString } from "@/lib/events";
import { getConfigPda, getMarketPda, getYesMintPda, getNoMintPda, getTreasuryPda, getUserPositionPda } from "@/lib/pda";
import { txAccounts } from "@/lib/anchor-utils";
import { FlipCountdown } from "@/components/FlipCountdown";
import { feedIdBytesToHex, isOracleCategory } from "@/lib/pyth-feeds";
import { LivePriceBar } from "@/components/LivePriceBar";
import DualFillGauge from "@/components/DualFillGauge";

import { LoadingState, EmptyState, ErrorState, LiveIndicator } from "@/components/StatePanels";
import { GlassPanel } from "@/components/GlassPanel";
import { useDeviceCapability } from "@/hooks/useDeviceCapability";
import { fadeInUp, staggerContainer } from "@/lib/motion-variants";

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

function ProbabilityChart({ data }: { data: number[] }) {
  if (data.length <= 1) {
    return (
      <div className="h-32 flex items-center justify-center text-xs font-mono text-[#d6c4ac] border border-[#9e8e78]/20 bg-[#0d0d0d] rounded">
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
    <div className="w-full bg-[#0d0d0d] border border-[#9e8e78]/30 p-4 rounded space-y-2 select-none">
      <div className="flex justify-between items-center text-[10px] font-mono text-[#d6c4ac] uppercase font-bold">
        <span>Probability History Trend</span>
        <span className="text-[#a1d494]">YES %</span>
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
            stroke="#ffd89c"
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
                className="fill-[#131313] stroke-[#ffd89c]"
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

export default function MarketDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const { program, wallet, connection } = useProgram();
  
  const [market, setMarket] = useState<MarketDetails | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
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
  const [tradeTab, setTradeTab] = useState<"buy" | "sell">("buy");
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);
  const [limitPriceSol, setLimitPriceSol] = useState<number>(0.5);
  const [isLimitOrder, setIsLimitOrder] = useState<boolean>(false);
  const [userOrders, setUserOrders] = useState<any[]>([]);

  // Sparkline history — stores probability snapshots
  const probHistory = useRef<number[]>([50]);

  // Determine feed ID for live Pyth price (re-computed on every render from market state)
  const marketCategory = market?.category ?? -1;
  const marketFeedId = market?.oracleFeedId ?? null;
  const feedHex = useMemo(() => {
    if (marketFeedId && isOracleCategory(marketCategory)) {
      return feedIdBytesToHex(marketFeedId);
    }
    return null;
  }, [marketFeedId, marketCategory]);
  // NOTE: usePythPrices is now inside LivePriceBar — no parent re-renders from price ticks
  const marketPda = useMemo(() => new PublicKey(id as string), [id]);

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
      setUserYesBalance(yesAcc ? yesAcc.value.uiAmount ?? 0 : 0);
      setUserNoBalance(noAcc ? noAcc.value.uiAmount ?? 0 : 0);
    } catch (e) {
      console.error("Error fetching user balances:", e);
    }
  };

  const syncMarketToDb = useCallback(async (details: MarketDetails) => {
    try {
      await fetch("/api/sync/market", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          marketPubkey: marketPda.toBase58(),
          marketId: details.marketId.toNumber(),
          question: details.question,
          description: details.description,
          category: CATEGORIES[details.category] || "Crypto",
          status: details.status.open ? "open" : details.status.settled ? "settled" : "cancelled",
          yesPoolSol: details.yesPoolLamports.toNumber() / 1e9,
          noPoolSol: details.noPoolLamports.toNumber() / 1e9,
          yesSupply: details.yesSupply.toNumber(),
          noSupply: details.noSupply.toNumber(),
          endTs: details.endTs.toNumber(),
          resolveTs: details.resolveTs.toNumber(),
        }),
      });
    } catch {}
  }, [marketPda]);

  const syncTradeToDb = async (sig: string, side: "YES" | "NO", qty: number, isBuy: boolean = true) => {
    try {
      const lamportsIn = isBuy ? qty * (market?.sharePriceLamports?.toNumber() || 10000000) : 0;
      await fetch("/api/sync/trade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          signature: sig,
          marketPubkey: marketPda.toBase58(),
          trader: wallet!.publicKey!.toBase58(),
          side,
          lamportsIn,
          tokensOut: qty * 1_000_000,
          yesPoolSol: yesPool,
          noPoolSol: noPool,
          yesPct: yesProb,
        }),
      });
    } catch {}
  };

  const fetchUserOrders = useCallback(async () => {
    if (!wallet?.publicKey || !program) return;
    try {
      const allOrders = await program.account.order.all();
      const myOrders = allOrders.filter(
        (o: any) => {
          const isMarketMatch = o.account.market.equals(marketPda);
          const isMakerMatch = o.account.maker.equals(wallet.publicKey);
          const status = o.account.status;
          const isOpen = typeof status === "object" && status !== null ? "open" in status : status === 0;
          return isMarketMatch && isMakerMatch && isOpen;
        }
      );
      setUserOrders(myOrders);
    } catch (err) {
      console.error("Error fetching user orders:", err);
    }
  }, [wallet?.publicKey, program, marketPda]);

  // Fetch market details and transactions
  const fetchMarket = async () => {
    try {
      let marketAcc: MarketDetails | null = null;

      try {
        marketAcc = await program.account.market.fetch(marketPda) as unknown as MarketDetails;
      } catch {
        // Fallback: fetch from NeonDB cached markets if on-chain account was reset
        try {
          const res = await fetch("/api/markets/cached");
          if (res.ok) {
            const json = await res.json();
            if (json.markets) {
              const cached = json.markets.find((c: any) => c.marketPubkey === marketPda.toBase58());
              if (cached) {
                const catIdx = CATEGORIES.indexOf(cached.category) >= 0 ? CATEGORIES.indexOf(cached.category) : 0;
                const statusObj = cached.status === "settled" ? { settled: {} } : cached.status === "cancelled" ? { cancelled: {} } : { open: {} };
                const winObj = cached.winningOutcome === "YES" ? { yes: {} } : cached.winningOutcome === "NO" ? { no: {} } : { unset: {} };

                marketAcc = {
                  marketId: new anchor.BN(cached.marketId || 0),
                  authority: PublicKey.default,
                  question: cached.question,
                  description: cached.description || "",
                  category: catIdx,
                  oracleFeedId: Array(32).fill(0),
                  targetPrice: new anchor.BN(20000),
                  targetExpo: -2,
                  comparison: 0,
                  endTs: new anchor.BN(Math.floor(new Date(cached.endTs).getTime() / 1000)),
                  resolveTs: new anchor.BN(Math.floor(new Date(cached.resolveTs).getTime() / 1000)),
                  status: statusObj,
                  winningOutcome: winObj,
                  yesMint: PublicKey.default,
                  noMint: PublicKey.default,
                  yesPoolLamports: new anchor.BN(Math.round((cached.yesPoolSol || 0) * 1e9)),
                  noPoolLamports: new anchor.BN(Math.round((cached.noPoolSol || 0) * 1e9)),
                  yesSupply: new anchor.BN(cached.yesSupply || 0),
                  noSupply: new anchor.BN(cached.noSupply || 0),
                  totalPayoutPool: new anchor.BN(0),
                  sharePriceLamports: new anchor.BN(0.01 * 1e9),
                };
              }
            }
          }
        } catch (e) {
          console.warn("Could not fetch market fallback from database:", e);
        }
      }

      if (!marketAcc) {
        throw new Error("Market account does not exist on-chain or in database");
      }

      setMarket(marketAcc);
      setIsWatched(getWatchlist().includes(marketPda.toBase58()));
      recordProbabilitySnapshot(marketAcc);
      syncMarketToDb(marketAcc);

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
      const orderId = new anchor.BN(Date.now() % 1_000_000_000 + Math.floor(Math.random() * 1000));
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

      const sig = await builder
        .accounts(txAccounts({
          maker: wallet.publicKey,
          market: marketPda,
          order: orderPda,
          makerTokenAta,
          orderTokenEscrow,
        }))
        .rpc();

      setTxState("success");
      setTxSig(sig);
      toast.success(`Limit ${isBuy ? "Buy Bid" : "Sell Ask"} placed! (Sig: ${sig.slice(0, 8)}...)`);
      fetchMarket();
      fetchUserOrders();
      fetchUserBalances();
    } catch (err: any) {
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

      const sig = await program.methods
        .fillOrder(new anchor.BN(fillQty))
        .accounts(txAccounts({
          taker: wallet.publicKey,
          maker: ord.maker,
          market: marketPda,
          order: orderAccount.publicKey,
          takerTokenAta,
          makerTokenAta,
          orderTokenEscrow,
        }))
        .rpc();

      toast.success(`Filled ${fillQty} shares order! (Sig: ${sig.slice(0, 8)}...)`);
      fetchMarket();
      fetchUserOrders();
      fetchUserBalances();
    } catch (err: any) {
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

      const sig = await program.methods
        .cancelOrder()
        .accounts(txAccounts({
          maker: wallet.publicKey,
          market: marketPda,
          order: orderAccount.publicKey,
          makerTokenAta,
          orderTokenEscrow,
        }))
        .rpc();

      toast.success(`Limit Order cancelled! (Sig: ${sig.slice(0, 8)}...)`);
      fetchMarket();
      fetchUserOrders();
    } catch (err: any) {
      toast.error(`Cancel Order Failed: ${getFriendlyErrorMessage(err)}`);
    } finally {
      setSubmitting(false);
    }
  };

  const fetchActivity = async () => {
    try {
      const sigs = await connection.getSignaturesForAddress(marketPda, { limit: 15 });
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
    fetchMarket();
    fetchActivity();

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
            setMarket(decoded);
            recordProbabilitySnapshot(decoded);
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
  }, [id, program, connection, recordProbabilitySnapshot]);

  // (Live SOL price chart state is managed inside LivePriceChartPanel component)

  if (loading) {
    return (
      <div className="space-y-8">
        <div className="h-8 bg-white/5 border border-white/10 rounded w-1/3" />
        <div className="grid md:grid-cols-3 gap-8">
          <div className="md:col-span-2 space-y-8">
            <div className="board-panel p-10 h-96 skeleton-shimmer bg-[#131313]" />
            <div className="board-panel p-10 h-64 skeleton-shimmer bg-[#131313]" />
          </div>
          <div className="board-panel p-10 h-80 skeleton-shimmer bg-[#131313]" />
        </div>
      </div>
    );
  }

  if (!market) {
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
    const next = toggleWatchlist(marketPda.toBase58(), wallet?.publicKey?.toBase58());
    setIsWatched(next.includes(marketPda.toBase58()));
    toast.success(
      next.includes(marketPda.toBase58())
        ? "Added to watchlist (synced to NeonDB)!"
        : "Removed from watchlist!"
    );
  };

  const shareUrl = typeof window !== "undefined" ? window.location.href : "";
  const twitterShareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(
    `Predicting "${market.question}" on SOLPredict! Current YES Probability: ${Math.round((market.yesPoolLamports.toNumber() / (market.yesPoolLamports.toNumber() + market.noPoolLamports.toNumber() || 1)) * 100)}%`
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
  
  const sharePriceSol = lamportsToSol(market.sharePriceLamports);
  
  // CPMM Effective Share Prices with 0.0005 SOL floor protection
  const yesSharePriceSol = Math.max(0.0005, sharePriceSol * ((yesProb + 50) / 100));
  const noSharePriceSol = Math.max(0.0005, sharePriceSol * ((noProb + 50) / 100));
  const activeSharePriceSol = tradeSide === "YES" ? yesSharePriceSol : noSharePriceSol;

  const tradeCost = quantity * activeSharePriceSol;

  const getPotentialPayout = (): number => {
    const costLamports = quantity * market.sharePriceLamports.toNumber();
    const yesSupply = market.yesSupply.toNumber() / 1e6;
    const noSupply = market.noSupply.toNumber() / 1e6;
    const totalPoolLamports = market.yesPoolLamports.toNumber() + market.noPoolLamports.toNumber();
    
    if (tradeSide === "YES") {
      const simulatedYesSupply = yesSupply + quantity;
      const simulatedTotalPool = totalPoolLamports + costLamports;
      return simulatedYesSupply > 0 ? (simulatedTotalPool * quantity) / (simulatedYesSupply * 1e9) : 0;
    } else {
      const simulatedNoSupply = noSupply + quantity;
      const simulatedTotalPool = totalPoolLamports + costLamports;
      return simulatedNoSupply > 0 ? (simulatedTotalPool * quantity) / (simulatedNoSupply * 1e9) : 0;
    }
  };

  const potentialPayout = getPotentialPayout();

  const handleBuy = async () => {
    if (!wallet || !wallet.publicKey) {
      toast.error("Please connect your wallet first.");
      return;
    }
    
    try {
      setTxState("signing");
      setSubmitting(true);
      
      const sideParam: { yes?: Record<string, never>; no?: Record<string, never> } = tradeSide === "YES" ? { yes: {} } : { no: {} };
      const yesMintPda = getYesMintPda(marketPda, program.programId);
      const noMintPda = getNoMintPda(marketPda, program.programId);
      const treasuryPda = getTreasuryPda(marketPda, program.programId);
      
      const buyerYesAta = getAssociatedTokenAddressSync(yesMintPda, wallet.publicKey);
      const buyerNoAta = getAssociatedTokenAddressSync(noMintPda, wallet.publicKey);
      const userPositionPda = getUserPositionPda(marketPda, wallet.publicKey, program.programId);

      setTxState("confirming");
      const sig = await program.methods
        .buyShares(sideParam, new anchor.BN(quantity))
        .accounts(txAccounts({
          buyer: wallet.publicKey,
          market: marketPda,
          treasury: treasuryPda,
          yesMint: yesMintPda,
          noMint: noMintPda,
          buyerYesAta: buyerYesAta,
          buyerNoAta: buyerNoAta,
          userPosition: userPositionPda,
        }))
        .rpc();

      setTxSig(sig);
      setTxState("success");
      setSuccessFlip(true);
      setTimeout(() => setSuccessFlip(false), 800);

      toast.success(`Position acquired: ${quantity} ${tradeSide} shares!`);
      setIsMobileDrawerOpen(false);
      syncTradeToDb(sig, tradeSide, quantity, true);
      fetchMarket();
      fetchActivity();
    } catch (err: unknown) {
      setTxState("error");
      console.error("Buy shares error:", err);
      toast.error(`Purchase failed: ${getFriendlyErrorMessage(err)}`);
    } finally {
      setSubmitting(false);
      setTimeout(() => setTxState("idle"), 4000);
    }
  };

  const handleSell = async () => {
    if (!wallet?.publicKey) {
      toast.error("Please connect your wallet first.");
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

      await program.methods
        .sellShares(sideParam, new anchor.BN(sellQuantity))
        .accounts(txAccounts({
          seller: wallet.publicKey,
          market: marketPda,
          treasury: treasuryPda,
          yesMint: yesMintPda,
          noMint: noMintPda,
          sellerYesAta,
          sellerNoAta,
          userPosition: userPositionPda,
        }))
        .rpc();

      toast.success(`Sold ${sellQuantity} ${sellSide} shares!`);
      syncTradeToDb("tx_sell_" + Date.now(), sellSide, sellQuantity, false);
      fetchMarket();
      fetchActivity();
      fetchUserBalances();
    } catch (err: unknown) {
      console.error("Sell shares error:", err);
      toast.error(`Sell failed: ${getFriendlyErrorMessage(err)}`);
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

  const renderTradingDashboard = () => {
    // Probability prices as cents (0-100)
    const yesPrice = yesProb; // e.g. 67¢
    const noPrice = noProb;   // e.g. 33¢

    // Dynamic cost with current price
    const effectivePrice = isLimitOrder ? limitPriceSol : sharePriceSol;
    const totalCost = quantity * effectivePrice;
    const avgPricePct = tradeSide === "YES" ? yesPrice : noPrice;
    const potReturn = totalCost > 0 ? (quantity / (totalCost / 1)) : 0;

    return (
    <div className="space-y-0">
      {status !== "Open" ? (
        <div className="py-8 text-center space-y-4">
          <div className="mx-auto w-12 h-12 bg-[#ffd89c]/10 text-[#ffd89c] rounded flex items-center justify-center border border-[#ffd89c]/25">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h4 className="text-sm font-bold text-[#e5e2e1] uppercase">TRADING TERMINATED</h4>
            <p className="text-xs text-[#d6c4ac]">
              This board has settled. Go to your <Link href="/dashboard" className="text-[#ffd89c] hover:underline font-bold">Dashboard</Link> to withdraw payout.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-0">

          {/* ── Buy / Sell Tabs ── */}
          <div className="flex border-b border-[#9e8e78]/20">
            {(["buy", "sell"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setTradeTab(tab)}
                className={`flex-1 py-3 text-sm font-bold uppercase tracking-widest transition-all cursor-pointer ${
                  tradeTab === tab
                    ? "border-b-2 border-[#ffd89c] text-[#ffd89c]"
                    : "text-[#9e8e78] hover:text-[#d6c4ac]"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {tradeTab === "buy" ? (
            <div className="space-y-4 pt-4">

              {/* Outcome Buttons — Polymarket style probability prices + SOL pricing */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setTradeSide("YES")}
                  className={`group relative flex flex-col items-center justify-center py-4 rounded-lg border-2 transition-all cursor-pointer ${
                    tradeSide === "YES"
                      ? "border-[#22c55e] bg-[#22c55e]/12 shadow-[0_0_20px_rgba(34,197,94,0.15)]"
                      : "border-[#9e8e78]/25 bg-[#0d0d0d] hover:border-[#22c55e]/50 hover:bg-[#22c55e]/5"
                  }`}
                >
                  <span className={`text-[10px] font-bold uppercase tracking-widest mb-1 ${
                    tradeSide === "YES" ? "text-[#22c55e]" : "text-[#9e8e78] group-hover:text-[#22c55e]"
                  }`}>Yes</span>
                  <span className={`text-2xl font-black font-mono ${
                    tradeSide === "YES" ? "text-[#22c55e]" : "text-[#e5e2e1]"
                  }`}>{yesProb}¢</span>
                  <span className="text-[10px] text-[#22c55e] font-mono font-semibold mt-0.5">{yesSharePriceSol.toFixed(4)} SOL</span>
                  <span className="text-[9px] text-[#9e8e78] mt-0.5 font-mono">{yesPool.toFixed(2)} SOL pool</span>
                </button>
                <button
                  onClick={() => setTradeSide("NO")}
                  className={`group relative flex flex-col items-center justify-center py-4 rounded-lg border-2 transition-all cursor-pointer ${
                    tradeSide === "NO"
                      ? "border-[#ef4444] bg-[#ef4444]/12 shadow-[0_0_20px_rgba(239,68,68,0.15)]"
                      : "border-[#9e8e78]/25 bg-[#0d0d0d] hover:border-[#ef4444]/50 hover:bg-[#ef4444]/5"
                  }`}
                >
                  <span className={`text-[10px] font-bold uppercase tracking-widest mb-1 ${
                    tradeSide === "NO" ? "text-[#ef4444]" : "text-[#9e8e78] group-hover:text-[#ef4444]"
                  }`}>No</span>
                  <span className={`text-2xl font-black font-mono ${
                    tradeSide === "NO" ? "text-[#ef4444]" : "text-[#e5e2e1]"
                  }`}>{noProb}¢</span>
                  <span className="text-[10px] text-[#ef4444] font-mono font-semibold mt-0.5">{noSharePriceSol.toFixed(4)} SOL</span>
                  <span className="text-[9px] text-[#9e8e78] mt-0.5 font-mono">{noPool.toFixed(2)} SOL pool</span>
                </button>
              </div>

              {/* Amount input */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-[#9e8e78] uppercase tracking-wider">Amount (Shares)</label>
                  {wallet?.publicKey && (
                    <span className="text-[10px] font-mono text-[#9e8e78]">
                      {tradeSide === "YES" ? `${userYesBalance.toFixed(1)} YES` : `${userNoBalance.toFixed(1)} NO`} held
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setQuantity(Math.max(1, quantity - 10))}
                    className="w-9 h-9 rounded-lg bg-[#1c1c1c] border border-[#9e8e78]/30 hover:border-[#9e8e78]/60 text-[#e5e2e1] font-mono font-bold text-base cursor-pointer transition-all"
                  >−</button>
                  <input
                    type="number"
                    value={quantity}
                    min={1}
                    onChange={(e) => setQuantity(Math.max(1, Number(e.target.value)))}
                    className="flex-1 bg-[#0d0d0d] border border-[#9e8e78]/40 rounded-lg px-3 py-2 text-center text-sm font-mono text-[#e5e2e1] focus:outline-none focus:border-[#ffd89c]/60"
                  />
                  <button
                    onClick={() => setQuantity(quantity + 10)}
                    className="w-9 h-9 rounded-lg bg-[#1c1c1c] border border-[#9e8e78]/30 hover:border-[#9e8e78]/60 text-[#e5e2e1] font-mono font-bold text-base cursor-pointer transition-all"
                  >+</button>
                </div>
                <div className="grid grid-cols-5 gap-1">
                  {[10, 25, 50, 100, 250].map((v) => (
                    <button key={v} onClick={() => setQuantity(v)}
                      className={`py-1 rounded text-[10px] font-mono cursor-pointer transition-all border ${
                        quantity === v
                          ? "border-[#ffd89c]/60 bg-[#ffd89c]/10 text-[#ffd89c]"
                          : "border-[#9e8e78]/20 bg-[#0d0d0d] text-[#9e8e78] hover:text-[#e5e2e1] hover:border-[#9e8e78]/40"
                      }`}>{v}</button>
                  ))}
                </div>
              </div>

              {/* Advanced: Limit Order toggle */}
              <div className="border border-[#9e8e78]/20 rounded-lg overflow-hidden">
                <button
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="w-full flex items-center justify-between px-3 py-2 text-[11px] font-mono text-[#9e8e78] hover:text-[#d6c4ac] cursor-pointer transition-colors bg-[#0d0d0d]"
                >
                  <span>Advanced: Limit Order</span>
                  <span className={`transition-transform ${showAdvanced ? 'rotate-180' : ''}`}>▾</span>
                </button>
                {showAdvanced && (
                  <div className="px-3 pb-3 pt-2 bg-[#0d0d0d] space-y-3 border-t border-[#9e8e78]/15">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setIsLimitOrder(!isLimitOrder)}
                        className={`relative w-8 h-4 rounded-full transition-colors cursor-pointer ${
                          isLimitOrder ? "bg-[#ffd89c]" : "bg-[#353534]"
                        }`}
                      >
                        <span className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${
                          isLimitOrder ? "left-4.5 left-[18px]" : "left-0.5"
                        }`} />
                      </button>
                      <span className="text-[11px] text-[#d6c4ac]">Place as limit order</span>
                    </div>
                    {isLimitOrder && (
                      <div className="space-y-1">
                        <label className="text-[10px] text-[#9e8e78] uppercase tracking-wider">Limit Price (SOL/share)</label>
                        <input
                          type="number" step="0.01" min="0.01" max="0.99"
                          value={limitPriceSol}
                          onChange={(e) => setLimitPriceSol(Math.max(0.01, Math.min(0.99, Number(e.target.value))))}
                          className="w-full bg-[#131313] border border-[#9e8e78]/40 rounded px-3 py-1.5 text-sm font-mono text-[#e5e2e1] focus:outline-none focus:border-[#ffd89c]/60"
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Order Summary */}
              <div className="bg-[#0d0d0d] rounded-lg border border-[#9e8e78]/20 p-3 space-y-2 text-[11px] font-mono">
                <div className="flex justify-between text-[#9e8e78]">
                  <span>Price per share</span>
                  <span className="text-[#e5e2e1]">{isLimitOrder ? `${limitPriceSol.toFixed(4)} SOL` : `${activeSharePriceSol.toFixed(4)} SOL`}</span>
                </div>
                <div className="flex justify-between text-[#9e8e78]">
                  <span>Quantity</span>
                  <span className="text-[#e5e2e1]">{quantity} shares</span>
                </div>
                <div className="flex justify-between text-[#e5e2e1] font-bold border-t border-[#9e8e78]/15 pt-2">
                  <span>Total Investment Amount</span>
                  <span className="text-[#ffd89c] font-mono text-xs">{isLimitOrder ? (quantity * limitPriceSol).toFixed(4) : tradeCost.toFixed(4)} SOL</span>
                </div>
                <div className="flex justify-between border-t border-[#9e8e78]/15 pt-2">
                  <span className="text-[#9e8e78]">Est. Payout on Win</span>
                  <span className={`font-bold ${
                    tradeSide === "YES" ? "text-[#22c55e]" : "text-[#ef4444]"
                  }`}>{potentialPayout.toFixed(4)} SOL</span>
                </div>
                {potentialPayout > 0 && (
                  <div className="flex justify-between text-[10px]">
                    <span className="text-[#9e8e78]">Est. Net Profit</span>
                    <span className="text-[#22c55e] font-bold">
                      +{(potentialPayout - (isLimitOrder ? quantity * limitPriceSol : tradeCost)).toFixed(4)} SOL
                      {" "}(+{(((potentialPayout - (isLimitOrder ? quantity * limitPriceSol : tradeCost)) / Math.max(0.0001, (isLimitOrder ? quantity * limitPriceSol : tradeCost))) * 100).toFixed(0)}% return)
                    </span>
                  </div>
                )}
              </div>

              {/* CTA Button */}
              <button
                disabled={submitting}
                onClick={isLimitOrder ? () => handlePlaceLimitOrder(true) : handleBuy}
                className={`w-full py-3.5 rounded-lg text-sm font-bold uppercase tracking-widest cursor-pointer transition-all flex items-center justify-center gap-2 ${
                  tradeSide === "YES"
                    ? "bg-[#22c55e] hover:bg-[#16a34a] text-white shadow-[0_4px_14px_rgba(34,197,94,0.3)]"
                    : "bg-[#ef4444] hover:bg-[#dc2626] text-white shadow-[0_4px_14px_rgba(239,68,68,0.3)]"
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {submitting && <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
                {isLimitOrder
                  ? `Place Limit ${tradeSide} Order`
                  : `Buy ${tradeSide}`
                }
              </button>

              {/* Tx status */}
              {txState === "signing" && <p className="text-center text-xs font-mono text-[#ffd89c] animate-pulse">⏳ Approve in wallet...</p>}
              {txState === "confirming" && <p className="text-center text-xs font-mono text-[#ffd89c] animate-pulse">⛓ Confirming on-chain...</p>}
              {txState === "success" && txSig && (
                <p className="text-center text-xs font-mono text-[#22c55e]">
                  ✓ Done —{" "}
                  <a href={`https://solscan.io/tx/${txSig}?cluster=localnet`} target="_blank" rel="noopener noreferrer" className="underline">View tx</a>
                </p>
              )}
              {txState === "error" && <p className="text-center text-xs font-mono text-[#ef4444]">✗ Transaction failed</p>}

              {/* Active limit orders */}
              {userOrders.length > 0 && (
                <div className="pt-2 border-t border-[#9e8e78]/20 space-y-2">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#9e8e78]">Your Open Orders</p>
                  {userOrders.map((ordAcc, idx) => {
                    const ord = ordAcc.account;
                    const sideStr = "yes" in ord.side ? "YES" : "NO";
                    const priceSol = (ord.priceBps.toNumber() / 10000).toFixed(2);
                    const qty2 = ord.quantity.toNumber();
                    const filled = ord.filledQuantity.toNumber();
                    return (
                      <div key={idx} className="flex items-center justify-between p-2 rounded-lg bg-[#0d0d0d] border border-[#9e8e78]/20 text-[10px] font-mono">
                        <div>
                          <span className={ord.isBuy ? "text-[#22c55e] font-bold" : "text-[#ef4444] font-bold"}>
                            {ord.isBuy ? "BUY" : "SELL"} {sideStr}
                          </span>
                          <span className="text-[#9e8e78] ml-2">@ {priceSol} SOL</span>
                          <span className="text-[#9e8e78] ml-2">{filled}/{qty2} filled</span>
                        </div>
                        <button
                          onClick={() => handleCancelOrder(ordAcc)}
                          className="text-[#ef4444] hover:text-[#ff6b6b] cursor-pointer underline"
                        >Cancel</button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            /* ── Sell Tab ── */
            <div className="space-y-4 pt-4">
              {/* User balances */}
              <div className="grid grid-cols-2 gap-2">
                <div className="p-3 rounded-lg bg-[#0d0d0d] border border-[#22c55e]/20 text-center">
                  <div className="text-[9px] uppercase tracking-wider text-[#9e8e78] font-bold">YES Shares</div>
                  <div className="text-lg font-black font-mono text-[#22c55e] mt-0.5">{userYesBalance.toFixed(1)}</div>
                </div>
                <div className="p-3 rounded-lg bg-[#0d0d0d] border border-[#ef4444]/20 text-center">
                  <div className="text-[9px] uppercase tracking-wider text-[#9e8e78] font-bold">NO Shares</div>
                  <div className="text-lg font-black font-mono text-[#ef4444] mt-0.5">{userNoBalance.toFixed(1)}</div>
                </div>
              </div>

              {/* Which side to sell */}
              <div className="grid grid-cols-2 gap-2">
                {(["YES", "NO"] as const).map((s) => (
                  <button key={s} onClick={() => setSellSide(s)}
                    className={`py-2.5 rounded-lg border-2 text-sm font-bold uppercase tracking-wide cursor-pointer transition-all ${
                      sellSide === s
                        ? s === "YES"
                          ? "border-[#22c55e] bg-[#22c55e]/10 text-[#22c55e]"
                          : "border-[#ef4444] bg-[#ef4444]/10 text-[#ef4444]"
                        : "border-[#9e8e78]/25 bg-[#0d0d0d] text-[#9e8e78]"
                    }`}
                  >{s}</button>
                ))}
              </div>

              {/* Amount */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-[#9e8e78] uppercase tracking-wider">Sell Quantity</label>
                  <button
                    onClick={() => setSellQuantity(Math.floor(sellSide === "YES" ? userYesBalance : userNoBalance))}
                    className="text-[10px] text-[#ffd89c] hover:underline cursor-pointer font-mono font-bold"
                  >
                    MAX ({Math.floor(sellSide === "YES" ? userYesBalance : userNoBalance)})
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => setSellQuantity(Math.max(1, sellQuantity - 5))}
                    className="w-9 h-9 rounded-lg bg-[#1c1c1c] border border-[#9e8e78]/30 text-[#e5e2e1] font-mono font-bold cursor-pointer">−</button>
                  <input type="number" value={sellQuantity} min={1}
                    onChange={(e) => setSellQuantity(Math.max(1, Number(e.target.value)))}
                    className="flex-1 bg-[#0d0d0d] border border-[#9e8e78]/40 rounded-lg px-3 py-2 text-center text-sm font-mono text-[#e5e2e1] focus:outline-none focus:border-[#ffd89c]/60" />
                  <button onClick={() => setSellQuantity(sellQuantity + 5)}
                    className="w-9 h-9 rounded-lg bg-[#1c1c1c] border border-[#9e8e78]/30 text-[#e5e2e1] font-mono font-bold cursor-pointer">+</button>
                </div>
              </div>

              {/* Advanced: Limit Sell Ask toggle */}
              <div className="border border-[#9e8e78]/20 rounded-lg overflow-hidden">
                <button
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="w-full flex items-center justify-between px-3 py-2 text-[11px] font-mono text-[#9e8e78] hover:text-[#d6c4ac] cursor-pointer transition-colors bg-[#0d0d0d]"
                >
                  <span>Advanced: Limit Sell (Ask)</span>
                  <span className={`transition-transform ${showAdvanced ? 'rotate-180' : ''}`}>▾</span>
                </button>
                {showAdvanced && (
                  <div className="px-3 pb-3 pt-2 bg-[#0d0d0d] space-y-3 border-t border-[#9e8e78]/15">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setIsLimitOrder(!isLimitOrder)}
                        className={`relative w-8 h-4 rounded-full transition-colors cursor-pointer ${
                          isLimitOrder ? "bg-[#ffd89c]" : "bg-[#353534]"
                        }`}
                      >
                        <span className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${
                          isLimitOrder ? "left-4.5 left-[18px]" : "left-0.5"
                        }`} />
                      </button>
                      <span className="text-[11px] text-[#d6c4ac]">Place as limit sell (ask)</span>
                    </div>
                    {isLimitOrder && (
                      <div className="space-y-1">
                        <label className="text-[10px] text-[#9e8e78] uppercase tracking-wider">Min Sell Price (SOL/share)</label>
                        <input
                          type="number" step="0.01" min="0.01" max="0.99"
                          value={limitPriceSol}
                          onChange={(e) => setLimitPriceSol(Math.max(0.01, Math.min(0.99, Number(e.target.value))))}
                          className="w-full bg-[#131313] border border-[#9e8e78]/40 rounded px-3 py-1.5 text-sm font-mono text-[#e5e2e1] focus:outline-none focus:border-[#ffd89c]/60"
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Summary */}
              <div className="bg-[#0d0d0d] rounded-lg border border-[#9e8e78]/20 p-3 space-y-2 text-[11px] font-mono">
                <div className="flex justify-between">
                  <span className="text-[#9e8e78]">Shares to sell</span>
                  <span className="text-[#e5e2e1]">{sellQuantity} {sellSide}</span>
                </div>
                <div className="flex justify-between border-t border-[#9e8e78]/15 pt-2">
                  <span className="text-[#9e8e78]">Est. payout</span>
                  <span className="text-[#22c55e] font-bold">
                    {isLimitOrder ? (sellQuantity * limitPriceSol).toFixed(4) : (sellQuantity * sharePriceSol).toFixed(4)} SOL
                  </span>
                </div>
              </div>

              <button
                disabled={submitting || (sellSide === "YES" ? userYesBalance < sellQuantity : userNoBalance < sellQuantity)}
                onClick={isLimitOrder ? () => handlePlaceLimitOrder(false) : handleSell}
                className={`w-full py-3.5 rounded-lg text-sm font-bold uppercase tracking-widest cursor-pointer transition-all ${
                  sellSide === "YES"
                    ? "bg-[#22c55e]/15 text-[#22c55e] border-2 border-[#22c55e]/40 hover:bg-[#22c55e]/25"
                    : "bg-[#ef4444]/15 text-[#ef4444] border-2 border-[#ef4444]/40 hover:bg-[#ef4444]/25"
                } disabled:opacity-40 disabled:cursor-not-allowed`}
              >
                {submitting ? "Processing..." : isLimitOrder ? `Place Limit Sell Ask (${sellQuantity} ${sellSide})` : `Instant Sell ${sellQuantity} ${sellSide} Shares`}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
    );
  };

  return (
    <div className="space-y-8 font-sans">
      <Link href="/markets" className="inline-flex items-center space-x-2 text-xs uppercase tracking-wider font-display text-[#d6c4ac] hover:text-[#e5e2e1] transition-colors">
        <ArrowLeft className="w-4 h-4" />
        <span>Explorer Board</span>
      </Link>

      <div className="grid md:grid-cols-3 gap-8 items-start">
        {/* Left Column: Contract specs & visuals */}
        <section className="md:col-span-2 space-y-8">
          {/* Main info panel */}
          <div className="glass-panel p-6 sm:p-8 space-y-6">
            <div className="flex items-center space-x-3">
              <span className="px-2 py-0.5 text-[9px] font-bold font-mono uppercase tracking-wider rounded bg-white/5 border border-[#9e8e78]/30 text-[#ffd89c]">
                {categoryStr}
              </span>
              <span className="text-xs font-mono text-[#d6c4ac]">BOARD ID #{market.marketId?.toString()}</span>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
              <h1 className="text-2xl sm:text-3xl font-bold font-display text-[#e5e2e1] uppercase leading-tight flex-1">
                {market.question}
              </h1>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleWatchlistToggle}
                  className={`p-2.5 rounded border transition-colors flex items-center justify-center cursor-pointer ${
                    isWatched
                      ? "border-[#ffd89c] bg-[#ffd89c]/10 text-[#ffd89c]"
                      : "border-[#9e8e78]/30 bg-black/20 text-[#d6c4ac] hover:text-[#e5e2e1] hover:border-[#9e8e78]/60"
                  }`}
                  title={isWatched ? "Remove from watchlist" : "Add to watchlist"}
                >
                  <Star className={`w-4 h-4 ${isWatched ? "fill-current text-[#ffd89c]" : ""}`} />
                </button>

                <div className="relative">
                  <button
                    onClick={() => setShowShareOptions(!showShareOptions)}
                    className="p-2.5 rounded border border-[#9e8e78]/30 bg-black/20 text-[#d6c4ac] hover:text-[#e5e2e1] hover:border-[#9e8e78]/60 transition-colors flex items-center justify-center cursor-pointer"
                    title="Share market"
                  >
                    <Share2 className="w-4 h-4" />
                  </button>
                  
                  {showShareOptions && (
                    <div className="absolute right-0 mt-2 w-40 bg-[#0d0d0d] border border-[#9e8e78]/50 p-1.5 rounded shadow-2xl z-30 font-mono text-[10px] space-y-1">
                      <button
                        onClick={copyShareLink}
                        className="w-full text-left px-2 py-1.5 rounded hover:bg-white/5 text-[#e5e2e1] transition-colors flex items-center gap-2 cursor-pointer"
                      >
                        🔗 Copy link
                      </button>
                      <a
                        href={twitterShareUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full text-left px-2 py-1.5 rounded hover:bg-white/5 text-[#e5e2e1] transition-colors flex items-center gap-2 block"
                      >
                        <svg className="w-3 h-3 fill-current text-[#ffd89c]" viewBox="0 0 24 24">
                          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                        </svg>
                        Share on X
                      </a>
                      <a
                        href={telegramShareUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full text-left px-2 py-1.5 rounded hover:bg-white/5 text-[#e5e2e1] transition-colors flex items-center gap-2 block"
                      >
                        <Send className="w-3 h-3 text-[#a1d494]" /> Telegram
                      </a>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <p className="text-sm text-[#d6c4ac] leading-relaxed font-medium">
              {market.description}
            </p>

            <div className="grid grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4 pt-4 border-t border-[#9e8e78]/30">
              {isOracleCategory(market.category) ? (
                <>
                  <div className="space-y-1 font-mono">
                    <div className="text-[10px] text-[#d6c4ac] uppercase tracking-wider font-display font-bold">Target Price</div>
                    <div className="text-base sm:text-lg font-bold text-[#e5e2e1]">
                      {formatTargetPrice(market.targetPrice, market.targetExpo)}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="text-[10px] text-[#d6c4ac] uppercase tracking-wider font-display font-bold">Comparison Rule</div>
                    <div className="text-base sm:text-lg font-bold text-[#e5e2e1] font-display uppercase tracking-wide">
                      {market.comparison === 0 ? "Greater Than" : "Less Than"}
                    </div>
                  </div>
                </>
              ) : (
                <div className="col-span-2 xl:col-span-2 space-y-1">
                  <div className="text-[10px] text-[#d6c4ac] uppercase tracking-wider font-display font-bold">Settlement Mode</div>
                  <div className="text-sm font-bold text-[#ffd89c] font-display uppercase tracking-wide flex items-center gap-1.5 pt-0.5">
                    ⚖️ Manual Settle
                  </div>
                </div>
              )}

              <div className="space-y-1 col-span-2 xl:col-span-1">
                <div className="text-[10px] text-[#d6c4ac] uppercase tracking-wider font-display font-bold">Ending clock</div>
                <div className="pt-1">
                  <FlipCountdown endTs={market.endTs.toNumber()} compact />
                </div>
              </div>
            </div>

            {isOracleCategory(market.category) && feedHex && (
              <div className="pt-4 border-t border-[#9e8e78]/30">
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
              <div className="pt-4 border-t border-[#9e8e78]/30 text-xs font-mono text-[#d6c4ac] flex flex-col gap-1 text-left">
                <div className="text-[10px] uppercase font-bold tracking-wider font-display text-[#d6c4ac]">Settlement Method</div>
                <div className="text-[#ffd89c]">
                  🔮 Oracle Settle (via Pyth Network feed{" "}
                  <span className="text-[#e5e2e1] select-all">
                    {getFeedIdHexString(market.oracleFeedId)}
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
          <div className="glass-panel p-6 sm:p-8 space-y-6">
            <h3 className="text-xs font-bold uppercase tracking-wider font-display text-[#d6c4ac] flex items-center space-x-2">
              <TrendingUp className="w-4 h-4 text-[#ffd89c]" />
              <span>Implied Odds & Trend Dial</span>
            </h3>

            <div className="flex flex-col sm:flex-row items-center justify-between gap-8 py-2">
              <div className="flex-1 w-full space-y-4">
                <div className="grid grid-cols-2 gap-4 text-xs font-mono pt-2">
                  <div className="p-3 bg-[#0d0d0d] rounded border border-[#9e8e78]/30">
                    <div className="text-[#d6c4ac] text-[9px] uppercase tracking-wider font-display font-bold">YES Pool Weight</div>
                    <div className="font-bold text-[#a1d494] text-sm pt-1">{yesPool.toFixed(2)} SOL</div>
                  </div>
                  <div className="p-3 bg-[#0d0d0d] rounded border border-[#9e8e78]/30">
                    <div className="text-[#d6c4ac] text-[9px] uppercase tracking-wider font-display font-bold">NO Pool Weight</div>
                    <div className="font-bold text-[#ffb4ab] text-sm pt-1">{noPool.toFixed(2)} SOL</div>
                  </div>
                </div>

                {/* Probability trend Line Chart */}
                {probHistory.current.length >= 1 && (
                  <div className="pt-2 border-t border-[#9e8e78]/20">
                    <ProbabilityChart data={probHistory.current} />
                  </div>
                )}
              </div>

              {/* Probability Gauge */}
              <div className="w-full sm:w-56 flex-shrink-0">
                <DualFillGauge yesPct={yesProb} noPct={noProb} />
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
          />

          {/* Community Discussions & Sentiment */}
          <MarketComments marketPubkey={marketPda.toBase58()} />

          {/* Decoded On-chain Activity logs */}
          <div className="glass-panel p-6 space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider font-display text-[#d6c4ac] flex items-center space-x-2">
              <Activity className="w-4 h-4 text-[#ffd89c]" />
              <span>Decoded On-Chain Transactions</span>
              <div className="ml-auto flex items-center gap-2">
                <LiveIndicator isLive={activity.length > 0} label={activity.length > 0 ? "Streaming" : "Idle"} />
              </div>
            </h3>
            
            <div className="space-y-2 font-mono text-xs max-h-96 overflow-y-auto scrollbar-thin">
              {activity.length === 0 ? (
                <EmptyState
                  icon={Activity}
                  title="No Transactions Yet"
                  description="No matching transaction logs decoded. New activity will appear here in real-time."
                />
              ) : (
                activity.map((item, index) => {
                  const isSettle = item.side === "SETTLE";
                  const isClaim = item.side === "CLAIM";
                  const isYes = item.side === "YES";
                  const isNo = item.side === "NO";
                  const isNew = index < 3;

                  let badgeColor = "bg-white/5 text-[#e5e2e1]";
                  if (isYes) badgeColor = "bg-[#a1d494]/10 text-[#a1d494] border border-[#a1d494]/20";
                  if (isNo) badgeColor = "bg-[#ffb4ab]/10 text-[#ffb4ab] border border-[#ffb4ab]/20";
                  if (isSettle) badgeColor = "bg-[#ffd89c]/10 text-[#ffd89c] border border-[#ffd89c]/20";

                  return (
                    <div
                      key={item.signature + "-" + index}
                      className={`flex flex-col sm:flex-row sm:items-center justify-between py-2.5 border-b border-[#9e8e78]/10 hover:bg-white/5 px-2 rounded gap-1 sm:gap-0 ${isNew ? "bg-[#ffd89c]/3 border-l-2 border-l-[#a1d494]" : ""}`}
                    >
                      <div className="flex items-center space-x-2.5 min-w-0">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold shrink-0 ${badgeColor}`}>
                          {item.side}
                        </span>
                        <span className="text-[#e5e2e1] text-[11px] truncate">
                          {isSettle ? (
                            <span>BOARD FINALIZED (OUTCOME {item.quantity === 1 ? "YES" : "NO"})</span>
                          ) : isClaim ? (
                            <span>REWARD WITHDRAWAL: {item.cost.toFixed(2)} SOL</span>
                          ) : (
                            <span>{item.quantity} SHARES AT {item.cost.toFixed(2)} SOL</span>
                          )}
                        </span>
                        {isNew && (
                          <span className="text-[8px] font-mono font-bold text-[#a1d494] bg-[#a1d494]/10 px-1 py-0.5 rounded border border-[#a1d494]/20 shrink-0">
                            NEW
                          </span>
                        )}
                      </div>
                      <div className="text-[#d6c4ac] text-[10px] flex items-center space-x-2 ml-7 sm:ml-0">
                        <span className="hidden sm:inline">@{item.buyer.slice(0, 4)}...</span>
                        <span>{item.time}</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Trust Signals & Settlement Explainer Card */}
          <div className="glass-panel p-6 sm:p-8 space-y-6">
            <h3 className="text-xs font-bold uppercase tracking-wider font-display text-[#ffd89c] flex items-center space-x-2">
              <Award className="w-4 h-4" />
              <span>⚖️ TRADER SAFETY & TRUST SIGNALS</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs font-mono">
              <div className="p-4 bg-[#0d0d0d] rounded border border-[#9e8e78]/30">
                <div className="text-[#d6c4ac] text-[9px] uppercase tracking-wider font-display font-bold">Treasury Balance</div>
                <div className="font-bold text-[#e5e2e1] text-sm pt-1">
                  {lamportsToSol(treasuryBalance).toFixed(3)} SOL
                </div>
                <div className="text-[8px] text-[#d6c4ac]/60 pt-0.5">Secure Escrow PDA</div>
              </div>

              <div className="p-4 bg-[#0d0d0d] rounded border border-[#9e8e78]/30">
                <div className="text-[#d6c4ac] text-[9px] uppercase tracking-wider font-display font-bold">Protocol Fee BPS</div>
                <div className="font-bold text-[#e5e2e1] text-sm pt-1">
                  {feeBps !== null ? `${(feeBps / 100).toFixed(1)}%` : "— BPS"}
                </div>
                <div className="text-[8px] text-[#d6c4ac]/60 pt-0.5">Max capped at 10%</div>
              </div>

              <div className="p-4 bg-[#0d0d0d] rounded border border-board-border/30">
                <div className="text-[#d6c4ac] text-[9px] uppercase tracking-wider font-display font-bold">Resolution Oracle</div>
                <div className="font-bold text-[#a1d494] text-sm pt-1">
                  {isOracleCategory(market.category) ? "Pyth Pull Oracle" : "Manual Settle"}
                </div>
                <div className="text-[8px] text-[#d6c4ac]/60 pt-0.5">Automated on-chain feed</div>
              </div>
            </div>

            <div className="p-4 bg-[#0d0d0d] rounded border border-board-border/30 space-y-2 text-xs font-sans text-text-muted leading-relaxed">
              <h4 className="font-display font-bold text-text-primary text-[10px] uppercase tracking-wider">How Settlement Works</h4>
              <p>
                This prediction board is secured by a decentralized smart contract treasury. 
                {isOracleCategory(market.category) ? (
                  <span>
                    {" "}For price-backed boards (Crypto, Tech, or Other assets), anyone can trigger settlement once the resolution timestamp has passed. The contract retrieves the target price directly from the Pyth Network pull oracle, validates the feed signature to verify it is not stale, and settles the board based on the comparison rule.
                  </span>
                ) : (
                  <span>
                    {" "}For non-price-backed boards (such as Sports and Politics), the administrator posts the official winning outcome (YES or NO) under a multi-signature verified authority once the event completes.
                  </span>
                )}
                {" "}If the settled side has zero winning shares (meaning nobody bet on the winner), the market auto-cancels and permits all participants to withdraw their full stakes without protocol fees.
              </p>
            </div>
          </div>
        </section>

        {/* Right Column: Desktop Trading dashboard */}
        <section className="hidden md:block">
          <div
            className={`glass-panel p-6 space-y-6 ${successFlip ? "animate-success-flip" : ""}`}
          >
            <div className="border-b border-[#9e8e78]/20 pb-3 mb-0">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold font-display text-[#e5e2e1]">
                  Trade
                </h3>
                <div className="flex items-center gap-1.5 text-[10px] font-mono">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#22c55e] animate-pulse inline-block" />
                  <span className="text-[#9e8e78]">Live · {yesProb}% YES</span>
                </div>
              </div>
            </div>
            {renderTradingDashboard()}
          </div>
        </section>
      </div>

      {/* Mobile Sticky floating trade button for thumb-reach */}
      <div className="md:hidden fixed bottom-16 left-0 right-0 z-40 bg-[#131313] border-t border-[#9e8e78]/30 p-4 flex items-center justify-between shadow-2xl">
        <div className="text-left font-mono">
          <div className="text-[8px] uppercase tracking-wider text-[#d6c4ac]">Current Odds</div>
          <div className="text-xs font-bold text-[#ffd89c]">YES: {yesProb}% | NO: {noProb}%</div>
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
              className="fixed bottom-16 left-0 right-0 z-50 bg-[#131313] border-t border-[#9e8e78] rounded-t-xl p-6 space-y-4"
            >
              <div className="flex justify-between items-center border-b border-[#9e8e78]/30 pb-2">
                <h4 className="text-xs font-bold uppercase tracking-wider font-display text-[#ffd89c]">
                  [■] Mobile Prediction Desk
                </h4>
                <button 
                  onClick={() => setIsMobileDrawerOpen(false)}
                  className="text-xs text-[#d6c4ac] hover:text-[#e5e2e1] font-mono px-2 py-1 rounded border border-[#9e8e78]/30"
                >
                  CLOSE
                </button>
              </div>
              {renderTradingDashboard()}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
