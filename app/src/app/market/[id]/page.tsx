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
import { Sparkline } from "@/components/Sparkline";
import ProbabilityOrb3D from "@/components/ProbabilityOrb3D";
import { OrderBookDepth } from "@/components/OrderBookDepth";
import { SplitFlapText } from "@/components/SplitFlapText";

const CATEGORIES = ["Crypto", "Sports", "Politics", "Tech", "Other"];

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
  status: any;
  winningOutcome: any;
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
      setMarket(marketAcc as any);

      // Record probability snapshot for sparkline
      const acc = marketAcc as any;
      const yesP = acc.yesPoolLamports.toNumber();
      const noP = acc.noPoolLamports.toNumber();
      const total = yesP + noP;
      const yesProbVal = total > 0 ? Math.round((yesP / total) * 100) : 50;
      
      // If we don't have enough parsed history items, seed with current
      if (probHistory.current.length <= 1) {
        probHistory.current = [50, yesProbVal];
      }
    } catch (err: any) {
      console.error("Error fetching market:", err);
      toast.error(`Failed to load market specs: ${getFriendlyErrorMessage(err)}`);
      router.push("/");
    } finally {
      setLoading(false);
    }
  };

  const fetchActivity = async () => {
    try {
      // Fetch signatures
      const sigs = await connection.getSignaturesForAddress(marketPda, { limit: 15 });
      const items: ActivityItem[] = [];
      const tempHistory: number[] = [];

      const eventParser = new EventParser(program.programId, program.coder);

      // Fetch transaction parse content in parallel
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

      // Map details sequentially, oldest to newest (to build chronological history)
      const pairs = sigs.map((sig, idx) => ({ sig, tx: txs[idx] })).reverse();

      for (const pair of pairs) {
        const { sig, tx } = pair;
        if (!tx || !tx.meta || !tx.meta.logMessages) continue;

        const date = sig.blockTime ? new Date(sig.blockTime * 1000) : new Date();
        const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

        const events = eventParser.parseLogs(tx.meta.logMessages);
        for (const event of events) {
          if (event.name === "SharesPurchased") {
            const { side, quantity, cost, buyer, newYesPool, newNoPool } = event.data as any;
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
              quantity: quantity.toNumber(),
              cost: cost.toNumber() / 1e9,
              time: timeStr,
            });
          } else if (event.name === "MarketSettled") {
            const { winningOutcome, settledPrice } = event.data as any;
            items.push({
              signature: sig.signature,
              slot: sig.slot,
              buyer: "BOARD SETTLEMENT",
              side: "SETTLE",
              quantity: winningOutcome, // store winning outcome index in quantity
              cost: settledPrice.toNumber() / 1e9,
              time: timeStr,
            });
          } else if (event.name === "RewardsClaimed") {
            const { claimer, payout } = event.data as any;
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

      // Display newest first
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

    // WS subscription to refresh
    const subscription = connection.onLogs(marketPda, () => {
      fetchMarket();
      fetchActivity();
    }, "confirmed");

    return () => {
      connection.removeOnLogsListener(subscription);
    };
  }, [id, program, connection]);

  if (loading) {
    return <div className="board-panel p-10 h-96 skeleton-shimmer bg-[#0C0D12]/50" />;
  }

  if (!market) return null;

  const status = market.status.open ? "Open" : market.status.settled ? "Settled" : "Cancelled";
  const categoryStr = CATEGORIES[market.category] || "Other";
  
  // Math properties
  const yesPool = market.yesPoolLamports.toNumber() / 1e9;
  const noPool = market.noPoolLamports.toNumber() / 1e9;
  const totalPool = yesPool + noPool;
  
  // Implied probability
  const yesProb = totalPool > 0 ? Math.round((yesPool / totalPool) * 100) : 50;
  const noProb = 100 - yesProb;
  
  const sharePriceSol = market.sharePriceLamports.toNumber() / 1e9;
  const tradeCost = quantity * sharePriceSol;

  // Potential payout calculation
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

  // Buy Position Action
  const handleBuy = async () => {
    if (!wallet || !wallet.publicKey) {
      toast.error("Please connect your wallet first.");
      return;
    }
    
    try {
      setSubmitting(true);
      
      const sideParam = tradeSide === "YES" ? { yes: {} } : { no: {} };
      const yesMintPda = getYesMintPda(marketPda, program.programId);
      const noMintPda = getNoMintPda(marketPda, program.programId);
      const treasuryPda = getTreasuryPda(marketPda, program.programId);
      
      const buyerYesAta = getAssociatedTokenAddressSync(yesMintPda, wallet.publicKey);
      const buyerNoAta = getAssociatedTokenAddressSync(noMintPda, wallet.publicKey);
      const userPositionPda = getUserPositionPda(marketPda, wallet.publicKey, program.programId);

      await program.methods
        .buyShares(sideParam as any, new anchor.BN(quantity))
        .accounts({
          buyer: wallet.publicKey,
          market: marketPda,
          treasury: treasuryPda,
          yesMint: yesMintPda,
          noMint: noMintPda,
          buyerYesAta: buyerYesAta,
          buyerNoAta: buyerNoAta,
          userPosition: userPositionPda,
        } as any)
        .rpc();

      setSuccessFlip(true);
      setTimeout(() => setSuccessFlip(false), 800);

      toast.success(`Position acquired: ${quantity} ${tradeSide} shares!`);
      setIsMobileDrawerOpen(false);
      fetchMarket();
      fetchActivity();
    } catch (err: any) {
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
          <div className="mx-auto w-12 h-12 bg-[#FFA500]/10 text-[#FFA500] rounded flex items-center justify-center border border-[#FFA500]/25">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h4 className="text-sm font-bold text-[#F4F4F9]">TRADING TERMINATED</h4>
            <p className="text-xs text-[#808495]">
              This board has been settled. Navigate to <Link href="/portfolio" className="text-[#FFA500] hover:underline">Portfolio</Link> to withdraw payout.
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
                  ? "bg-[#235A34] border-[#1B4527] text-[#F4F4F9] shadow-lg"
                  : "bg-[#050608] border-[#2D3142] text-[#808495] hover:text-[#F4F4F9]"
              }`}
            >
              Predict YES
            </button>
            <button
              onClick={() => setTradeSide("NO")}
              className={`py-3 text-xs font-bold uppercase tracking-wider font-display rounded transition-all cursor-pointer border ${
                tradeSide === "NO"
                  ? "bg-[#8E2424] border-[#6E1B1B] text-[#F4F4F9] shadow-lg"
                  : "bg-[#050608] border-[#2D3142] text-[#808495] hover:text-[#F4F4F9]"
              }`}
            >
              Predict NO
            </button>
          </div>

          {/* Stepper qty */}
          <div className="space-y-2">
            <label className="text-xs text-[#808495] uppercase font-display font-semibold">Share Quantity</label>
            <div className="flex items-center space-x-2">
              <button 
                onClick={() => setQuantity(Math.max(1, quantity - 5))}
                className="w-10 h-10 rounded bg-[#050608] border border-[#2D3142] hover:bg-[#0C0D12] text-[#F4F4F9] flex items-center justify-center font-mono font-bold text-lg cursor-pointer"
              >
                -
              </button>
              <input
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, Number(e.target.value)))}
                className="flex-1 board-input text-center text-sm"
              />
              <button 
                onClick={() => setQuantity(quantity + 5)}
                className="w-10 h-10 rounded bg-[#050608] border border-[#2D3142] hover:bg-[#0C0D12] text-[#F4F4F9] flex items-center justify-center font-mono font-bold text-lg cursor-pointer"
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
                  className="py-1 bg-[#050608] hover:bg-[#0C0D12] border border-[#2D3142] rounded text-[10px] text-[#808495] hover:text-[#F4F4F9] cursor-pointer transition-all"
                >
                  {val}
                </button>
              ))}
            </div>
          </div>

          {/* Cost layout */}
          <div className="space-y-2 pt-4 border-t border-[#2D3142] font-mono text-[11px] text-[#808495]">
            <div className="flex justify-between">
              <span>Price per share:</span>
              <span className="text-[#F4F4F9]">{sharePriceSol.toFixed(2)} SOL</span>
            </div>
            <div className="flex justify-between">
              <span>Transaction cost:</span>
              <span className="text-[#F4F4F9]">{tradeCost.toFixed(2)} SOL</span>
            </div>
            <div className="flex justify-between font-sans font-bold text-xs pt-1 text-[#235A34]">
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
    <div className="space-y-8">
      <Link href="/" className="inline-flex items-center space-x-2 text-xs uppercase tracking-wider font-display text-[#808495] hover:text-[#F4F4F9] transition-colors">
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
            className="board-panel p-6 sm:p-8 space-y-6"
          >
            <div className="flex items-center space-x-3">
              <span className="px-2 py-0.5 text-[9px] font-bold font-mono uppercase tracking-wider rounded bg-[#2D3142]/40 border border-[#2D3142] text-[#FFA500]">
                {categoryStr}
              </span>
              <span className="text-xs font-mono text-[#808495]">BOARD ID #{market.marketId?.toString()}</span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-bold font-display text-[#F4F4F9] uppercase leading-tight">
              {market.question}
            </h1>

            <p className="text-sm text-[#808495] leading-relaxed font-medium">
              {market.description}
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-4 border-t border-[#2D3142]">
              <div className="space-y-1">
                <div className="text-[10px] text-[#808495] uppercase tracking-wider font-display">Target Price</div>
                <div className="text-lg font-bold font-mono text-[#F4F4F9]">
                  {formatTargetPrice(market.targetPrice, market.targetExpo)}
                </div>
              </div>

              <div className="space-y-1">
                <div className="text-[10px] text-[#808495] uppercase tracking-wider font-display">Comparison Rule</div>
                <div className="text-lg font-bold text-[#F4F4F9] font-display uppercase tracking-wide">
                  {market.comparison === 0 ? "Greater Than" : "Less Than"}
                </div>
              </div>

              <div className="space-y-1">
                <div className="text-[10px] text-[#808495] uppercase tracking-wider font-display">Ending clock</div>
                <div className="pt-1">
                  <FlipCountdown endTs={market.endTs.toNumber()} compact />
                </div>
              </div>
            </div>
          </motion.div>

          {/* Semicircle Probability Dial and Sparkline Trend */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.05 }}
            className="board-panel p-6 sm:p-8 space-y-6"
          >
            <h3 className="text-xs font-bold uppercase tracking-wider font-display text-[#808495] flex items-center space-x-2">
              <TrendingUp className="w-4 h-4 text-[#FFA500]" />
              <span>Implied Odds & Trend Dial</span>
            </h3>

            <div className="flex flex-col sm:flex-row items-center justify-between gap-8 py-2">
              <div className="flex-1 w-full space-y-4">
                <div className="flex items-center justify-between text-xs font-mono font-bold">
                  <span className="text-[#235A34] text-sm">YES: {yesProb}%</span>
                  <span className="text-[#8E2424] text-sm">NO: {noProb}%</span>
                </div>
                
                {/* Horizontal probability strip */}
                <div className="w-full h-3 bg-[#8E2424] rounded overflow-hidden flex border border-[#050608]">
                  <motion.div
                    className="h-full bg-[#235A34]"
                    initial={{ width: "50%" }}
                    animate={{ width: `${yesProb}%` }}
                    transition={{ duration: 0.4, ease: "easeOut" }}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4 text-xs font-mono pt-2">
                  <div className="p-3 bg-[#050608] rounded border border-[#2D3142]">
                    <div className="text-[#808495] text-[9px] uppercase tracking-wider font-display">YES Pool Weight</div>
                    <div className="font-bold text-[#235A34] text-sm pt-1">{yesPool.toFixed(2)} SOL</div>
                  </div>
                  <div className="p-3 bg-[#050608] rounded border border-[#2D3142]">
                    <div className="text-[#808495] text-[9px] uppercase tracking-wider font-display">NO Pool Weight</div>
                    <div className="font-bold text-[#8E2424] text-sm pt-1">{noPool.toFixed(2)} SOL</div>
                  </div>
                </div>

                {/* Probability trend Sparkline */}
                {probHistory.current.length > 2 && (
                  <div className="pt-2 border-t border-[#2D3142]">
                    <div className="text-[9px] text-[#808495] uppercase tracking-wider font-display mb-2">Real-Time Probability Trend</div>
                    <div className="w-full bg-[#050608] border border-[#2D3142] p-2 rounded">
                      <Sparkline
                        data={probHistory.current}
                        width={380}
                        height={50}
                        color="#FFA500"
                        fillColor="#FFA500"
                        className="w-full"
                      />
                    </div>
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
            className="board-panel p-6 space-y-4"
          >
            <h3 className="text-xs font-bold uppercase tracking-wider font-display text-[#808495] flex items-center space-x-2">
              <Activity className="w-4 h-4 text-[#FFA500]" />
              <span>Decoded On-Chain Transactions</span>
            </h3>
            
            <div className="space-y-2 font-mono text-xs max-h-96 overflow-y-auto scrollbar-none">
              {activity.length === 0 ? (
                <p className="text-[#808495] text-center py-8">No matching transaction logs decoded.</p>
              ) : (
                <AnimatePresence>
                  {activity.map((item, index) => {
                    const isSettle = item.side === "SETTLE";
                    const isClaim = item.side === "CLAIM";
                    const isYes = item.side === "YES";
                    const isNo = item.side === "NO";

                    let badgeColor = "bg-white/5 text-[#F4F4F9]";
                    if (isYes) badgeColor = "bg-[#235A34]/15 text-[#235A34] border border-[#235A34]/30";
                    if (isNo) badgeColor = "bg-[#8E2424]/15 text-[#8E2424] border border-[#8E2424]/30";
                    if (isSettle) badgeColor = "bg-[#FFA500]/15 text-[#FFA500] border border-[#FFA500]/30";

                    return (
                      <motion.div
                        key={item.signature + "-" + index}
                        initial={{ opacity: 0, x: -5 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: Math.min(index * 0.03, 0.3) }}
                        className="flex justify-between items-center py-2.5 border-b border-[#2D3142]/40 hover:bg-white/1 px-2 rounded"
                      >
                        <div className="flex items-center space-x-2.5">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${badgeColor}`}>
                            {item.side}
                          </span>
                          <span className="text-[#F4F4F9] text-[11px]">
                            {isSettle ? (
                              <span>BOARD FINALIZED (OUTCOME {item.quantity === 1 ? "YES" : "NO"})</span>
                            ) : isClaim ? (
                              <span>REWARD WITHDRAWAL: {item.cost.toFixed(2)} SOL</span>
                            ) : (
                              <span>{item.quantity} SHARES AT {item.cost.toFixed(2)} SOL</span>
                            )}
                          </span>
                        </div>
                        <div className="text-[#808495] text-[10px] flex items-center space-x-2">
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
            className={`board-panel p-6 space-y-6 ${successFlip ? "animate-success-flip" : ""}`}
          >
            <h3 className="text-sm font-bold uppercase tracking-wider font-display border-b border-[#2D3142] pb-3 text-[#FFA500]">
              [■] Prediction Desk
            </h3>
            {renderTradingDashboard()}
          </motion.div>
        </section>
      </div>

      {/* Mobile Sticky floating trade button for thumb-reach */}
      <div className="md:hidden fixed bottom-16 left-0 right-0 z-40 bg-[#0C0D12] border-t-2 border-[#2D3142] p-4 flex items-center justify-between shadow-2xl">
        <div className="text-left font-mono">
          <div className="text-[8px] uppercase tracking-wider text-[#808495]">Current Odds</div>
          <div className="text-xs font-bold text-[#FFA500]">YES: {yesProb}% | NO: {noProb}%</div>
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
              className="fixed bottom-16 left-0 right-0 z-50 bg-[#0C0D12] border-t-2 border-[#2D3142] rounded-t-xl p-6 space-y-4"
            >
              <div className="flex justify-between items-center border-b border-[#2D3142] pb-2">
                <h4 className="text-xs font-bold uppercase tracking-wider font-display text-[#FFA500]">
                  [■] Mobile Prediction Desk
                </h4>
                <button 
                  onClick={() => setIsMobileDrawerOpen(false)}
                  className="text-xs text-[#808495] hover:text-[#F4F4F9] font-mono px-2 py-1 rounded border border-[#2D3142]"
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
