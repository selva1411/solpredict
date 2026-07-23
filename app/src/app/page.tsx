"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useProgram } from "@/hooks/useProgram";
import { motion, type Variants } from "framer-motion";
import { GlassPanel } from "@/components/GlassPanel";
import { Coins, ArrowRight, Activity, Award, BarChart3 } from "lucide-react";
import { getFriendlyErrorMessage } from "@/lib/error-map";
import { lamportsToSol } from "@/lib/format";
import { toast } from "sonner";
import { getMarketStatusString } from "@/lib/events";
import { useUserRole } from "@/hooks/useUserRole";
import { PublicKey } from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";

interface MarketItem {
  publicKey: PublicKey;
  account: {
    marketId: anchor.BN;
    question: string;
    status: { open?: Record<string, never>; settled?: Record<string, never>; cancelled?: Record<string, never> };
    yesPoolLamports: anchor.BN;
    noPoolLamports: anchor.BN;
  };
}

const stagger: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08 } },
};

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.9 },
  visible: { opacity: 1, scale: 1, transition: { duration: 0.35 } },
};

function SplitFlapHero() {
  const line1 = "PREDICT THE FUTURE.";
  const line2 = "SETTLE THE BOARD.  ";

  return (
    <div className="flex flex-col items-center gap-4 py-6 font-mono select-none">
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

const FEATURES = [
  {
    icon: Coins,
    title: "Instant Liquidity",
    desc: "Order values escrowed into individual market vault PDAs. Collect rewards instantly once results are resolved.",
    color: "#ffd89c",
    bgClass: "bg-[#ffd89c]/10 border-[#ffd89c]/20 text-[#ffd89c]",
  },
  {
    icon: Activity,
    title: "Pyth Settlement",
    desc: "Decentralized validations verify target conditions without middleman consensus. Fully on-chain.",
    color: "#a1d494",
    bgClass: "bg-[#a1d494]/10 border-[#a1d494]/20 text-[#a1d494]",
  },
  {
    icon: Award,
    title: "Mechanical Ledger",
    desc: "Track win-rates, settled exposures, and personal chronological actions directly from logged smart contract events.",
    color: "#ffb4ab",
    bgClass: "bg-[#ffb4ab]/10 border-[#ffb4ab]/20 text-[#ffb4ab]",
  },
];

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

      let totalVolumeLamports = 0;
      let openCount = 0;
      let settledCount = 0;

      allMarkets.forEach((m) => {
        const status = getMarketStatusString(m.account.status, m.account.endTs);
        totalVolumeLamports += m.account.yesPoolLamports.toNumber() + m.account.noPoolLamports.toNumber();
        if (status === "Open") openCount++;
        if (status === "Settled") settledCount++;
      });

      const uniqueTraders = new Set(allPositions.map((p) => p.account.owner.toBase58())).size;

      setStats({
        volume: lamportsToSol(totalVolumeLamports),
        open: openCount,
        settled: settledCount,
        traders: uniqueTraders,
      });

      const openMarkets = allMarkets.filter((m) => getMarketStatusString(m.account.status, m.account.endTs) === "Open");
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
    <motion.div
      initial="hidden"
      animate="visible"
      variants={stagger}
      className="space-y-10 pb-12"
    >
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

      {/* Hero */}
      <motion.section variants={fadeUp} className="glass-panel p-6 sm:p-12 text-center space-y-6 relative overflow-hidden">
        <div className="absolute top-4 left-4 flex items-center space-x-2 z-10">
          <span className="w-2 h-2 rounded-full bg-[#ffd89c] animate-pulse" />
          <span className="text-[9px] font-mono font-bold tracking-widest text-[#ffd89c]">SOLPREDICT MAINFRAME</span>
        </div>

        <SplitFlapHero />

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8, duration: 0.5 }}
          className="max-w-2xl mx-auto space-y-6"
        >
          <p className="text-sm text-[#d6c4ac] leading-relaxed">
            Trade <strong className="text-[#e5e2e1]">YES/NO</strong> contracts on decentralized events.
            Fully on-chain order matching settled by trustless <strong className="text-[#06b6d4]">Pyth</strong> oracles.
          </p>
          <div className="flex justify-center gap-4">
            <Link
              href="/markets"
              className="group inline-flex items-center gap-2 bg-[#ffd89c] text-[#131313] font-bold font-display text-xs uppercase tracking-widest px-6 py-3 rounded border-2 border-[#9e8e78] shadow-[0_4px_0_#5f4100,0_4px_10px_rgba(0,0,0,0.4)] hover:bg-[#ffe6c2] active:translate-y-[3px] active:shadow-[0_1px_0_#5f4100,0_2px_4px_rgba(0,0,0,0.4)] transition-all duration-100"
            >
              Enter Terminal
              <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </Link>
            {role === "admin" && (
              <Link
                href="/admin"
                className="inline-flex items-center gap-2 bg-[#0d0d0d] text-[#ffd89c] font-bold font-display text-xs uppercase tracking-widest px-6 py-3 rounded border-2 border-[#9e8e78] hover:bg-[#1c1c1c] transition-all duration-100"
              >
                Control Panel
              </Link>
            )}
          </div>
        </motion.div>
      </motion.section>

      {/* Ticker */}
      {tickerMarkets.length > 0 && (
        <motion.section variants={fadeUp} className="glass-panel py-3 overflow-hidden relative select-none hover-lift">
          <div className="absolute left-0 top-0 bottom-0 w-16 bg-gradient-to-r from-[#131313] to-transparent z-10 pointer-events-none" />
          <div className="absolute right-0 top-0 bottom-0 w-16 bg-gradient-to-l from-[#131313] to-transparent z-10 pointer-events-none" />

          <div className="flex">
            <div className="flex space-x-12 animate-marquee cursor-pointer whitespace-nowrap">
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
        </motion.section>
      )}

      {/* Stats */}
      <motion.section variants={fadeUp} className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        {[
          { label: "Total Volume", suffix: "SOL", value: loading ? "0.0" : stats.volume.toFixed(1) },
          { label: "Open Board", suffix: "QTY", value: loading ? "0" : String(stats.open) },
          { label: "Settled Board", suffix: "QTY", value: loading ? "0" : String(stats.settled) },
          { label: "Active Pilots", suffix: "QTY", value: loading ? "0" : String(stats.traders) },
        ].map((stat, idx) => (
          <motion.div
            key={stat.label}
            variants={scaleIn}
            className="glass-panel p-5 flex flex-col justify-between h-28"
          >
            <div className="text-[9px] uppercase font-display tracking-widest text-[#d6c4ac] font-bold">
              {stat.label}
            </div>
            <div className="flex items-end justify-between">
              <span className="text-xs font-mono text-[#d6c4ac]/60">{stat.suffix}</span>
              <FlapText text={stat.value} />
            </div>
          </motion.div>
        ))}
      </motion.section>

      {/* Features */}
      <motion.section variants={fadeUp} className="space-y-6 pt-2">
        <div className="text-center space-y-1">
          <h2 className="text-lg sm:text-xl font-bold font-display text-[#e5e2e1] uppercase tracking-wider flex items-center justify-center gap-2">
            <BarChart3 className="w-5 h-5 text-[#ffd89c]" />
            Precision Markets Infrastructure
          </h2>
          <p className="text-xs text-[#d6c4ac]/60">
            State-of-the-art decentralized prediction mechanics on Solana.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
          {FEATURES.map((feature, idx) => (
            <motion.div
              key={feature.title}
              variants={fadeUp}
              custom={idx}
              className="glass-panel p-6 space-y-3 hover-lift"
            >
              <div className={`w-10 h-10 rounded flex items-center justify-center ${feature.bgClass}`}>
                <feature.icon className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold font-display text-[#e5e2e1] uppercase">
                {feature.title}
              </h3>
              <p className="text-xs text-[#d6c4ac] leading-relaxed">
                {feature.desc}
              </p>
            </motion.div>
          ))}
        </div>
      </motion.section>
    </motion.div>
  );
}
