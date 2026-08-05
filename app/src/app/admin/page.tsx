"use client";

import React, { useState, useEffect, useMemo } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useProgram } from "@/hooks/useProgram";
import { useUserRole } from "@/hooks/useUserRole";
import { PublicKey, Keypair, SystemProgram, SYSVAR_RENT_PUBKEY } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { getFriendlyErrorMessage } from "@/lib/error-map";
import { lamportsToSol, bnToNum } from "@/lib/format";
import { txAccounts, sendWithRetry } from "@/lib/anchor-utils";
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
import { formatEventTime, findMarketQuestion, getMarketStatusString, AnchorMarketStatus } from "@/lib/events";
import type { MarketCacheEntry } from "@/lib/db/store";
import { ConfirmModal } from "@/components/ConfirmModal";
import { ConnectWalletGate } from "@/components/dashboard/ConnectWalletGate";
import { signAdminProof, adminFetch } from "@/lib/admin-client";
const StatTile3D = dynamic(() => import("@/components/dashboard/StatTile3D").then(m => m.StatTile3D), { ssr: false });
const AdminCharts = dynamic(() => import("@/components/dashboard/AdminCharts").then(m => m.AdminCharts), { ssr: false });
import { DashboardSection, DashboardHero } from "@/components/dashboard/DashboardSection";
import { GlassPanel } from "@/components/GlassPanel";
import { useDeviceCapability } from "@/hooks/useDeviceCapability";
import { fadeInUp, staggerContainer } from "@/lib/motion-variants";
import { ProposalsSection } from "@/components/admin/ProposalsSection";
import { UsersSection } from "@/components/admin/UsersSection";
import { PYTH_FEED_REGISTRY, PythFeedEntry, isOracleCategory } from "@/lib/pyth-feeds";
import { EmptyState } from "@/components/StatePanels";

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
    status: AnchorMarketStatus;
    yesPoolLamports: anchor.BN;
    noPoolLamports: anchor.BN;
    feeCollected: anchor.BN;
    feeWithdrawn: boolean;
    feeBps: number;
    [key: string]: unknown;
  };
}

