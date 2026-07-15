"use client";

import React, { useState, useEffect, useRef } from "react";
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
  ChevronDown
} from "lucide-react";
import * as anchor from "@coral-xyz/anchor";
import { EventParser } from "@coral-xyz/anchor";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";

import { useProgram } from "@/hooks/useProgram";
import { PublicKey } from "@solana/web3.js";
import { getFriendlyErrorMessage } from "@/lib/error-map";
import { toast } from "sonner";
import { getMarketPda, getYesMintPda, getNoMintPda, getTreasuryPda, getUserPositionPda } from "@/lib/pda";
import { FlipCountdown } from "@/components/FlipCountdown";
import { OrderBookDepth } from "@/components/OrderBookDepth";
import ProbabilityOrb3D from "@/components/ProbabilityOrb3D";

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
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState<boolean>(false);

  // Sparkline history — stores probability snapshots
  const probHistory = useRef<number[]>([50]);

  const marketPda = new PublicKey(id as string);

  // Fetch market details and transactions
  const fetchMarket = async () => {
    try {
      const marketAcc = await program.account.market.fetch(marketPda);
      setMarket(marketAcc as unknown as MarketDetails);

      // Record probability snapshot for sparkline
      const acc = marketAcc as unknown as MarketDetails;
      const yesP = acc.yesPoolLamports.toNumber();
      const noP = acc.noPoolLamports.toNumber();
      const total = yesP + noP;
      const yesProbVal = total > 0 ? Math.round((yesP / total) * 100) : 50;
      
      // If we don't have enough parsed history items, seed with current
      if (probHistory.current.length <= 1) {
        probHistory.current = [50, yesProbVal];
      }
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
              cost: cost.toNumber() / 1e9,
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
              cost: settledPrice.toNumber() / 1e9,
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
              cost: payout.toNumber() / 1e9,
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

  useEffect(() => {
    fetchMarket();
    fetchActivity();

    const subscription = connection.onLogs(marketPda, () => {
      fetchMarket();
      fetchActivity();
    }, "confirmed");

    return () => {
      connection.removeOnLogsListener(subscription);
    };
  }, [id, program, connection]);

  if (loading) {
    return <div className="board-panel p-10 h-96 skeleton-shimmer bg-[#131313]" />;
  }

  if (!market) return null;

  const getFeedIdHexString = (feedId: number[] | Uint8Array | Buffer): string => {
    const arr = Array.from(feedId);
    return "0x" + arr.map(b => b.toString(16).padStart(2, '0')).join('');
  };

  const status = market.status.open ? "Open" : market.status.settled ? "Settled" : "Cancelled";
  const categoryStr = CATEGORIES[market.category] || "Other";
  
  const yesPool = market.yesPoolLamports.toNumber() / 1e9;
  const noPool = market.noPoolLamports.toNumber() / 1e9;
  const totalPool = yesPool + noPool;
  
  const yesProb = totalPool > 0 ? Math.round((yesPool / totalPool) * 100) : 50;
  const noProb = 100 - yesProb;
  
  const sharePriceSol = market.sharePriceLamports.toNumber() / 1e9;
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
      setSubmitting(true);
      
      const sideParam: { yes?: Record<string, never>; no?: Record<string, never> } = tradeSide === "YES" ? { yes: {} } : { no: {} };
      const yesMintPda = getYesMintPda(marketPda, program.programId);
      const noMintPda = getNoMintPda(marketPda, program.programId);
      const treasuryPda = getTreasuryPda(marketPda, program.programId);
      
      const buyerYesAta = getAssociatedTokenAddressSync(yesMintPda, wallet.publicKey);
      const buyerNoAta = getAssociatedTokenAddressSync(noMintPda, wallet.publicKey);
      const userPositionPda = getUserPositionPda(marketPda, wallet.publicKey, program.programId);

      await program.methods
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

      setSuccessFlip(true);
      setTimeout(() => setSuccessFlip(false), 800);

      toast.success(`Position acquired: ${quantity} ${tradeSide} shares!`);
      setIsMobileDrawerOpen(false);
      fetchMarket();
      fetchActivity();
    } catch (err: unknown) {
      console.error("Buy shares error:", err);
      toast.error(`Purchase failed: ${getFriendlyErrorMessage(err)}`);
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
            className="board-panel p-6 sm:p-8 space-y-6 border-[#9e8e78] bg-[#131313]"
          >
            <div className="flex items-center space-x-3">
              <span className="px-2 py-0.5 text-[9px] font-bold font-mono uppercase tracking-wider rounded bg-white/5 border border-[#9e8e78]/30 text-[#ffd89c]">
                {categoryStr}
              </span>
              <span className="text-xs font-mono text-[#d6c4ac]">BOARD ID #{market.marketId?.toString()}</span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-bold font-display text-[#e5e2e1] uppercase leading-tight">
              {market.question}
            </h1>

            <p className="text-sm text-[#d6c4ac] leading-relaxed font-medium">
              {market.description}
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-4 border-t border-[#9e8e78]/30">
              {market.category === 0 ? (
                <>
                  <div className="space-y-1 font-mono">
                    <div className="text-[10px] text-[#d6c4ac] uppercase tracking-wider font-display font-bold">Target Price</div>
                    <div className="text-lg font-bold text-[#e5e2e1]">
                      {formatTargetPrice(market.targetPrice, market.targetExpo)}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="text-[10px] text-[#d6c4ac] uppercase tracking-wider font-display font-bold">Comparison Rule</div>
                    <div className="text-lg font-bold text-[#e5e2e1] font-display uppercase tracking-wide">
                      {market.comparison === 0 ? "Greater Than" : "Less Than"}
                    </div>
                  </div>
                </>
              ) : (
                <div className="sm:col-span-2 space-y-1">
                  <div className="text-[10px] text-[#d6c4ac] uppercase tracking-wider font-display font-bold">Settlement Mode</div>
                  <div className="text-sm font-bold text-[#ffd89c] font-display uppercase tracking-wide flex items-center gap-1.5 pt-0.5">
                    ⚖️ Manual Settle (via Admin signature)
                  </div>
                </div>
              )}

              <div className="space-y-1">
                <div className="text-[10px] text-[#d6c4ac] uppercase tracking-wider font-display font-bold">Ending clock</div>
                <div className="pt-1">
                  <FlipCountdown endTs={market.endTs.toNumber()} compact />
                </div>
              </div>
            </div>

            {market.category === 0 && (
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

          {/* Semicircle Probability Dial and Sparkline Trend */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.05 }}
            className="board-panel p-6 sm:p-8 space-y-6 border-[#9e8e78]/40 bg-[#131313]"
          >
            <h3 className="text-xs font-bold uppercase tracking-wider font-display text-[#d6c4ac] flex items-center space-x-2">
              <TrendingUp className="w-4 h-4 text-[#ffd89c]" />
              <span>Implied Odds & Trend Dial</span>
            </h3>

            <div className="flex flex-col sm:flex-row items-center justify-between gap-8 py-2">
              <div className="flex-1 w-full space-y-4">
                <div className="flex items-center justify-between text-xs font-mono font-bold">
                  <span className="text-[#a1d494] text-sm">YES: {yesProb}%</span>
                  <span className="text-[#ffb4ab] text-sm">NO: {noProb}%</span>
                </div>
                
                {/* Horizontal probability strip */}
                <div className="w-full h-3 bg-[#ffb4ab]/30 rounded overflow-hidden flex border border-[#0d0d0d]">
                  <motion.div
                    className="h-full bg-[#a1d494]"
                    initial={{ width: "50%" }}
                    animate={{ width: `${yesProb}%` }}
                    transition={{ duration: 0.4, ease: "easeOut" }}
                  />
                </div>

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

              {/* Semicircle dial indicator */}
              <ProbabilityOrb3D yesProb={yesProb} size={150} />
            </div>
          </motion.div>

          {/* YES vs NO Pool Liquidity Depth */}
          <OrderBookDepth yesPoolLamports={market.yesPoolLamports.toNumber()} noPoolLamports={market.noPoolLamports.toNumber()} />

          {/* Decoded On-chain Activity logs */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.15 }}
            className="board-panel p-6 space-y-4 border-[#9e8e78]/40 bg-[#131313]"
          >
            <h3 className="text-xs font-bold uppercase tracking-wider font-display text-[#d6c4ac] flex items-center space-x-2">
              <Activity className="w-4 h-4 text-[#ffd89c]" />
              <span>Decoded On-Chain Transactions</span>
            </h3>
            
            <div className="space-y-2 font-mono text-xs max-h-96 overflow-y-auto scrollbar-thin">
              {activity.length === 0 ? (
                <p className="text-[#d6c4ac] text-center py-8">No matching transaction logs decoded.</p>
              ) : (
                <AnimatePresence>
                  {activity.map((item, index) => {
                    const isSettle = item.side === "SETTLE";
                    const isClaim = item.side === "CLAIM";
                    const isYes = item.side === "YES";
                    const isNo = item.side === "NO";

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
                        className="flex justify-between items-center py-2.5 border-b border-[#9e8e78]/10 hover:bg-white/5 px-2 rounded"
                      >
                        <div className="flex items-center space-x-2.5">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${badgeColor}`}>
                            {item.side}
                          </span>
                          <span className="text-[#e5e2e1] text-[11px]">
                            {isSettle ? (
                              <span>BOARD FINALIZED (OUTCOME {item.quantity === 1 ? "YES" : "NO"})</span>
                            ) : isClaim ? (
                              <span>REWARD WITHDRAWAL: {item.cost.toFixed(2)} SOL</span>
                            ) : (
                              <span>{item.quantity} SHARES AT {item.cost.toFixed(2)} SOL</span>
                            )}
                          </span>
                        </div>
                        <div className="text-[#d6c4ac] text-[10px] flex items-center space-x-2">
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
        </section>

        {/* Right Column: Desktop Trading dashboard */}
        <section className="hidden md:block">
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3, delay: 0.1 }}
            className={`board-panel p-6 space-y-6 border-[#9e8e78] bg-[#131313] ${successFlip ? "animate-success-flip" : ""}`}
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
