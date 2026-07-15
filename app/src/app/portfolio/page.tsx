"use client";

import React, { useState, useEffect, useMemo } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useProgram } from "@/hooks/useProgram";
import { PublicKey } from "@solana/web3.js";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import { getFriendlyErrorMessage } from "@/lib/error-map";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { 
  FolderOpen, 
  Wallet, 
  Coins, 
  CheckCircle, 
  Gift, 
  TrendingUp, 
  TrendingDown,
  ShieldAlert,
  Filter
} from "lucide-react";
import * as anchor from "@coral-xyz/anchor";
import { Sparkline } from "@/components/Sparkline";
import { SplitFlapText } from "@/components/SplitFlapText";

interface PositionWithMarket {
  publicKey: PublicKey;
  account: {
    owner: PublicKey;
    market: PublicKey;
    yesAmount: anchor.BN;
    noAmount: anchor.BN;
    claimed: boolean;
    totalSpentLamports: anchor.BN;
  };
  marketAccount: {
    marketId: anchor.BN;
    question: string;
    description: string;
    category: number;
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
  };
}

type FilterTab = "All" | "Open" | "Settled" | "Claimed";
const CATEGORIES = ["Crypto", "Sports", "Politics", "Tech", "Other"];

const fadeInUp = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: "easeOut" as const } },
};

