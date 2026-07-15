"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useProgram } from "@/hooks/useProgram";
import { motion } from "framer-motion";
import { Coins, HelpCircle, ArrowRight, Activity, Users, ShieldAlert, Award } from "lucide-react";
import { getFriendlyErrorMessage } from "@/lib/error-map";
import { toast } from "sonner";
import { getMarketStatusString } from "@/lib/events";
import { useUserRole } from "@/hooks/useUserRole";
import { PublicKey } from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";

interface MarketItem {
  publicKey: PublicKey;
  account: {
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
    status: { open?: Record<string, never>; settled?: Record<string, never>; cancelled?: Record<string, never> };
    winningOutcome: { unset?: Record<string, never>; yes?: Record<string, never>; no?: Record<string, never> };
    yesMint: PublicKey;
    noMint: PublicKey;
    yesPoolLamports: anchor.BN;
    noPoolLamports: anchor.BN;
    yesSupply: anchor.BN;
    noSupply: anchor.BN;
    totalPayoutPool: anchor.BN;
    sharePriceLamports: anchor.BN;
    feeCollected: anchor.BN;
    feeWithdrawn: boolean;
  };
}

function SplitFlapHero() {
  const line1 = "PREDICT THE FUTURE.";
  const line2 = "SETTLE THE BOARD.  ";

  return (
    <div className="flex flex-col items-center gap-4 py-8 font-mono select-none">
      <div className="flex gap-1.5 flex-wrap justify-center">
        {line1.split("").map((char, i) => (
          <div
            key={i}
            className="flap-tile w-7 h-10 sm:w-9 sm:h-14 flex items-center justify-center text-md sm:text-xl font-bold border-[#ffd89c]/40"
            style={{
              animation: "flip-tile 0.4s ease-in-out forwards",
              animationDelay: `${i * 0.04}s`,
            }}
          >
            {char}
          </div>
        ))}
      </div>
      <div className="flex gap-1.5 flex-wrap justify-center">
        {line2.split("").map((char, i) => (
          <div
            key={i}
            className="flap-tile w-7 h-10 sm:w-9 sm:h-14 flex items-center justify-center text-md sm:text-xl font-bold border-[#ffd89c]/40"
            style={{
              animation: "flip-tile 0.4s ease-in-out forwards",
              animationDelay: `${(line1.length + i) * 0.04}s`,
            }}
          >
            {char}
          </div>
        ))}
      </div>
    </div>
  );
}

function FlapText({ text }: { text: string }) {
  return (
    <div className="flex gap-0.5 font-mono">
      {text.split("").map((char, idx) => (
        <div
          key={idx}
          className="flap-tile w-5 h-8 flex items-center justify-center text-xs font-bold border-[#9e8e78]/40"
          style={{
            animation: "flip-tile 0.3s ease-out forwards",
            animationDelay: `${idx * 0.02}s`,
          }}
        >
          {char}
        </div>
      ))}
    </div>
  );
}

