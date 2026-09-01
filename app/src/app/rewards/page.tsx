"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Award, TrendingUp, Flame, Zap, DollarSign, Plus, Brain, Trophy, Vote, Crown, Lock } from "lucide-react";
import { useWallet } from "@solana/wallet-adapter-react";
import { ClientWalletButton } from "@/components/ClientWalletButton";
import { keys } from "@/lib/api/keys";

const ACHIEVEMENTS = [
  { key: "first_trade", icon: TrendingUp, title: "First Trade", desc: "Place your first trade" },
  { key: "first_win", icon: Award, title: "First Win", desc: "Win your first market" },
  { key: "streak_3", icon: Flame, title: "Hot Streak", desc: "Win 3 markets in a row" },
  { key: "streak_10", icon: Zap, title: "Unstoppable", desc: "Win 10 markets in a row" },
  { key: "whale_100", icon: DollarSign, title: "Whale", desc: "Single trade > $100" },
  { key: "whale_1k", icon: DollarSign, title: "Mega Whale", desc: "Single trade > $1,000" },
  { key: "market_creator", icon: Plus, title: "Market Creator", desc: "Propose an approved market" },
  { key: "oracle_whisperer", icon: Brain, title: "Oracle Whisperer", desc: "Win 5 crypto markets" },
  { key: "sports_savant", icon: Trophy, title: "Sports Savant", desc: "Win 5 sports markets" },
  { key: "politico", icon: Vote, title: "Politico", desc: "Win 5 politics markets" },
  { key: "top_10_weekly", icon: Crown, title: "Top 10", desc: "Top 10 in weekly leaderboard" },
];

interface AchievementStatus {
  key: string;
  unlocked: boolean;
  progress: number;
}

export default function RewardsPage() {
  const { publicKey } = useWallet();
  const [statuses, setStatuses] = useState<Record<string, AchievementStatus>>({});

  const walletStr = publicKey?.toBase58() ?? null;

  const { isLoading } = useQuery({
    queryKey: keys.user.achievements(walletStr ?? "none"),
    queryFn: async () => {
      const r = await fetch(`/api/user/achievements?wallet=${walletStr}`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json();
      if (data?.ok && data.achievements) {
        const map: Record<string, AchievementStatus> = {};
        data.achievements.forEach((a: any) => {
          map[a.key] = { key: a.key, unlocked: a.unlocked, progress: a.progress };
        });
        setStatuses(map);
      }
      return data;
    },
    enabled: !!walletStr,
    staleTime: 30_000,
  });
  const loading = !!walletStr ? isLoading : false;

  if (!publicKey) {
    return (
      <main className="mx-auto w-full max-w-[1240px] px-6 py-14">
        <div className="surface p-12 text-center max-w-md mx-auto">
          <Award className="w-12 h-12 mx-auto mb-4 text-gold" />
          <h2 className="font-display text-[22px] font-semibold uppercase mb-2">Connect your wallet</h2>
          <p className="text-[13px] text-ash mb-5">Connect to view your achievement gallery.</p>
          <ClientWalletButton />
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-[1240px] px-6 py-14">
      <div className="mb-8">
        <h1 className="font-display text-[46px] font-semibold uppercase mb-2">
          <span className="text-gold-lite">Rewards</span>
        </h1>
        <p className="text-ash">Achievements and badges</p>
      </div>

      {loading ? (
        <div className="surface p-12 text-center text-ash">Loading achievements...</div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {ACHIEVEMENTS.map((ach) => {
            const Icon = ach.icon;
            const status = statuses[ach.key] ?? { key: ach.key, unlocked: false, progress: 0 };
            return (
              <div
                key={ach.key}
                className={`surface p-5 flex flex-col items-center text-center gap-3 transition-all relative ${
                  status.unlocked ? "" : "opacity-50 grayscale"
                }`}
              >
                <div className={`w-12 h-12 rounded-[2px] flex items-center justify-center ${
                  status.unlocked ? "bg-gold/20" : "bg-panel-2"
                }`}>
                  <Icon className={`w-6 h-6 ${status.unlocked ? "text-gold" : "text-ash"}`} />
                </div>
                <div>
                  <h3 className="font-display text-[13px] font-bold text-ivory">{ach.title}</h3>
                  <p className="text-xs text-ash mt-1">{ach.desc}</p>
                </div>
                <div className="w-full h-1.5 bg-panel-2 rounded-[2px] overflow-hidden">
                  <div
                    className="h-full rounded-[2px] transition-all bg-gradient-to-r from-gold to-gold"
                    style={{ width: `${status.progress}%` }}
                  />
                </div>
                {!status.unlocked && (
                  <div className="absolute top-3 right-3">
                    <Lock className="w-3 h-3 text-ash" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
