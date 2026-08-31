'use client';

import React, { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { motion } from 'framer-motion';
import {
  TrendingUp, Users, DollarSign, Activity, MessageSquare,
  BarChart3, RefreshCw,
  CheckCircle2, Clock, type LucideIcon,
} from 'lucide-react';
import { adminFetch } from '@/lib/admin-client';

const AdminCharts = dynamic(() => import('@/components/dashboard/AdminCharts').then(m => m.AdminCharts), { ssr: false });

interface DashboardData {
  stats: {
    markets: { total: number; open: number; resolved: number; totalVolume: number; totalLiquidity: number };
    trades: { total: number; volume24h: number };
    users: { total: number };
    comments: { total: number };
  };
  recent: {
    markets: Array<{ marketPubkey: string; question: string; category: string | null; status: string | null; createdAt: Date | null }>;
    trades: Array<{ id: number; trader: string; side: string | null; lamportsIn: number | null; blockTime: Date | null }>;
    topTraders: Array<{ wallet: string; username: string | null; volume: string | null; pnl: string | null }>;
  };
}

interface StatCardProps {
  title: string;
  value: string;
  sub?: string;
  icon: LucideIcon;
  color: 'gold' | 'verdigris' | 'amber' | 'green';
  delay?: number;
}

const colorMap = {
  gold:     { bg: 'bg-gold/10',  border: 'border-gold/20',  icon: 'text-gold',  wash: 'rgba(245,158,11,0.08)' },
  verdigris:{ bg: 'bg-gold/10',  border: 'border-gold/20',  icon: 'text-gold',  wash: 'rgba(245,158,11,0.08)' },
  amber:    { bg: 'bg-gold/10',  border: 'border-gold/20',  icon: 'text-gold',  wash: 'rgba(232,178,58,0.08)' },
  green:    { bg: 'bg-verdigris/10',  border: 'border-verdigris/20',  icon: 'text-verdigris',  wash: 'rgba(59,160,107,0.08)' },
};

function StatCard({ title, value, sub, icon: Icon, color, delay = 0 }: StatCardProps) {
  const c = colorMap[color];
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4, ease: 'easeOut' }}
      className={`relative overflow-hidden rounded-[2px] bg-panel border ${c.border} p-5 group`}
    >
      <div className="absolute inset-0 rounded-[2px] transition-opacity duration-500 opacity-0 group-hover:opacity-100"
           style={{ background: `radial-gradient(circle at 70% 30%, ${c.wash} 0%, transparent 60%)` }} />
      <div className="relative flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-xs text-ash uppercase tracking-wider font-medium mb-2">{title}</p>
          <p className="text-2xl font-bold text-ivory font-mono">{value}</p>
          {sub && <p className="text-xs text-ash-dim mt-1">{sub}</p>}
        </div>
        <div className={`p-2.5 rounded-[2px] ${c.bg} flex-shrink-0`}>
          <Icon className={`w-5 h-5 ${c.icon}`} />
        </div>
      </div>
    </motion.div>
  );
}

function RecentTable({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4, duration: 0.4 }}
      className="rounded-[2px] bg-panel border border-hairline p-5"
    >
      <h3 className="text-[13px] font-semibold text-ivory mb-4 flex items-center gap-2">
        <BarChart3 className="w-4 h-4 text-gold" />
        {title}
      </h3>
      {children}
    </motion.div>
  );
}