export default function LandingPage() {
  const { program, connection } = useProgram();
  const { role } = useUserRole();
  const [stats, setStats] = useState({ volume: 0, open: 0, settled: 0, traders: 0 });
  const [tickerMarkets, setTickerMarkets] = useState<MarketItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLandingData = async () => {
    try {
      setLoading(true);
      const [allMarkets, allPositions] = await Promise.all([
        program.account.market.all(),
        program.account.userPosition.all(),
      ]);

      // Calculate stats
      let totalVolumeLamports = 0;
      let openCount = 0;
      let settledCount = 0;

      allMarkets.forEach((m) => {
        const status = getMarketStatusString(m.account.status);
        totalVolumeLamports += m.account.yesPoolLamports.toNumber() + m.account.noPoolLamports.toNumber();
        if (status === "Open") openCount++;
        if (status === "Settled") settledCount++;
      });

      const uniqueTraders = new Set(allPositions.map((p) => p.account.owner.toBase58())).size;

      setStats({
        volume: totalVolumeLamports / 1e9,
        open: openCount,
        settled: settledCount,
        traders: uniqueTraders,
      });

      // Filter open markets for the ticker
      const openMarkets = allMarkets.filter((m) => getMarketStatusString(m.account.status) === "Open");
      setTickerMarkets(openMarkets);
    } catch (err: unknown) {
      console.error("Error loading landing data:", err);
      toast.error(`Failed to sync stats: ${getFriendlyErrorMessage(err)}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLandingData();
    const sub = connection.onLogs(program.programId, () => fetchLandingData(), "confirmed");
    return () => { connection.removeOnLogsListener(sub); };
  }, [program, connection]);

  const doubleTickerMarkets = [...tickerMarkets, ...tickerMarkets, ...tickerMarkets];

  return (
    <div className="space-y-12 animate-fade-in font-sans pb-12">
      <style>{`
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-33.33%); }
        }
        .animate-marquee {
          animation: marquee 35s linear infinite;
        }
        .animate-marquee:hover {
          animation-play-state: paused;
        }
      `}</style>

      {/* Hero display block */}
      <section className="board-panel p-6 sm:p-12 text-center space-y-6 bg-[#131313] border-[#9e8e78] relative">
        <div className="absolute top-4 left-4 flex items-center space-x-2">
          <span className="w-2.5 h-2.5 rounded-full bg-[#ffd89c] animate-pulse" />
          <span className="text-[10px] font-mono font-bold tracking-widest text-[#ffd89c]">SOLPREDICT MAINFRAME</span>
        </div>

        <SplitFlapHero />

        <div className="max-w-2xl mx-auto space-y-4">
          <p className="text-sm text-[#d6c4ac] leading-relaxed">
            Trade YES/NO contracts on decentralized events. Fully on-chain order matching settled by trustless Pyth validation. Fully secure, peer-to-peer.
          </p>
          <div className="flex justify-center gap-4 pt-4">
            <Link href="/markets" className="btn-primary text-xs font-semibold">
              Enter Terminal <ArrowRight className="w-4 h-4 inline pl-1" />
            </Link>
            {role === "admin" && (
              <Link href="/admin" className="btn-amber text-xs font-semibold">
                Control Panel
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* Ticker bar */}
      {tickerMarkets.length > 0 && (
        <section className="board-panel py-3 bg-[#131313] border-[#9e8e78]/40 overflow-hidden relative select-none">
          <div className="absolute left-0 top-0 bottom-0 w-16 bg-gradient-to-r from-[#131313] to-transparent z-10" />
          <div className="absolute right-0 top-0 bottom-0 w-16 bg-gradient-to-l from-[#131313] to-transparent z-10" />
          
          <div className="ticker-container flex">
            <div className="ticker-content flex space-x-12 animate-marquee cursor-pointer whitespace-nowrap">
              {doubleTickerMarkets.map((market, idx) => {
                const yesPool = market.account.yesPoolLamports.toNumber() / 1e9;
                const noPool = market.account.noPoolLamports.toNumber() / 1e9;
                const total = yesPool + noPool;
                const prob = total > 0 ? Math.round((yesPool / total) * 100) : 50;

                return (
                  <Link 
                    key={market.publicKey.toBase58() + "-" + idx} 
                    href={`/market/${market.publicKey.toBase58()}`}
                    className="flex items-center space-x-3 text-xs font-mono"
                  >
                    <span className="text-[#ffd89c] font-bold">[■]</span>
                    <span className="text-[#e5e2e1] hover:underline font-bold max-w-xs truncate">
                      {market.account.question}
                    </span>
                    <span className="text-[#a1d494] font-bold">YES {prob}%</span>
                    <span className="text-[#ffb4ab] font-bold">NO {100 - prob}%</span>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* Stats counter strip */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="board-panel p-5 flex flex-col justify-between h-28 bg-[#131313] border-[#9e8e78]/40">
          <div className="text-[9px] uppercase font-display tracking-widest text-[#d6c4ac] font-bold">Total Volume</div>
          <div className="flex items-end justify-between">
            <span className="text-xs font-mono text-[#d6c4ac]">SOL</span>
            <FlapText text={loading ? "0.0" : stats.volume.toFixed(1)} />
          </div>
        </div>

        <div className="board-panel p-5 flex flex-col justify-between h-28 bg-[#131313] border-[#9e8e78]/40">
          <div className="text-[9px] uppercase font-display tracking-widest text-[#d6c4ac] font-bold">Open Board</div>
          <div className="flex items-end justify-between">
            <span className="text-xs font-mono text-[#d6c4ac]">QTY</span>
            <FlapText text={loading ? "0" : String(stats.open)} />
          </div>
        </div>

        <div className="board-panel p-5 flex flex-col justify-between h-28 bg-[#131313] border-[#9e8e78]/40">
          <div className="text-[9px] uppercase font-display tracking-widest text-[#d6c4ac] font-bold">Settled Board</div>
          <div className="flex items-end justify-between">
            <span className="text-xs font-mono text-[#d6c4ac]">QTY</span>
            <FlapText text={loading ? "0" : String(stats.settled)} />
          </div>
        </div>

        <div className="board-panel p-5 flex flex-col justify-between h-28 bg-[#131313] border-[#9e8e78]/40">
          <div className="text-[9px] uppercase font-display tracking-widest text-[#d6c4ac] font-bold">Active Pilots</div>
          <div className="flex items-end justify-between">
            <span className="text-xs font-mono text-[#d6c4ac]">QTY</span>
            <FlapText text={loading ? "0" : String(stats.traders)} />
          </div>
        </div>
      </section>

      {/* Feature Highlighting Section */}
      <section className="space-y-6 pt-4">
        <div className="text-center">
          <h2 className="text-xl font-bold font-display text-[#e5e2e1] uppercase tracking-wider">
            [■] PRECISION MARKETS INFRASTRUCTURE
          </h2>
          <p className="text-xs text-[#d6c4ac]">State-of-the-art decentralized prediction mechanics.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="board-panel p-6 bg-[#131313] border-[#9e8e78]/30 space-y-3">
            <div className="w-10 h-10 rounded bg-[#ffd89c]/10 border border-[#ffd89c]/20 flex items-center justify-center text-[#ffd89c]">
              <Coins className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold font-display text-[#e5e2e1] uppercase">Instant Liquidity</h3>
            <p className="text-xs text-[#d6c4ac] leading-relaxed">
              Order values are escrowed into individual market vault PDAs. Collect rewards instantly once results are resolved.
            </p>
          </div>

          <div className="board-panel p-6 bg-[#131313] border-[#9e8e78]/30 space-y-3">
            <div className="w-10 h-10 rounded bg-[#a1d494]/10 border border-[#a1d494]/20 flex items-center justify-center text-[#a1d494]">
              <Activity className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold font-display text-[#e5e2e1] uppercase">Pyth Settlement</h3>
            <p className="text-xs text-[#d6c4ac] leading-relaxed">
              Decentralized validations verify target conditions without middleman consensus.
            </p>
          </div>

          <div className="board-panel p-6 bg-[#131313] border-[#9e8e78]/30 space-y-3">
            <div className="w-10 h-10 rounded bg-[#ffb4ab]/10 border border-[#ffb4ab]/20 flex items-center justify-center text-[#ffb4ab]">
              <Award className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold font-display text-[#e5e2e1] uppercase">Mechanical Ledger</h3>
            <p className="text-xs text-[#d6c4ac] leading-relaxed">
              Track win-rates, settled exposures, and personal chronological actions directly from logged smart contract events.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
