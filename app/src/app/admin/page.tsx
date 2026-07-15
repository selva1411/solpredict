"use client";

import React, { useState, useEffect, useMemo } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useProgram } from "@/hooks/useProgram";
import { useUserRole } from "@/hooks/useUserRole";
import { PublicKey, Keypair } from "@solana/web3.js";
import { getFriendlyErrorMessage } from "@/lib/error-map";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { 
  ShieldCheck, 
  Plus, 
  Settings, 
  AlertTriangle,
  Users,
  TrendingUp,
  History,
  BarChart3,
} from "lucide-react";
import * as anchor from "@coral-xyz/anchor";
import { EventParser } from "@coral-xyz/anchor";
import { getConfigPda, getMarketPda, getMockPriceUpdatePda, getYesMintPda, getNoMintPda, getTreasuryPda } from "@/lib/pda";
import { formatEventTime, findMarketQuestion, getMarketStatusString } from "@/lib/events";
import { ConfirmModal } from "@/components/ConfirmModal";
import { ConnectWalletGate } from "@/components/dashboard/ConnectWalletGate";
import { StatTile3D } from "@/components/dashboard/StatTile3D";
import { DashboardSection, DashboardHero } from "@/components/dashboard/DashboardSection";

const CATEGORIES = ["Crypto", "Sports", "Politics", "Tech", "Other"];

const getCategoryString = (categoryIndex: number): string => {
  return CATEGORIES[categoryIndex] || "Other";
};

interface Market {
  publicKey: PublicKey;
  account: {
    marketId: anchor.BN;
    question: string;
    description: string;
    category: number;
    oracleFeedId: number[];
    targetPrice: anchor.BN;
    targetExpo: number;
    endTs: anchor.BN;
    resolveTs: anchor.BN;
    status: any;
    yesPoolLamports: anchor.BN;
    noPoolLamports: anchor.BN;
    feeCollected: anchor.BN;
    feeWithdrawn: boolean;
  };
}

interface AdminActivity {
  signature: string;
  type: "CREATE" | "SETTLE" | "CANCEL" | "WITHDRAW";
  question: string;
  timeStr: string;
  details: string;
}

const cardVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" as const } },
};

const staggerContainer = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08 } },
};