export default function AdminDashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchData = () => {
    setLoading(true);
    adminFetch('/api/admin/dashboard')
      .then(r => r.ok ? r.json() : Promise.reject(new Error(String(r.status))))
      .then((json) => {
        setData(json);
        setLastUpdated(new Date());
        setError(null);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchData(); }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-32 rounded-[2px] bg-panel border border-hairline animate-pulse" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="h-64 rounded-[2px] bg-panel border border-hairline animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-[2px] bg-bordeaux/10 border border-bordeaux/20 p-6 text-center">
        <p className="text-bordeaux text-[13px] mb-3">Failed to load dashboard: {error}</p>
        <button onClick={fetchData} className="text-xs px-4 py-2 rounded-[2px] bg-bordeaux/20 text-bordeaux hover:bg-bordeaux/30 transition-colors">
          Retry
        </button>
      </div>
    );
  }

  const stats = data?.stats;
  const recent = data?.recent;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[21px] font-bold text-ivory">Dashboard Overview</h2>
          {lastUpdated && (
            <p className="text-xs text-ash-dim mt-1">
              Updated {lastUpdated.toLocaleTimeString()}
            </p>
          )}
        </div>
        <button
          onClick={fetchData}
          className="flex items-center gap-2 text-xs px-3 py-2 rounded-[2px] bg-panel border border-hairline text-gray-400 hover:text-ivory hover:bg-ivory/5 transition-all"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh
        </button>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Markets"
          value={String(stats?.markets.total ?? 0)}
          sub={`${stats?.markets.open ?? 0} open · ${stats?.markets.resolved ?? 0} resolved`}
          icon={TrendingUp}
          color="gold"
          delay={0}
        />
        <StatCard
          title="24h Volume"
          value={`${(stats?.trades.volume24h ?? 0).toFixed(2)} SOL`}
          sub={`${stats?.trades.total ?? 0} total trades`}
          icon={DollarSign}
          color="verdigris"
          delay={0.05}
        />
        <StatCard
          title="Platform Users"
          value={String(stats?.users.total ?? 0)}
          icon={Users}
          color="amber"
          delay={0.1}
        />
        <StatCard
          title="Total Liquidity"
          value={`${(stats?.markets.totalLiquidity ?? 0).toFixed(1)} SOL`}
          sub={`${(stats?.markets.totalVolume ?? 0).toFixed(1)} SOL all-time`}
          icon={Activity}
          color="green"
          delay={0.15}
        />
      </div>

      {/* Secondary stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="rounded-[2px] bg-panel border border-hairline p-4 flex items-center gap-4">
          <div className="p-2.5 rounded-[2px] bg-gold/10">
            <MessageSquare className="w-5 h-5 text-gold" />
          </div>
          <div>
            <p className="text-xs text-ash uppercase tracking-wider">Comments</p>
            <p className="text-[21px] font-bold text-ivory font-mono">{stats?.comments.total ?? 0}</p>
          </div>
        </div>
        <div className="rounded-[2px] bg-panel border border-hairline p-4 flex items-center gap-4">
          <div className="p-2.5 rounded-[2px] bg-verdigris/10">
            <CheckCircle2 className="w-5 h-5 text-verdigris" />
          </div>
          <div>
            <p className="text-xs text-ash uppercase tracking-wider">Open Markets</p>
            <p className="text-[21px] font-bold text-ivory font-mono">{stats?.markets.open ?? 0}</p>
          </div>
        </div>
        <div className="rounded-[2px] bg-panel border border-hairline p-4 flex items-center gap-4">
          <div className="p-2.5 rounded-[2px] bg-gold/10">
            <Clock className="w-5 h-5 text-gold" />
          </div>
          <div>
            <p className="text-xs text-ash uppercase tracking-wider">Resolved</p>
            <p className="text-[21px] font-bold text-ivory font-mono">{stats?.markets.resolved ?? 0}</p>
          </div>
        </div>
      </div>

      {/* Charts */}
      <AdminCharts />

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Markets */}
        <RecentTable title="Recent Markets">
          {!recent?.markets.length ? (
            <p className="text-xs text-ash-dim py-6 text-center">No markets yet.</p>
          ) : (
            <div className="space-y-2">
              {recent.markets.map((m) => (
                <div key={m.marketPubkey} className="flex items-start gap-3 p-3 rounded-[2px] hover:bg-panel transition-colors">
                  <span className={`mt-0.5 w-2 h-2 rounded-[2px] flex-shrink-0 ${
                    m.status === 'open' ? 'bg-verdigris' :
                    m.status === 'settled' ? 'bg-gold' : 'bg-gray-600'
                  }`} />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-ivory truncate">{m.question}</p>
                    <p className="text-[10px] text-ash-dim mt-0.5">{m.category} · {m.status}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </RecentTable>

        {/* Top Traders */}
        <RecentTable title="Top Traders by Volume">
          {!recent?.topTraders.length ? (
            <p className="text-xs text-ash-dim py-6 text-center">No traders yet.</p>
          ) : (
            <div className="space-y-2">
              {recent.topTraders.map((t, i) => (
                <div key={t.wallet} className="flex items-center gap-3 p-2.5 rounded-[2px] hover:bg-panel transition-colors">
                  <span className="text-xs text-ash-dim font-mono w-5 text-right">{i + 1}</span>
                  <div className="w-7 h-7 rounded-[2px] bg-gradient-to-br from-gold to-gold-deep flex items-center justify-center text-[10px] font-bold text-ivory flex-shrink-0">
                    {t.wallet.slice(0, 2)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-ivory font-mono truncate">
                      {t.username || `${t.wallet.slice(0, 6)}…${t.wallet.slice(-4)}`}
                    </p>
                  </div>
                  <span className="text-xs text-gold font-mono flex-shrink-0">
                    {Number(t.volume || 0).toFixed(1)} SOL
                  </span>
                </div>
              ))}
            </div>
          )}
        </RecentTable>
      </div>
    </div>
  );
}