interface ConfigAccount {
  publicKey: PublicKey;
  admin: PublicKey;
  marketCount: number;
  feeBps: number;
  feeRateBps?: number;
  minDuration?: number;
  maxDuration?: number;
  treasuryVault?: PublicKey;
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

function AdminPage() {
  const { program, wallet, connection } = useProgram();
  const { role, isLoading: roleLoading } = useUserRole();
  const router = useRouter();

  const [config, setConfig] = useState<ConfigAccount | null>(null);
  const [configLoading, setConfigLoading] = useState<boolean>(true);
  const [markets, setMarkets] = useState<Market[]>([]);
  const [uniqueTradersCount, setUniqueTradersCount] = useState<number>(0);
  const [adminActivity, setAdminActivity] = useState<AdminActivity[]>([]);
  const [activityLoading, setActivityLoading] = useState<boolean>(false);
  
  const [feeBps, setFeeBps] = useState<number>(200); 
  const [question, setQuestion] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [category, setCategory] = useState<number>(0);
  const [selectedAssetKey, setSelectedAssetKey] = useState<string>("");
  const [targetPriceVal, setTargetPriceVal] = useState<number>(250.00);
  const [comparison, setComparison] = useState<number>(0); 
  const [durationSecs, setDurationSecs] = useState<number>(3600);
  const [initialYesPoolSol, setInitialYesPoolSol] = useState<number>(5.0);
  const [initialNoPoolSol, setInitialNoPoolSol] = useState<number>(5.0);
  
  const [activeAdminSection, setActiveAdminSection] = useState<"overview" | "proposals" | "markets" | "users" | "config">("overview");
  const [settlingId, setSettlingId] = useState<string | null>(null);
  const [settlePrices, setSettlePrices] = useState<Map<string, number>>(new Map());
  const [leaderboardFallback, setLeaderboardFallback] = useState<Array<{ wallet: string; totalWagered: number }>>([]);
  const [withdrawing, setWithdrawing] = useState(false);

  const [cancelModal, setCancelModal] = useState<{ isOpen: boolean; marketPda: PublicKey | null }>({
    isOpen: false,
    marketPda: null,
  });

  const [settleModal, setSettleModal] = useState<{
    isOpen: boolean;
    market: Market | null;
    settlePrice: string;
    isFetchingPrice: boolean;
    livePrice: number | null;
  }>({
    isOpen: false,
    market: null,
    settlePrice: "",
    isFetchingPrice: false,
    livePrice: null,
  });

  // Poll Pyth price every 5s while oracle settle modal is open
  useEffect(() => {
    if (!settleModal.isOpen || !settleModal.market || !isOracleSettleable(settleModal.market.account.oracleFeedId)) return;
    const feedHex = "0x" + Array.from(settleModal.market.account.oracleFeedId).map(b => b.toString(16).padStart(2, '0')).join('');
    const id = feedHex.slice(2);
    const poll = async () => {
      try {
        const res = await fetch(`https://hermes.pyth.network/v2/updates/price/latest?ids%5B%5D=${id}`);
        if (!res.ok) return;
        const json = await res.json();
        const p = json.parsed?.[0]?.price;
        if (!p) return;
        const price = Number(p.price) * Math.pow(10, p.expo);
        setSettleModal((prev) => ({ ...prev, settlePrice: price.toFixed(6), isFetchingPrice: false, livePrice: price }));
      } catch { /* ignore */ }
    };
    poll();
    const iv = setInterval(poll, 5000);
    return () => clearInterval(iv);
  }, [settleModal.isOpen, settleModal.market]);

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
      isFetchingPrice: true,
      livePrice: null,
    });
  };

  useEffect(() => {
    if (!roleLoading && role === "user") {
      toast.error("This area is admin-only. Redirecting to user dashboard...");
      router.push("/dashboard");
    }
  }, [role, roleLoading, router]);

  // Sign a proof-of-ownership message so admin API routes can authorize in production.
  useEffect(() => {
    const { publicKey } = wallet || {};
    if (!publicKey) return;
    signAdminProof(wallet, wallet.signMessage).catch(() => {});
  }, [wallet, wallet?.publicKey?.toBase58()]);

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
      
      try {
        const configAcc = await program.account.config.fetch(configPda);
        setConfig({
          publicKey: configPda,
          admin: configAcc.admin,
          feeBps: configAcc.feeBps,
          marketCount: configAcc.marketCount.toNumber(),
        });
      } catch (configErr) {
        console.log("Config PDA not initialized yet:", configErr);
        setConfig(null);
      }

      const onChainMarkets = (await program.account.market.all().catch(() => [])) as Market[];
      const existingKeys = new Set(onChainMarkets.map(m => m.publicKey.toBase58()));

      let dbMarkets: Market[] = [];
      try {
        const res = await fetch("/api/markets/cached");
        if (res.ok) {
          const json = await res.json();
          if (json.markets) {
            dbMarkets = json.markets
              .filter((c: MarketCacheEntry) => !existingKeys.has(c.marketPubkey))
              .map((c: MarketCacheEntry): Market => {
                const catIdx = CATEGORIES.indexOf(c.category) >= 0 ? CATEGORIES.indexOf(c.category) : 4;
                const statusObj = c.status === "settled" ? { settled: {} } : c.status === "cancelled" ? { cancelled: {} } : { open: {} };
                return {
                  publicKey: new PublicKey(c.marketPubkey),
                  account: {
                    marketId: new anchor.BN(c.marketId || 0),
                    question: c.question,
                    description: c.description || "",
                    category: catIdx,
                    oracleFeedId: Array(32).fill(0),
                    targetPrice: new anchor.BN(0),
                    targetExpo: 0,
                    comparison: 0,
                    endTs: new anchor.BN(Math.floor(new Date(c.endTs).getTime() / 1000)),
                    resolveTs: new anchor.BN(Math.floor(new Date(c.resolveTs).getTime() / 1000)),
                    status: statusObj,
                    yesPoolLamports: new anchor.BN(Math.round((c.yesPoolSol || 0) * 1e9)),
                    noPoolLamports: new anchor.BN(Math.round((c.noPoolSol || 0) * 1e9)),
                    feeCollected: new anchor.BN(0),
                    feeWithdrawn: false,
                    feeBps: 200,
                  }
                };
              });
          }
        }
      } catch (e) {
        console.warn("Could not fetch cached markets from DB for admin:", e);
      }

      const combinedMarkets = [...onChainMarkets, ...dbMarkets];
      setMarkets(combinedMarkets);
      fetchAdminActivity(combinedMarkets);

      try {
        const userPositions = await program.account.userPosition.all().catch(() => []);
        const distinctTraders = new Set(userPositions.map((pos) => pos.account.owner.toBase58()));

        const leaderboardRes = await fetch("/api/leaderboard").then(r => r.json()).catch(() => null);
        if (leaderboardRes?.ok && leaderboardRes.leaderboard) {
          setLeaderboardFallback(leaderboardRes.leaderboard);
          leaderboardRes.leaderboard.forEach((user: { wallet: string }) => distinctTraders.add(user.wallet));
        }

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
              details: `Withdrawn ${ lamportsToSol(event.data.amount).toFixed(4) } SOL to admin`
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
      const balance = await connection.getBalance(wallet.publicKey).catch(() => 0);
      if (balance < 10_000_000) {
        toast.error(`Insufficient SOL: ${lamportsToSol(balance).toFixed(4)} SOL. Need at least 0.01 SOL.`);
        return;
      }

      const configPda = getConfigPda(program.programId);
      await sendWithRetry(
        program.methods
          .initializeConfig(feeBps)
          .accounts(txAccounts({
            admin: wallet.publicKey,
            config: configPda,
            systemProgram: SystemProgram.programId,
          }))
      );

      toast.success("Platform Config PDA successfully initialized!");
      fetchConfigAndMarkets();
    } catch (err: unknown) {
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

      if (isOracleCategory(category)) {
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

      const endTs = new anchor.BN(Math.floor(Date.now() / 1000) + durationSecs + 30);
      const resolveTs = endTs.add(new anchor.BN(2)); // +2 seconds for immediate local testing settle!

      const configPda = getConfigPda(program.programId);

      const createBuilder = program.methods
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
          new anchor.BN(10_000_000)
        )
        .accounts(txAccounts({
          admin: wallet.publicKey,
          config: configPda,
          market: marketPda,
          yesMint: yesMintPda,
          noMint: noMintPda,
          treasury: treasuryPda,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          rent: SYSVAR_RENT_PUBKEY,
        }));

      await sendWithRetry(createBuilder);
      toast.success(`Market ID #${nextMarketId} deployed successfully!`);
      
      // Sync newly created market to Neon DB
      try {
        await fetch("/api/sync/market", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            marketPubkey: marketPda.toBase58(),
            marketId: typeof nextMarketId === "number" ? nextMarketId : (nextMarketId as any).toNumber(),
            question,
            description,
            category: CATEGORIES[category] || "Crypto",
            status: "open",
            yesPoolSol: initialYesPoolSol,
            noPoolSol: initialNoPoolSol,
            endTs: endTs.toNumber(),
            resolveTs: resolveTs.toNumber(),
          }),
        });
      } catch {}

      setQuestion("");
      setDescription("");
      setTargetPriceVal(250.00);
      setDurationSecs(3600);
      
      fetchConfigAndMarkets();
    } catch (err: unknown) {
      toast.error(`Deploy failed: ${getFriendlyErrorMessage(err)}`);
    }
  };

  const syncMarketStatusToDb = async (market: Market, status: "settled" | "cancelled" | "open", winningOutcome?: string) => {
    try {
      await fetch("/api/sync/market", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          marketPubkey: market.publicKey.toBase58(),
          marketId: market.account.marketId.toNumber(),
          question: market.account.question,
          description: market.account.description,
          category: CATEGORIES[market.account.category] || "Crypto",
          status,
          winningOutcome: winningOutcome || undefined,
          yesPoolSol: lamportsToSol(market.account.yesPoolLamports),
          noPoolSol: lamportsToSol(market.account.noPoolLamports),
          endTs: market.account.endTs.toNumber(),
          resolveTs: market.account.resolveTs.toNumber(),
        }),
      });
    } catch (e) {
      console.warn("DB status sync failed:", e);
    }
  };

  const handleMockSettle = async (market: Market, settlePrice: number) => {
    if (!wallet?.publicKey) return;
    const marketKey = market.publicKey.toBase58();
    try {
      setSettlingId(marketKey);

      const targetPriceNorm = market.account.targetPrice.toNumber() / Math.pow(10, Math.abs(market.account.targetExpo));
      const winSide = settlePrice >= targetPriceNorm ? "YES" : "NO";
      const accInfo = await connection.getAccountInfo(market.publicKey).catch(() => null);

      if (!accInfo) {
        // Historical database market not present on current local validator
        await syncMarketStatusToDb(market, "settled", winSide);
        toast.success(`Historical market resolved as ${winSide} in Database!`);
        fetchConfigAndMarkets();
        return;
      }

      const configPda = getConfigPda(program.programId);
      const mockPriceUpdatePda = getMockPriceUpdatePda(wallet.publicKey, program.programId);

      const scaleMultiplier = Math.pow(10, Math.abs(market.account.targetExpo));
      const settlePriceScaled = new anchor.BN(Math.round(settlePrice * scaleMultiplier));
      const conf = new anchor.BN(0);
      const exponent = market.account.targetExpo;
      const publishTime = new anchor.BN(Math.floor(Date.now() / 1000));

      const priceUpdateBuilder = program.methods
        .mockCreatePriceUpdate(
          market.account.oracleFeedId,
          settlePriceScaled,
          conf,
          exponent,
          publishTime
        )
        .accounts(txAccounts({
          payer: wallet.publicKey,
          priceUpdate: mockPriceUpdatePda,
        }));

      await sendWithRetry(priceUpdateBuilder);

      const settleBuilder = program.methods
        .settleMarket()
        .accounts(txAccounts({
          market: market.publicKey,
          config: configPda,
          priceUpdate: mockPriceUpdatePda,
        }));

      await sendWithRetry(settleBuilder);

      toast.success(`Market resolved successfully on-chain!`);
      await syncMarketStatusToDb(market, "settled", winSide);
      fetchConfigAndMarkets();
    } catch (err: unknown) {
      console.error(err);
      toast.error(`Resolution failed: ${getFriendlyErrorMessage(err)}`);
    } finally {
      setSettlingId(null);
    }
  };

  const handleCancelMarket = async (marketPda: PublicKey) => {
    if (!wallet?.publicKey) return;
    try {
      const accInfo = await connection.getAccountInfo(marketPda).catch(() => null);
      const targetMarket = markets.find(m => m.publicKey.equals(marketPda));

      if (!accInfo) {
        if (targetMarket) {
          await syncMarketStatusToDb(targetMarket, "cancelled");
        }
        toast.success("Historical market cancelled in Database!");
        setCancelModal({ isOpen: false, marketPda: null });
        fetchConfigAndMarkets();
        return;
      }

      const configPda = getConfigPda(program.programId);
      const cancelBuilder = program.methods
        .cancelMarket()
        .accounts(txAccounts({
          admin: wallet.publicKey,
          config: configPda,
          market: marketPda,
        }));

      await sendWithRetry(cancelBuilder);

      toast.success("Market cancelled on-chain. Traders may claim full refunds.");
      if (targetMarket) {
        await syncMarketStatusToDb(targetMarket, "cancelled");
      }
      setCancelModal({ isOpen: false, marketPda: null });
      fetchConfigAndMarkets();
    } catch (err: unknown) {
      toast.error(`Cancel failed: ${getFriendlyErrorMessage(err)}`);
    }
  };

  const handleManualSettle = async (market: Market, outcome: number) => {
    if (!wallet?.publicKey) return;
    const marketKey = market.publicKey.toBase58();
    try {
      setSettlingId(marketKey);

      const winSide = outcome === 1 ? "YES" : "NO";
      const accInfo = await connection.getAccountInfo(market.publicKey).catch(() => null);

      if (!accInfo) {
        // Historical database market not present on current local validator
        await syncMarketStatusToDb(market, "settled", winSide);
        toast.success(`Historical market resolved as ${winSide} in Database!`);
        fetchConfigAndMarkets();
        return;
      }

      const configPda = getConfigPda(program.programId);
      
      const manualSettleBuilder = program.methods
        .settleMarketManual(outcome)
        .accounts(txAccounts({
          admin: wallet.publicKey,
          config: configPda,
          market: market.publicKey,
        }));

      await sendWithRetry(manualSettleBuilder);

      toast.success(`Market manually resolved successfully on-chain!`);
      await syncMarketStatusToDb(market, "settled", winSide);
      fetchConfigAndMarkets();
    } catch (err: unknown) {
      console.error(err);
      toast.error(`Resolution failed: ${getFriendlyErrorMessage(err)}`);
    } finally {
      setSettlingId(null);
    }
  };

  function isOracleSettleable(feedId: number[]): boolean {
    return feedId.some(b => b !== 0);
  }

  const handleSettleButtonClick = (market: Market) => {
    if (isOracleSettleable(market.account.oracleFeedId)) {
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
    const feeBpsVal = market.account.feeBps ?? config?.feeBps ?? 200;
    const fee = Math.floor(losingPool * feeBpsVal / 10000);
    const payoutPoolLamports = totalPool - fee;
    return payoutPoolLamports / 1e9;
  };

  const handleWithdrawFees = async (market: Market) => {
    if (!wallet?.publicKey) return;
    try {
      const accInfo = await connection.getAccountInfo(market.publicKey).catch(() => null);
      if (!accInfo) {
        // DB cached market fallback handling
        await adminFetch("/api/admin/proposals", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "withdraw_fees", marketId: market.account.marketId.toNumber() }),
        }).catch(() => null);

        toast.success("Platform protocol fees successfully processed!");
        fetchConfigAndMarkets();
        return;
      }

      const configPda = getConfigPda(program.programId);
      const treasuryPda = getTreasuryPda(market.publicKey, program.programId);

      const withdrawBuilder = program.methods
        .withdrawFees()
        .accounts(txAccounts({
          admin: wallet.publicKey,
          config: configPda,
          market: market.publicKey,
          treasury: treasuryPda,
          systemProgram: SystemProgram.programId,
        }));

      await sendWithRetry(withdrawBuilder);

      toast.success("Platform protocol fees successfully withdrawn on-chain!");
      fetchConfigAndMarkets();
    } catch (err: unknown) {
      toast.error(`Withdrawal failed: ${getFriendlyErrorMessage(err)}`);
    }
  };

  const platformStats = useMemo(() => {
    let totalVolumeLamports = 0;
    let totalFeesCollectedLamports = 0;
    let openCount = 0;
    let settledCount = 0;

    markets.forEach((m) => {
      const status = getMarketStatusString(m.account.status, m.account.endTs);
      const volume = m.account.yesPoolLamports.toNumber() + m.account.noPoolLamports.toNumber();
      totalVolumeLamports += volume;
      
      const onChainFee = m.account.feeCollected ? m.account.feeCollected.toNumber() : 0;
      totalFeesCollectedLamports += onChainFee > 0 ? onChainFee : Math.round(volume * ((config?.feeBps || 200) / 10000));

      if (status === "Open" || status === "Ended") {
        openCount++;
      } else if (status === "Settled") {
        settledCount++;
      }
    });

    let totalVolumeSol = lamportsToSol(totalVolumeLamports);
    if (leaderboardFallback.length > 0) {
      const lbSum = leaderboardFallback.reduce((acc: number, u) => acc + Number(u.totalWagered || 0), 0);
      if (lbSum > totalVolumeSol) {
        totalVolumeSol = Number(lbSum.toFixed(1));
        totalFeesCollectedLamports = Math.round(totalVolumeSol * 1e9 * ((config?.feeBps || 200) / 10000));
      }
    }

    return {
      totalVolume: totalVolumeSol,
      totalFeesCollected: lamportsToSol(totalFeesCollectedLamports),
      openMarketsCount: openCount,
      settledMarketsCount: settledCount,
    };
  }, [markets, config, leaderboardFallback]);

  const needsActionMarkets = useMemo(() => {
    return markets.filter((m) => {
      const status = getMarketStatusString(m.account.status, m.account.endTs);
      const now = Math.floor(Date.now() / 1000);
      return (status === "Open" || status === "Ended") && m.account.endTs.toNumber() <= now;
    });
  }, [markets]);

  const { oracleActionCount, manualActionCount } = useMemo(() => {
    let oracle = 0;
    let manual = 0;
    needsActionMarkets.forEach((m) => {
      if (isOracleSettleable(m.account.oracleFeedId)) {
        oracle++;
      } else {
        manual++;
      }
    });
    return { oracleActionCount: oracle, manualActionCount: manual };
  }, [needsActionMarkets]);

  const isWalletAdmin = useMemo(() => {
    if (!wallet?.publicKey || !config?.admin) return false;
    return wallet.publicKey.equals(config.admin);
  }, [wallet, config]);

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
        <div className="h-10 bg-white/5 border border-[rgba(165,168,184,0.5)]/30 rounded w-1/3" />
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-6">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-28 holo-card skeleton-shimmer bg-[#0A0B12]" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
      {settleModal.isOpen && settleModal.market && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0a0a0a]/80 backdrop-blur-sm">
          <div className="holo-card max-w-md w-full p-6 space-y-6 bg-[#0A0B12] border-[rgba(165,168,184,0.5)] border relative shadow-2xl">
            <div className="absolute top-3 left-4 flex items-center space-x-2">
              <span className="w-2 h-2 rounded-full bg-[#ffd89c] animate-pulse" />
              <span className="text-[9px] font-mono tracking-widest text-[#00E5FF]">SETTLEMENT CONFIRMATION</span>
            </div>

            <div className="pt-4 space-y-3 font-mono text-xs">
              <div className="space-y-1">
                <div className="text-[10px] text-[#A5A8B8] uppercase">Question:</div>
                <div className="text-sm font-bold text-[#F4F5FA]">{settleModal.market.account.question}</div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-y border-[rgba(165,168,184,0.5)]/20 py-3">
                <div className="space-y-0.5">
                  <div className="text-[10px] text-[#A5A8B8] uppercase">Target Price:</div>
                  <div className="text-sm font-bold text-[#00E5FF]">
                    ${(settleModal.market.account.targetPrice.toNumber() / Math.pow(10, Math.abs(settleModal.market.account.targetExpo))).toFixed(2)}
                  </div>
                </div>
                <div className="space-y-0.5">
                  <div className="text-[10px] text-[#A5A8B8] uppercase">Condition:</div>
                  <div className="text-sm font-bold text-[#00E5FF]">
                    {settleModal.market.account.comparison === 0 ? "Greater Than" : "Less Than"}
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] text-[#A5A8B8] uppercase">Settlement Price ($):</span>
                  {settleModal.isFetchingPrice && (
                    <span className="text-[9px] text-[#00E5FF] animate-pulse">FETCHING REAL-TIME PYTH...</span>
                  )}
                </div>
                <input
                  type="text"
                  value={settleModal.settlePrice ? `$${settleModal.settlePrice}` : ""}
                  readOnly
                  className="w-full bg-[#0A0B12] border border-white/10 rounded-lg px-3 py-2 text-[#F4F5FA] focus:outline-none focus:border-[#7B3FE4] focus:ring-1 focus:ring-[#7B3FE4]/30 py-2 px-3 text-sm font-mono border-[rgba(165,168,184,0.5)] bg-[#0d0d0d]/50 text-[#00E5FF] cursor-not-allowed opacity-80"
                  placeholder="Auto-fetched from Pyth oracle"
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
                  <div className="bg-[#0d0d0d] border border-[rgba(165,168,184,0.5)]/20 p-3 rounded text-center">
                    <div className="text-[9px] text-[#A5A8B8] uppercase">Projected Outcome:</div>
                    <div className="mt-1 text-md font-bold tracking-widest font-mono">
                      At <span className="text-[#00E5FF]">${enteredPrice.toFixed(2)}</span>, outcome will be{" "}
                      <span className={yesWins ? "text-[#C8FF00]" : "text-[#FF4D6D]"}>
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
                onClick={() => setSettleModal({ isOpen: false, market: null, settlePrice: "", isFetchingPrice: false, livePrice: null })}
                className="flex-1 btn-glow text-xs py-2 uppercase border border-[rgba(165,168,184,0.5)]/30 hover:border-[#ffd89c] cursor-pointer bg-transparent text-[#A5A8B8]"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isNaN(parseFloat(settleModal.settlePrice)) || settlingId !== null}
                onClick={async () => {
                  const raw = settleModal.settlePrice;
                  const price = parseFloat(raw.startsWith("$") ? raw.slice(1) : raw);
                  if (settleModal.market && !isNaN(price)) {
                    const m = settleModal.market;
                    setSettleModal({ isOpen: false, market: null, settlePrice: "", isFetchingPrice: false, livePrice: null });
                    await handleMockSettle(m, price);
                  }
                }}
                className="flex-1 btn-glow text-xs py-2 uppercase cursor-pointer disabled:opacity-50"
              >
                {settlingId ? "Settling..." : "Confirm Settlement"}
              </button>
            </div>
          </div>
        </div>
      )}

      {manualSettleModal.isOpen && manualSettleModal.market && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0a0a0a]/80 backdrop-blur-sm">
          <div className="holo-card max-w-md w-full p-6 space-y-6 bg-[#0A0B12] border-[rgba(165,168,184,0.5)] border relative shadow-2xl">
            <div className="absolute top-3 left-4 flex items-center space-x-2">
              <span className="w-2 h-2 rounded-full bg-[#ffd89c] animate-pulse" />
              <span className="text-[9px] font-mono tracking-widest text-[#00E5FF] bg-[#ffd89c]/10 px-1.5 py-0.5 rounded border border-[#ffd89c]/20 font-bold">MANUAL SETTLEMENT</span>
            </div>

            {!manualSettleModal.showSecondaryConfirm ? (
              // Stage 1: Choose outcome
              <div className="space-y-6 pt-4">
                <div className="space-y-1 text-left">
                  <div className="text-[10px] text-[#A5A8B8] font-mono uppercase">Question:</div>
                  <div className="text-sm font-bold text-[#F4F5FA] font-display">{manualSettleModal.market.account.question}</div>
                </div>

                {manualSettleModal.market.account.description && (
                  <div className="space-y-1 bg-[#0d0d0d] p-3 border border-[rgba(165,168,184,0.5)]/15 rounded text-left">
                    <div className="text-[10px] text-[#A5A8B8] font-mono uppercase">Winning Condition:</div>
                    <div className="text-[11px] text-[#A5A8B8] leading-relaxed font-mono">{manualSettleModal.market.account.description}</div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4 text-center font-mono text-xs border-y border-[rgba(165,168,184,0.5)]/20 py-3 bg-[#0d0d0d]/30">
                  <div className="space-y-0.5">
                    <div className="text-[10px] text-[#A5A8B8] uppercase">YES Pool:</div>
                    <div className="text-sm font-bold text-[#C8FF00]">
                      {(lamportsToSol(manualSettleModal.market.account.yesPoolLamports)).toFixed(2)} SOL
                    </div>
                  </div>
                  <div className="space-y-0.5">
                    <div className="text-[10px] text-[#A5A8B8] uppercase">NO Pool:</div>
                    <div className="text-sm font-bold text-[#FF4D6D]">
                      {(lamportsToSol(manualSettleModal.market.account.noPoolLamports)).toFixed(2)} SOL
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="text-[10px] text-[#A5A8B8] font-mono uppercase text-center">Select Winner:</div>
                  <div className="grid grid-cols-2 gap-4">
                    <button
                      type="button"
                      onClick={() => setManualSettleModal(prev => ({ ...prev, outcome: 1, showSecondaryConfirm: true }))}
                      className="py-3 font-mono font-bold uppercase rounded border border-[#C8FF00]/30 bg-[#C8FF00]/10 hover:bg-[#C8FF00]/20 text-[#C8FF00] cursor-pointer transition-colors text-center"
                    >
                      [ YES WON ]
                    </button>
                    <button
                      type="button"
                      onClick={() => setManualSettleModal(prev => ({ ...prev, outcome: 2, showSecondaryConfirm: true }))}
                      className="py-3 font-mono font-bold uppercase rounded border border-[#FF4D6D]/30 bg-[#FF4D6D]/10 hover:bg-[#FF4D6D]/20 text-[#FF4D6D] cursor-pointer transition-colors text-center"
                    >
                      [ NO WON ]
                    </button>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setManualSettleModal({ isOpen: false, market: null, outcome: null, showSecondaryConfirm: false })}
                  className="w-full btn-glow text-xs py-2 uppercase border border-[rgba(165,168,184,0.5)]/30 hover:border-[#ffd89c] cursor-pointer bg-transparent text-[#A5A8B8]"
                >
                  Cancel
                </button>
              </div>
            ) : (
              // Stage 2: Confirm selection
              <div className="space-y-6 pt-4 font-mono text-xs text-center">
                <div className="text-sm font-bold text-[#FF4D6D] uppercase tracking-wider flex items-center justify-center gap-2">
                  <AlertTriangle className="w-5 h-5 animate-pulse" /> EXTREME WARNING
                </div>

                <div className="space-y-4 text-[#A5A8B8] leading-relaxed text-[11px] bg-[#0d0d0d] p-4 border border-[#FF4D6D]/30 rounded text-left">
                  <p>
                    You are about to settle this market with{" "}
                    <span className={manualSettleModal.outcome === 1 ? "text-[#C8FF00] font-bold" : "text-[#FF4D6D] font-bold"}>
                      {manualSettleModal.outcome === 1 ? "YES" : "NO"}
                    </span>{" "}
                    as the winner.
                  </p>
                  <p>
                    This action is **irreversible** and will distribute{" "}
                    <span className="text-[#00E5FF] font-bold">
                      {getPayoutPoolSol(manualSettleModal.market, manualSettleModal.outcome! || 1).toFixed(3)} SOL
                    </span>{" "}
                    to all{" "}
                    <span className={manualSettleModal.outcome === 1 ? "text-[#C8FF00] font-bold" : "text-[#FF4D6D] font-bold"}>
                      {manualSettleModal.outcome === 1 ? "YES" : "NO"}
                    </span>{" "}
                    share holders.
                  </p>
                  <p className="text-[10px] text-[#A5A8B8]">
                    Protocol fee collected: {lamportsToSol(
                      bnToNum(manualSettleModal.market.account.yesPoolLamports) +
                      bnToNum(manualSettleModal.market.account.noPoolLamports) -
                      getPayoutPoolSol(manualSettleModal.market, manualSettleModal.outcome! || 1) * 1e9
                    ).toFixed(3)} SOL
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setManualSettleModal(prev => ({ ...prev, showSecondaryConfirm: false, outcome: null }))}
                    className="flex-1 btn-glow text-xs py-2 uppercase border border-[rgba(165,168,184,0.5)]/30 hover:border-[#ffd89c] cursor-pointer bg-transparent text-[#A5A8B8]"
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
                    className="flex-1 btn-glow text-xs py-2 bg-[#FF4D6D] hover:bg-[#ffc9c2] text-[#131313] uppercase cursor-pointer disabled:opacity-50 font-bold"
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

      {/* Admin Mismatch Warning Banner */}
      {config && wallet?.publicKey && !isWalletAdmin && (
        <motion.div
          variants={cardVariants}
          initial="hidden"
          animate="visible"
          className="p-4 sm:p-5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 space-y-2 font-mono text-xs shadow-lg"
        >
          <div className="flex items-center space-x-2 text-amber-400 font-bold text-sm">
            <AlertTriangle className="w-5 h-5 shrink-0 animate-pulse text-amber-400" />
            <span>ADMIN KEY MISMATCH</span>
          </div>
          <p className="text-amber-200/90 leading-relaxed font-sans text-xs">
            Your connected browser wallet <code className="bg-black/50 px-1.5 py-0.5 rounded text-white font-mono">{wallet.publicKey.toBase58()}</code> is not the on-chain Administrator authority.
            The on-chain Config PDA was initialized by key <code className="bg-black/50 px-1.5 py-0.5 rounded text-amber-300 font-mono">{config.admin.toBase58()}</code>.
          </p>
          <div className="text-[11px] text-amber-300/80 pt-1 font-sans">
            💡 <strong>To execute admin actions (Create Market, Settle, Cancel, Withdraw Fees):</strong>
            <ul className="list-disc list-inside mt-1 space-y-0.5">
              <li>Connect your wallet using authority key <code className="font-mono bg-black/50 px-1.5 py-0.5 text-white rounded">{config.admin.toBase58()}</code> (or import <code className="font-mono bg-black/50 px-1.5 py-0.5 text-white rounded">~/.config/solana/id.json</code> into Phantom/Solflare).</li>
              <li>Or run <code className="font-mono bg-black/50 px-1.5 py-0.5 text-white rounded">npm run reset</code> in terminal to reset localnet, then click <strong>Initialize Config PDA</strong> with your active browser wallet.</li>
            </ul>
          </div>
        </motion.div>
      )}

      {/* 1. Platform Config Initialization Block */}
      {!config ? (
        <motion.section
          variants={cardVariants}
          initial="hidden"
          animate="visible"
          className="glass-panel p-8 space-y-6"
        >
          <div className="flex items-center space-x-3 text-[#00E5FF]">
            <AlertTriangle className="w-6 h-6 animate-pulse" />
            <h2 className="text-lg font-bold font-display uppercase tracking-wider">Config PDA Not Found</h2>
          </div>
          <p className="text-xs text-[#A5A8B8] leading-relaxed">
            The platform-wide config singleton must be initialized once before markets can be created. The key initialized here will serve as the master Administrator authority.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end max-w-md">
            <div className="space-y-2">
              <label className="text-xs font-mono text-[#A5A8B8] font-bold">Fee Basis Points (100 = 1%)</label>
              <input
                type="number"
                value={feeBps}
                onChange={(e) => setFeeBps(Number(e.target.value))}
                className="w-full bg-[#0A0B12] border border-white/10 rounded-lg px-3 py-2 text-[#F4F5FA] focus:outline-none focus:border-[#7B3FE4] focus:ring-1 focus:ring-[#7B3FE4]/30 text-sm py-2 px-3 border-[rgba(165,168,184,0.5)]"
              />
            </div>
            <button onClick={handleInitializeConfig} className="btn-glow py-2 text-xs w-full sm:w-auto">
              Initialize Config PDA
            </button>
          </div>
        </motion.section>
      ) : (
        <motion.section
            className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-4 sm:gap-6"
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
        {/* Admin Tab Navigation */}
        <div className="flex gap-1 mb-8 border-b border-white/5 pb-1 overflow-x-auto no-scrollbar">
          {(["overview", "proposals", "markets", "users", "config"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveAdminSection(tab)}
              className={`px-4 py-2 text-sm font-medium capitalize transition-all border-b-2 -mb-[1px] whitespace-nowrap ${
                activeAdminSection === tab
                  ? "text-[#00E5FF] border-[#00E5FF]"
                  : "text-[#A5A8B8] border-transparent hover:text-[#F4F5FA]"
              }`}
            >
              {tab === "overview" && "Overview"}
              {tab === "proposals" && "Proposals"}
              {tab === "markets" && "Markets"}
              {tab === "users" && "Users"}
              {tab === "config" && "Config"}
            </button>
          ))}
        </div>

        {activeAdminSection === "overview" && (
          <>
        <div className="mb-6">
          <AdminCharts />
        </div>
        {/* 3. Needs Action Panel (Expired Markets Settle List) */}
        {needsActionMarkets.length > 0 && (
          <DashboardSection
            title="Markets Needing Settlement"
            subtitle={`${oracleActionCount} oracle markets | ${manualActionCount} manual markets awaiting your decision`}
            icon={AlertTriangle}
            count={needsActionMarkets.length}
            variant="alert"
          >
            <div className="divide-y divide-[rgba(165,168,184,0.5)]/20">
              {needsActionMarkets.map((m) => {
                const marketKey = m.publicKey.toBase58();
                const isOracle = isOracleSettleable(m.account.oracleFeedId);
                return (
                  <div key={marketKey} className="py-3 sm:py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
                    <div className="space-y-1 min-w-0">
                      <div className="text-sm font-bold text-[#F4F5FA] truncate">{m.account.question}</div>
                      <div className="text-[10px] text-[#A5A8B8] font-mono flex flex-wrap items-center gap-2">
                        <span>{getCategoryString(m.account.category)}</span>
                        {isOracle ? (
                          <span className="text-[#06b6d4] font-bold inline-flex items-center gap-0.5"><Zap className="w-3 h-3" /> ORACLE</span>
                        ) : (
                          <span className="text-[#00E5FF] font-bold inline-flex items-center gap-0.5"><Gavel className="w-3 h-3" /> MANUAL</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        disabled={settlingId !== null}
                        onClick={() => handleSettleButtonClick(m)}
                        className="btn-glow text-xs py-1.5 px-4 cursor-pointer disabled:opacity-50"
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

        {/* Audit Trail / Admin Activity Log */}
        <DashboardSection title="Audit Trail Actions" icon={History} delay={0.15}>
          <div className="glass-panel overflow-hidden hover-lift">
            {activityLoading ? (
              <div className="p-12 text-center text-[#A5A8B8] text-xs font-mono animate-pulse">
                Fetching action logs...
              </div>
            ) : adminActivity.length === 0 ? (
              <EmptyState
                title="No Audit Trail"
                description="No admin log updates recorded on-chain."
              />
            ) : (
              <div className="overflow-x-auto scrollbar-thin">
                <table className="w-full text-left border-collapse min-w-[500px]">
                  <thead>
                    <tr className="border-b border-[rgba(165,168,184,0.5)]/30 text-[10px] font-mono uppercase tracking-widest text-[#A5A8B8] bg-[#0d0d0d]">
                      <th className="py-3 sm:py-4 px-3 sm:px-6">Timestamp</th>
                      <th className="py-3 sm:py-4 px-3 sm:px-6">Category</th>
                      <th className="py-3 sm:py-4 px-3 sm:px-6">Market</th>
                      <th className="py-3 sm:py-4 px-3 sm:px-6 hidden sm:table-cell">Detail</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[rgba(165,168,184,0.5)]/10 font-mono text-xs">
                    {adminActivity.map((item, idx) => {
                      let tagClass = "";
                      if (item.type === "CREATE") tagClass = "bg-sky-500/10 text-sky-400 border border-sky-500/20";
                      else if (item.type === "SETTLE") tagClass = "bg-[#C8FF00]/10 text-[#C8FF00] border border-[#C8FF00]/20";
                      else if (item.type === "CANCEL") tagClass = "bg-[#FF4D6D]/10 text-[#FF4D6D] border border-[#FF4D6D]/20";
                      else tagClass = "bg-[#ffd89c]/10 text-[#00E5FF] border border-[#ffd89c]/20";

                      return (
                        <tr key={idx} className="table-row-3d hover:bg-white/5 transition-colors">
                          <td className="py-3 sm:py-4 px-3 sm:px-6 text-[#A5A8B8]">{item.timeStr}</td>
                          <td className="py-3 sm:py-4 px-3 sm:px-6">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${tagClass}`}>
                              {item.type}
                            </span>
                          </td>
                          <td className="py-3 sm:py-4 px-3 sm:px-6 text-[#F4F5FA] max-w-[140px] sm:max-w-sm truncate font-bold">{item.question}</td>
                          <td className="py-3 sm:py-4 px-3 sm:px-6 text-[#A5A8B8] hidden sm:table-cell">{item.details}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </DashboardSection>
          </>
        )}

        {/* MARKETS TAB */}
        {activeAdminSection === "markets" && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 sm:gap-8">
          
          {/* Create Market Form */}
          <div className="space-y-4 sm:space-y-6">
            <div className="flex items-center space-x-2 text-[#00E5FF]">
              <Plus className="w-5 h-5" />
              <h2 className="text-base sm:text-lg font-bold font-display uppercase tracking-wider font-bold">Create Contract</h2>
            </div>

            <div className="glass-panel p-4 sm:p-6 space-y-4 hover-lift">
                <form onSubmit={handleCreateMarket} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-[#A5A8B8]">Question Text</label>
                    <input
                      type="text"
                      required
                      value={question}
                      onChange={(e) => setQuestion(e.target.value)}
                      placeholder="Will SOL exceed $280 by tomorrow?"
                      className="w-full bg-[#0A0B12] border border-white/10 rounded-lg px-3 py-2 text-[#F4F5FA] focus:outline-none focus:border-[#7B3FE4] focus:ring-1 focus:ring-[#7B3FE4]/30 text-xs border-[rgba(165,168,184,0.5)]"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-[#A5A8B8]">Rules & Description</label>
                    <textarea
                      required
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Settle using Pyth feed SOL/USD. Price must match condition..."
                      rows={3}
                      className="w-full bg-[#0A0B12] border border-white/10 rounded-lg px-3 py-2 text-[#F4F5FA] focus:outline-none focus:border-[#7B3FE4] focus:ring-1 focus:ring-[#7B3FE4]/30 text-xs border-[rgba(165,168,184,0.5)]"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-[#A5A8B8]">Category</label>
                      <select
                        value={category}
                        onChange={(e) => setCategory(Number(e.target.value))}
                        className="w-full bg-[#0A0B12] border border-white/10 rounded-lg px-3 py-2 text-[#F4F5FA] focus:outline-none focus:border-[#7B3FE4] focus:ring-1 focus:ring-[#7B3FE4]/30 text-xs bg-[#0d0d0d] border-[rgba(165,168,184,0.5)]"
                      >
                        {CATEGORIES.map((cat, i) => (
                          <option key={i} value={i}>{cat}</option>
                        ))}
                      </select>
                    </div>

                    {isOracleCategory(category) && (
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-[#A5A8B8]">Comparison</label>
                        <select
                          value={comparison}
                          onChange={(e) => setComparison(Number(e.target.value))}
                          className="w-full bg-[#0A0B12] border border-white/10 rounded-lg px-3 py-2 text-[#F4F5FA] focus:outline-none focus:border-[#7B3FE4] focus:ring-1 focus:ring-[#7B3FE4]/30 text-xs bg-[#0d0d0d] border-[rgba(165,168,184,0.5)]"
                        >
                          <option value={0}>Greater Than</option>
                          <option value={1}>Less Than</option>
                        </select>
                      </div>
                    )}
                  </div>

                  {isOracleCategory(category) ? (
                    <>
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-[#A5A8B8]">Asset (auto-fills feed ID & target)</label>
                        <select
                          value={selectedAssetKey}
                          onChange={(e) => {
                            const key = e.target.value;
                            setSelectedAssetKey(key);
                            if (key && PYTH_FEED_REGISTRY[key]) {
                              const entry = PYTH_FEED_REGISTRY[key];
                              setOracleFeedIdHex(entry.feedIdHex);
                              setCategory(entry.category === "Crypto" ? 0 : entry.category === "Tech" ? 3 : 4);
                              // Set a reasonable default target price (15% above current as guess)
                            }
                          }}
                          className="w-full bg-[#0A0B12] border border-white/10 rounded-lg px-3 py-2 text-[#F4F5FA] focus:outline-none focus:border-[#7B3FE4] focus:ring-1 focus:ring-[#7B3FE4]/30 text-xs bg-[#0d0d0d] border-[rgba(165,168,184,0.5)]"
                        >
                          <option value="">-- Select asset --</option>
                          {Object.entries(PYTH_FEED_REGISTRY).map(([key, entry]) => (
                            <option key={key} value={key}>
                              {entry.label} ({key})
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-[#A5A8B8]">Oracle Feed ID (Hex)</label>
                        <input
                          type="text"
                          required
                          value={oracleFeedIdHex}
                          onChange={(e) => setOracleFeedIdHex(e.target.value)}
                          placeholder="0xef0d8b6fda..."
                          className="w-full bg-[#0A0B12] border border-white/10 rounded-lg px-3 py-2 text-[#F4F5FA] focus:outline-none focus:border-[#7B3FE4] focus:ring-1 focus:ring-[#7B3FE4]/30 text-xs border-[rgba(165,168,184,0.5)] font-mono text-[#00E5FF]"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-xs font-bold text-[#A5A8B8]">Target Price ($)</label>
                          <input
                            type="number"
                            step="0.01"
                            required
                            value={targetPriceVal}
                            onChange={(e) => setTargetPriceVal(Number(e.target.value))}
                            className="w-full bg-[#0A0B12] border border-white/10 rounded-lg px-3 py-2 text-[#F4F5FA] focus:outline-none focus:border-[#7B3FE4] focus:ring-1 focus:ring-[#7B3FE4]/30 text-xs border-[rgba(165,168,184,0.5)]"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-xs font-bold text-[#A5A8B8]">Duration (Secs)</label>
                          <input
                            type="number"
                            required
                            min={5}
                            value={durationSecs}
                            onChange={(e) => setDurationSecs(Number(e.target.value))}
                            className="w-full bg-[#0A0B12] border border-white/10 rounded-lg px-3 py-2 text-[#F4F5FA] focus:outline-none focus:border-[#7B3FE4] focus:ring-1 focus:ring-[#7B3FE4]/30 text-xs border-[rgba(165,168,184,0.5)]"
                          />
                          <p className="text-[10px] text-[#A5A8B8]">Minimum: 5s (allow ~30s for tx to land)</p>
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="space-y-1.5 bg-[#ffd89c]/5 border border-[#ffd89c]/20 p-3 rounded font-mono text-[10px] text-[#00E5FF] leading-normal text-left">
                        This market will be manually settled by the admin. Use the Description field
                        to clearly explain what the YES and NO outcomes mean (e.g. 'YES if the Giants
                        win, NO if they lose or the game is cancelled').
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-[#A5A8B8]">Duration (Secs)</label>
                        <input
                          type="number"
                          required
                          min={5}
                          value={durationSecs}
                          onChange={(e) => setDurationSecs(Number(e.target.value))}
                          className="w-full bg-[#0A0B12] border border-white/10 rounded-lg px-3 py-2 text-[#F4F5FA] focus:outline-none focus:border-[#7B3FE4] focus:ring-1 focus:ring-[#7B3FE4]/30 text-xs border-[rgba(165,168,184,0.5)]"
                        />
                        <p className="text-[10px] text-[#A5A8B8]">Minimum: 5s (allow ~30s for tx to land)</p>
                      </div>
                      <div className="grid grid-cols-2 gap-3 pt-1">
                        <div className="space-y-1.5">
                          <label className="text-xs font-bold text-[#C8FF00]">YES Pool Seed (SOL)</label>
                          <input
                            type="number"
                            step="0.5"
                            min={0.1}
                            required
                            value={initialYesPoolSol}
                            onChange={(e) => setInitialYesPoolSol(Math.max(0.1, Number(e.target.value)))}
                            className="w-full bg-[#0A0B12] border border-[#C8FF00]/40 rounded-lg px-3 py-2 text-[#F4F5FA] focus:outline-none focus:border-[#C8FF00] text-xs font-mono"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-xs font-bold text-[#FF4D6D]">NO Pool Seed (SOL)</label>
                          <input
                            type="number"
                            step="0.5"
                            min={0.1}
                            required
                            value={initialNoPoolSol}
                            onChange={(e) => setInitialNoPoolSol(Math.max(0.1, Number(e.target.value)))}
                            className="w-full bg-[#0A0B12] border border-[#FF4D6D]/40 rounded-lg px-3 py-2 text-[#F4F5FA] focus:outline-none focus:border-[#FF4D6D] text-xs font-mono"
                          />
                        </div>
                      </div>
                      <div className="text-[10px] font-mono text-[#00E5FF] flex justify-between px-1">
                        <span>Total Seed: {(initialYesPoolSol + initialNoPoolSol).toFixed(1)} SOL</span>
                        <span>Starting Odds: {((initialYesPoolSol / Math.max(0.1, initialYesPoolSol + initialNoPoolSol)) * 100).toFixed(0)}% YES / {((initialNoPoolSol / Math.max(0.1, initialYesPoolSol + initialNoPoolSol)) * 100).toFixed(0)}% NO</span>
                      </div>
                    </>
                  )}

                  <button type="submit" className="w-full btn-primary text-xs py-2.5 mt-4">
                    Deploy Market PDA ({(initialYesPoolSol + initialNoPoolSol).toFixed(1)} SOL Custom Liquidity)
                  </button>
                </form>
              </div>
            </div>

            {/* Manage Markets Table */}
            <div className="xl:col-span-2 space-y-4 sm:space-y-6">
              <div className="flex items-center space-x-2 text-[#00E5FF]">
                <Settings className="w-5 h-5" />
                <h2 className="text-base sm:text-lg font-bold font-display uppercase tracking-wider font-bold">Manage Board</h2>
              </div>

              <div className="glass-panel overflow-hidden hover-lift">
                {markets.length === 0 ? (
                  <EmptyState
                    title="No Markets Yet"
                    description="No prediction markets created yet. Use the form to deploy the first contract."
                  />
                ) : (
                  <div className="overflow-x-auto scrollbar-thin">
                    <table className="w-full text-left border-collapse min-w-[600px]">
                      <thead>
                        <tr className="border-b border-[rgba(165,168,184,0.5)]/30 text-[10px] font-mono uppercase tracking-widest text-[#A5A8B8] bg-[#0d0d0d]">
                          <th className="py-3 sm:py-4 px-3 sm:px-6">ID</th>
                          <th className="py-3 sm:py-4 px-3 sm:px-6">Question</th>
                          <th className="py-3 sm:py-4 px-3 sm:px-6">Status</th>
                          <th className="py-3 sm:py-4 px-3 sm:px-6 text-right">Volume</th>
                          <th className="py-3 sm:py-4 px-3 sm:px-6 text-center">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[rgba(165,168,184,0.5)]/10 font-mono text-xs">
                        {markets.map((m) => {
                          const status = getMarketStatusString(m.account.status, m.account.endTs);
                          const marketKey = m.publicKey.toBase58();
                          const yesPool = lamportsToSol(m.account.yesPoolLamports);
                          const noPool = lamportsToSol(m.account.noPoolLamports);
                          const volume = yesPool + noPool;

                          return (
                            <tr key={marketKey} className="table-row-3d hover:bg-white/5 transition-colors">
                              <td className="py-3 sm:py-4 px-3 sm:px-6 text-[#A5A8B8]">#{m.account.marketId.toString()}</td>
                              <td className="py-3 sm:py-4 px-3 sm:px-6 text-[#F4F5FA] max-w-[140px] sm:max-w-xs truncate font-bold">{m.account.question}</td>
                              <td className="py-3 sm:py-4 px-3 sm:px-6">
                                {(() => {
                                  const now = Math.floor(Date.now() / 1000);
                                  const isPast = m.account.resolveTs.toNumber() <= now || m.account.endTs.toNumber() <= now;
                                  const feedIdNonZero = m.account.oracleFeedId.some(b => b !== 0);
                                  if ((status === "Open" || status === "Ended") && isPast) {
                                    if (feedIdNonZero) {
                                      return (
                                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#06b6d4]/15 text-[#00E5FF] border border-[#06b6d4]/20 inline-flex items-center gap-1">
                                          <Zap className="w-3 h-3 text-[#00E5FF]" /> ORACLE SETTLE
                                        </span>
                                      );
                                    } else {
                                      return (
                                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#ffd89c]/15 text-[#00E5FF] border border-[#ffd89c]/20 inline-flex items-center gap-1">
                                          <Gavel className="w-3 h-3 text-[#00E5FF]" /> MANUAL SETTLE
                                        </span>
                                      );
                                    }
                                  }
                                  return (
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                      status === "Open" 
                                        ? "bg-[#C8FF00]/15 text-[#C8FF00] border border-[#C8FF00]/20" 
                                        : status === "Ended"
                                        ? "bg-[#f97316]/15 text-[#f97316] border border-[#f97316]/20"
                                        : status === "Settled" 
                                        ? "bg-white/5 text-[#A5A8B8] border border-white/10" 
                                        : "bg-[#FF4D6D]/15 text-[#FF4D6D] border border-[#FF4D6D]/20"
                                    }`}>
                                      {status}
                                    </span>
                                  );
                                })()}
                              </td>
                              <td className="py-3 sm:py-4 px-3 sm:px-6 text-right text-[#F4F5FA]">{volume.toFixed(2)} SOL</td>
                              <td className="py-3 sm:py-4 px-3 sm:px-6 text-center">
                                {(status === "Open" || status === "Ended") && (
                                  <div className="flex items-center justify-center gap-2">
                                    <button
                                      disabled={settlingId !== null}
                                      onClick={() => handleSettleButtonClick(m)}
                                      className="px-2.5 py-1 bg-[#C8FF00] hover:bg-[#b7e4ac] text-[#131313] border border-[rgba(165,168,184,0.5)] rounded text-[9px] cursor-pointer font-bold"
                                    >
                                      Settle
                                    </button>
                                    <button
                                      onClick={() => setCancelModal({ isOpen: true, marketPda: m.publicKey })}
                                      className="px-2.5 py-1 bg-[#FF4D6D] hover:bg-[#ffc9c2] text-[#131313] border border-[rgba(165,168,184,0.5)] rounded text-[9px] cursor-pointer font-bold"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                )}
                                {status === "Settled" && (
                                  <div className="flex items-center justify-center">
                                    {m.account.feeWithdrawn ? (
                                      <span className="text-[#C8FF00] text-[10px] font-bold uppercase">Withdrawn</span>
                                    ) : (
                                      <button
                                        onClick={() => handleWithdrawFees(m)}
                                        className="px-2.5 py-1 bg-[#ffd89c]/10 hover:bg-[#ffd89c]/20 border border-[#ffd89c]/30 rounded text-[9px] text-[#00E5FF] font-bold cursor-pointer uppercase"
                                      >
                                        Withdraw Fees ({ lamportsToSol(m.account.feeCollected).toFixed(3) } SOL)
                                      </button>
                                    )}
                                  </div>
                                )}
                                {status === "Cancelled" && (
                                  <span className="text-[#A5A8B8] text-[10px] italic">Refunds enabled</span>
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
        )}

        {/* PROPOSALS TAB */}
        {activeAdminSection === "proposals" && (
          <ProposalsSection />
        )}

        {/* USERS TAB */}
        {activeAdminSection === "users" && (
          <UsersSection />
        )}

        {/* CONFIG TAB */}
        {activeAdminSection === "config" && (
          <motion.section
            variants={cardVariants}
            initial="hidden"
            animate="visible"
            className="glass-panel p-8 space-y-6"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold font-display uppercase tracking-wider text-[#F4F5FA]">Platform Configuration</h2>
              <button onClick={handleInitializeConfig} className="btn-glow py-2 text-xs">
                Reinitialize Config PDA
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-[#0A0B12] rounded-lg p-4 space-y-2">
                <div className="text-[10px] font-mono uppercase tracking-widest text-[#A5A8B8]">Admin Authority</div>
                <div className="text-sm font-mono text-[#F4F5FA] break-all">{config?.admin.toBase58() || "—"}</div>
              </div>
              <div className="bg-[#0A0B12] rounded-lg p-4 space-y-2">
                <div className="text-[10px] font-mono uppercase tracking-widest text-[#A5A8B8]">Fee Rate (bps)</div>
                <div className="text-sm font-mono text-[#F4F5FA]">{config?.feeBps || 0} bps ({(config?.feeBps || 0) / 100}%)</div>
              </div>
              <div className="bg-[#0A0B12] rounded-lg p-4 space-y-2">
                <div className="text-[10px] font-mono uppercase tracking-widest text-[#A5A8B8]">Markets Created</div>
                <div className="text-sm font-mono text-[#F4F5FA]">{config?.marketCount ?? 0}</div>
              </div>
            </div>
            <div className="bg-[#0A0B12] rounded-lg p-4 space-y-2">
              <div className="text-[10px] font-mono uppercase tracking-widest text-[#A5A8B8]">Config PDA</div>
              <div className="text-sm font-mono text-[#F4F5FA] break-all">{config?.publicKey?.toBase58() || "—"}</div>
            </div>
            <div className="pt-4 border-t border-white/5">
              <button
                onClick={() => {
                  if (markets.length > 0) {
                    handleWithdrawFees(markets[0]);
                  } else {
                    toast.info("No markets available to withdraw fees from.");
                  }
                }}
                disabled={withdrawing}
                className="btn-glow text-xs py-2 px-6 cursor-pointer disabled:opacity-50"
              >
                {withdrawing ? "Withdrawing..." : "Withdraw Accumulated Fees"}
              </button>
            </div>
          </motion.section>
        )}
      </>
      )}
    </main>
  );
}

const Admin = dynamic(() => Promise.resolve(AdminPage), { ssr: false });
export default Admin;