function AdminPage() {
  const { program, wallet, connection } = useProgram();
  const { role, isLoading: roleLoading } = useUserRole();
  const router = useRouter();

  const [config, setConfig] = useState<any>(null);
  const [configLoading, setConfigLoading] = useState<boolean>(true);
  const [markets, setMarkets] = useState<Market[]>([]);
  const [uniqueTradersCount, setUniqueTradersCount] = useState<number>(0);
  const [adminActivity, setAdminActivity] = useState<AdminActivity[]>([]);
  const [activityLoading, setActivityLoading] = useState<boolean>(false);
  
  const [feeBps, setFeeBps] = useState<number>(200); 
  const [question, setQuestion] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [category, setCategory] = useState<number>(0);
  const [targetPriceVal, setTargetPriceVal] = useState<number>(250.00);
  const [comparison, setComparison] = useState<number>(0); 
  const [durationSecs, setDurationSecs] = useState<number>(300); 
  
  const [settlingId, setSettlingId] = useState<string | null>(null);
  const [settlePrices, setSettlePrices] = useState<Map<string, number>>(new Map());

  const [cancelModal, setCancelModal] = useState<{ isOpen: boolean; marketPda: PublicKey | null }>({
    isOpen: false,
    marketPda: null,
  });

  useEffect(() => {
    if (!roleLoading && role === "user") {
      toast.error("This area is admin-only. Redirecting to user dashboard...");
      router.push("/dashboard");
    }
  }, [role, roleLoading, router]);

  const getSettlePrice = (marketKey: string): number => {
    return settlePrices.get(marketKey) ?? 260.00;
  };

  const setSettlePrice = (marketKey: string, value: number) => {
    setSettlePrices((prev) => {
      const next = new Map(prev);
      next.set(marketKey, value);
      return next;
    });
  };

  const fetchConfigAndMarkets = async () => {
    try {
      setConfigLoading(true);
      const configPda = getConfigPda(program.programId);
      const configAcc = await program.account.config.fetch(configPda);
      setConfig({
        publicKey: configPda,
        admin: configAcc.admin,
        feeBps: configAcc.feeBps,
        marketCount: configAcc.marketCount.toNumber(),
      });

      const allMarkets = (await program.account.market.all()) as Market[];
      setMarkets(allMarkets);

      const userPositions = await program.account.userPosition.all();
      const distinctTraders = new Set(userPositions.map((pos: any) => pos.account.owner.toBase58()));
      setUniqueTradersCount(distinctTraders.size);

      fetchAdminActivity(allMarkets);
    } catch (err) {
      console.log("Config PDA not initialized yet:", err);
      setConfig(null);
    } finally {
      setConfigLoading(false);
    }
  };

  const fetchAdminActivity = async (currentMarkets: Market[]) => {
    if (!wallet?.publicKey) return;
    try {
      setActivityLoading(true);
      const sigs = await connection.getSignaturesForAddress(wallet.publicKey, { limit: 40 });
      const items: AdminActivity[] = [];
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

      const getStatusString = getMarketStatusString;

      sigs.forEach((sig, idx) => {
        const tx = txs[idx];
        if (!tx || !tx.meta || !tx.meta.logMessages) return;

        const timeStr = formatEventTime(sig.blockTime);
        const events = eventParser.parseLogs(tx.meta.logMessages);

        for (const event of events) {
          const marketId = event.data.marketId as anchor.BN;
          const questionText = findMarketQuestion(marketId, currentMarkets);

          if (event.name === "MarketCreated") {
            items.push({
              signature: sig.signature,
              type: "CREATE",
              question: questionText || `ID #${marketId.toString()}`,
              timeStr,
              details: `Category: ${getCategoryString(event.data.category)}. Target: $${(event.data.targetPrice.toNumber() / 100).toFixed(2)}`
            });
          } else if (event.name === "MarketSettled") {
            const outcome = event.data.winningOutcome.yes ? "YES" : "NO";
            items.push({
              signature: sig.signature,
              type: "SETTLE",
              question: questionText || `ID #${marketId.toString()}`,
              timeStr,
              details: `Outcome: ${outcome}. Settled Price: $${(event.data.settledPrice.toNumber() / 100).toFixed(2)}`
            });
          } else if (event.name === "MarketCancelled") {
            items.push({
              signature: sig.signature,
              type: "CANCEL",
              question: questionText || `ID #${marketId.toString()}`,
              timeStr,
              details: "Market cancelled by admin. All buy orders are fully refundable."
            });
          } else if (event.name === "FeesWithdrawn") {
            items.push({
              signature: sig.signature,
              type: "WITHDRAW",
              question: questionText || `ID #${marketId.toString()}`,
              timeStr,
              details: `Withdrawn ${ (event.data.amount.toNumber() / 1e9).toFixed(4) } SOL to admin`
            });
          }
        }
      });

      setAdminActivity(items);
    } catch (err) {
      console.log("Error loading admin activity logs:", err);
    } finally {
      setActivityLoading(false);
    }
  };

  useEffect(() => {
    fetchConfigAndMarkets();
    const sub = connection.onLogs(program.programId, () => fetchConfigAndMarkets(), "confirmed");
    return () => { connection.removeOnLogsListener(sub); };
  }, [wallet, program]);

  const handleInitializeConfig = async () => {
    if (!wallet?.publicKey) return;
    try {
      const configPda = getConfigPda(program.programId);
      await program.methods
        .initializeConfig(feeBps)
        .accounts({
          admin: wallet.publicKey,
          config: configPda,
        } as any)
        .rpc();

      toast.success("Platform Config PDA successfully initialized!");
      fetchConfigAndMarkets();
    } catch (err: any) {
      toast.error(`Initialization failed: ${getFriendlyErrorMessage(err)}`);
    }
  };

  const handleCreateMarket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!wallet?.publicKey || !config) return;

    try {
      const nextMarketId = config.marketCount;
      const marketPda = getMarketPda(new anchor.BN(nextMarketId), program.programId);
      const yesMintPda = getYesMintPda(marketPda, program.programId);
      const noMintPda = getNoMintPda(marketPda, program.programId);
      const treasuryPda = getTreasuryPda(marketPda, program.programId);

      const feedId = Array(32).fill(0);
      feedId[0] = 55; // SOL/USD mock feed ID

      const targetPriceBn = new anchor.BN(Math.round(targetPriceVal * 100));
      const targetExpo = -2;
      const endTs = new anchor.BN(Math.floor(Date.now() / 1000) + durationSecs);
      const resolveTs = endTs.add(new anchor.BN(2)); // +2 seconds for immediate local testing settle!

      const configPda = getConfigPda(program.programId);

      await program.methods
        .initializeMarket(
          question,
          description,
          category,
          feedId,
          targetPriceBn,
          targetExpo,
          comparison,
          endTs,
          resolveTs,
          new anchor.BN(10_000_000) // 0.01 SOL share price
        )
        .accounts({
          admin: wallet.publicKey,
          config: configPda,
          market: marketPda,
          yesMint: yesMintPda,
          noMint: noMintPda,
          treasury: treasuryPda,
        } as any)
        .rpc();

      toast.success(`Market ID #${nextMarketId} deployed successfully!`);
      
      setQuestion("");
      setDescription("");
      setTargetPriceVal(250.00);
      setDurationSecs(300);
      
      fetchConfigAndMarkets();
    } catch (err: any) {
      toast.error(`Deploy failed: ${getFriendlyErrorMessage(err)}`);
    }
  };

  const handleMockSettle = async (market: Market) => {
    if (!wallet?.publicKey) return;
    const marketKey = market.publicKey.toBase58();
    try {
      setSettlingId(marketKey);

      const configPda = getConfigPda(program.programId);
      const settlePrice = getSettlePrice(marketKey);
      
      const mockPriceUpdatePda = getMockPriceUpdatePda(wallet.publicKey, program.programId);

      const scaleMultiplier = Math.pow(10, Math.abs(market.account.targetExpo));
      const settlePriceScaled = new anchor.BN(Math.round(settlePrice * scaleMultiplier));
      const conf = new anchor.BN(0);
      const exponent = market.account.targetExpo;
      const publishTime = new anchor.BN(Math.floor(Date.now() / 1000));

      await program.methods
        .mockCreatePriceUpdate(
          market.account.oracleFeedId,
          settlePriceScaled,
          conf,
          exponent,
          publishTime
        )
        .accounts({
          payer: wallet.publicKey,
          priceUpdate: mockPriceUpdatePda,
        } as any)
        .rpc();

      await program.methods
        .settleMarket()
        .accounts({
          admin: wallet.publicKey,
          config: configPda,
          market: market.publicKey,
          priceUpdate: mockPriceUpdatePda,
        } as any)
        .rpc();

      toast.success(`Market resolved successfully!`);
      fetchConfigAndMarkets();
    } catch (err: any) {
      console.error(err);
      toast.error(`Resolution failed: ${getFriendlyErrorMessage(err)}`);
    } finally {
      setSettlingId(null);
    }
  };

  const handleCancelMarket = async (marketPda: PublicKey) => {
    if (!wallet?.publicKey) return;
    try {
      const configPda = getConfigPda(program.programId);
      await program.methods
        .cancelMarket()
        .accounts({
          authority: wallet.publicKey,
          config: configPda,
          market: marketPda,
        } as any)
        .rpc();

      toast.success("Market cancelled. Traders may claim full refunds.");
      setCancelModal({ isOpen: false, marketPda: null });
      fetchConfigAndMarkets();
    } catch (err: any) {
      toast.error(`Cancel failed: ${getFriendlyErrorMessage(err)}`);
    }
  };

  const handleWithdrawFees = async (market: Market) => {
    if (!wallet?.publicKey) return;
    try {
      const configPda = getConfigPda(program.programId);
      const treasuryPda = getTreasuryPda(market.publicKey, program.programId);

      await program.methods
        .withdrawFees()
        .accounts({
          authority: wallet.publicKey,
          config: configPda,
          market: market.publicKey,
          treasury: treasuryPda,
        } as any)
        .rpc();

      toast.success("Platform protocol fees successfully withdrawn!");
      fetchConfigAndMarkets();
    } catch (err: any) {
      toast.error(`Withdrawal failed: ${getFriendlyErrorMessage(err)}`);
    }
  };

  const platformStats = useMemo(() => {
    let totalVolumeLamports = 0;
    let totalFeesCollectedLamports = 0;
    let openCount = 0;
    let settledCount = 0;

    markets.forEach((m) => {
      const status = getMarketStatusString(m.account.status);
      totalVolumeLamports += m.account.yesPoolLamports.toNumber() + m.account.noPoolLamports.toNumber();
      totalFeesCollectedLamports += m.account.feeCollected.toNumber();
      if (status === "Open") openCount++;
      if (status === "Settled") settledCount++;
    });

    return {
      totalVolume: totalVolumeLamports / 1e9,
      totalFeesCollected: totalFeesCollectedLamports / 1e9,
      openMarketsCount: openCount,
      settledMarketsCount: settledCount,
    };
  }, [markets]);

  const needsActionMarkets = useMemo(() => {
    return markets.filter((m) => {
      const status = getMarketStatusString(m.account.status);
      const now = Math.floor(Date.now() / 1000);
      return status === "Open" && m.account.endTs.toNumber() < now;
    });
  }, [markets]);

  if (role === "disconnected" && !roleLoading) {
    return (
      <ConnectWalletGate
        title="[■] SIGN IN TO OBSERVATORY"
        description="Verify platform administrator key signature credentials. Access is restricted to master protocol wallet nodes."
      />
    );
  }

  if (configLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-10 bg-white/5 border border-[#9e8e78]/30 rounded w-1/3" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-28 board-panel skeleton-shimmer bg-[#131313]" />
          ))}
        </div>
      </div>
    );
  }

  const getStatusString = getMarketStatusString;

  return (
    <div className="space-y-10 animate-fade-in font-sans pb-12">
      <ConfirmModal
        isOpen={cancelModal.isOpen}
        title="CANCEL PREDICTION BOARD"
        message="Are you sure you want to cancel this market? This is a terminal action. It stops all event trading, sets pool balances to 0, and permits all share holders to withdraw refunds."
        confirmLabel="CANCEL BOARD"
        destructive={true}
        onConfirm={() => {
          if (cancelModal.marketPda) handleCancelMarket(cancelModal.marketPda);
        }}
        onCancel={() => setCancelModal({ isOpen: false, marketPda: null })}
      />

      <DashboardHero
        title="[■] ADMIN OBSERVATORY CONSOLE"
        subtitle="Deploy singleton parameters, settle output categories, cancel contracts, and withdraw protocol fees."
        badge={
          wallet?.publicKey
            ? `${wallet.publicKey.toBase58().slice(0, 6)}...${wallet.publicKey.toBase58().slice(-6)}`
            : ""
        }
        badgeLabel="ADMIN ACTIVE KEY:"
      />

      {/* 1. Platform Config Initialization Block */}
      {!config ? (
        <motion.section
          variants={cardVariants}
          initial="hidden"
          animate="visible"
          className="board-panel p-8 space-y-6 border-[#ffd89c]/40 bg-[#131313]"
        >
          <div className="flex items-center space-x-3 text-[#ffd89c]">
            <AlertTriangle className="w-6 h-6 animate-pulse" />
            <h2 className="text-lg font-bold font-display uppercase tracking-wider">Config PDA Not Found</h2>
          </div>
          <p className="text-xs text-[#d6c4ac] leading-relaxed">
            The platform-wide config singleton must be initialized once before markets can be created. The key initialized here will serve as the master Administrator authority.
          </p>
          <div className="grid sm:grid-cols-2 gap-4 items-end max-w-md">
            <div className="space-y-2">
              <label className="text-xs font-mono text-[#d6c4ac] font-bold">Fee Basis Points (100 = 1%)</label>
              <input
                type="number"
                value={feeBps}
                onChange={(e) => setFeeBps(Number(e.target.value))}
                className="w-full board-input text-sm py-2 px-3 border-[#9e8e78]"
              />
            </div>
            <button onClick={handleInitializeConfig} className="btn-amber py-2 text-xs">
              Initialize Config PDA
            </button>
          </div>
        </motion.section>
      ) : (
        /* 2. Platform Stats Row */
        <motion.section
          className="grid grid-cols-2 lg:grid-cols-5 gap-6"
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
        >
          <StatTile3D label="Total Volume" value={platformStats.totalVolume.toFixed(1)} unit="SOL" icon={BarChart3} delay={0} />
          <StatTile3D label="Open Markets" value={String(platformStats.openMarketsCount)} unit="QTY" icon={TrendingUp} accent="green" delay={0.05} />
          <StatTile3D label="Settled Markets" value={String(platformStats.settledMarketsCount)} unit="QTY" accent="neutral" delay={0.1} />
          <StatTile3D label="Unique Traders" value={String(uniqueTradersCount)} unit="QTY" icon={Users} delay={0.15} />
          <StatTile3D label="Fees Collected" value={platformStats.totalFeesCollected.toFixed(4)} unit="SOL" delay={0.2} useSplitFlap={false} />
        </motion.section>
      )}

      {config && (
        <>
          {/* 3. Needs Action Panel (Expired Markets Settle List) */}
          {needsActionMarkets.length > 0 && (
            <DashboardSection
              title="Markets Needing Settlement"
              subtitle="Trading time has ended for these markets. Fetch/provide the settlement price and settle payouts."
              icon={AlertTriangle}
              count={needsActionMarkets.length}
              variant="alert"
            >
              <div className="divide-y divide-[#9e8e78]/20">
                {needsActionMarkets.map((m) => {
                  const marketKey = m.publicKey.toBase58();
                  const targetPrice = m.account.targetPrice.toNumber() / 100;
                  return (
                    <div key={marketKey} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="space-y-1">
                        <div className="text-sm font-bold text-[#e5e2e1]">{m.account.question}</div>
                        <div className="text-xs text-[#d6c4ac] font-mono">
                          Target: ${targetPrice.toFixed(2)} | Category: {getCategoryString(m.account.category)}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          step="0.01"
                          value={getSettlePrice(marketKey)}
                          onChange={(e) => setSettlePrice(marketKey, Number(e.target.value))}
                          className="w-24 board-input py-1 px-2 text-xs font-mono border-[#9e8e78]"
                          placeholder="Price"
                        />
                        <button
                          disabled={settlingId !== null}
                          onClick={() => handleMockSettle(m)}
                          className="btn-amber text-xs py-1.5 px-4 cursor-pointer disabled:opacity-50"
                        >
                          {settlingId === marketKey ? "Settling..." : "Settle"}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </DashboardSection>
          )}

          {/* Create Market and Manage Table Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* Create Market Form */}
            <div className="space-y-6">
              <div className="flex items-center space-x-2 text-[#ffd89c]">
                <Plus className="w-5 h-5" />
                <h2 className="text-lg font-bold font-display uppercase tracking-wider font-bold">Create Contract</h2>
              </div>

              <div className="board-panel p-6 bg-[#131313] border-[#9e8e78]/40 space-y-4 board-panel-3d">
                <form onSubmit={handleCreateMarket} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-[#d6c4ac]">Question Text</label>
                    <input
                      type="text"
                      required
                      value={question}
                      onChange={(e) => setQuestion(e.target.value)}
                      placeholder="Will SOL exceed $280 by tomorrow?"
                      className="w-full board-input text-xs border-[#9e8e78]"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-[#d6c4ac]">Rules & Description</label>
                    <textarea
                      required
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Settle using Pyth feed SOL/USD. Price must match condition..."
                      rows={3}
                      className="w-full board-input text-xs border-[#9e8e78]"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-[#d6c4ac]">Category</label>
                      <select
                        value={category}
                        onChange={(e) => setCategory(Number(e.target.value))}
                        className="w-full board-input text-xs bg-[#0d0d0d] border-[#9e8e78]"
                      >
                        {CATEGORIES.map((cat, i) => (
                          <option key={i} value={i}>{cat}</option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-[#d6c4ac]">Comparison</label>
                      <select
                        value={comparison}
                        onChange={(e) => setComparison(Number(e.target.value))}
                        className="w-full board-input text-xs bg-[#0d0d0d] border-[#9e8e78]"
                      >
                        <option value={0}>Greater Than</option>
                        <option value={1}>Less Than</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-[#d6c4ac]">Target Price ($)</label>
                      <input
                        type="number"
                        step="0.01"
                        required
                        value={targetPriceVal}
                        onChange={(e) => setTargetPriceVal(Number(e.target.value))}
                        className="w-full board-input text-xs border-[#9e8e78]"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-[#d6c4ac]">Duration (Secs)</label>
                      <input
                        type="number"
                        required
                        value={durationSecs}
                        onChange={(e) => setDurationSecs(Number(e.target.value))}
                        className="w-full board-input text-xs border-[#9e8e78]"
                      />
                    </div>
                  </div>

                  <button type="submit" className="w-full btn-primary text-xs py-2.5 mt-4">
                    Deploy Market PDA
                  </button>
                </form>
              </div>
            </div>

            {/* Manage Markets Table */}
            <div className="lg:col-span-2 space-y-6">
              <div className="flex items-center space-x-2 text-[#ffd89c]">
                <Settings className="w-5 h-5" />
                <h2 className="text-lg font-bold font-display uppercase tracking-wider font-bold">Manage Board</h2>
              </div>

              <div className="board-panel bg-[#131313] border-[#9e8e78]/40 overflow-hidden board-panel-3d">
                {markets.length === 0 ? (
                  <p className="text-xs text-[#d6c4ac] text-center py-12">No prediction markets created yet.</p>
                ) : (
                  <div className="overflow-x-auto scrollbar-thin">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-[#9e8e78]/30 text-[10px] font-mono uppercase tracking-widest text-[#d6c4ac] bg-[#0d0d0d]">
                          <th className="py-4 px-6">ID</th>
                          <th className="py-4 px-6">Question</th>
                          <th className="py-4 px-6">Status</th>
                          <th className="py-4 px-6 text-right">Volume</th>
                          <th className="py-4 px-6 text-center">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#9e8e78]/10 font-mono text-xs">
                        {markets.map((m) => {
                          const status = getStatusString(m.account.status);
                          const marketKey = m.publicKey.toBase58();
                          const yesPool = m.account.yesPoolLamports.toNumber() / 1e9;
                          const noPool = m.account.noPoolLamports.toNumber() / 1e9;
                          const volume = yesPool + noPool;

                          return (
                            <tr key={marketKey} className="table-row-3d hover:bg-white/5 transition-colors">
                              <td className="py-4 px-6 text-[#d6c4ac]">#{m.account.marketId.toString()}</td>
                              <td className="py-4 px-6 text-[#e5e2e1] max-w-xs truncate font-bold">{m.account.question}</td>
                              <td className="py-4 px-6">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  status === "Open" 
                                    ? "bg-[#a1d494]/15 text-[#a1d494] border border-[#a1d494]/20" 
                                    : status === "Settled" 
                                    ? "bg-white/5 text-[#d6c4ac] border border-white/10" 
                                    : "bg-[#ffb4ab]/15 text-[#ffb4ab] border border-[#ffb4ab]/20"
                                }`}>
                                  {status}
                                </span>
                              </td>
                              <td className="py-4 px-6 text-right text-[#e5e2e1]">{volume.toFixed(2)} SOL</td>
                              <td className="py-4 px-6 text-center">
                                {status === "Open" && (
                                  <div className="flex items-center justify-center gap-2">
                                    <input
                                      type="number"
                                      step="0.01"
                                      value={getSettlePrice(marketKey)}
                                      onChange={(e) => setSettlePrice(marketKey, Number(e.target.value))}
                                      className="w-16 board-input py-1 px-1.5 text-[10px] border-[#9e8e78]"
                                      placeholder="Price"
                                    />
                                    <button
                                      disabled={settlingId !== null}
                                      onClick={() => handleMockSettle(m)}
                                      className="px-2 py-1 bg-[#a1d494] hover:bg-[#b7e4ac] text-[#131313] border border-[#9e8e78] rounded text-[9px] cursor-pointer font-bold"
                                    >
                                      Settle
                                    </button>
                                    <button
                                      onClick={() => setCancelModal({ isOpen: true, marketPda: m.publicKey })}
                                      className="px-2 py-1 bg-[#ffb4ab] hover:bg-[#ffc9c2] text-[#131313] border border-[#9e8e78] rounded text-[9px] cursor-pointer font-bold"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                )}
                                {status === "Settled" && (
                                  <div className="flex items-center justify-center">
                                    {m.account.feeWithdrawn ? (
                                      <span className="text-[#a1d494] text-[10px] font-bold uppercase">Withdrawn</span>
                                    ) : (
                                      <button
                                        onClick={() => handleWithdrawFees(m)}
                                        className="px-2.5 py-1 bg-[#ffd89c]/10 hover:bg-[#ffd89c]/20 border border-[#ffd89c]/30 rounded text-[9px] text-[#ffd89c] font-bold cursor-pointer uppercase"
                                      >
                                        Withdraw Fees ({ (m.account.feeCollected.toNumber() / 1e9).toFixed(3) } SOL)
                                      </button>
                                    )}
                                  </div>
                                )}
                                {status === "Cancelled" && (
                                  <span className="text-[#d6c4ac] text-[10px] italic">Refunds enabled</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* 4. Admin Activity Log Section */}
      {config && (
        <DashboardSection title="Audit Trail Actions" icon={History} delay={0.15}>
          <div className="board-panel bg-[#131313] border-[#9e8e78]/40 overflow-hidden board-panel-3d">
            {activityLoading ? (
              <div className="p-12 text-center text-[#d6c4ac] text-xs font-mono animate-pulse">
                Fetching action logs...
              </div>
            ) : adminActivity.length === 0 ? (
              <div className="p-12 text-center text-[#d6c4ac] text-xs font-mono">
                No admin log updates recorded on-chain.
              </div>
            ) : (
              <div className="overflow-x-auto scrollbar-thin">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-[#9e8e78]/30 text-[10px] font-mono uppercase tracking-widest text-[#d6c4ac] bg-[#0d0d0d]">
                      <th className="py-4 px-6">Timestamp</th>
                      <th className="py-4 px-6">Category</th>
                      <th className="py-4 px-6">Prediction Market</th>
                      <th className="py-4 px-6">Execution Detail</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#9e8e78]/10 font-mono text-xs">
                    {adminActivity.map((item, idx) => {
                      let tagClass = "";
                      if (item.type === "CREATE") tagClass = "bg-sky-500/10 text-sky-400 border border-sky-500/20";
                      else if (item.type === "SETTLE") tagClass = "bg-[#a1d494]/10 text-[#a1d494] border border-[#a1d494]/20";
                      else if (item.type === "CANCEL") tagClass = "bg-[#ffb4ab]/10 text-[#ffb4ab] border border-[#ffb4ab]/20";
                      else tagClass = "bg-[#ffd89c]/10 text-[#ffd89c] border border-[#ffd89c]/20";

                      return (
                        <tr key={idx} className="table-row-3d hover:bg-white/5 transition-colors">
                          <td className="py-4 px-6 text-[#d6c4ac]">{item.timeStr}</td>
                          <td className="py-4 px-6">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${tagClass}`}>
                              {item.type}
                            </span>
                          </td>
                          <td className="py-4 px-6 text-[#e5e2e1] max-w-sm truncate font-bold">{item.question}</td>
                          <td className="py-4 px-6 text-[#d6c4ac]">{item.details}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </DashboardSection>
      )}
    </div>
  );
}

const Admin = dynamic(() => Promise.resolve(AdminPage), { ssr: false });
export default Admin;
