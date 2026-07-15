"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useProgram } from "@/hooks/useProgram";
import { useUserRole } from "@/hooks/useUserRole";
import { PublicKey } from "@solana/web3.js";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import { getFriendlyErrorMessage } from "@/lib/error-map";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import {
  Wallet,
  Coins,
  TrendingUp,
  Clock,
  ArrowRight,
  History,
  AlertTriangle,
  PieChart,
  Briefcase,
  ExternalLink,
} from "lucide-react";
import * as anchor from "@coral-xyz/anchor";
import { EventParser } from "@coral-xyz/anchor";
import { FlipCountdown } from "@/components/FlipCountdown";
import { getWatchlist } from "@/lib/watchlist";
import {
  formatEventTime,
  findMarketQuestion,
  getMarketStatusString,
} from "@/lib/events";
import { ConnectWalletGate } from "@/components/dashboard/ConnectWalletGate";
import { StatTile3D } from "@/components/dashboard/StatTile3D";
import { CategoryRing3D } from "@/components/dashboard/CategoryRing3D";
import { DashboardSection, DashboardHero } from "@/components/dashboard/DashboardSection";

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
    endTs: anchor.BN;
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

interface PersonalActivity {
  signature: string;
  type: "BUY_YES" | "BUY_NO" | "CLAIM_REWARDS" | "CLAIM_REFUND";
  question: string;
  amount: number;
  costOrPayout: number;
  timeStr: string;
}

const CATEGORIES = ["Crypto", "Sports", "Politics", "Tech", "Other"];

const getCategoryString = (categoryIndex: number): string =>
  CATEGORIES[categoryIndex] || "Other";

const listVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.06 } },
};

const itemVariants = {
  hidden: { opacity: 0, x: -12 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.35 } },
};

