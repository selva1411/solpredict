'use client';

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { DollarSign, TrendingUp, Wallet, ArrowDownRight, RefreshCw } from 'lucide-react';
import { adminFetch } from '@/lib/admin-client';

interface TreasuryData {
  totalFees: number;
  pendingWithdrawal: number;
  marketCount: number;
  totalVolume: number;
}

export default function AdminTreasuryPage() {
  const [data, setData] = useState<TreasuryData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminFetch('/api/admin/stats')
      .then(r => r.ok ? r.json() : Promise.reject())
      .then((json) => {
        setData({
          totalFees: (json.stats?.totalVolume || 0) * 0.02,
          pendingWithdrawal: 0,
          marketCount: json.stats?.totalMarkets || 0,
          totalVolume: json.stats?.totalVolume || 0,
        });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-3">
        <DollarSign className="w-5 h-5 text-green-400" />
        <h2 className="text-xl font-bold text-white">Treasury Dashboard</h2>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-32 rounded-2xl bg-white/[0.03] border border-white/[0.06] animate-pulse" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4">
            {[
              { label: 'Total Platform Fees', value: `${(data?.totalFees || 0).toFixed(2)} SOL`, icon: DollarSign, color: 'text-green-400', bg: 'bg-green-500/10' },
              { label: 'Total Volume', value: `${(data?.totalVolume || 0).toFixed(2)} SOL`, icon: TrendingUp, color: 'text-cyan-400', bg: 'bg-cyan-500/10' },
              { label: 'Markets Created', value: String(data?.marketCount || 0), icon: Wallet, color: 'text-purple-400', bg: 'bg-purple-500/10' },
              { label: 'Fee Rate', value: '2%', icon: ArrowDownRight, color: 'text-amber-400', bg: 'bg-amber-500/10' },
            ].map((card, i) => (
              <motion.div
                key={card.label}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="rounded-2xl bg-[#0A0B12] border border-white/[0.06] p-5"
              >
                <div className="flex items-start justify-between mb-3">
                  <p className="text-xs text-gray-500 uppercase tracking-wider">{card.label}</p>
                  <div className={`p-2 rounded-lg ${card.bg}`}>
                    <card.icon className={`w-4 h-4 ${card.color}`} />
                  </div>
                </div>
                <p className="text-2xl font-bold font-mono text-white">{card.value}</p>
              </motion.div>
            ))}
          </div>

          <div className="rounded-2xl bg-[#0A0B12] border border-white/[0.06] p-6">
            <h3 className="text-sm font-semibold text-white mb-4">Fee Withdrawal</h3>
            <p className="text-xs text-gray-500 mb-4">
              Accumulated fees are held in the on-chain treasury vault. Use the admin panel or Anchor CLI to withdraw.
            </p>
            <div className="flex items-center gap-3">
              <div className="flex-1 px-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                <p className="text-xs text-gray-500">Available for withdrawal</p>
                <p className="text-lg font-bold font-mono text-white mt-0.5">
                  {(data?.totalFees || 0).toFixed(4)} SOL
                </p>
              </div>
              <button
                className="btn-primary whitespace-nowrap"
                onClick={() => alert('Use the Admin Panel → Markets section to withdraw fees per-market.')}
              >
                <DollarSign className="w-4 h-4" />
                Withdraw All
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
