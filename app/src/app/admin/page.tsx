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
import { getConfigPda, getMarketPda, getMockPriceUpdatePda } from "@/lib/pda";
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

// Motion variants
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
  
  // Form states
  const [feeBps, setFeeBps] = useState<number>(200); // 2%
  const [question, setQuestion] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [category, setCategory] = useState<number>(0);
  const [targetPriceVal, setTargetPriceVal] = useState<number>(250.00);
  const [comparison, setComparison] = useState<number>(0); // 0 = GreaterThan, 1 = LessThan
  const [durationSecs, setDurationSecs] = useState<number>(300); // 5 mins for quick test
  
  // Settlement states — per-market settle prices
  const [settlingId, setSettlingId] = useState<string | null>(null);
  const [settlePrices, setSettlePrices] = useState<Map<string, number>>(new Map());

  // Confirmation modal state
  const [cancelModal, setCancelModal] = useState<{ isOpen: boolean; marketPda: PublicKey | null }>({
    isOpen: false,
    marketPda: null,
  });

  // Protect Admin route from non-admins
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

      // Fetch all markets
      const allMarkets = (await program.account.market.all()) as Market[];
      setMarkets(allMarkets);

      // Fetch all unique traders (owners in userPosition accounts)
      const userPositions = await program.account.userPosition.all();
      const distinctTraders = new Set(userPositions.map((pos: any) => pos.account.owner.toBase58()));
      setUniqueTradersCount(distinctTraders.size);

      // Fetch admin activity feed
      fetchAdminActivity(allMarkets);
    } catch (err) {
      console.log("Config PDA not initialized yet:", err);
      setConfig(null);
    } finally {
      setConfigLoading(false);
    }
  };

  const fetchAdminActivity = async (currentMarkets: Market[]) => {
    try {
      setActivityLoading(true);
      const sigs = await connection.getSignaturesForAddress(program.programId, { limit: 30 });
      const items: AdminActivity[] = [];
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
        if (!tx || !tx.meta || !tx.meta.logMessages) return;

        const timeStr = formatEventTime(sig.blockTime);

        const events = eventParser.parseLogs(tx.meta.logMessages);
        for (const event of events) {
          const marketId = event.data.marketId as anchor.BN;
          const question = findMarketQuestion(marketId, currentMarkets);

          if (event.name === "MarketCreated") {
            items.push({
              signature: sig.signature,
              type: "CREATE",
              question: event.data.question || question,
              timeStr,
              details: `Market created with ID #${marketId.toString()}`
            });
          } else if (event.name === "MarketSettled") {
            const outcome = event.data.winningOutcome === 0 ? "YES" : "NO";
            const price = (event.data.settledPrice as anchor.BN).toNumber() / 100;
            items.push({
              signature: sig.signature,
              type: "SETTLE",
              question,
              timeStr,
              details: `Settled ${outcome} at price $${price.toFixed(2)}`
            });
          } else if (event.name === "MarketCancelled") {
            items.push({
              signature: sig.signature,
              type: "CANCEL",
              question,
              timeStr,
              details: `Market cancelled`
            });
          } else if (event.name === "FeesWithdrawn") {
            const amount = (event.data.amount as anchor.BN).toNumber() / 1e9;
            items.push({
              signature: sig.signature,
              type: "WITHDRAW",
              question,
              timeStr,
              details: `Withdrew ${amount.toFixed(4)} SOL in platform fees`
            });
          }
        }
      });

      setAdminActivity(items);
    } catch (err) {
      console.error("Error fetching admin activity:", err);
    } finally {
      setActivityLoading(false);
    }
  };

  useEffect(() => {
    fetchConfigAndMarkets();
  }, [program]);

  // 1. Initialize Config PDA
  const handleInitializeConfig = async () => {
    if (!wallet || !wallet.publicKey) return;
    try {
      const configPda = getConfigPda(program.programId);
      await program.methods
        .initializeConfig(feeBps)
        .accounts({
          admin: wallet.publicKey,
          config: configPda,
        } as any)
        .rpc();

      toast.success("Platform Config initialized successfully!");
      fetchConfigAndMarkets();
    } catch (err: any) {
      console.error("Initialize Config error:", err);
      toast.error(`Initialization failed: ${getFriendlyErrorMessage(err)}`);
    }
  };

  // 2. Create Prediction Market
  const handleCreateMarket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!wallet || !wallet.publicKey || !config) return;

    try {
      const targetPriceBn = new anchor.BN(Math.round(targetPriceVal * 100)); // Store with 2 decimals
      const targetExpo = -2;
      const now = Math.floor(Date.now() / 1000);
      const endTs = new anchor.BN(now + durationSecs);
      const resolveTs = new anchor.BN(now + durationSecs + 1);

      // Derive market ID and keys
      const marketId = new anchor.BN(config.marketCount);
      const marketPda = getMarketPda(marketId, program.programId);
      const [yesMintPda] = PublicKey.findProgramAddressSync([Buffer.from("yes_mint"), marketPda.toBuffer()], program.programId);
      const [noMintPda] = PublicKey.findProgramAddressSync([Buffer.from("no_mint"), marketPda.toBuffer()], program.programId);
      const [treasuryPda] = PublicKey.findProgramAddressSync([Buffer.from("treasury"), marketPda.toBuffer()], program.programId);

      const feedId = Array(32).fill(0);
      feedId[0] = 55; // SOL/USD mock feed ID

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
          config: config.publicKey,
          market: marketPda,
          yesMint: yesMintPda,
          noMint: noMintPda,
          treasury: treasuryPda,
        } as any)
        .rpc();

      toast.success("Prediction market initialized!");
      setQuestion("");
      setDescription("");
      fetchConfigAndMarkets();
    } catch (err: any) {
      console.error("Create Market error:", err);
      toast.error(`Market creation failed: ${getFriendlyErrorMessage(err)}`);
    }
  };

  // 3. Settle Market using a Mock Price Feed update
  const handleMockSettle = async (market: Market) => {
    if (!wallet || !wallet.publicKey) return;
    const marketKey = market.publicKey.toBase58();
    const price = getSettlePrice(marketKey);

    try {
      setSettlingId(marketKey);
      const mockPayer = Keypair.generate();
      
      // Send SOL to mockPayer to cover price update transaction fees
      const fundTx = new anchor.web3.Transaction().add(
        anchor.web3.SystemProgram.transfer({
          fromPubkey: wallet.publicKey,
          toPubkey: mockPayer.publicKey,
          lamports: 0.1 * anchor.web3.LAMPORTS_PER_SOL,
        })
      );
      await program.provider.sendAndConfirm!(fundTx);

      const mockPriceUpdatePda = getMockPriceUpdatePda(mockPayer.publicKey, program.programId);
      const priceVal = new anchor.BN(Math.round(price * 100)); // Store with 2 decimals

      // 1. Create the Pyth Mock Price Update Account
      await program.methods
        .mockCreatePriceUpdate(
          [55, ...Array(31).fill(0)], // Matching SOL/USD mock feed id
          priceVal,
          new anchor.BN(1), // Tight confidence interval
          -2, // Exponent -2
          new anchor.BN(Math.floor(Date.now() / 1000))
        )
        .accounts({
          payer: mockPayer.publicKey,
          priceUpdate: mockPriceUpdatePda,
        } as any)
        .signers([mockPayer])
        .rpc();

      // 2. Trigger on-chain settleMarket call
      await program.methods
        .settleMarket()
        .accounts({
          admin: wallet.publicKey,
          config: config.publicKey,
          market: market.publicKey,
          priceUpdate: mockPriceUpdatePda,
        } as any)
        .rpc();

      toast.success("Market settled successfully!");
      fetchConfigAndMarkets();
    } catch (err: any) {
      console.error("Settlement error:", err);
      toast.error(`Settlement failed: ${getFriendlyErrorMessage(err)}`);
    } finally {
      setSettlingId(null);
    }
  };

  // 4. Cancel Market
  const handleCancelMarket = async (marketPda: PublicKey) => {
    if (!wallet || !wallet.publicKey) return;
    try {
      await program.methods
        .cancelMarket()
        .accounts({
          admin: wallet.publicKey,
          market: marketPda,
        } as any)
        .rpc();

      toast.success("Market cancelled!");
      fetchConfigAndMarkets();
    } catch (err: any) {
      console.error("Cancel Market error:", err);
      toast.error(`Cancellation failed: ${getFriendlyErrorMessage(err)}`);
    }
  };

  // 5. Withdraw Protocol Fees
  const handleWithdrawFees = async (market: Market) => {
    if (!wallet || !wallet.publicKey) return;
    try {
      const treasuryPda = PublicKey.findProgramAddressSync([Buffer.from("treasury"), market.publicKey.toBuffer()], program.programId)[0];
      await program.methods
        .withdrawFees()
        .accounts({
          admin: wallet.publicKey,
          config: config.publicKey,
          market: market.publicKey,
          treasury: treasuryPda,
        } as any)
        .rpc();

      toast.success(`Withdrew ${(market.account.feeCollected.toNumber() / 1e9).toFixed(4)} SOL!`);
      fetchConfigAndMarkets();
    } catch (err: any) {
      console.error("Fee withdrawal error:", err);
      toast.error(`Withdrawal failed: ${getFriendlyErrorMessage(err)}`);
    }
  };

  const getStatusString = getMarketStatusString;

  // derived stats
  const platformStats = useMemo(() => {
    let totalVol = 0;
    let openCount = 0;
    let settledCount = 0;
    let totalFees = 0;

    markets.forEach((m) => {
      const yesPool = m.account.yesPoolLamports.toNumber() / 1e9;
      const noPool = m.account.noPoolLamports.toNumber() / 1e9;
      totalVol += yesPool + noPool;

      const status = getStatusString(m.account.status);
      if (status === "Open") openCount++;
      if (status === "Settled") settledCount++;

      totalFees += m.account.feeCollected.toNumber() / 1e9;
    });

    return {
      totalVolume: totalVol,
      openMarketsCount: openCount,
      settledMarketsCount: settledCount,
      totalFeesCollected: totalFees
    };
  }, [markets]);

  // Settle Needs Action Panel
  const needsActionMarkets = useMemo(() => {
    const now = Math.floor(Date.now() / 1000);
    return markets.filter((m) => {
      const status = getStatusString(m.account.status);
      const isExpired = m.account.endTs.toNumber() < now;
      return status === "Open" && isExpired;
    });
  }, [markets]);

  if (role === "disconnected" && !roleLoading) {
    return (
      <ConnectWalletGate
        icon={ShieldCheck}
        title="[■] CONNECT WALLET TO CONTINUE"
        description="Initialize your Solana keypair terminal connection. Platform administrators are routed to the observatory console automatically; all other wallets go to the pilot ledger."
      />
    );
  }

  if (configLoading || roleLoading) {
    return (
      <div className="space-y-8 animate-pulse max-w-7xl mx-auto w-full">
        <div className="h-10 bg-white/5 border border-white/10 rounded w-1/3" />
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-6">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-28 board-panel skeleton-shimmer bg-[#0C0D12]" />
          ))}
        </div>
        <div className="h-96 board-panel skeleton-shimmer bg-[#0C0D12]" />
      </div>
    );
  }

  if (role === "user") {
    return null; // Will redirect in useEffect
  }

  return (
    <div className="space-y-10 animate-fade-in max-w-7xl mx-auto w-full">
      {/* Cancel Confirmation Modal */}
      <ConfirmModal
        isOpen={cancelModal.isOpen}
        title="Cancel Market"
        message="Are you sure you want to cancel this market? All traders will be able to claim full refunds. This action cannot be undone."
        confirmLabel="Cancel Market"
        cancelLabel="Keep Market"
        destructive
        onConfirm={() => {
          if (cancelModal.marketPda) {
            handleCancelMarket(cancelModal.marketPda);
          }
          setCancelModal({ isOpen: false, marketPda: null });
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
          className="board-panel p-8 space-y-6 border-[#FFA500]/20 bg-[#0C0D12]"
        >
          <div className="flex items-center space-x-3 text-[#FFA500]">
            <AlertTriangle className="w-6 h-6" />
            <h2 className="text-lg font-bold font-display">Config PDA Not Found</h2>
          </div>
          <p className="text-xs text-[#808495]">
            The platform-wide config singleton must be initialized once before markets can be created. The key initialized here will serve as the master Administrator authority.
          </p>
          <div className="grid sm:grid-cols-2 gap-4 items-end max-w-md">
            <div className="space-y-2">
              <label className="text-xs font-mono text-[#808495]">Fee Basis Points (100 = 1%)</label>
              <input
                type="number"
                value={feeBps}
                onChange={(e) => setFeeBps(Number(e.target.value))}
                className="w-full board-input text-sm py-2 px-3"
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
              <div className="divide-y divide-[#2D3142]/40">
                {needsActionMarkets.map((m) => {
                  const marketKey = m.publicKey.toBase58();
                  const targetPrice = m.account.targetPrice.toNumber() / 100;
                  return (
                    <div key={marketKey} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="space-y-1">
                        <div className="text-sm font-semibold text-[#F4F4F9]">{m.account.question}</div>
                        <div className="text-xs text-[#808495] font-mono">
                          Target: ${targetPrice.toFixed(2)} | Category: {getCategoryString(m.account.category)}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          step="0.01"
                          value={getSettlePrice(marketKey)}
                          onChange={(e) => setSettlePrice(marketKey, Number(e.target.value))}
                          className="w-24 board-input py-1 px-2 text-xs font-mono"
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
              <div className="flex items-center space-x-2 text-[#FFA500]">
                <Plus className="w-5 h-5" />
                <h2 className="text-lg font-bold font-display uppercase tracking-wide">Create Contract</h2>
              </div>

              <div className="board-panel p-6 bg-[#0C0D12] space-y-4 board-panel-3d">
                <form onSubmit={handleCreateMarket} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-[#808495]">Question Text</label>
                    <input
                      type="text"
                      required
                      value={question}
                      onChange={(e) => setQuestion(e.target.value)}
                      placeholder="Will SOL exceed $280 by tomorrow?"
                      className="w-full board-input text-xs"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-[#808495]">Rules & Description</label>
                    <textarea
                      required
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Settle using Pyth feed SOL/USD. Price must match condition..."
                      rows={3}
                      className="w-full board-input text-xs"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-[#808495]">Category</label>
                      <select
                        value={category}
                        onChange={(e) => setCategory(Number(e.target.value))}
                        className="w-full board-input text-xs bg-[#050608]"
                      >
                        {CATEGORIES.map((cat, i) => (
                          <option key={i} value={i}>{cat}</option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-[#808495]">Comparison</label>
                      <select
                        value={comparison}
                        onChange={(e) => setComparison(Number(e.target.value))}
                        className="w-full board-input text-xs bg-[#050608]"
                      >
                        <option value={0}>Greater Than</option>
                        <option value={1}>Less Than</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-[#808495]">Target Price ($)</label>
                      <input
                        type="number"
                        step="0.01"
                        required
                        value={targetPriceVal}
                        onChange={(e) => setTargetPriceVal(Number(e.target.value))}
                        className="w-full board-input text-xs"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-[#808495]">Duration (Secs)</label>
                      <input
                        type="number"
                        required
                        value={durationSecs}
                        onChange={(e) => setDurationSecs(Number(e.target.value))}
                        className="w-full board-input text-xs"
                      />
                    </div>
                  </div>

                  <button type="submit" className="w-full btn-amber text-xs py-2.5 mt-4">
                    Deploy Market PDA
                  </button>
                </form>
              </div>
            </div>

            {/* Manage Markets Table */}
            <div className="lg:col-span-2 space-y-6">
              <div className="flex items-center space-x-2 text-[#FFA500]">
                <Settings className="w-5 h-5" />
                <h2 className="text-lg font-bold font-display uppercase tracking-wide">Manage Board</h2>
              </div>

              <div className="board-panel bg-[#0C0D12] overflow-hidden board-panel-3d">
                {markets.length === 0 ? (
                  <p className="text-xs text-[#808495] text-center py-12">No prediction markets created yet.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-[#2D3142] text-[10px] font-mono uppercase tracking-widest text-[#808495] bg-[#050608]">
                          <th className="py-4 px-6">ID</th>
                          <th className="py-4 px-6">Question</th>
                          <th className="py-4 px-6">Status</th>
                          <th className="py-4 px-6 text-right">Volume</th>
                          <th className="py-4 px-6 text-center">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#2D3142]/40 font-mono text-xs">
                        {markets.map((m) => {
                          const status = getStatusString(m.account.status);
                          const marketKey = m.publicKey.toBase58();
                          const yesPool = m.account.yesPoolLamports.toNumber() / 1e9;
                          const noPool = m.account.noPoolLamports.toNumber() / 1e9;
                          const volume = yesPool + noPool;

                          return (
                            <tr key={marketKey} className="table-row-3d hover:bg-white/5 transition-colors">
                              <td className="py-4 px-6 text-[#808495]">#{m.account.marketId.toString()}</td>
                              <td className="py-4 px-6 text-[#F4F4F9] max-w-xs truncate">{m.account.question}</td>
                              <td className="py-4 px-6">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  status === "Open" 
                                    ? "bg-[#235A34]/20 text-green-500 border border-[#235A34]/30" 
                                    : status === "Settled" 
                                    ? "bg-white/5 text-text-muted border border-white/10" 
                                    : "bg-red-500/10 text-red-400 border border-red-500/20"
                                }`}>
                                  {status}
                                </span>
                              </td>
                              <td className="py-4 px-6 text-right text-[#F4F4F9]">{volume.toFixed(2)} SOL</td>
                              <td className="py-4 px-6 text-center">
                                {status === "Open" && (
                                  <div className="flex items-center justify-center gap-2">
                                    <input
                                      type="number"
                                      step="0.01"
                                      value={getSettlePrice(marketKey)}
                                      onChange={(e) => setSettlePrice(marketKey, Number(e.target.value))}
                                      className="w-16 board-input py-1 px-1.5 text-[10px]"
                                      placeholder="Price"
                                    />
                                    <button
                                      disabled={settlingId !== null}
                                      onClick={() => handleMockSettle(m)}
                                      className="px-2 py-1 bg-[#235A34] hover:bg-[#2D7242] text-white border border-[#1B4527] rounded text-[9px] cursor-pointer"
                                    >
                                      Settle
                                    </button>
                                    <button
                                      onClick={() => setCancelModal({ isOpen: true, marketPda: m.publicKey })}
                                      className="px-2 py-1 bg-[#8E2424] hover:bg-[#A92C2C] text-white border border-[#6E1B1B] rounded text-[9px] cursor-pointer"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                )}
                                {status === "Settled" && (
                                  <div className="flex items-center justify-center">
                                    {m.account.feeWithdrawn ? (
                                      <span className="text-green-500 text-[10px] font-semibold">Withdrawn</span>
                                    ) : (
                                      <button
                                        onClick={() => handleWithdrawFees(m)}
                                        className="px-2.5 py-1 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 rounded text-[9px] text-[#FFA500] font-semibold cursor-pointer"
                                      >
                                        Withdraw Fees ({ (m.account.feeCollected.toNumber() / 1e9).toFixed(3) } SOL)
                                      </button>
                                    )}
                                  </div>
                                )}
                                {status === "Cancelled" && (
                                  <span className="text-[#808495] text-[10px] italic">Refunds enabled</span>
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
          <div className="board-panel bg-[#0C0D12] overflow-hidden board-panel-3d">
            {activityLoading ? (
              <div className="p-12 text-center text-[#808495] text-xs font-mono animate-pulse">
                Fetching action logs...
              </div>
            ) : adminActivity.length === 0 ? (
              <div className="p-12 text-center text-[#808495] text-xs font-mono">
                No admin log updates recorded on-chain.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-[#2D3142] text-[10px] font-mono uppercase tracking-widest text-[#808495] bg-[#050608]">
                      <th className="py-4 px-6">Timestamp</th>
                      <th className="py-4 px-6">Category</th>
                      <th className="py-4 px-6">Prediction Market</th>
                      <th className="py-4 px-6">Execution Detail</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#2D3142]/40 font-mono text-xs">
                    {adminActivity.map((item, idx) => {
                      let tagClass = "";
                      if (item.type === "CREATE") tagClass = "bg-blue-500/10 text-blue-400 border border-blue-500/20";
                      else if (item.type === "SETTLE") tagClass = "bg-green-500/10 text-green-400 border border-green-500/20";
                      else if (item.type === "CANCEL") tagClass = "bg-red-500/10 text-red-400 border border-red-500/20";
                      else tagClass = "bg-amber-500/10 text-amber-400 border border-amber-500/20";

                      return (
                        <tr key={idx} className="table-row-3d hover:bg-white/5 transition-colors">
                          <td className="py-4 px-6 text-[#808495]">{item.timeStr}</td>
                          <td className="py-4 px-6">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${tagClass}`}>
                              {item.type}
                            </span>
                          </td>
                          <td className="py-4 px-6 text-[#F4F4F9] max-w-sm truncate">{item.question}</td>
                          <td className="py-4 px-6 text-[#808495]">{item.details}</td>
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
