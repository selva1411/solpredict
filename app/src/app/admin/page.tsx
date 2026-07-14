"use client";

import React, { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { useProgram } from "@/hooks/useProgram";
import { PublicKey, Keypair } from "@solana/web3.js";
import { getFriendlyErrorMessage } from "@/lib/error-map";
import { toast } from "sonner";
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
  
  // Settlement states
  const [settlingId, setSettlingId] = useState<string | null>(null);
  const [settlePrice, setSettlePrice] = useState<number>(260.00);

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
    try {
      setSettlingId(market.publicKey.toBase58());
      
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
      const priceVal = new anchor.BN(Math.round(settlePrice * 100)); // Store with 2 decimals

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
      <div className="border-b border-white/5 pb-4">
        <h1 className="text-3xl font-extrabold font-display bg-gradient-to-r from-violet-400 to-cyan-400 bg-clip-text text-transparent">
          Admin Observatory Console
        </h1>
        <p className="text-text-muted text-sm">Initialize config singleton, create contracts, settle outputs, and withdraw protocol fees.</p>
      </div>

      {/* 1. INITIALIZE CONFIG SECTION (Shown only if not initialized) */}
      {!config ? (
        <section className="glass-panel p-8 space-y-6 border border-amber-500/25 bg-amber-500/3">
          <div className="flex items-center space-x-3 text-amber-400">
            <AlertTriangle className="w-6 h-6" />
            <h2 className="text-lg font-bold font-display">Config PDA Not Found</h2>
          </div>
          <p className="text-xs text-text-muted">
            The platform-wide config singleton must be initialized once before markets can be created. The key initialized here will serve as the master Administrator authority.
          </p>
          <div className="grid sm:grid-cols-2 gap-4 items-end max-w-md">
            <div className="space-y-2">
              <label className="text-xs font-mono text-text-muted">Fee Basis Points (100 = 1%)</label>
              <input
                type="number"
                value={feeBps}
                onChange={(e) => setFeeBps(Number(e.target.value))}
                className="w-full glass-input text-sm py-2 px-3"
              />
            </div>
            <button onClick={handleInitializeConfig} className="btn-primary py-2.5 text-xs">
              Initialize Config PDA
            </button>
          </div>
        </section>
      ) : (
        <section className="grid sm:grid-cols-3 gap-6">
          <div className="glass-panel p-6 space-y-1">
            <div className="text-xs text-text-muted">Fee Percentage</div>
            <div className="text-xl font-mono font-bold text-violet-400">
              {(config.feeBps / 100).toFixed(1)}% ({config.feeBps} bps)
            </div>
          </div>
          <div className="glass-panel p-6 space-y-1">
            <div className="text-xs text-text-muted">Total Markets Formed</div>
            <div className="text-xl font-mono font-bold text-cyan-400">{config.marketCount}</div>
          </div>
          <div className="glass-panel p-6 space-y-1 overflow-hidden">
            <div className="text-xs text-text-muted">Admin Account</div>
            <div className="text-xs font-mono font-semibold truncate text-text-primary pt-1">
              {config.admin.toBase58()}
            </div>
          </div>
        </section>
      )}

      {config && (
        <div className="grid md:grid-cols-5 gap-8">
          {/* 2. CREATE MARKET FORM PANEL */}
          <section className="md:col-span-2 space-y-6">
            <div className="glass-panel p-6 space-y-6">
              <div className="flex items-center space-x-2 border-b border-white/5 pb-3">
                <Plus className="w-5 h-5 text-violet-400" />
                <h2 className="text-base font-bold font-display">Create Prediction Contract</h2>
              </div>

              <form onSubmit={handleCreateMarket} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-text-muted">Question Text</label>
                  <input
                    type="text"
                    required
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    placeholder="e.g. Will SOL exceed $280 by tomorrow?"
                    className="w-full glass-input text-xs py-2 px-3"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-text-muted">Rules & Settlement Description</label>
                  <textarea
                    required
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="e.g. Settle using Pyth feed SOL/USD. Price must match condition..."
                    rows={3}
                    className="w-full glass-input text-xs py-2 px-3"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-text-muted">Category</label>
                    <select
                      value={category}
                      onChange={(e) => setCategory(Number(e.target.value))}
                      className="w-full glass-input text-xs py-2 px-3 bg-[#0B0B1E]"
                    >
                      {CATEGORIES.map((cat, i) => (
                        <option key={i} value={i}>{cat}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-text-muted">Comparison</label>
                    <select
                      value={comparison}
                      onChange={(e) => setComparison(Number(e.target.value))}
                      className="w-full glass-input text-xs py-2 px-3 bg-[#0B0B1E]"
                    >
                      <option value={0}>Greater Than</option>
                      <option value={1}>Less Than</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-text-muted">Target Price ($)</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={targetPriceVal}
                      onChange={(e) => setTargetPriceVal(Number(e.target.value))}
                      className="w-full glass-input text-xs py-2 px-3 font-mono"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-text-muted">Duration (Seconds)</label>
                    <input
                      type="number"
                      required
                      value={durationSecs}
                      onChange={(e) => setDurationSecs(Number(e.target.value))}
                      className="w-full glass-input text-xs py-2 px-3 font-mono"
                    />
                  </div>
                </div>

                <button type="submit" className="w-full btn-primary text-xs py-3 mt-4">
                  Deploy Market PDA
                </button>
              </form>
            </div>
          </section>

          {/* 3. MANAGE MARKETS LIST & SETTLEMENT */}
          <section className="md:col-span-3 space-y-6">
            <div className="glass-panel p-6 space-y-6">
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
                    
                    return (
                      <div key={m.publicKey.toBase58()} className="p-4 border border-white/5 bg-white/2 rounded-xl space-y-4">
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
                                value={settlePrice}
                                onChange={(e) => setSettlePrice(Number(e.target.value))}
                                className="w-24 glass-input py-1 px-2 text-xs font-mono"
                                placeholder="Price"
                              />
                              <button
                                disabled={settlingId !== null}
                                onClick={() => handleMockSettle(m)}
                                className="btn-primary py-1.5 px-4 text-[10px]"
                              >
                                {settlingId === m.publicKey.toBase58() ? "Settling..." : "Mock Settle"}
                              </button>
                              <button
                                onClick={() => handleCancelMarket(m.publicKey)}
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
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

const Admin = dynamic(() => Promise.resolve(AdminPage), { ssr: false });
export default Admin;
