"use client";

import { useState, useEffect } from "react";
import { Award, TrendingUp, Flame, Zap, DollarSign, Star, Plus, Brain, Trophy, Vote, Crown, Lock } from "lucide-react";
import { useWallet } from "@solana/wallet-adapter-react";
import { ClientWalletButton } from "@/components/ClientWalletButton";

const ACHIEVEMENTS = [
  { key: "first_trade", icon: TrendingUp, title: "First Trade", desc: "Place your first trade" },
  { key: "first_win", icon: Award, title: "First Win", desc: "Win your first market" },
  { key: "streak_3", icon: Flame, title: "Hot Streak", desc: "Win 3 markets in a row" },
  { key: "streak_10", icon: Zap, title: "Unstoppable", desc: "Win 10 markets in a row" },
  { key: "whale_100", icon: DollarSign, title: "Whale", desc: "Single trade > $100" },
  { key: "whale_1k", icon: DollarSign, title: "Mega Whale", desc: "Single trade > $1,000" },
  { key: "early_adopter", icon: Star, title: "Early Adopter", desc: "Traded in first 30 days" },
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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!publicKey) { setLoading(false); return; }
    fetch(`/api/user/achievements?wallet=${publicKey.toBase58()}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.ok && data.achievements) {
          const map: Record<string, AchievementStatus> = {};
          data.achievements.forEach((a: any) => {
            map[a.key] = { key: a.key, unlocked: a.unlocked, progress: a.progress };
          });
          setStatuses(map);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [publicKey]);

  if (!publicKey) {
    return (
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
        <div className="holo-card p-12 text-center max-w-md mx-auto">
          <Award className="w-12 h-12 mx-auto mb-4 text-[#7B3FE4]" />
          <h2 className="font-display text-xl font-bold mb-2">Connect your wallet</h2>
          <p className="text-sm text-[#A5A8B8] mb-5">Connect to view your achievement gallery.</p>
          <ClientWalletButton />
        </div>
      </main>
    );
  }

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
      <div className="mb-8">
        <h1 className="font-display text-3xl sm:text-4xl font-bold mb-2">
          <span className="text-gradient">Rewards</span>
        </h1>
        <p className="text-[#A5A8B8]">Achievements and badges</p>
      </div>

      {loading ? (
        <div className="holo-card p-12 text-center text-[#A5A8B8]">Loading achievements...</div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {ACHIEVEMENTS.map((ach) => {
            const Icon = ach.icon;
            const status = statuses[ach.key] ?? { key: ach.key, unlocked: false, progress: 0 };
            return (
              <div
                key={ach.key}
                className={`holo-card p-5 flex flex-col items-center text-center gap-3 transition-all relative ${
                  status.unlocked ? "" : "opacity-50 grayscale"
                }`}
              >
                <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                  status.unlocked ? "bg-[#7B3FE4]/20" : "bg-white/5"
                }`}>
                  <Icon className={`w-6 h-6 ${status.unlocked ? "text-[#7B3FE4]" : "text-[#A5A8B8]"}`} />
                </div>
                <div>
                  <h3 className="font-display text-sm font-bold text-[#F4F5FA]">{ach.title}</h3>
                  <p className="text-xs text-[#A5A8B8] mt-1">{ach.desc}</p>
                </div>
                <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all bg-gradient-to-r from-[#7B3FE4] to-[#00E5FF]"
                    style={{ width: `${status.progress}%` }}
                  />
                </div>
                {!status.unlocked && (
                  <div className="absolute top-3 right-3">
                    <Lock className="w-3 h-3 text-[#A5A8B8]" />
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
