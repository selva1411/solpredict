"use client";

import React, { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { useProgram } from "@/hooks/useProgram";
import { PublicKey, Keypair } from "@solana/web3.js";
import { getFriendlyErrorMessage } from "@/lib/error-map";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { 
  ShieldCheck, 
  Plus, 
  HelpCircle, 
  Settings, 
  Coins, 
  Info,
  Calendar,
  AlertTriangle
} from "lucide-react";
import * as anchor from "@coral-xyz/anchor";
import { getConfigPda, getMarketPda, getMockPriceUpdatePda } from "@/lib/pda";
import { ConfirmModal } from "@/components/ConfirmModal";

const CATEGORIES = ["Crypto", "Sports", "Politics", "Tech", "Other"];

interface Market {
  publicKey: PublicKey;
  account: {
    marketId: anchor.BN;
    question: string;
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
  const [config, setConfig] = useState<any>(null);
  const [configLoading, setConfigLoading] = useState<boolean>(true);
  const [markets, setMarkets] = useState<Market[]>([]);
  
  // Form states
  const [feeBps, setFeeBps] = useState<number>(200); // 2%
  const [question, setQuestion] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [category, setCategory] = useState<number>(0);
  const [targetPriceVal, setTargetPriceVal] = useState<number>(250.00);
  const [comparison, setComparison] = useState<number>(0); // 0 = GreaterThan, 1 = LessThan
  const [durationSecs, setDurationSecs] = useState<number>(300); // 5 mins for quick test
  
  // Settlement states — per-market settle prices (FIX: was a single shared value)
  const [settlingId, setSettlingId] = useState<string | null>(null);
  const [settlePrices, setSettlePrices] = useState<Map<string, number>>(new Map());

  // Confirmation modal state
  const [cancelModal, setCancelModal] = useState<{ isOpen: boolean; marketPda: PublicKey | null }>({
    isOpen: false,
    marketPda: null,
  });

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
      const allMarkets = await program.account.market.all();
      setMarkets(allMarkets as any[]);
    } catch (err) {
      console.log("Config PDA not initialized yet:", err);
      setConfig(null);
    } finally {
      setConfigLoading(false);
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

  // 4. Cancel Market (with confirmation modal)
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

  const getStatusString = (status: any): "Open" | "Settled" | "Cancelled" => {
    if (status.open) return "Open";
    if (status.settled) return "Settled";
    if (status.cancelled) return "Cancelled";
    return "Open";
  };

  if (!wallet || !wallet.publicKey) {
    return (
      <div className="glass-panel py-20 text-center space-y-6 max-w-xl mx-auto my-12">
        <div className="mx-auto w-16 h-16 bg-white/5 border border-white/10 rounded-full flex items-center justify-center text-text-muted">
          <ShieldCheck className="w-8 h-8" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-bold font-display text-text-primary">Admin Console Locked</h2>
          <p className="text-text-muted text-sm max-w-sm mx-auto">
            Please connect your admin keypair wallet to deploy configs, manage markets, or settle payouts.
          </p>
        </div>
      </div>
    );
  }

  if (configLoading) {
    return <div className="glass-panel p-10 h-64 skeleton-shimmer max-w-4xl mx-auto" />;
  }

  return (
    <div className="space-y-10 animate-fade-in max-w-5xl mx-auto">
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

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="border-b border-white/5 pb-4"
      >
        <h1 className="text-3xl font-bold font-display text-[#F4F4F9]">
          [■] ADMIN OBSERVATORY CONSOLE
        </h1>
        <p className="text-[#808495] text-sm">Initialize config singleton, create contracts, settle outputs, and withdraw protocol fees.</p>
      </motion.div>

      {/* 1. INITIALIZE CONFIG SECTION (Shown only if not initialized) */}
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
        <motion.section
          className="grid sm:grid-cols-3 gap-6"
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
        >
          <motion.div variants={cardVariants} className="board-panel p-6 space-y-1 bg-[#0C0D12]">
            <div className="text-xs text-[#808495]">Fee Percentage</div>
            <div className="text-xl font-mono font-bold text-[#FFA500]">
              {(config.feeBps / 100).toFixed(1)}% ({config.feeBps} bps)
            </div>
          </motion.div>
          <motion.div variants={cardVariants} className="board-panel p-6 space-y-1 bg-[#0C0D12]">
            <div className="text-xs text-[#808495]">Total Markets Formed</div>
            <div className="text-xl font-mono font-bold text-[#FFA500]">{config.marketCount}</div>
          </motion.div>
          <motion.div variants={cardVariants} className="board-panel p-6 space-y-1 overflow-hidden bg-[#0C0D12]">
            <div className="text-xs text-[#808495]">Admin Account</div>
            <div className="text-xs font-mono font-semibold truncate text-[#F4F4F9] pt-1">
              {config.admin.toBase58()}
            </div>
          </motion.div>
        </motion.section>
      )}

      {config && (
        <div className="grid md:grid-cols-5 gap-8">
          {/* 2. CREATE MARKET FORM PANEL */}
          <motion.section
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="md:col-span-2 space-y-6"
          >
            <div className="board-panel p-6 space-y-6 bg-[#0C0D12]">
              <div className="flex items-center space-x-2 border-b border-[#2D3142] pb-3">
                <Plus className="w-5 h-5 text-[#FFA500]" />
                <h2 className="text-base font-bold font-display text-[#F4F4F9]">Create Prediction Contract</h2>
              </div>

              <form onSubmit={handleCreateMarket} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#808495]">Question Text</label>
                  <input
                    type="text"
                    required
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    placeholder="e.g. Will SOL exceed $280 by tomorrow?"
                    className="w-full board-input text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#808495]">Rules & Settlement Description</label>
                  <textarea
                    required
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="e.g. Settle using Pyth feed SOL/USD. Price must match condition..."
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
                    <label className="text-xs font-semibold text-[#808495]">Duration (Seconds)</label>
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
          </motion.section>

          {/* 3. MANAGE MARKETS LIST & SETTLEMENT */}
          <motion.section
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4, delay: 0.15 }}
            className="md:col-span-3 space-y-6"
          >
            <div className="glass-panel premium-card p-6 space-y-6">
              <div className="flex items-center space-x-2 border-b border-white/5 pb-3">
                <Settings className="w-5 h-5 text-cyan-400" />
                <h2 className="text-base font-bold font-display">Manage & Settle Markets</h2>
              </div>

              {markets.length === 0 ? (
                <p className="text-xs text-text-muted text-center py-10">No prediction markets created yet.</p>
              ) : (
                <div className="space-y-4">
                  {markets.map((m) => {
                    const status = getStatusString(m.account.status);
                    const marketKey = m.publicKey.toBase58();
                    
                    return (
                      <motion.div
                        key={marketKey}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="p-4 border border-white/5 bg-white/2 rounded-xl premium-card space-y-4"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-mono text-text-muted">ID #{m.account.marketId.toString()}</span>
                          <span className={`px-2 py-0.5 text-[9px] font-bold rounded ${
                            status === "Open" ? "bg-[#10E58C]/15 text-[#10E58C]" : "bg-white/5 text-text-muted"
                          }`}>
                            {status}
                          </span>
                        </div>
                        <h4 className="text-xs font-bold text-text-primary">{m.account.question}</h4>
                        
                        {status === "Open" && (
                          <div className="space-y-3 pt-2 border-t border-white/5">
                            <div className="flex items-center gap-2">
                              <input
                                type="number"
                                step="0.01"
                                value={getSettlePrice(marketKey)}
                                onChange={(e) => setSettlePrice(marketKey, Number(e.target.value))}
                                className="w-24 glass-input py-1 px-2 text-xs font-mono"
                                placeholder="Price"
                              />
                              <button
                                disabled={settlingId !== null}
                                onClick={() => handleMockSettle(m)}
                                className="btn-primary py-1.5 px-4 text-[10px]"
                              >
                                {settlingId === marketKey ? "Settling..." : "Mock Settle"}
                              </button>
                              <button
                                onClick={() => setCancelModal({ isOpen: true, marketPda: m.publicKey })}
                                className="bg-red-500/10 border border-red-500/30 text-[#FF4D6D] hover:bg-red-500/20 py-1.5 px-4 text-[10px] rounded-xl transition-all cursor-pointer font-semibold"
                              >
                                Cancel
                              </button>
                            </div>
                            <p className="text-[9px] text-text-muted flex items-center gap-1">
                              <Info className="w-3.5 h-3.5 text-amber-500" />
                              Warp: settlement forces Pyth Mock Price, comparing against Target Price.
                            </p>
                          </div>
                        )}

                        {status === "Settled" && (
                          <div className="flex items-center justify-between pt-2 border-t border-white/5 text-[11px] font-mono">
                            <div>Fees: <span className="text-text-primary font-bold">{(m.account.feeCollected.toNumber() / 1e9).toFixed(4)} SOL</span></div>
                            {m.account.feeWithdrawn ? (
                              <span className="text-[#10E58C] font-semibold text-[10px]">Withdrawn</span>
                            ) : (
                              <button
                                onClick={() => handleWithdrawFees(m)}
                                className="px-3 py-1 bg-violet-500/20 hover:bg-violet-500/30 border border-violet-500/30 rounded-lg text-violet-400 text-[10px] font-semibold cursor-pointer transition-all"
                              >
                                Withdraw Fees
                              </button>
                            )}
                          </div>
                        )}
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </div>
          </motion.section>
        </div>
      )}
    </div>
  );
}

const Admin = dynamic(() => Promise.resolve(AdminPage), { ssr: false });
export default Admin;