export default function UserDashboard() {
  const { program, wallet, connection } = useProgram();
  const { role, isLoading: roleLoading } = useUserRole();
  const router = useRouter();

  const [positions, setPositions] = useState<PositionWithMarket[]>([]);
  const [allMarkets, setAllMarkets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [watchlistKeys, setWatchlistKeys] = useState<string[]>([]);
  const [activity, setActivity] = useState<PersonalActivity[]>([]);
  const [activityLoading, setActivityLoading] = useState(false);
  const [lifetimeClaimedFromEvents, setLifetimeClaimedFromEvents] = useState(0);


  useEffect(() => {
    setWatchlistKeys(getWatchlist());
  }, []);

  const calculatePnL = (pos: PositionWithMarket): { pnl: number; pnlPercent: number } | null => {
    const status = getMarketStatusString(pos.marketAccount.status);
    if (status !== "Settled") return null;

    const spent = pos.account.totalSpentLamports.toNumber() / 1e9;
    const winningOutcome = pos.marketAccount.winningOutcome;
    const yesShares = pos.account.yesAmount.toNumber() / 1e6;
    const noShares = pos.account.noAmount.toNumber() / 1e6;
    const userWon =
      (winningOutcome.yes && yesShares > 0) || (winningOutcome.no && noShares > 0);

    if (!userWon) return { pnl: -spent, pnlPercent: -100 };

    const totalPayoutPool = pos.marketAccount.totalPayoutPool.toNumber() / 1e9;
    const winningShares = winningOutcome.yes ? yesShares : noShares;
    const totalWinningSupply = winningOutcome.yes
      ? pos.marketAccount.yesSupply.toNumber() / 1e6
      : pos.marketAccount.noSupply.toNumber() / 1e6;
    const payout =
      totalWinningSupply > 0 ? (winningShares / totalWinningSupply) * totalPayoutPool : 0;
    const pnl = payout - spent;
    return { pnl, pnlPercent: spent > 0 ? (pnl / spent) * 100 : 0 };
  };

  const fetchDashboardData = async () => {
    if (!wallet?.publicKey) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const allPositions = await program.account.userPosition.all([
        { memcmp: { offset: 8, bytes: wallet.publicKey.toBase58() } },
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

      const markets = await program.account.market.all();
      setAllMarkets(markets);
    } catch (err: any) {
      console.error("Error loading dashboard data:", err);
      toast.error(`Dashboard update failed: ${getFriendlyErrorMessage(err)}`);
    } finally {
      setLoading(false);
    }
  };

  const fetchPersonalActivity = async () => {
    if (!wallet?.publicKey || allMarkets.length === 0) return;

    try {
      setActivityLoading(true);
      const sigs = await connection.getSignaturesForAddress(wallet.publicKey, { limit: 40 });
      const items: PersonalActivity[] = [];
      let claimedTotal = 0;
      const eventParser = new EventParser(program.programId, program.coder);

      const txs = await Promise.all(
        sigs.map(async (sig) => {
          try {
            return await connection.getParsedTransaction(sig.signature, {
              maxSupportedTransactionVersion: 0,
              commitment: "confirmed",
            });
          } catch {
            return null;
          }
        })
      );

      sigs.forEach((sig, idx) => {
        const tx = txs[idx];
        if (!tx?.meta?.logMessages) return;

        const timeStr = formatEventTime(sig.blockTime);
        const events = eventParser.parseLogs(tx.meta.logMessages);

        for (const event of events) {
          const marketId = event.data.marketId as anchor.BN;
          const question = findMarketQuestion(marketId, allMarkets);
          const walletKey = wallet.publicKey!.toBase58();

          if (
            event.name === "SharesPurchased" &&
            (event.data.buyer as PublicKey).toBase58() === walletKey
          ) {
            const side = event.data.side as any;
            items.push({
              signature: sig.signature,
              type: side.yes !== undefined ? "BUY_YES" : "BUY_NO",
              question,
              amount: (event.data.quantity as anchor.BN).toNumber() / 1e6,
              costOrPayout: (event.data.cost as anchor.BN).toNumber() / 1e9,
              timeStr,
            });
          } else if (
            event.name === "RewardsClaimed" &&
            (event.data.claimer as PublicKey).toBase58() === walletKey
          ) {
            const payout = (event.data.payout as anchor.BN).toNumber() / 1e9;
            claimedTotal += payout;
            items.push({
              signature: sig.signature,
              type: "CLAIM_REWARDS",
              question,
              amount: 0,
              costOrPayout: payout,
              timeStr,
            });
          } else if (
            event.name === "RefundClaimed" &&
            (event.data.user as PublicKey).toBase58() === walletKey
          ) {
            const refund = (event.data.refund as anchor.BN).toNumber() / 1e9;
            claimedTotal += refund;
            items.push({
              signature: sig.signature,
              type: "CLAIM_REFUND",
              question,
              amount: 0,
              costOrPayout: refund,
              timeStr,
            });
          }
        }
      });

      setActivity(items);
      setLifetimeClaimedFromEvents(claimedTotal);
    } catch (err) {
      console.error("Error fetching personal activity logs:", err);
    } finally {
      setActivityLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [wallet, program]);

  useEffect(() => {
    if (allMarkets.length > 0) fetchPersonalActivity();
  }, [allMarkets, wallet]);

  const handleClaimRewards = async (pos: PositionWithMarket) => {
    if (!wallet?.publicKey) return;
    try {
      setClaimingId(pos.publicKey.toBase58());
      const winningOutcome = pos.marketAccount.winningOutcome;
      const winningMint = winningOutcome.yes
        ? pos.marketAccount.yesMint
        : winningOutcome.no
          ? pos.marketAccount.noMint
          : null;

      if (!winningMint) {
        toast.error("Winning outcome is unset.");
        return;
      }

      const claimerAta = getAssociatedTokenAddressSync(winningMint, wallet.publicKey);
      await program.methods
        .claimRewards()
        .accounts({
          claimer: wallet.publicKey,
          market: pos.account.market,
          treasury: PublicKey.findProgramAddressSync(
            [Buffer.from("treasury"), pos.account.market.toBuffer()],
            program.programId
          )[0],
          winningMint,
          claimerAta,
          userPosition: pos.publicKey,
        } as any)
        .rpc();

      toast.success("Rewards claimed successfully!");
      import("canvas-confetti").then((module) => {
        module.default({ particleCount: 180, spread: 90, origin: { y: 0.6 } });
      });
      fetchDashboardData();
      fetchPersonalActivity();
    } catch (err: any) {
      toast.error(`Failed to claim rewards: ${getFriendlyErrorMessage(err)}`);
    } finally {
      setClaimingId(null);
    }
  };

  const handleClaimRefund = async (pos: PositionWithMarket) => {
    if (!wallet?.publicKey) return;
    try {
      setClaimingId(pos.publicKey.toBase58());
      const claimerYesAta = getAssociatedTokenAddressSync(
        pos.marketAccount.yesMint,
        wallet.publicKey
      );
      const claimerNoAta = getAssociatedTokenAddressSync(
        pos.marketAccount.noMint,
        wallet.publicKey
      );

      await program.methods
        .claimRefund()
        .accounts({
          claimer: wallet.publicKey,
          market: pos.account.market,
          treasury: PublicKey.findProgramAddressSync(
            [Buffer.from("treasury"), pos.account.market.toBuffer()],
            program.programId
          )[0],
          yesMint: pos.marketAccount.yesMint,
          noMint: pos.marketAccount.noMint,
          claimerYesAta,
          claimerNoAta,
          userPosition: pos.publicKey,
        } as any)
        .rpc();

      toast.success("Refund processed successfully!");
      fetchDashboardData();
      fetchPersonalActivity();
    } catch (err: any) {
      toast.error(`Failed to claim refund: ${getFriendlyErrorMessage(err)}`);
    } finally {
      setClaimingId(null);
    }
  };

  const stats = useMemo(() => {
    let totalInvested = 0;
    let activeCount = 0;
    let winCount = 0;
    let settledCount = 0;

    positions.forEach((p) => {
      const invested = p.account.totalSpentLamports.toNumber() / 1e9;
      totalInvested += invested;

      const status = getMarketStatusString(p.marketAccount.status);
      const yesShares = p.account.yesAmount.toNumber() / 1e6;
      const noShares = p.account.noAmount.toNumber() / 1e6;
      if (status === "Open" && (yesShares > 0 || noShares > 0)) activeCount++;

      const pnlResult = calculatePnL(p);
      if (pnlResult) {
        settledCount++;
        if (pnlResult.pnl > 0) winCount++;
      }
    });

    return {
      totalSpent: totalInvested,
      activePositions: activeCount,
      winRate: settledCount > 0 ? Math.round((winCount / settledCount) * 100) : null,
      lifetimeClaimed: lifetimeClaimedFromEvents,
    };
  }, [positions, lifetimeClaimedFromEvents]);

  const needsAttention = useMemo(
    () =>
      positions.filter((p) => {
        const status = getMarketStatusString(p.marketAccount.status);
        return !p.account.claimed && (status === "Settled" || status === "Cancelled");
      }),
    [positions]
  );

  const openPositions = useMemo(
    () =>
      positions.filter((p) => {
        const status = getMarketStatusString(p.marketAccount.status);
        const yesShares = p.account.yesAmount.toNumber() / 1e6;
        const noShares = p.account.noAmount.toNumber() / 1e6;
        return status === "Open" && (yesShares > 0 || noShares > 0);
      }),
    [positions]
  );

  const endingSoonMarkets = useMemo(() => {
    const userHeldMarketPubkeys = new Set(positions.map((p) => p.account.market.toBase58()));
    return allMarkets
      .filter((m) => {
        const key = m.publicKey.toBase58();
        const status = getMarketStatusString(m.account.status);
        return status === "Open" && (watchlistKeys.includes(key) || userHeldMarketPubkeys.has(key));
      })
      .sort((a, b) => a.account.endTs.toNumber() - b.account.endTs.toNumber())
      .slice(0, 4);
  }, [allMarkets, positions, watchlistKeys]);

  const categoryExposure = useMemo(() => {
    const breakdown = { Crypto: 0, Sports: 0, Politics: 0, Tech: 0, Other: 0 };
    let total = 0;

    positions.forEach((p) => {
      const invested = p.account.totalSpentLamports.toNumber() / 1e9;
      const cat = getCategoryString(p.marketAccount.category) as keyof typeof breakdown;
      if (breakdown[cat] !== undefined) breakdown[cat] += invested;
      else breakdown.Other += invested;
      total += invested;
    });

    return {
      breakdown: Object.entries(breakdown).map(([name, value]) => ({
        name,
        value,
        percentage: total > 0 ? Math.round((value / total) * 100) : 0,
      })),
      total,
    };
  }, [positions]);

  if (role === "disconnected" && !roleLoading) {
    return (
      <ConnectWalletGate
        title="[■] CONNECT WALLET TO CONTINUE"
        description="Initialize your Solana keypair terminal connection. The application routes you automatically — traders to this ledger, platform administrators to the observatory console."
      />
    );
  }

  if (loading || roleLoading) {
    return (
      <div className="space-y-8 animate-pulse max-w-7xl mx-auto w-full">
        <div className="h-10 bg-white/5 border border-white/10 rounded w-1/3" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-32 board-panel skeleton-shimmer bg-[#0C0D12]" />
          ))}
        </div>
        <div className="h-64 board-panel skeleton-shimmer bg-[#0C0D12]" />
      </div>
    );
  }

  const walletBadge = wallet?.publicKey
    ? `${wallet.publicKey.toBase58().slice(0, 6)}...${wallet.publicKey.toBase58().slice(-6)}`
    : "";

  return (
    <div className="space-y-10 animate-fade-in max-w-7xl mx-auto w-full">
      <DashboardHero
        title="[■] PILOT LEDGER DASHBOARD"
        subtitle="Monitor positions, check payouts, analyze category exposure, and review your on-chain audit trail."
        badge={walletBadge}
        badgeLabel="CONNECTED AS:"
      />

      {/* Stats row */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-6">
        <StatTile3D label="Total Spent" value={stats.totalSpent.toFixed(2)} unit="SOL" icon={Coins} delay={0} />
        <StatTile3D
          label="Active Positions"
          value={String(stats.activePositions)}
          unit="QTY"
          icon={Briefcase}
          accent="green"
          delay={0.05}
        />
        <StatTile3D
          label="Win Rate"
          value={stats.winRate !== null ? String(stats.winRate) : "—"}
          unit="%"
          icon={TrendingUp}
          accent="neutral"
          delay={0.1}
          useSplitFlap={stats.winRate !== null}
        />
        <StatTile3D
          label="Lifetime Claimed"
          value={stats.lifetimeClaimed > 0 ? stats.lifetimeClaimed.toFixed(2) : "0.00"}
          unit="SOL"
          icon={Wallet}
          delay={0.15}
          useSplitFlap={false}
        />
      </section>

      {/* Needs attention */}
      <AnimatePresence>
        {needsAttention.length > 0 && (
          <DashboardSection
            title="Needs Your Attention"
            subtitle="These markets have settled or cancelled — execute your claims to retrieve payouts."
            icon={AlertTriangle}
            count={needsAttention.length}
            variant="alert"
          >
            <motion.div
              variants={listVariants}
              initial="hidden"
              animate="visible"
              className="divide-y divide-[#2D3142]/40"
            >
              {needsAttention.map((pos) => {
                const status = getMarketStatusString(pos.marketAccount.status);
                const isSettled = status === "Settled";
                const isCancelled = status === "Cancelled";
                const yesShares = pos.account.yesAmount.toNumber() / 1e6;
                const noShares = pos.account.noAmount.toNumber() / 1e6;
                const winningOutcome = pos.marketAccount.winningOutcome;
                const isWinner =
                  isSettled &&
                  ((winningOutcome.yes && yesShares > 0) || (winningOutcome.no && noShares > 0));
                const posKey = pos.publicKey.toBase58();

                return (
                  <motion.div
                    key={posKey}
                    variants={itemVariants}
                    className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div className="space-y-1">
                      <div className="text-sm font-semibold text-[#F4F4F9]">
                        {pos.marketAccount.question}
                      </div>
                      <div className="flex items-center space-x-3 text-xs text-[#808495] font-mono">
                        <span>
                          Status:{" "}
                          <span className={isSettled ? "text-green-500" : "text-amber-500"}>
                            {status}
                          </span>
                        </span>
                        <span>•</span>
                        <span>
                          Your Position: {yesShares > 0 ? `${yesShares} YES` : `${noShares} NO`}
                        </span>
                      </div>
                    </div>
                    <div>
                      {isCancelled ? (
                        <button
                          onClick={() => handleClaimRefund(pos)}
                          disabled={claimingId === posKey}
                          className="btn-amber text-xs py-1.5 px-4 cursor-pointer disabled:opacity-50"
                        >
                          {claimingId === posKey ? "Claiming..." : "Claim Refund"}
                        </button>
                      ) : isWinner ? (
                        <button
                          onClick={() => handleClaimRewards(pos)}
                          disabled={claimingId === posKey}
                          className="btn-yes-mechanical text-xs py-1.5 px-4 cursor-pointer disabled:opacity-50 animate-pulse-glow"
                        >
                          {claimingId === posKey ? "Claiming..." : "Claim Rewards"}
                        </button>
                      ) : (
                        <span className="text-xs text-[#808495] font-mono italic">
                          No payout claimable (lost)
                        </span>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </motion.div>
          </DashboardSection>
        )}
      </AnimatePresence>

      {/* Open positions */}
      <DashboardSection
        title="Open Positions"
        subtitle="Live contracts where you hold YES or NO shares."
        icon={Briefcase}
        count={openPositions.length}
        delay={0.05}
      >
        <div className="board-panel bg-[#0C0D12] overflow-hidden board-panel-3d">
          {openPositions.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="py-16 text-center space-y-4"
            >
              <div className="mx-auto w-16 h-16 rounded border border-[#2D3142] bg-[#050608] flex items-center justify-center animate-float-y">
                <Briefcase className="w-7 h-7 text-[#808495]" />
              </div>
              <p className="text-[#808495] text-sm font-mono">No open positions on the board yet.</p>
              <Link
                href="/"
                className="inline-flex items-center space-x-1 text-[#FFA500] hover:underline text-xs font-semibold"
              >
                <span>Explore prediction markets</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </motion.div>
          ) : (
            <div className="overflow-x-auto scrollbar-thin">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#2D3142] text-[10px] font-mono uppercase tracking-widest text-[#808495] bg-[#050608]">
                    <th className="py-4 px-6">Market</th>
                    <th className="py-4 px-6">Side</th>
                    <th className="py-4 px-6">Shares</th>
                    <th className="py-4 px-6 text-right">Invested</th>
                    <th className="py-4 px-6 text-center">Closes In</th>
                    <th className="py-4 px-6 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2D3142]/40 font-mono text-xs">
                  {openPositions.map((pos) => {
                    const yesShares = pos.account.yesAmount.toNumber() / 1e6;
                    const noShares = pos.account.noAmount.toNumber() / 1e6;
                    const side = yesShares > 0 ? "YES" : "NO";
                    const shares = yesShares > 0 ? yesShares : noShares;
                    const invested = pos.account.totalSpentLamports.toNumber() / 1e9;
                    const marketKey = pos.account.market.toBase58();

                    return (
                      <tr key={pos.publicKey.toBase58()} className="table-row-3d">
                        <td className="py-4 px-6 text-[#F4F4F9] max-w-xs truncate">
                          {pos.marketAccount.question}
                        </td>
                        <td className="py-4 px-6">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              side === "YES"
                                ? "bg-[#235A34]/20 text-green-500 border border-[#235A34]/30"
                                : "bg-[#8E2424]/20 text-red-500 border border-[#8E2424]/30"
                            }`}
                          >
                            {side}
                          </span>
                        </td>
                        <td className="py-4 px-6 text-[#808495]">{shares}</td>
                        <td className="py-4 px-6 text-right text-[#F4F4F9]">
                          {invested.toFixed(4)} SOL
                        </td>
                        <td className="py-4 px-6 text-center">
                          <FlipCountdown endTs={pos.marketAccount.endTs.toNumber()} compact />
                        </td>
                        <td className="py-4 px-6 text-center">
                          <Link
                            href={`/market/${marketKey}`}
                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-white/5 border border-[#2D3142] rounded text-[10px] hover:border-[#FFA500] hover:text-[#FFA500] transition-colors"
                          >
                            Trade <ExternalLink className="w-3 h-3" />
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </DashboardSection>

      {/* Ending soon + category */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <DashboardSection title="Ending Soon" icon={Clock} delay={0.1}>
            {endingSoonMarkets.length === 0 ? (
              <div className="board-panel p-8 text-center bg-[#0C0D12] text-[#808495] text-sm board-panel-3d">
                <p>No open markets from your watchlist or holdings are ending soon.</p>
                <Link
                  href="/"
                  className="inline-flex items-center space-x-1 mt-4 text-[#FFA500] hover:underline text-xs font-semibold"
                >
                  <span>Browse markets in the explorer</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            ) : (
              <motion.div
                variants={listVariants}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                className="grid grid-cols-1 md:grid-cols-2 gap-6"
              >
                {endingSoonMarkets.map((market) => (
                  <motion.div
                    key={market.publicKey.toBase58()}
                    variants={itemVariants}
                    whileHover={{ y: -4, rotateX: 2 }}
                    className="board-panel p-5 bg-[#0C0D12] flex flex-col justify-between space-y-4 board-panel-3d"
                  >
                    <div className="space-y-1">
                      <span className="text-[9px] font-mono uppercase tracking-widest text-[#FFA500] px-2 py-0.5 bg-[#FFA500]/10 border border-[#FFA500]/20 rounded">
                        {getCategoryString(market.account.category)}
                      </span>
                      <h3 className="text-sm font-semibold text-[#F4F4F9] pt-2 line-clamp-2 h-10">
                        {market.account.question}
                      </h3>
                    </div>
                    <div className="flex items-center justify-between border-t border-[#2D3142]/40 pt-4">
                      <span className="text-[10px] font-mono text-[#808495]">CLOSING IN</span>
                      <FlipCountdown endTs={market.account.endTs.toNumber()} compact />
                    </div>
                    <Link
                      href={`/market/${market.publicKey.toBase58()}`}
                      className="w-full text-center block text-xs font-mono font-bold uppercase tracking-wider bg-white/5 border border-[#2D3142] py-2 rounded hover:bg-white/10 hover:border-[#FFA500] transition-colors"
                    >
                      View Board
                    </Link>
                  </motion.div>
                ))}
              </motion.div>
            )}
          </DashboardSection>
        </div>

        <div className="space-y-6">
          <DashboardSection title="Category Exposure" icon={PieChart} delay={0.15}>
            <div className="board-panel p-6 bg-[#0C0D12] board-panel-3d">
              <CategoryRing3D segments={categoryExposure.breakdown} total={categoryExposure.total} />
            </div>
          </DashboardSection>
        </div>
      </div>

      {/* Activity ledger */}
      <DashboardSection title="Activity Ledger" icon={History} delay={0.2}>
        <div className="board-panel bg-[#0C0D12] overflow-hidden board-panel-3d">
          {activityLoading ? (
            <div className="p-12 text-center text-[#808495] text-xs font-mono animate-pulse">
              Parsing on-chain logs...
            </div>
          ) : activity.length === 0 ? (
            <div className="p-12 text-center text-[#808495] text-xs font-mono space-y-3">
              <History className="w-8 h-8 mx-auto text-[#2D3142] animate-float-y" />
              <p>No transactions recorded for this wallet address.</p>
            </div>
          ) : (
            <div className="overflow-x-auto scrollbar-thin max-h-[420px] overflow-y-auto">
              <table className="w-full text-left border-collapse">
                <thead className="sticky top-0 z-10">
                  <tr className="border-b border-[#2D3142] text-[10px] font-mono uppercase tracking-widest text-[#808495] bg-[#050608]">
                    <th className="py-4 px-6">Timestamp</th>
                    <th className="py-4 px-6">Action</th>
                    <th className="py-4 px-6">Prediction Market</th>
                    <th className="py-4 px-6 text-right">Value (SOL)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2D3142]/40 font-mono text-xs">
                  {activity.map((item, idx) => {
                    const isBuy = item.type.startsWith("BUY");
                    const isClaim = item.type === "CLAIM_REWARDS";
                    const isRefund = item.type === "CLAIM_REFUND";
                    let actionText = "";
                    let valClass = "";
                    if (isBuy) {
                      actionText = item.type === "BUY_YES" ? "BUY YES" : "BUY NO";
                      valClass = "text-text-primary";
                    } else if (isClaim) {
                      actionText = "CLAIMED REWARDS";
                      valClass = "text-green-500 font-semibold";
                    } else if (isRefund) {
                      actionText = "REFUND CLAIMED";
                      valClass = "text-amber-500";
                    }

                    return (
                      <motion.tr
                        key={item.signature + idx}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.03 }}
                        className="table-row-3d"
                      >
                        <td className="py-4 px-6 text-[#808495]">{item.timeStr}</td>
                        <td className="py-4 px-6">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              isBuy
                                ? item.type === "BUY_YES"
                                  ? "bg-[#235A34]/20 text-green-500 border border-[#235A34]/30"
                                  : "bg-[#8E2424]/20 text-red-500 border border-[#8E2424]/30"
                                : isClaim
                                  ? "bg-green-500/10 text-green-400 border border-green-500/20"
                                  : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                            }`}
                          >
                            {actionText}
                          </span>
                        </td>
                        <td className="py-4 px-6 text-[#F4F4F9] max-w-sm truncate">{item.question}</td>
                        <td className={`py-4 px-6 text-right ${valClass}`}>
                          {isBuy
                            ? `-${item.costOrPayout.toFixed(4)}`
                            : `+${item.costOrPayout.toFixed(4)}`}
                        </td>
                      </motion.tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </DashboardSection>
    </div>
  );
}
