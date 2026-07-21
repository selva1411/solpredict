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
import { getAssociatedTokenAddressSync } from "@solana/spl-token";

import { useProgram } from "@/hooks/useProgram";
import { PublicKey } from "@solana/web3.js";
import { getFriendlyErrorMessage } from "@/lib/error-map";
import { lamportsToSol, bnToNum } from "@/lib/format";
import { toast } from "sonner";
import { OrderBookDepth } from "@/components/OrderBookDepth";
import { getWatchlist, toggleWatchlist } from "@/lib/watchlist";
import { getConfigPda, getMarketPda, getYesMintPda, getNoMintPda, getTreasuryPda, getUserPositionPda } from "@/lib/pda";
import { FlipCountdown } from "@/components/FlipCountdown";
import { usePythPrices } from "@/hooks/usePythPrices";
import { feedIdBytesToHex, lookupFeedEntry, isOracleCategory } from "@/lib/pyth-feeds";
import { LivePriceBar } from "@/components/LivePriceBar";
import DualFillGauge from "@/components/DualFillGauge";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
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

  const MAX_POINTS = 120;
  const priceHistoryRef = useRef<{ time: number; price: number }[]>([]);
  const [chartData, setChartData] = useState<{ time: number; price: number }[]>([]);
  const [currentPrice, setCurrentPrice] = useState<number>(0);
  const [prevPrice, setPrevPrice] = useState<number>(0);
  const [priceStatus, setPriceStatus] = useState<'loading' | 'live' | 'error'>('loading');
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const latestPriceRef = useRef<number>(0);

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
  const feedEntry = feedHex ? lookupFeedEntry(feedHex) : null;
  const priceFeedIds = feedHex ? [feedHex] : [];
  const livePrices = usePythPrices(priceFeedIds);
  const priceData = feedHex ? livePrices[feedHex.replace("0x", "")] : null;
  const marketPda = new PublicKey(id as string);

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

  // Fetch market details and transactions
  const fetchMarket = async () => {
    try {
      const marketAcc = await program.account.market.fetch(marketPda) as unknown as MarketDetails;
      setMarket(marketAcc);
      setIsWatched(getWatchlist().includes(marketPda.toBase58()));
      recordProbabilitySnapshot(marketAcc);

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
    } catch (err: unknown) {
      console.error("Error fetching market:", err);
      toast.error(`Failed to load market specs: ${getFriendlyErrorMessage(err)}`);
      router.push("/markets");
    } finally {
      setLoading(false);
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

      setActivity(items.reverse());

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

  useEffect(() => {
    fetchMarket();
    fetchActivity();

    // Real-time market data stream — no RPC call, validator pushes account updates
    const accountSub = connection.onAccountChange(
      marketPda,
      (accountInfo) => {
        try {
          const decoded = program.coder.accounts.decode("Market", accountInfo.data) as unknown as MarketDetails;
          setMarket(decoded);
          recordProbabilitySnapshot(decoded);
        } catch {
          fetchMarket();
        }
      },
      "confirmed"
    );

    // Logs subscription — cheaper: only refreshes activity feed, not market data
    const logSub = connection.onLogs(marketPda, () => {
      fetchActivity();
    }, "confirmed");

    return () => {
      connection.removeAccountChangeListener(accountSub);
      connection.removeOnLogsListener(logSub);
    };
  }, [id, program, connection, recordProbabilitySnapshot]);

  // ── Live SOL price charting ──────────────────────────────────────────
  useEffect(() => {
    let mounted = true;

    async function init() {
      setPriceStatus('loading');

      const realPrice = await fetchSOLPrice();

      if (!mounted) return;

      if (realPrice === 0) {
        setPriceStatus('error');
        return;
      }

      setPriceStatus('live');
      setCurrentPrice(realPrice);
      setPrevPrice(realPrice);
      latestPriceRef.current = realPrice;

      const now = Date.now();
      const seed = Array.from({ length: 60 }, (_, i) => {
        const age = (60 - i) * 3000;
        const drift = (Math.random() - 0.5) * realPrice * 0.005;
        return { time: now - age, price: realPrice + drift };
      });

      priceHistoryRef.current = seed;
      if (mounted) setChartData([...seed]);

      intervalRef.current = setInterval(async () => {
        if (!mounted) return;

        const newPrice = await fetchSOLPrice();
        if (newPrice === 0 || !mounted) return;

        setPrevPrice(latestPriceRef.current);
        setCurrentPrice(newPrice);
        latestPriceRef.current = newPrice;

        const newPoint = { time: Date.now(), price: newPrice };
        priceHistoryRef.current = [
          ...priceHistoryRef.current.slice(-(MAX_POINTS - 1)),
          newPoint,
        ];

        if (mounted) setChartData([...priceHistoryRef.current]);
      }, 3000);
    }

    init();

    return () => {
      mounted = false;
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

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
    const next = toggleWatchlist(marketPda.toBase58());
    setIsWatched(next.includes(marketPda.toBase58()));
    toast.success(
      next.includes(marketPda.toBase58())
        ? "Added to watchlist!"
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

  const status = market.status.open ? "Open" : market.status.settled ? "Settled" : "Cancelled";
  const categoryStr = CATEGORIES[market.category] || "Other";
  
  const yesPool = lamportsToSol(market.yesPoolLamports);
  const noPool = lamportsToSol(market.noPoolLamports);
  const totalPool = yesPool + noPool;
  
  const yesProb = totalPool > 0 ? Math.round((yesPool / totalPool) * 100) : 50;
  const noProb = 100 - yesProb;
  
  const sharePriceSol = lamportsToSol(market.sharePriceLamports);
  const tradeCost = quantity * sharePriceSol;

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
        .accounts({
          buyer: wallet.publicKey,
          market: marketPda,
          treasury: treasuryPda,
          yesMint: yesMintPda,
          noMint: noMintPda,
          buyerYesAta: buyerYesAta,
          buyerNoAta: buyerNoAta,
          userPosition: userPositionPda,
        } as Record<string, unknown>)
        .rpc();

      setTxSig(sig);
      setTxState("success");
      setSuccessFlip(true);
      setTimeout(() => setSuccessFlip(false), 800);

      toast.success(`Position acquired: ${quantity} ${tradeSide} shares!`);
      setIsMobileDrawerOpen(false);
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
        .accounts({
          seller: wallet.publicKey,
          market: marketPda,
          treasury: treasuryPda,
          yesMint: yesMintPda,
          noMint: noMintPda,
          sellerYesAta,
          sellerNoAta,
          userPosition: userPositionPda,
        } as Record<string, unknown>)
        .rpc();

      toast.success(`Sold ${sellQuantity} ${sellSide} shares!`);
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

  const renderTradingDashboard = () => (
    <div className="space-y-6">
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
        <div className="space-y-6">
          {/* YES/NO buttons */}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setTradeSide("YES")}
              className={`py-3 text-xs font-bold uppercase tracking-wider font-display rounded transition-all cursor-pointer border ${
                tradeSide === "YES"
                  ? "bg-[#a1d494] border-[#9e8e78] text-[#131313] shadow-lg font-bold"
                  : "bg-[#0d0d0d] border-[#9e8e78]/30 text-[#d6c4ac] hover:text-[#e5e2e1]"
              }`}
            >
              Predict YES
            </button>
            <button
              onClick={() => setTradeSide("NO")}
              className={`py-3 text-xs font-bold uppercase tracking-wider font-display rounded transition-all cursor-pointer border ${
                tradeSide === "NO"
                  ? "bg-[#ffb4ab] border-[#9e8e78] text-[#131313] shadow-lg font-bold"
                  : "bg-[#0d0d0d] border-[#9e8e78]/30 text-[#d6c4ac] hover:text-[#e5e2e1]"
              }`}
            >
              Predict NO
            </button>
          </div>

          {/* Stepper qty */}
          <div className="space-y-2">
            <label className="text-xs text-[#d6c4ac] uppercase font-display font-bold">Share Quantity</label>
            <div className="flex items-center space-x-2">
              <button 
                onClick={() => setQuantity(Math.max(1, quantity - 5))}
                className="w-10 h-10 rounded bg-[#0d0d0d] border border-[#9e8e78]/40 hover:bg-[#1c1c1c] text-[#e5e2e1] flex items-center justify-center font-mono font-bold text-lg cursor-pointer"
              >
                -
              </button>
              <input
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, Number(e.target.value)))}
                className="flex-1 board-input text-center text-sm border-[#9e8e78]"
              />
              <button 
                onClick={() => setQuantity(quantity + 5)}
                className="w-10 h-10 rounded bg-[#0d0d0d] border border-[#9e8e78]/40 hover:bg-[#1c1c1c] text-[#e5e2e1] flex items-center justify-center font-mono font-bold text-lg cursor-pointer"
              >
                +
              </button>
            </div>
            
            {/* Quick chips */}
            <div className="grid grid-cols-4 gap-2 pt-1 font-mono">
              {[10, 50, 100, 250].map((val) => (
                <button
                  key={val}
                  onClick={() => setQuantity(val)}
                  className="py-1 bg-[#0d0d0d] hover:bg-[#1c1c1c] border border-[#9e8e78]/30 rounded text-[10px] text-[#d6c4ac] hover:text-[#e5e2e1] cursor-pointer transition-all"
                >
                  {val}
                </button>
              ))}
            </div>
          </div>

          {/* Cost layout */}
          <div className="space-y-2 pt-4 border-t border-[#9e8e78]/20 font-mono text-[11px] text-[#d6c4ac]">
            <div className="flex justify-between">
              <span>Price per share:</span>
              <span className="text-[#e5e2e1]">{sharePriceSol.toFixed(2)} SOL</span>
            </div>
            <div className="flex justify-between">
              <span>Transaction cost:</span>
              <span className="text-[#e5e2e1]">{tradeCost.toFixed(2)} SOL</span>
            </div>
            <div className="flex justify-between font-sans font-bold text-xs pt-1 text-[#a1d494]">
              <span>Win Payout:</span>
              <span className="font-mono">{potentialPayout.toFixed(2)} SOL</span>
            </div>
          </div>

          <button
            disabled={submitting}
            onClick={handleBuy}
            className={`w-full py-3.5 mt-2 rounded text-xs font-bold uppercase tracking-widest font-display cursor-pointer transition-all ${
              tradeSide === "YES" ? "btn-yes-mechanical" : "btn-no-mechanical"
            }`}
          >
            {submitting ? (
              <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin inline-block mr-2 align-middle"></span>
            ) : null}
            Confirm Prediction
          </button>

          {txState === "signing" && (
            <div className="font-mono text-xs text-[#ffd89c] mt-2 text-center">
              ⏳ Approve in wallet...
            </div>
          )}
          {txState === "confirming" && (
            <div className="font-mono text-xs text-[#ffd89c] animate-pulse mt-2 text-center">
              ⛓ Confirming on Solana...
            </div>
          )}
          {txState === "success" && txSig && (
            <div className="font-mono text-xs text-[#a1d494] mt-2 text-center">
              ✓ Success —
              <a href={`https://solscan.io/tx/${txSig}?cluster=devnet`}
                target="_blank" rel="noopener noreferrer"
                className="underline ml-1">View tx</a>
            </div>
          )}
          {txState === "error" && (
            <div className="font-mono text-xs text-[#ffb4ab] mt-2 text-center">
              ✗ Transaction failed. Check console.
            </div>
          )}

          {/* ─── Sell Section ─── */}
          <div className="pt-6 mt-6 border-t border-[#9e8e78]/30">
            <button
              onClick={() => setShowSellSection(!showSellSection)}
              className="w-full flex items-center justify-between text-xs font-mono uppercase tracking-widest text-[#d6c4ac] hover:text-[#e5e2e1] transition-colors cursor-pointer"
            >
              <span>Sell Shares</span>
              {showSellSection ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
            {showSellSection && (
              <div className="mt-4 space-y-4">
                <div className="flex gap-2 text-[10px] font-mono text-[#d6c4ac]">
                  <span>Your YES: <span className="text-[#a1d494] font-bold">{userYesBalance.toFixed(2)}</span></span>
                  <span>Your NO: <span className="text-[#ffb4ab] font-bold">{userNoBalance.toFixed(2)}</span></span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setSellSide("YES")}
                    className={`py-2 text-xs font-bold uppercase tracking-wider rounded border cursor-pointer transition-all ${
                      sellSide === "YES"
                        ? "bg-[#a1d494] border-[#9e8e78] text-[#131313]"
                        : "bg-[#0d0d0d] border-[#9e8e78]/30 text-[#d6c4ac]"
                    }`}
                  >
                    Sell YES
                  </button>
                  <button
                    onClick={() => setSellSide("NO")}
                    className={`py-2 text-xs font-bold uppercase tracking-wider rounded border cursor-pointer transition-all ${
                      sellSide === "NO"
                        ? "bg-[#ffb4ab] border-[#9e8e78] text-[#131313]"
                        : "bg-[#0d0d0d] border-[#9e8e78]/30 text-[#d6c4ac]"
                    }`}
                  >
                    Sell NO
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setSellQuantity(Math.max(1, sellQuantity - 5))}
                    className="w-8 h-8 rounded bg-[#0d0d0d] border border-[#9e8e78]/40 text-[#e5e2e1] text-sm font-mono cursor-pointer"
                  >-</button>
                  <input
                    type="number"
                    value={sellQuantity}
                    onChange={(e) => setSellQuantity(Math.max(1, Number(e.target.value)))}
                    className="flex-1 board-input text-center text-sm border-[#9e8e78]"
                  />
                  <button
                    onClick={() => setSellQuantity(sellQuantity + 5)}
                    className="w-8 h-8 rounded bg-[#0d0d0d] border border-[#9e8e78]/40 text-[#e5e2e1] text-sm font-mono cursor-pointer"
                  >+</button>
                </div>
                <div className="text-[10px] font-mono text-[#d6c4ac] text-right">
                  Refund: {(sellQuantity * sharePriceSol).toFixed(4)} SOL
                </div>
                <button
                  disabled={submitting || (sellSide === "YES" ? userYesBalance < sellQuantity : userNoBalance < sellQuantity)}
                  onClick={handleSell}
                  className={`w-full py-2.5 rounded text-xs font-bold uppercase tracking-widest cursor-pointer transition-all ${
                    sellSide === "YES"
                      ? "bg-[#a1d494]/20 text-[#a1d494] border border-[#a1d494]/40 hover:bg-[#a1d494]/30"
                      : "bg-[#ffb4ab]/20 text-[#ffb4ab] border border-[#ffb4ab]/40 hover:bg-[#ffb4ab]/30"
                  } disabled:opacity-40 disabled:cursor-not-allowed`}
                >
                  {submitting ? "Processing..." : `Sell ${sellQuantity} ${sellSide}`}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );

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
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="glass-panel p-6 sm:p-8 space-y-6"
          >
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

            {isOracleCategory(market.category) && feedEntry && (
              <div className="pt-4 border-t border-[#9e8e78]/30">
                <LivePriceBar
                  feedIdHex={feedHex!}
                  category={market.category}
                  livePrice={priceData?.price ?? null}
                  liveError={priceData?.error ?? null}
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
          </motion.div>

          {/* Live Crypto Price Chart */}
          {isOracleCategory(market.category) && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.07 }}
              className="glass-panel p-6 sm:p-8 space-y-4"
            >
              <h3 className="text-xs font-bold uppercase tracking-wider font-display text-[#d6c4ac] flex items-center space-x-2">
                <TrendingUp className="w-4 h-4 text-[#06b6d4]" />
                <span>Live Price Chart</span>
              </h3>

              {/* Header / Badge */}
              <div className="flex items-center gap-3 mb-3 flex-wrap">
                <div className="flex items-center gap-2">
                  {priceStatus === 'live' && (
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#ffd89c] opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-[#ffd89c]" />
                    </span>
                  )}
                  {priceStatus === 'loading' && (
                    <span className="h-2 w-2 rounded-full bg-[#9e8e78] animate-pulse" />
                  )}
                  {priceStatus === 'error' && (
                    <span className="h-2 w-2 rounded-full bg-[#ffb4ab]" />
                  )}
                  <span className="text-xs font-mono text-[#9e8e78]">
                    {priceStatus === 'loading' && 'Fetching price...'}
                    {priceStatus === 'live' && 'LIVE · SOL/USD · every 3s'}
                    {priceStatus === 'error' && 'Price feed unavailable'}
                  </span>
                </div>
                {currentPrice > 0 && (
                  <div className="ml-auto flex items-center gap-2">
                    <span className={`text-lg font-bold font-mono ${currentPrice >= prevPrice ? 'text-[#a1d494]' : 'text-[#ffb4ab]'}`}>
                      ${currentPrice.toFixed(4)}
                    </span>
                    <span className={`text-xs font-mono ${currentPrice >= prevPrice ? 'text-[#a1d494]' : 'text-[#ffb4ab]'}`}>
                      {currentPrice >= prevPrice ? '▲' : '▼'} {Math.abs(currentPrice - prevPrice).toFixed(4)}
                    </span>
                  </div>
                )}
              </div>

              {/* Chart or error state */}
              {priceStatus === 'error' ? (
                <div className="flex items-center justify-center h-64 border border-[#353534] rounded font-mono text-sm text-[#9e8e78]">
                  ⚠ Could not connect to price feed. Check your internet connection.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <AreaChart
                    data={chartData}
                    margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ffd89c" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#ffd89c" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#252525" vertical={false} />
                    <XAxis
                      dataKey="time"
                      tickFormatter={(t: unknown) =>
                        new Date(Number(t)).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                      }
                      stroke="#9e8e78"
                      tick={{ fill: '#9e8e78', fontSize: 10, fontFamily: 'JetBrains Mono' }}
                      tickLine={false}
                      axisLine={false}
                      interval="preserveStartEnd"
                      minTickGap={60}
                    />
                    <YAxis
                      domain={['auto', 'auto']}
                      stroke="#9e8e78"
                      tick={{ fill: '#9e8e78', fontSize: 10, fontFamily: 'JetBrains Mono' }}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v: unknown) => `$${Number(v).toFixed(2)}`}
                      width={70}
                    />
                    <Tooltip
                      contentStyle={{
                        background: '#1a1a1a',
                        border: '1px solid #9e8e78',
                        borderRadius: 2,
                        fontFamily: 'JetBrains Mono',
                        fontSize: 11,
                        color: '#e5e2e1',
                        padding: '6px 10px',
                      }}
                      labelFormatter={(t: unknown) =>
                        new Date(Number(t)).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                      }
                      formatter={(v: unknown) => [`$${Number(v).toFixed(4)}`, 'SOL/USD']}
                      cursor={{ stroke: '#9e8e78', strokeWidth: 1 }}
                    />
                    <Area
                      type="monotone"
                      dataKey="price"
                      stroke="#ffd89c"
                      strokeWidth={1.5}
                      fill="url(#priceGradient)"
                      dot={false}
                      activeDot={{ r: 3, fill: '#ffd89c', stroke: '#131313', strokeWidth: 1 }}
                      isAnimationActive={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </motion.div>
          )}

          {/* Semicircle Probability Dial and Sparkline Trend */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.05 }}
            className="glass-panel p-6 sm:p-8 space-y-6"
          >
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
          </motion.div>

          {/* YES vs NO Pool Liquidity Depth */}
          <OrderBookDepth yesPoolLamports={market.yesPoolLamports.toNumber()} noPoolLamports={market.noPoolLamports.toNumber()} />

          {/* Decoded On-chain Activity logs */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.15 }}
            className="glass-panel p-6 space-y-4"
          >
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
                <AnimatePresence>
                  {activity.map((item, index) => {
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
                      <motion.div
                        key={item.signature + "-" + index}
                        initial={{ opacity: 0, x: -5 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: Math.min(index * 0.03, 0.3) }}
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
                            <span className="text-[8px] font-mono font-bold text-[#a1d494] bg-[#a1d494]/10 px-1 py-0.5 rounded border border-[#a1d494]/20 animate-pulse shrink-0">
                              NEW
                            </span>
                          )}
                        </div>
                        <div className="text-[#d6c4ac] text-[10px] flex items-center space-x-2 ml-7 sm:ml-0">
                          <span className="hidden sm:inline">@{item.buyer.slice(0, 4)}...</span>
                          <span>{item.time}</span>
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              )}
            </div>
          </motion.div>

          {/* Trust Signals & Settlement Explainer Card */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.2 }}
            className="glass-panel p-6 sm:p-8 space-y-6"
          >
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
          </motion.div>
        </section>

        {/* Right Column: Desktop Trading dashboard */}
        <section className="hidden md:block">
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3, delay: 0.1 }}
            className={`glass-panel p-6 space-y-6 ${successFlip ? "animate-success-flip" : ""}`}
          >
            <h3 className="text-sm font-bold uppercase tracking-wider font-display border-b border-[#9e8e78]/30 pb-3 text-[#ffd89c]">
              [■] Prediction Desk
            </h3>
            {renderTradingDashboard()}
          </motion.div>
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
