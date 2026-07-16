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
  Zap,
  Gavel,
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
    comparison: number;
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

  const [settleModal, setSettleModal] = useState<{
    isOpen: boolean;
    market: Market | null;
    settlePrice: string;
    isFetchingPrice: boolean;
  }>({
    isOpen: false,
    market: null,
    settlePrice: "",
    isFetchingPrice: false,
  });

  const [oracleFeedIdHex, setOracleFeedIdHex] = useState<string>("0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d");
  const [manualSettleModal, setManualSettleModal] = useState<{
    isOpen: boolean;
    market: Market | null;
    outcome: number | null;
    showSecondaryConfirm: boolean;
  }>({
    isOpen: false,
    market: null,
    outcome: null,
    showSecondaryConfirm: false,
  });

  const openSettleModal = async (market: Market) => {
    setSettleModal({
      isOpen: true,
      market,
      settlePrice: "",
      isFetchingPrice: true
    });

    try {
      const res = await fetch("https://hermes.pyth.network/v2/updates/price/latest?ids[]=0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d");
      if (res.ok) {
        const data = await res.json();
        const priceUpdate = data.parsed?.[0]?.price;
        if (priceUpdate) {
          const price = Number(priceUpdate.price) * Math.pow(10, priceUpdate.expo);
          setSettleModal({
            isOpen: true,
            market,
            settlePrice: price.toFixed(2),
            isFetchingPrice: false
          });
          return;
        }
      }
    } catch (err) {
      console.error("Error fetching Pyth price:", err);
    }

    const localVal = getSettlePrice(market.publicKey.toBase58());
    setSettleModal({
      isOpen: true,
      market,
      settlePrice: localVal > 0 ? String(localVal) : "260.00",
      isFetchingPrice: false
    });
  };

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
      
      let configAcc;
      try {
        configAcc = await program.account.config.fetch(configPda);
      } catch (configErr) {
        console.log("Config PDA not initialized yet:", configErr);
        setConfig(null);
        return; // Config is not initialized, abort secondary queries
      }

      setConfig({
        publicKey: configPda,
        admin: configAcc.admin,
        feeBps: configAcc.feeBps,
        marketCount: configAcc.marketCount.toNumber(),
      });

      let allMarkets: Market[] = [];
      try {
        allMarkets = (await program.account.market.all()) as Market[];
        setMarkets(allMarkets);
        fetchAdminActivity(allMarkets);
      } catch (marketErr) {
        console.error("Failed to fetch markets list:", marketErr);
        toast.error(`Failed to load markets: ${getFriendlyErrorMessage(marketErr)}`);
      }

      try {
        const userPositions = await program.account.userPosition.all();
        const distinctTraders = new Set(userPositions.map((pos: any) => pos.account.owner.toBase58()));
        setUniqueTradersCount(distinctTraders.size);
      } catch (posErr) {
        console.error("Failed to fetch user positions for stats:", posErr);
      }
    } catch (err) {
      console.error("General fetchConfigAndMarkets error:", err);
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

      let feedId = Array(32).fill(0);
      let targetPriceBn = new anchor.BN(0);
      let targetExpo = 0;
      let finalComparison = 0;

      if (category === 0) {
        let hex = oracleFeedIdHex.trim();
        if (hex.startsWith("0x")) {
          hex = hex.slice(2);
        }
        if (hex.length !== 64) {
          throw new Error("Oracle Feed ID must be a 32-byte hex string (64 characters)");
        }
        for (let i = 0; i < 32; i++) {
          feedId[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
        }
        targetPriceBn = new anchor.BN(Math.round(targetPriceVal * 100_000_000));
        targetExpo = -8;
        finalComparison = comparison;
      }

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
          finalComparison,
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

  const handleMockSettle = async (market: Market, settlePrice: number) => {
    if (!wallet?.publicKey) return;
    const marketKey = market.publicKey.toBase58();
    try {
      setSettlingId(marketKey);

      const configPda = getConfigPda(program.programId);
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

  const handleManualSettle = async (market: Market, outcome: number) => {
    if (!wallet?.publicKey) return;
    const marketKey = market.publicKey.toBase58();
    try {
      setSettlingId(marketKey);

      const configPda = getConfigPda(program.programId);
      
      await program.methods
        .settleMarketManual(outcome)
        .accounts({
          admin: wallet.publicKey,
          config: configPda,
          market: market.publicKey,
        } as any)
        .rpc();

      toast.success(`Market manually resolved successfully!`);
      fetchConfigAndMarkets();
    } catch (err: any) {
      console.error(err);
      toast.error(`Resolution failed: ${getFriendlyErrorMessage(err)}`);
    } finally {
      setSettlingId(null);
    }
  };

  const handleSettleButtonClick = (market: Market) => {
    if (market.account.category === 0) {
      openSettleModal(market);
    } else {
      setManualSettleModal({
        isOpen: true,
        market,
        outcome: null,
        showSecondaryConfirm: false,
      });
    }
  };

  const getPayoutPoolSol = (market: Market, outcome: number) => {
    const yesPool = market.account.yesPoolLamports.toNumber();
    const noPool = market.account.noPoolLamports.toNumber();
    const totalPool = yesPool + noPool;
    const losingPool = outcome === 1 ? noPool : yesPool;
    const feeBpsVal = config?.feeBps ?? 200;
    const fee = Math.floor(losingPool * feeBpsVal / 10000);
    const payoutPoolLamports = totalPool - fee;
    return payoutPoolLamports / 1e9;
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

  const { oracleActionCount, manualActionCount } = useMemo(() => {
    let oracle = 0;
    let manual = 0;
    needsActionMarkets.forEach((m) => {
      if (m.account.category === 0) {
        oracle++;
      } else {
        manual++;
      }
    });
    return { oracleActionCount: oracle, manualActionCount: manual };
  }, [needsActionMarkets]);

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
      {settleModal.isOpen && settleModal.market && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0a0a0a]/80 backdrop-blur-sm">
          <div className="board-panel max-w-md w-full p-6 space-y-6 bg-[#131313] border-[#9e8e78] border relative shadow-2xl">
            <div className="absolute top-3 left-4 flex items-center space-x-2">
              <span className="w-2 h-2 rounded-full bg-[#ffd89c] animate-pulse" />
              <span className="text-[9px] font-mono tracking-widest text-[#ffd89c]">SETTLEMENT CONFIRMATION</span>
            </div>

            <div className="pt-4 space-y-3 font-mono text-xs">
              <div className="space-y-1">
                <div className="text-[10px] text-[#9e8e78] uppercase">Question:</div>
                <div className="text-sm font-bold text-[#e5e2e1]">{settleModal.market.account.question}</div>
              </div>

              <div className="grid grid-cols-2 gap-4 border-y border-[#9e8e78]/20 py-3">
                <div className="space-y-0.5">
                  <div className="text-[10px] text-[#9e8e78] uppercase">Target Price:</div>
                  <div className="text-sm font-bold text-[#ffd89c]">
                    ${(settleModal.market.account.targetPrice.toNumber() / Math.pow(10, Math.abs(settleModal.market.account.targetExpo))).toFixed(2)}
                  </div>
                </div>
                <div className="space-y-0.5">
                  <div className="text-[10px] text-[#9e8e78] uppercase">Condition:</div>
                  <div className="text-sm font-bold text-[#ffd89c]">
                    {settleModal.market.account.comparison === 0 ? "Greater Than" : "Less Than"}
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] text-[#9e8e78] uppercase">Settlement Price ($):</span>
                  {settleModal.isFetchingPrice && (
                    <span className="text-[9px] text-[#ffd89c] animate-pulse">FETCHING REAL-TIME PYTH...</span>
                  )}
                </div>
                <input
                  type="number"
                  step="0.01"
                  value={settleModal.settlePrice}
                  onChange={(e) => setSettleModal(prev => ({ ...prev, settlePrice: e.target.value }))}
                  className="w-full board-input py-2 px-3 text-sm font-mono border-[#9e8e78] bg-[#0d0d0d] text-[#ffd89c]"
                  placeholder="Enter price"
                  disabled={settleModal.isFetchingPrice}
                />
              </div>

              {/* Calculated outcome prediction */}
              {(() => {
                const enteredPrice = parseFloat(settleModal.settlePrice);
                if (isNaN(enteredPrice)) return null;

                const target = settleModal.market.account.targetPrice.toNumber() / Math.pow(10, Math.abs(settleModal.market.account.targetExpo));
                const isGreater = settleModal.market.account.comparison === 0;
                const yesWins = isGreater ? enteredPrice > target : enteredPrice < target;

                return (
                  <div className="bg-[#0d0d0d] border border-[#9e8e78]/20 p-3 rounded text-center">
                    <div className="text-[9px] text-[#9e8e78] uppercase">Projected Outcome:</div>
                    <div className="mt-1 text-md font-bold tracking-widest font-mono">
                      At <span className="text-[#ffd89c]">${enteredPrice.toFixed(2)}</span>, outcome will be{" "}
                      <span className={yesWins ? "text-[#a1d494]" : "text-[#ffb4ab]"}>
                        {yesWins ? "YES" : "NO"}
                      </span>
                    </div>
                  </div>
                );
              })()}
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setSettleModal({ isOpen: false, market: null, settlePrice: "", isFetchingPrice: false })}
                className="flex-1 btn-amber text-xs py-2 uppercase border border-[#9e8e78]/30 hover:border-[#ffd89c] cursor-pointer bg-transparent text-[#d6c4ac]"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isNaN(parseFloat(settleModal.settlePrice)) || settlingId !== null}
                onClick={async () => {
                  const price = parseFloat(settleModal.settlePrice);
                  if (settleModal.market && !isNaN(price)) {
                    const m = settleModal.market;
                    setSettleModal({ isOpen: false, market: null, settlePrice: "", isFetchingPrice: false });
                    await handleMockSettle(m, price);
                  }
                }}
                className="flex-1 btn-amber text-xs py-2 uppercase cursor-pointer disabled:opacity-50"
              >
                {settlingId ? "Settling..." : "Confirm Settlement"}
              </button>
            </div>
          </div>
        </div>
      )}

      {manualSettleModal.isOpen && manualSettleModal.market && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0a0a0a]/80 backdrop-blur-sm">
          <div className="board-panel max-w-md w-full p-6 space-y-6 bg-[#131313] border-[#9e8e78] border relative shadow-2xl">
            <div className="absolute top-3 left-4 flex items-center space-x-2">
              <span className="w-2 h-2 rounded-full bg-[#ffd89c] animate-pulse" />
              <span className="text-[9px] font-mono tracking-widest text-[#ffd89c] bg-[#ffd89c]/10 px-1.5 py-0.5 rounded border border-[#ffd89c]/20 font-bold">MANUAL SETTLEMENT</span>
            </div>

            {!manualSettleModal.showSecondaryConfirm ? (
              // Stage 1: Choose outcome
              <div className="space-y-6 pt-4">
                <div className="space-y-1 text-left">
                  <div className="text-[10px] text-[#9e8e78] font-mono uppercase">Question:</div>
                  <div className="text-sm font-bold text-[#e5e2e1] font-display">{manualSettleModal.market.account.question}</div>
                </div>

                {manualSettleModal.market.account.description && (
                  <div className="space-y-1 bg-[#0d0d0d] p-3 border border-[#9e8e78]/15 rounded text-left">
                    <div className="text-[10px] text-[#9e8e78] font-mono uppercase">Winning Condition:</div>
                    <div className="text-[11px] text-[#d6c4ac] leading-relaxed font-mono">{manualSettleModal.market.account.description}</div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4 text-center font-mono text-xs border-y border-[#9e8e78]/20 py-3 bg-[#0d0d0d]/30">
                  <div className="space-y-0.5">
                    <div className="text-[10px] text-[#9e8e78] uppercase">YES Pool:</div>
                    <div className="text-sm font-bold text-[#a1d494]">
                      {(manualSettleModal.market.account.yesPoolLamports.toNumber() / 1e9).toFixed(2)} SOL
                    </div>
                  </div>
                  <div className="space-y-0.5">
                    <div className="text-[10px] text-[#9e8e78] uppercase">NO Pool:</div>
                    <div className="text-sm font-bold text-[#ffb4ab]">
                      {(manualSettleModal.market.account.noPoolLamports.toNumber() / 1e9).toFixed(2)} SOL
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="text-[10px] text-[#9e8e78] font-mono uppercase text-center">Select Winner:</div>
                  <div className="grid grid-cols-2 gap-4">
                    <button
                      type="button"
                      onClick={() => setManualSettleModal(prev => ({ ...prev, outcome: 1, showSecondaryConfirm: true }))}
                      className="py-3 font-mono font-bold uppercase rounded border border-[#a1d494]/30 bg-[#a1d494]/10 hover:bg-[#a1d494]/20 text-[#a1d494] cursor-pointer transition-colors text-center"
                    >
                      [ YES WON ]
                    </button>
                    <button
                      type="button"
                      onClick={() => setManualSettleModal(prev => ({ ...prev, outcome: 2, showSecondaryConfirm: true }))}
                      className="py-3 font-mono font-bold uppercase rounded border border-[#ffb4ab]/30 bg-[#ffb4ab]/10 hover:bg-[#ffb4ab]/20 text-[#ffb4ab] cursor-pointer transition-colors text-center"
                    >
                      [ NO WON ]
                    </button>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setManualSettleModal({ isOpen: false, market: null, outcome: null, showSecondaryConfirm: false })}
                  className="w-full btn-amber text-xs py-2 uppercase border border-[#9e8e78]/30 hover:border-[#ffd89c] cursor-pointer bg-transparent text-[#d6c4ac]"
                >
                  Cancel
                </button>
              </div>
            ) : (
              // Stage 2: Confirm selection
              <div className="space-y-6 pt-4 font-mono text-xs text-center">
                <div className="text-sm font-bold text-[#ffb4ab] uppercase tracking-wider flex items-center justify-center gap-2">
                  <AlertTriangle className="w-5 h-5 animate-pulse" /> EXTREME WARNING
                </div>

                <div className="space-y-4 text-[#d6c4ac] leading-relaxed text-[11px] bg-[#0d0d0d] p-4 border border-[#ffb4ab]/30 rounded text-left">
                  <p>
                    You are about to settle this market with{" "}
                    <span className={manualSettleModal.outcome === 1 ? "text-[#a1d494] font-bold" : "text-[#ffb4ab] font-bold"}>
                      {manualSettleModal.outcome === 1 ? "YES" : "NO"}
                    </span>{" "}
                    as the winner.
                  </p>
                  <p>
                    This action is **irreversible** and will distribute{" "}
                    <span className="text-[#ffd89c] font-bold">
                      {getPayoutPoolSol(manualSettleModal.market, manualSettleModal.outcome! || 1).toFixed(3)} SOL
                    </span>{" "}
                    to all{" "}
                    <span className={manualSettleModal.outcome === 1 ? "text-[#a1d494] font-bold" : "text-[#ffb4ab] font-bold"}>
                      {manualSettleModal.outcome === 1 ? "YES" : "NO"}
                    </span>{" "}
                    share holders.
                  </p>
                  <p className="text-[10px] text-[#9e8e78]">
                    Protocol fee collected: {((manualSettleModal.market.account.yesPoolLamports.toNumber() + manualSettleModal.market.account.noPoolLamports.toNumber() - getPayoutPoolSol(manualSettleModal.market, manualSettleModal.outcome! || 1) * 1e9) / 1e9).toFixed(3)} SOL
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setManualSettleModal(prev => ({ ...prev, showSecondaryConfirm: false, outcome: null }))}
                    className="flex-1 btn-amber text-xs py-2 uppercase border border-[#9e8e78]/30 hover:border-[#ffd89c] cursor-pointer bg-transparent text-[#d6c4ac]"
                  >
                    Go Back
                  </button>
                  <button
                    type="button"
                    disabled={settlingId !== null}
                    onClick={async () => {
                      if (manualSettleModal.market && manualSettleModal.outcome) {
                        const m = manualSettleModal.market;
                        const outcome = manualSettleModal.outcome;
                        setManualSettleModal({ isOpen: false, market: null, outcome: null, showSecondaryConfirm: false });
                        await handleManualSettle(m, outcome);
                      }
                    }}
                    className="flex-1 btn-amber text-xs py-2 bg-[#ffb4ab] hover:bg-[#ffc9c2] text-[#131313] uppercase cursor-pointer disabled:opacity-50 font-bold"
                  >
                    {settlingId ? "Settling..." : "Confirm"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

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
          wallet && wallet.publicKey
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
              subtitle={`${oracleActionCount} oracle markets | ${manualActionCount} manual markets awaiting your decision`}
              icon={AlertTriangle}
              count={needsActionMarkets.length}
              variant="alert"
            >
              <div className="divide-y divide-[#9e8e78]/20">
                {needsActionMarkets.map((m) => {
                  const marketKey = m.publicKey.toBase58();
                  const isCrypto = m.account.category === 0;
                  return (
                    <div key={marketKey} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="space-y-1">
                        <div className="text-sm font-bold text-[#e5e2e1]">{m.account.question}</div>
                        <div className="text-[10px] text-[#d6c4ac] font-mono flex items-center gap-2">
                          <span>Category: {getCategoryString(m.account.category)}</span>
                          {isCrypto ? (
                            <span className="text-[#06b6d4] font-bold inline-flex items-center gap-0.5"><Zap className="w-3 h-3" /> ORACLE SETTLED</span>
                          ) : (
                            <span className="text-[#ffd89c] font-bold inline-flex items-center gap-0.5"><Gavel className="w-3 h-3" /> MANUALLY SETTLED</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          disabled={settlingId !== null}
                          onClick={() => handleSettleButtonClick(m)}
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

                    {category === 0 && (
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
                    )}
                  </div>

                  {category === 0 ? (
                    <>
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-[#d6c4ac]">Oracle Feed ID (Hex)</label>
                        <input
                          type="text"
                          required
                          value={oracleFeedIdHex}
                          onChange={(e) => setOracleFeedIdHex(e.target.value)}
                          placeholder="0xef0d8b6fda..."
                          className="w-full board-input text-xs border-[#9e8e78] font-mono text-[#ffd89c]"
                        />
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
                    </>
                  ) : (
                    <>
                      <div className="space-y-1.5 bg-[#ffd89c]/5 border border-[#ffd89c]/20 p-3 rounded font-mono text-[10px] text-[#ffd89c] leading-normal text-left">
                        This market will be manually settled by the admin. Use the Description field
                        to clearly explain what the YES and NO outcomes mean (e.g. 'YES if the Giants
                        win, NO if they lose or the game is cancelled').
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
                    </>
                  )}

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
                                {(() => {
                                  const now = Math.floor(Date.now() / 1000);
                                  const isPast = m.account.resolveTs.toNumber() < now;
                                  if (status === "Open" && isPast) {
                                    if (m.account.category === 0) {
                                      return (
                                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#06b6d4]/15 text-[#ffd89c] border border-[#06b6d4]/20 inline-flex items-center gap-1">
                                          <Zap className="w-3 h-3 text-[#ffd89c]" /> ORACLE SETTLE
                                        </span>
                                      );
                                    } else {
                                      return (
                                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#ffd89c]/15 text-[#ffd89c] border border-[#ffd89c]/20 inline-flex items-center gap-1">
                                          <Gavel className="w-3 h-3 text-[#ffd89c]" /> MANUAL SETTLE
                                        </span>
                                      );
                                    }
                                  }
                                  return (
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                      status === "Open" 
                                        ? "bg-[#a1d494]/15 text-[#a1d494] border border-[#a1d494]/20" 
                                        : status === "Settled" 
                                        ? "bg-white/5 text-[#d6c4ac] border border-white/10" 
                                        : "bg-[#ffb4ab]/15 text-[#ffb4ab] border border-[#ffb4ab]/20"
                                    }`}>
                                      {status}
                                    </span>
                                  );
                                })()}
                              </td>
                              <td className="py-4 px-6 text-right text-[#e5e2e1]">{volume.toFixed(2)} SOL</td>
                              <td className="py-4 px-6 text-center">
                                {status === "Open" && (
                                  <div className="flex items-center justify-center gap-2">
                                    <button
                                      disabled={settlingId !== null}
                                      onClick={() => handleSettleButtonClick(m)}
                                      className="px-2.5 py-1 bg-[#a1d494] hover:bg-[#b7e4ac] text-[#131313] border border-[#9e8e78] rounded text-[9px] cursor-pointer font-bold"
                                    >
                                      Settle
                                    </button>
                                    <button
                                      onClick={() => setCancelModal({ isOpen: true, marketPda: m.publicKey })}
                                      className="px-2.5 py-1 bg-[#ffb4ab] hover:bg-[#ffc9c2] text-[#131313] border border-[#9e8e78] rounded text-[9px] cursor-pointer font-bold"
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
