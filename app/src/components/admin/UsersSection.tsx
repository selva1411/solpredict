"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, Variants } from "framer-motion";
import { Users, Search, Loader2, ExternalLink } from "lucide-react";

const cardVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" } },
};

interface UserRow {
  wallet: string;
  username: string | null;
  avatarUrl: string | null;
  bio: string | null;
  twitterHandle: string | null;
  totalWagered: number;
  totalProfit: number;
  totalWon: number;
  marketsTraded: number;
  winRate: number;
  pasScore: number;
  lastActive: string | null;
  createdAt: string | null;
}

export function UsersSection() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/users");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setUsers(data.users ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load users");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const filtered = search
    ? users.filter(u =>
        u.wallet.toLowerCase().includes(search.toLowerCase()) ||
        u.username?.toLowerCase().includes(search.toLowerCase())
      )
    : users;

  if (loading) {
    return (
      <motion.section variants={cardVariants} initial="hidden" animate="visible" className="glass-panel p-8">
        <div className="flex items-center justify-center gap-3 text-[#A5A8B8]">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-xs font-mono">Loading users...</span>
        </div>
      </motion.section>
    );
  }

  if (error) {
    return (
      <motion.section variants={cardVariants} initial="hidden" animate="visible" className="glass-panel p-8">
        <p className="text-xs text-[#FF4D6D] font-mono">{error}</p>
      </motion.section>
    );
  }

  return (
    <motion.section variants={cardVariants} initial="hidden" animate="visible" className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2 text-[#00E5FF]">
          <Users className="w-5 h-5" />
          <h2 className="text-lg font-bold font-display uppercase tracking-wider text-[#F4F5FA]">
            Traders ({filtered.length})
          </h2>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#A5A8B8]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by wallet or username..."
            className="w-64 bg-[#0A0B12] border border-white/10 rounded-lg pl-9 pr-3 py-2 text-xs text-[#F4F5FA] focus:outline-none focus:border-[#7B3FE4]"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="glass-panel p-8 text-center">
          <p className="text-sm text-[#A5A8B8]">
            {search ? "No users match your search." : "No traders yet. Users appear when they place their first trade."}
          </p>
        </div>
      ) : (
        <div className="glass-panel overflow-hidden">
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full text-left border-collapse min-w-[650px]">
              <thead>
                <tr className="border-b border-white/5 text-[10px] font-mono uppercase tracking-widest text-[#A5A8B8] bg-[#0d0d0d]">
                  <th className="py-3 px-4">Wallet</th>
                  <th className="py-3 px-4">Username</th>
                  <th className="py-3 px-4 text-right">Wagered</th>
                  <th className="py-3 px-4 text-right">Profit</th>
                  <th className="py-3 px-4 text-right">Win Rate</th>
                  <th className="py-3 px-4 text-right">PAS</th>
                  <th className="py-3 px-4 text-right">Traded</th>
                  <th className="py-3 px-4 text-right hidden sm:table-cell">Last Active</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 font-mono text-xs">
                {filtered.map((u) => (
                  <tr key={u.wallet} className="hover:bg-white/5 transition-colors">
                    <td className="py-3 px-4">
                      <span className="text-[#00E5FF] text-[10px]">
                        {u.wallet.slice(0, 4)}...{u.wallet.slice(-4)}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-[#F4F5FA] font-bold">
                      {u.username || `${u.wallet.slice(0, 4)}...${u.wallet.slice(-4)}`}
                    </td>
                    <td className="py-3 px-4 text-right text-[#F4F5FA]">{u.totalWagered.toFixed(2)} SOL</td>
                    <td className={`py-3 px-4 text-right font-bold ${u.totalProfit >= 0 ? "text-[#C8FF00]" : "text-[#FF4D6D]"}`}>
                      {u.totalProfit >= 0 ? "+" : ""}{u.totalProfit.toFixed(2)} SOL
                    </td>
                    <td className="py-3 px-4 text-right text-[#F4F5FA]">{u.winRate.toFixed(1)}%</td>
                    <td className="py-3 px-4 text-right text-[#F4F5FA]">{u.pasScore}</td>
                    <td className="py-3 px-4 text-right text-[#F4F5FA]">{u.marketsTraded}</td>
                    <td className="py-3 px-4 text-right text-[#A5A8B8] text-[10px] hidden sm:table-cell">
                      {u.lastActive ? new Date(u.lastActive).toLocaleDateString() : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </motion.section>
  );
}