function PortfolioPage() {
  const { program, wallet } = useProgram();
  const [positions, setPositions] = useState<PositionWithMarket[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<FilterTab>("All");
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>("All");

  const fetchPortfolio = async () => {
    if (!wallet || !wallet.publicKey) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const allPositions = await program.account.userPosition.all([
        {
          memcmp: {
            offset: 8,
            bytes: wallet.publicKey.toBase58(),
          },
        },
      ]);

      const positionData: PositionWithMarket[] = [];

      for (const pos of allPositions) {
        try {
          const marketAccount = await program.account.market.fetch(pos.account.market);
          positionData.push({
            publicKey: pos.publicKey,
            account: pos.account as any,
            marketAccount: marketAccount as any,
          });
        } catch (err) {
          console.error("Error fetching market for position:", pos.publicKey.toBase58(), err);
        }
      }

      setPositions(positionData);
    } catch (err: any) {
      console.error("Error fetching portfolio:", err);
      toast.error(`Failed to load portfolio: ${getFriendlyErrorMessage(err)}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPortfolio();
  }, [wallet, program]);

  const getStatusString = (status: any): "Open" | "Settled" | "Cancelled" => {
    if (status.open) return "Open";
    if (status.settled) return "Settled";
    if (status.cancelled) return "Cancelled";
    return "Open";
  };

  const getCategoryString = (categoryIndex: number): string => {
    return CATEGORIES[categoryIndex] || "Other";
  };

  const calculatePnL = (pos: PositionWithMarket): { pnl: number; pnlPercent: number } | null => {
    const status = getStatusString(pos.marketAccount.status);
    if (status !== "Settled") return null;

    const spent = pos.account.totalSpentLamports.toNumber() / 1e9;
    const winningOutcome = pos.marketAccount.winningOutcome;
    const yesShares = pos.account.yesAmount.toNumber() / 1e6;
    const noShares = pos.account.noAmount.toNumber() / 1e6;

    const userWon = (winningOutcome.yes && yesShares > 0) || (winningOutcome.no && noShares > 0);
    
    if (!userWon) {
      return { pnl: -spent, pnlPercent: -100 };
    }

    const totalPayoutPool = pos.marketAccount.totalPayoutPool.toNumber() / 1e9;
    const winningShares = winningOutcome.yes ? yesShares : noShares;
    const totalWinningSupply = winningOutcome.yes
      ? pos.marketAccount.yesSupply.toNumber() / 1e6
      : pos.marketAccount.noSupply.toNumber() / 1e6;

    const payout = totalWinningSupply > 0 ? (winningShares / totalWinningSupply) * totalPayoutPool : 0;
    const pnl = payout - spent;
    const pnlPercent = spent > 0 ? (pnl / spent) * 100 : 0;

    return { pnl, pnlPercent };
  };

  const handleClaimRewards = async (pos: PositionWithMarket) => {
    if (!wallet || !wallet.publicKey) return;
    try {
      setClaimingId(pos.publicKey.toBase58());
      
      const winningOutcome = pos.marketAccount.winningOutcome;
      let winningMint: PublicKey;
      
      if (winningOutcome.yes) {
        winningMint = pos.marketAccount.yesMint;
      } else if (winningOutcome.no) {
        winningMint = pos.marketAccount.noMint;
      } else {
        toast.error("Winning outcome is unset.");
        return;
      }

      const claimerAta = getAssociatedTokenAddressSync(winningMint, wallet.publicKey);

      await program.methods
        .claimRewards()
        .accounts({
          claimer: wallet.publicKey,
          market: pos.account.market,
          treasury: PublicKey.findProgramAddressSync([Buffer.from("treasury"), pos.account.market.toBuffer()], program.programId)[0],
          winningMint: winningMint,
          claimerAta: claimerAta,
          userPosition: pos.publicKey,
        } as any)
        .rpc();

      toast.success("Rewards claimed successfully!");
      fetchPortfolio();
    } catch (err: any) {
      console.error("Error claiming rewards:", err);
      toast.error(`Failed to claim rewards: ${getFriendlyErrorMessage(err)}`);
    } finally {
      setClaimingId(null);
    }
  };

  const handleClaimRefund = async (pos: PositionWithMarket) => {
    if (!wallet || !wallet.publicKey) return;
    try {
      setClaimingId(pos.publicKey.toBase58());

      const claimerYesAta = getAssociatedTokenAddressSync(pos.marketAccount.yesMint, wallet.publicKey);
      const claimerNoAta = getAssociatedTokenAddressSync(pos.marketAccount.noMint, wallet.publicKey);

      await program.methods
        .claimRefund()
        .accounts({
          claimer: wallet.publicKey,
          market: pos.account.market,
          treasury: PublicKey.findProgramAddressSync([Buffer.from("treasury"), pos.account.market.toBuffer()], program.programId)[0],
          yesMint: pos.marketAccount.yesMint,
          noMint: pos.marketAccount.noMint,
          claimerYesAta: claimerYesAta,
          claimerNoAta: claimerNoAta,
          userPosition: pos.publicKey,
        } as any)
        .rpc();

      toast.success("Refund processed successfully!");
      fetchPortfolio();
    } catch (err: any) {
      console.error("Error claiming refund:", err);
      toast.error(`Failed to claim refund: ${getFriendlyErrorMessage(err)}`);
    } finally {
      setClaimingId(null);
    }
  };

  // Filtered positions by Lifecycle status and Market category
  const filteredPositions = useMemo(() => {
    return positions.filter((pos) => {
      const status = getStatusString(pos.marketAccount.status);
      const matchesLifecycle = 
        activeFilter === "All" ||
        (activeFilter === "Open" && status === "Open") ||
        (activeFilter === "Settled" && status === "Settled" && !pos.account.claimed) ||
        (activeFilter === "Claimed" && pos.account.claimed);

      const categoryName = getCategoryString(pos.marketAccount.category);
      const matchesCategory = 
        selectedCategoryFilter === "All" || categoryName === selectedCategoryFilter;

      return matchesLifecycle && matchesCategory;
    });
  }, [positions, activeFilter, selectedCategoryFilter]);

  // Calculate statistics for the CURRENT filtered category
  const portfolioStats = useMemo(() => {
    let totalInvested = 0;
    let activePositionsCount = 0;
    let totalPnL = 0;
    let winCount = 0;
    let settledCount = 0;

    // We compute statistics based on category filter
    const targetPositions = positions.filter((p) => 
      selectedCategoryFilter === "All" || getCategoryString(p.marketAccount.category) === selectedCategoryFilter
    );

    targetPositions.forEach((p) => {
      totalInvested += p.account.totalSpentLamports.toNumber();
      if (!p.account.claimed) {
        activePositionsCount++;
      }
      const pnlResult = calculatePnL(p);
      if (pnlResult) {
        settledCount++;
        totalPnL += pnlResult.pnl;
        if (pnlResult.pnl > 0) winCount++;
      }
    });

    return {
      invested: totalInvested / 1e9,
      count: activePositionsCount,
      pnl: totalPnL,
      winRate: settledCount > 0 ? Math.round((winCount / settledCount) * 100) : null,
    };
  }, [positions, selectedCategoryFilter]);

  const investmentHistory = useMemo(() => {
    const targetPositions = positions.filter((p) => 
      selectedCategoryFilter === "All" || getCategoryString(p.marketAccount.category) === selectedCategoryFilter
    );
    let sum = 0;
    const history: number[] = [];
    for (const p of targetPositions) {
      sum += p.account.totalSpentLamports.toNumber() / 1e9;
      history.push(sum);
    }
    return history;
  }, [positions, selectedCategoryFilter]);

  if (!wallet || !wallet.publicKey) {
    return (
      <div className="board-panel py-20 text-center space-y-6 max-w-xl mx-auto my-12">
        <div className="mx-auto w-16 h-16 bg-[#050608] border border-[#2D3142] rounded flex items-center justify-center text-[#808495]">
          <Wallet className="w-8 h-8" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-bold font-display text-[#F4F4F9]">WALLET NOT RECORDED</h2>
          <p className="text-[#808495] text-sm max-w-sm mx-auto">
            Please connect your wallet at the top terminal header to read positions and claim settlement payouts.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-10 font-sans">
      <div className="border-b border-[#2D3142] pb-4">
        <h1 className="text-3xl font-bold font-display text-[#F4F4F9]">
          [■] PORTFOLIO LEDGER
        </h1>
        <p className="text-[#808495] text-sm font-medium">Track your positions, settle payouts, and audit refund specifications.</p>
      </div>

      {/* Category Performance Filter/Compare view */}
      <div className="space-y-3">
        <div className="text-[10px] uppercase font-display tracking-widest text-[#808495] font-semibold">
          Compare Performance by Category
        </div>
        <div className="flex items-center space-x-2 overflow-x-auto pb-2 scrollbar-none">
          <button
            onClick={() => setSelectedCategoryFilter("All")}
            className={`px-3 py-1.5 text-xs font-semibold rounded transition-all active:scale-95 ${
              selectedCategoryFilter === "All"
                ? "mechanical-switch-active"
                : "mechanical-switch-inactive"
            }`}
          >
            All Categories
          </button>
          {CATEGORIES.map((cat) => {
            const countInCategory = positions.filter((p) => getCategoryString(p.marketAccount.category) === cat).length;
            return (
              <button
                key={cat}
                onClick={() => setSelectedCategoryFilter(cat)}
                className={`px-3 py-1.5 text-xs font-semibold rounded transition-all active:scale-95 ${
                  selectedCategoryFilter === cat
                    ? "mechanical-switch-active"
                    : "mechanical-switch-inactive"
                }`}
              >
                {cat} ({countInCategory})
              </button>
            );
          })}
        </div>
      </div>

      {/* Portfolio Overview */}
      <motion.section
        className="grid grid-cols-2 md:grid-cols-4 gap-4"
        initial="hidden"
        animate="visible"
        variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.05 } } }}
      >
        <motion.div variants={fadeInUp} className="board-panel p-5 flex flex-col justify-between h-28 bg-[#0C0D12]">
          <div className="text-[10px] uppercase font-display tracking-wider text-[#808495]">Total Spent ({selectedCategoryFilter})</div>
          <div className="flex items-end justify-between">
            <span className="text-xs font-mono text-[#808495]">SOL</span>
            <SplitFlapText text={`${portfolioStats.invested.toFixed(1)}`} charClassName="w-[20px] h-[30px] text-sm" />
          </div>
        </motion.div>

        <motion.div variants={fadeInUp} className="board-panel p-5 flex flex-col justify-between h-28 bg-[#0C0D12]">
          <div className="text-[10px] uppercase font-display tracking-wider text-[#808495]">Active POS ({selectedCategoryFilter})</div>
          <div className="flex items-end justify-between">
            <span className="text-xs font-mono text-[#808495]">QTY</span>
            <SplitFlapText text={`${portfolioStats.count}`} charClassName="w-[20px] h-[30px] text-sm" />
          </div>
        </motion.div>

        <motion.div variants={fadeInUp} className="board-panel p-5 flex flex-col justify-between h-28 bg-[#0C0D12]">
          <div className="text-[10px] uppercase font-display tracking-wider text-[#808495]">Total P&L ({selectedCategoryFilter})</div>
          <div className="flex items-end justify-between">
            <span className="text-xs font-mono text-[#808495]">SOL</span>
            <span className={`text-xl font-mono font-bold ${portfolioStats.pnl >= 0 ? "text-[#235A34]" : "text-[#8E2424]"}`}>
              {portfolioStats.pnl >= 0 ? "+" : ""}{portfolioStats.pnl.toFixed(2)}
            </span>
          </div>
        </motion.div>

        <motion.div variants={fadeInUp} className="board-panel p-5 flex flex-col justify-between h-28 bg-[#0C0D12]">
          <div className="text-[10px] uppercase font-display tracking-wider text-[#808495]">Win Rate ({selectedCategoryFilter})</div>
          <div className="flex items-end justify-between">
            <span className="text-xs font-mono text-[#808495]">%</span>
            <span className="text-xl font-mono font-bold text-[#F4F4F9]">
              {portfolioStats.winRate !== null ? `${portfolioStats.winRate}%` : "—"}
            </span>
          </div>
        </motion.div>
      </motion.section>

      {/* Performance Trend Sparkline */}
      {investmentHistory.length > 1 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="board-panel p-6 space-y-3 bg-[#0C0D12]"
        >
          <h3 className="text-xs font-bold uppercase tracking-wider font-display text-[#808495]">Investment Scaling Trend</h3>
          <div className="w-full bg-[#050608] border border-[#2D3142] p-2 rounded">
            <Sparkline
              data={investmentHistory}
              width={600}
              height={50}
              color="#FFA500"
              fillColor="#FFA500"
              className="w-full"
            />
          </div>
        </motion.div>
      )}

      {/* Filter Tabs */}
      <div className="flex items-center space-x-2 border-b border-[#2D3142] pb-3">
        <Filter className="w-4 h-4 text-[#808495]" />
        {(["All", "Open", "Settled", "Claimed"] as FilterTab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveFilter(tab)}
            className={`px-3 py-1 text-xs font-semibold rounded transition-all active:scale-95 ${
              activeFilter === tab
                ? "mechanical-switch-active"
                : "mechanical-switch-inactive"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Positions Ledger List */}
      {loading ? (
        <section className="space-y-4">
          {[1, 2].map((i) => (
            <div key={i} className="board-panel p-6 h-36 skeleton-shimmer bg-[#0C0D12]/50" />
          ))}
        </section>
      ) : filteredPositions.length === 0 ? (
        <div className="board-panel py-20 text-center text-[#808495] flex flex-col items-center justify-center space-y-4">
          <FolderOpen className="w-10 h-10 opacity-30" />
          <div>
            <h3 className="text-sm font-bold font-display text-[#F4F4F9]">LEDGER IS EMPTY</h3>
            <p className="text-xs mt-1">
              {activeFilter === "All"
                ? `You do not hold positions under the ${selectedCategoryFilter} category.`
                : `No positions fit the ${activeFilter.toLowerCase()} status criteria.`}
            </p>
          </div>
        </div>
      ) : (
        <AnimatePresence mode="popLayout">
          <section className="space-y-4">
            {filteredPositions.map((pos) => {
              const status = getStatusString(pos.marketAccount.status);
              const spentSol = pos.account.totalSpentLamports.toNumber() / 1e9;
              const yesShares = pos.account.yesAmount.toNumber() / 1e6;
              const noShares = pos.account.noAmount.toNumber() / 1e6;
              
              const isSettled = status === "Settled";
              const isCancelled = status === "Cancelled";
              
              const winningOutcome = pos.marketAccount.winningOutcome;
              const userWon = isSettled && (
                (winningOutcome.yes && yesShares > 0) || 
                (winningOutcome.no && noShares > 0)
              );

              const pnlResult = calculatePnL(pos);

              return (
                <motion.div
                  key={pos.publicKey.toBase58()}
                  layout
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  transition={{ duration: 0.25 }}
                  className="board-panel p-6 flex flex-col md:flex-row md:items-center justify-between gap-6"
                >
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center space-x-2">
                      <span className="px-2 py-0.5 text-[9px] font-bold font-mono uppercase tracking-wider rounded bg-[#2D3142]/40 border border-[#2D3142] text-[#808495]">
                        BOARD ID #{pos.marketAccount.marketId?.toString()}
                      </span>
                      <span className="px-2 py-0.5 text-[9px] font-bold font-mono uppercase tracking-wider rounded bg-[#2D3142]/40 border border-[#2D3142] text-[#FFA500]">
                        {getCategoryString(pos.marketAccount.category)}
                      </span>
                      <span className={`w-2 h-2 rounded-full ${
                        status === "Open" ? "bg-[#235A34]" : isSettled ? "bg-[#808495]" : "bg-[#8E2424]"
                      }`}></span>
                      <span className="text-[10px] font-mono text-[#808495] uppercase font-bold">
                        {status}
                      </span>
                    </div>
                    <Link href={`/market/${pos.account.market.toBase58()}`}>
                      <h3 className="text-sm font-bold font-display hover:text-[#FFA500] transition-colors">
                        {pos.marketAccount.question}
                      </h3>
                    </Link>
                    <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-xs text-[#808495] font-mono">
                      <div>HELD: <span className="text-[#235A34] font-bold">{yesShares} YES</span> / <span className="text-[#8E2424] font-bold">{noShares} NO</span></div>
                      <div>COST: <span className="text-[#F4F4F9] font-bold">{spentSol.toFixed(2)} SOL</span></div>
                      {pnlResult && (
                        <div>
                          RESULT:{" "}
                          <span className={`font-bold ${pnlResult.pnl >= 0 ? "text-[#235A34]" : "text-[#8E2424]"}`}>
                            {pnlResult.pnl >= 0 ? "+" : ""}{pnlResult.pnl.toFixed(2)} SOL
                            ({pnlResult.pnl >= 0 ? "+" : ""}{pnlResult.pnlPercent.toFixed(0)}%)
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-end">
                    {pos.account.claimed ? (
                      <div className="flex items-center space-x-2 bg-[#235A34]/10 border border-[#235A34]/20 px-4 py-2 rounded text-[#235A34] text-xs font-bold uppercase tracking-wider font-display">
                        <CheckCircle className="w-4 h-4" />
                        <span>WITHDRAWN</span>
                      </div>
                    ) : isCancelled ? (
                      <button
                        disabled={claimingId !== null}
                        onClick={() => handleClaimRefund(pos)}
                        className="btn-amber py-2 px-5 flex items-center space-x-2 text-xs"
                      >
                        {claimingId === pos.publicKey.toBase58() ? (
                          <span className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin"></span>
                        ) : (
                          <ShieldAlert className="w-4 h-4" />
                        )}
                        <span>Claim Refund</span>
                      </button>
                    ) : isSettled ? (
                      userWon ? (
                        <button
                          disabled={claimingId !== null}
                          onClick={() => handleClaimRewards(pos)}
                          className="btn-amber py-2 px-5 flex items-center space-x-2 text-xs"
                        >
                          {claimingId === pos.publicKey.toBase58() ? (
                            <span className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin"></span>
                          ) : (
                            <Gift className="w-4 h-4" />
                          )}
                          <span>Withdraw Payout</span>
                        </button>
                      ) : (
                        <div className="px-4 py-2 border border-[#2D3142] rounded text-[#808495] text-[10px] font-bold uppercase tracking-wider font-display">
                          UNSUCCESSFUL
                        </div>
                      )
                    ) : (
                      <div className="px-4 py-2 border border-[#2D3142] rounded text-[#808495] text-[10px] font-bold uppercase tracking-wider font-display">
                        ACTIVE TRADING
                      </div>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </section>
        </AnimatePresence>
      )}
    </div>
  );
}

const Portfolio = dynamic(() => Promise.resolve(PortfolioPage), { ssr: false });
export default Portfolio;
