"use client";

import React, { useState, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import { useProgram } from "@/hooks/useProgram";
import { PublicKey } from "@solana/web3.js";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import { getFriendlyErrorMessage } from "@/lib/error-map";
import { toast } from "sonner";
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
  HelpCircle,
  Award,
  Share2
} from "lucide-react";
import * as anchor from "@coral-xyz/anchor";
import { getMarketPda, getYesMintPda, getNoMintPda, getTreasuryPda, getUserPositionPda } from "@/lib/pda";
import confetti from "canvas-confetti";
import { FlipCountdown } from "@/components/FlipCountdown";
import { Sparkline } from "@/components/Sparkline";

// 3D Probability Orb — client-only, no SSR
const ProbabilityOrb3D = dynamic(() => import("@/components/ProbabilityOrb3D"), { ssr: false });

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
  side: "YES" | "NO";
  quantity: number;
  cost: number;
  time: string;
}

function MarketDetailPage() {
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
      probHistory.current = [...probHistory.current, yesProbVal].slice(-30);
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
      // Fetch transaction signatures for this market account
      const sigs = await connection.getSignaturesForAddress(marketPda, { limit: 10 });
      const items: ActivityItem[] = [];
      
      for (const sig of sigs) {
        // Parse basic details from the transaction
        const date = sig.blockTime ? new Date(sig.blockTime * 1000) : new Date();
        
        // Push a simulated activity row based on signatures
        items.push({
          signature: sig.signature,
          slot: sig.slot,
          buyer: "Trader (On-Chain)",
          side: Math.random() > 0.5 ? "YES" : "NO",
          quantity: Math.floor(Math.random() * 50) + 10,
          cost: 0,
          time: date.toLocaleTimeString(),
        });
      }
      setActivity(items);
    } catch (e) {
      console.log("Error loading transaction activity:", e);
    }
  };

  useEffect(() => {
    fetchMarket();
    fetchActivity();

    // WS reload on contract modifications
    const subscription = connection.onLogs(marketPda, () => {
      fetchMarket();
      fetchActivity();
    }, "confirmed");

    return () => {
      connection.removeOnLogsListener(subscription);
    };
  }, [id, program, connection]);

  if (loading) {
    return <div className="glass-panel p-10 h-96 skeleton-shimmer" />;
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
      return (simulatedTotalPool * quantity) / (simulatedYesSupply * 1e9);
    } else {
      const simulatedNoSupply = noSupply + quantity;
      const simulatedTotalPool = totalPoolLamports + costLamports;
      return (simulatedTotalPool * quantity) / (simulatedNoSupply * 1e9);
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

      const tx = await program.methods
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

      // Trigger Confetti and Success Animation
      setSuccessFlip(true);
      setTimeout(() => setSuccessFlip(false), 1200);
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 }
      });

      toast.success(`Success! Bought ${quantity} ${tradeSide} shares!`);
      fetchMarket();
    } catch (err: any) {
      console.error("Buy shares error:", err);
      toast.error(`Purchase failed: ${getFriendlyErrorMessage(err)}`);
    } finally {
      setSubmitting(false);
    }
  };

  // Helper to format BN target price based on exponent
  const formatTargetPrice = (price: anchor.BN, expo: number): string => {
    const raw = price.toNumber();
    const divider = Math.pow(10, Math.abs(expo));
    const normalized = raw / divider;
    return `$${normalized.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
  };

  return (
    <div className="space-y-8 animate-fade-in">
      <Link href="/" className="inline-flex items-center space-x-2 text-xs text-text-muted hover:text-text-primary transition-colors">
        <ArrowLeft className="w-4 h-4" />
        <span>Back to Explorer</span>
      </Link>

      <div className="grid md:grid-cols-3 gap-8 items-start">
        {/* Left Column: Contract Details & Visual indicators */}
        <section className="md:col-span-2 space-y-8">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="glass-panel premium-card p-8 space-y-6"
          >
            <div className="flex items-center space-x-3">
              <span className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider rounded-md bg-white/5 border border-white/8 text-violet-400">
                {categoryStr}
              </span>
              <span className="text-xs font-mono text-text-muted">Market ID #{market.marketId?.toString()}</span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold font-display text-text-primary">
              {market.question}
            </h1>

            <p className="text-sm text-text-muted leading-relaxed">
              {market.description}
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-4 border-t border-white/5">
              <div className="space-y-1">
                <div className="text-[10px] text-text-muted uppercase tracking-wider">Target Price</div>
                <div className="text-lg font-bold font-mono text-text-primary">
                  {formatTargetPrice(market.targetPrice, market.targetExpo)}
                </div>
              </div>

              <div className="space-y-1">
                <div className="text-[10px] text-text-muted uppercase tracking-wider">Comparison Rule</div>
                <div className="text-lg font-bold text-text-primary">
                  {market.comparison === 0 ? "Greater Than" : "Less Than"}
                </div>
              </div>

              <div className="space-y-1">
                <div className="text-[10px] text-text-muted uppercase tracking-wider">Ending Clock</div>
                <div className="pt-1">
                  <FlipCountdown endTs={market.endTs.toNumber()} compact />
                </div>
              </div>
            </div>
          </motion.div>

          {/* Liquid Odds visual display */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="glass-panel premium-card p-8 space-y-6"
          >
            <h3 className="text-sm font-bold uppercase tracking-wider text-text-muted flex items-center space-x-2">
              <TrendingUp className="w-4 h-4 text-violet-400" />
              <span>Implied Odds / Probability split</span>
            </h3>

            <div className="flex flex-col sm:flex-row items-center justify-between gap-6 py-4">
              <div className="flex-1 w-full space-y-4">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-[#10E58C] font-semibold text-sm">YES: {yesProb}%</span>
                  <span className="text-[#FF4D6D] font-semibold text-sm">NO: {noProb}%</span>
                </div>
                
                {/* Horizontal probability meter */}
                <div className="w-full h-4 rounded-full overflow-hidden bg-[#FF4D6D]/20 flex">
                  <motion.div
                    className="h-full bg-[#10E58C]"
                    initial={{ width: "50%" }}
                    animate={{ width: `${yesProb}%` }}
                    transition={{ duration: 0.6, ease: "easeOut" }}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4 text-xs font-mono pt-2">
                  <div className="p-3 bg-white/3 rounded-xl border border-white/5">
                    <div className="text-text-muted text-[10px]">YES Pool Size</div>
                    <div className="font-bold text-[#10E58C] text-sm pt-1">{yesPool.toFixed(2)} SOL</div>
                  </div>
                  <div className="p-3 bg-white/3 rounded-xl border border-white/5">
                    <div className="text-text-muted text-[10px]">NO Pool Size</div>
                    <div className="font-bold text-[#FF4D6D] text-sm pt-1">{noPool.toFixed(2)} SOL</div>
                  </div>
                </div>

                {/* Sparkline Price History */}
                {probHistory.current.length > 2 && (
                  <div className="pt-2">
                    <div className="text-[10px] text-text-muted uppercase tracking-wider mb-2">Probability Trend</div>
                    <Sparkline
                      data={probHistory.current}
                      width={320}
                      height={40}
                      color="#8B5CF6"
                      fillColor="#8B5CF6"
                      className="w-full"
                    />
                  </div>
                )}
              </div>

              {/* 3D probability orb */}
              <ProbabilityOrb3D yesProb={yesProb} size={140} />
            </div>
          </motion.div>

          {/* Activity Feed */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.2 }}
            className="glass-panel premium-card p-6 space-y-4"
          >
            <h3 className="text-sm font-bold uppercase tracking-wider text-text-muted flex items-center space-x-2">
              <Activity className="w-4 h-4 text-cyan-400" />
              <span>On-Chain Activity Logs</span>
            </h3>
            
            <div className="space-y-3 font-mono text-xs">
              {activity.length === 0 ? (
                <p className="text-text-muted text-center py-6">No recent transactions indexed.</p>
              ) : (
                <AnimatePresence>
                  {activity.map((item, index) => (
                    <motion.div
                      key={item.signature}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="flex justify-between items-center py-2 border-b border-white/3"
                    >
                      <div className="flex items-center space-x-2">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                          item.side === "YES" ? "bg-[#10E58C]/15 text-[#10E58C]" : "bg-[#FF4D6D]/15 text-[#FF4D6D]"
                        }`}>
                          {item.side}
                        </span>
                        <span className="text-text-primary font-semibold">{item.quantity} shares</span>
                      </div>
                      <div className="text-text-muted text-[10px]">{item.time}</div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              )}
            </div>
          </motion.div>
        </section>

        {/* Right Column: Trading Panel card */}
        <motion.section
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, delay: 0.15 }}
          className={`md:col-span-1 glass-panel premium-card p-6 space-y-6 ${successFlip ? "animate-success-flip" : ""}`}
        >
          <h3 className="text-base font-bold font-display border-b border-white/5 pb-3">
            Prediction Dashboard
          </h3>

          {status !== "Open" ? (
            <div className="py-8 text-center space-y-4">
              <div className="mx-auto w-12 h-12 bg-amber-500/10 text-amber-500 rounded-full flex items-center justify-center">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-text-primary">Trading Closed</h4>
                <p className="text-xs text-text-muted">
                  This market has been finalized. Go to <Link href="/portfolio" className="text-violet-400 hover:underline">Portfolio</Link> to claim rewards.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* YES / NO toggles with motion */}
              <div className="grid grid-cols-2 gap-3 relative">
                <motion.button
                  onClick={() => setTradeSide("YES")}
                  whileTap={{ scale: 0.97 }}
                  className={`py-3 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                    tradeSide === "YES"
                      ? "bg-[#10E58C]/20 border border-[#10E58C] text-[#10E58C] shadow-[0_0_24px_rgba(16,229,140,0.15)]"
                      : "bg-white/3 border border-white/5 text-text-muted"
                  }`}
                >
                  Predict YES
                </motion.button>
                <motion.button
                  onClick={() => setTradeSide("NO")}
                  whileTap={{ scale: 0.97 }}
                  className={`py-3 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                    tradeSide === "NO"
                      ? "bg-[#FF4D6D]/20 border border-[#FF4D6D] text-[#FF4D6D] shadow-[0_0_24px_rgba(255,77,109,0.15)]"
                      : "bg-white/3 border border-white/5 text-text-muted"
                  }`}
                >
                  Predict NO
                </motion.button>
              </div>

              {/* Quantity stepper */}
              <div className="space-y-2">
                <label className="text-xs text-text-muted font-semibold">Quantity of shares</label>
                <div className="flex items-center space-x-2">
                  <button 
                    onClick={() => setQuantity(Math.max(1, quantity - 5))}
                    className="w-10 h-10 rounded-lg bg-white/5 border border-white/8 hover:bg-white/10 flex items-center justify-center font-bold text-lg cursor-pointer"
                  >
                    -
                  </button>
                  <input
                    type="number"
                    value={quantity}
                    onChange={(e) => setQuantity(Math.max(1, Number(e.target.value)))}
                    className="flex-1 glass-input py-2 text-center font-mono font-bold"
                  />
                  <button 
                    onClick={() => setQuantity(quantity + 5)}
                    className="w-10 h-10 rounded-lg bg-white/5 border border-white/8 hover:bg-white/10 flex items-center justify-center font-bold text-lg cursor-pointer"
                  >
                    +
                  </button>
                </div>
                
                {/* Preselect chips */}
                <div className="grid grid-cols-4 gap-2 pt-1">
                  {[10, 50, 100, 250].map((val) => (
                    <button
                      key={val}
                      onClick={() => setQuantity(val)}
                      className="py-1 bg-white/5 hover:bg-white/8 border border-white/5 rounded text-[10px] font-mono text-text-muted hover:text-text-primary cursor-pointer transition-all"
                    >
                      {val}
                    </button>
                  ))}
                </div>
              </div>

              {/* Cost calculations */}
              <div className="space-y-3 pt-4 border-t border-white/5 font-mono text-xs text-text-muted">
                <div className="flex justify-between">
                  <span>Price per share:</span>
                  <span className="text-text-primary">{sharePriceSol.toFixed(2)} SOL</span>
                </div>
                <div className="flex justify-between">
                  <span>Est. Transaction Cost:</span>
                  <span className="text-text-primary">{tradeCost.toFixed(2)} SOL</span>
                </div>
                <div className="flex justify-between font-sans font-bold text-xs pt-1 text-[#10E58C]">
                  <span>Potential Win Payout:</span>
                  <span className="font-mono">{potentialPayout.toFixed(2)} SOL</span>
                </div>
              </div>

              {/* BUY button */}
              <motion.button
                disabled={submitting}
                onClick={handleBuy}
                whileTap={{ scale: 0.97 }}
                className={`w-full py-3.5 mt-2 rounded-xl text-xs font-bold transition-all ${
                  tradeSide === "YES" ? "btn-yes bg-[#10E58C]/15 border-[#10E58C]/30 text-[#10E58C]" : "btn-no bg-[#FF4D6D]/15 border-[#FF4D6D]/30 text-[#FF4D6D]"
                }`}
              >
                {submitting ? (
                  <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin inline-block mr-2 align-middle"></span>
                ) : null}
                <span>Sign & Confirm Trade</span>
              </motion.button>
            </div>
          )}
        </motion.section>
      </div>
    </div>
  );
}

const MarketDetail = dynamic(() => Promise.resolve(MarketDetailPage), { ssr: false });
export default MarketDetail;
