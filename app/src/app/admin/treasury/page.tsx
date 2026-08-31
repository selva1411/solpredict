'use client';

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { DollarSign, TrendingUp, Wallet, ArrowDownRight, RefreshCw, ExternalLink } from 'lucide-react';
import { adminFetch } from '@/lib/admin-client';

interface Withdrawal {
  amountSol: number;
  signature: string | null;
  createdAt: string;
}

interface TreasuryData {
  totalFeeCollectedSol: number;
  totalFeeWithdrawnSol: number;
  pendingFeesSol: number;
  totalTreasuryBalanceSol: number;
  marketsWithFees: number;
  totalTradeVolume: number;
  buyVolume: number;
  feeBps: number;
  feeSource: string;
  recentWithdrawals: Withdrawal[];
}

export default function AdminTreasuryPage() {
  const [data, setData] = useState<TreasuryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [recording, setRecording] = useState(false);

  const load = () => {
    setLoading(true);
    adminFetch('/api/admin/treasury')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((json) => setData(json.treasury as TreasuryData))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const handleRecordWithdrawal = async () => {
    const amountSol = data?.pendingFeesSol ?? 0;
    if (amountSol <= 0) return;
    const recipient = window.prompt(
      'Recipient wallet for the withdrawal (defaults to admin):',
      ''
    )?.trim();
    const signature = window.prompt(
      'On-chain withdraw transaction signature (paste the sig from the admin console):',
      ''
    )?.trim();

    setRecording(true);
    try {
      const res = await adminFetch('/api/admin/treasury', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amountSol, recipient: recipient || undefined, signature: signature || undefined }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      load();
    } catch {
      window.alert('Failed to record withdrawal. Check that the transaction confirmed.');
    } finally {
      setRecording(false);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-3 justify-between">
        <div className="flex items-center gap-3">
          <DollarSign className="w-5 h-5 text-verdigris" />
          <h2 className="text-[21px] font-bold text-ivory">Treasury Dashboard</h2>
        </div>
        <button
          onClick={load}
          className="inline-flex items-center gap-2 text-xs text-gray-400 hover:text-ivory transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-32 rounded-[2px] bg-panel border border-hairline animate-pulse" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4">
            {[
              { label: 'Fees Collected', value: `${(data?.totalFeeCollectedSol || 0).toFixed(4)} SOL`, icon: DollarSign, color: 'text-verdigris', bg: 'bg-verdigris/10' },
              { label: 'Fees Withdrawn', value: `${(data?.totalFeeWithdrawnSol || 0).toFixed(4)} SOL`, icon: ArrowDownRight, color: 'text-gold', bg: 'bg-gold/10' },
              { label: 'Pending Fees', value: `${(data?.pendingFeesSol || 0).toFixed(4)} SOL`, icon: Wallet, color: 'text-gold', bg: 'bg-gold/10' },
              { label: 'Trade Volume', value: `${(data?.totalTradeVolume || 0).toFixed(2)} SOL`, icon: TrendingUp, color: 'text-gold', bg: 'bg-gold/10' },
            ].map((card, i) => (
              <motion.div
                key={card.label}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="rounded-[2px] bg-panel border border-hairline p-5"
              >
                <div className="flex items-start justify-between mb-3">
                  <p className="text-xs text-ash uppercase tracking-wider">{card.label}</p>
                  <div className={`p-2 rounded-[2px] ${card.bg}`}>
                    <card.icon className={`w-4 h-4 ${card.color}`} />
                  </div>
                </div>
                <p className="text-2xl font-bold font-mono text-ivory">{card.value}</p>
              </motion.div>
            ))}
          </div>

          <div className="rounded-[2px] bg-panel border border-hairline p-6">
            <h3 className="text-[13px] font-semibold text-ivory mb-2">Fee Withdrawal</h3>
            <p className="text-xs text-ash mb-3">
              Fee data source: <span className="text-gray-300 font-mono">{data?.feeSource ?? '—'}</span>
            </p>
            <p className="text-xs text-ash mb-4">
              Execute the on-chain withdraw (Admin Console → Markets → Withdraw Fees), then record it here so the
              ledger stays accurate.
            </p>
            <div className="flex items-center gap-3">
              <div className="flex-1 px-4 py-3 rounded-[2px] bg-panel border border-hairline">
                <p className="text-xs text-ash">Available for withdrawal</p>
                <p className="text-[21px] font-bold font-mono text-ivory mt-0.5">
                  {(data?.pendingFeesSol || 0).toFixed(4)} SOL
                </p>
              </div>
              <button
                className="btn-primary whitespace-nowrap"
                onClick={handleRecordWithdrawal}
                disabled={recording || (data?.pendingFeesSol ?? 0) <= 0}
              >
                {recording ? 'Recording...' : 'Record Withdrawal'}
              </button>
            </div>
          </div>

          <div className="rounded-[2px] bg-panel border border-hairline p-6">
            <h3 className="text-[13px] font-semibold text-ivory mb-4">Withdrawal History</h3>
            {!data?.recentWithdrawals?.length ? (
              <p className="text-xs text-ash">No withdrawals recorded yet.</p>
            ) : (
              <div className="space-y-2">
                {data.recentWithdrawals.map((w, i) => (
                  <div key={i} className="flex items-center justify-between py-2 border-b border-white/[0.04] last:border-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[13px] text-ivory">{w.amountSol.toFixed(4)} SOL</span>
                      {w.signature ? (
                        <a
                          href={`https://explorer.solana.com/tx/${w.signature}${process.env.NEXT_PUBLIC_CLUSTER === 'devnet' ? '?cluster=devnet' : ''}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-[10px] font-mono text-gold hover:text-gold-lite"
                        >
                          {w.signature.slice(0, 12)}… <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      ) : (
                        <span className="text-[10px] font-mono text-ash-dim">no sig</span>
                      )}
                    </div>
                    <span className="text-[10px] font-mono text-ash">
                      {new Date(w.createdAt).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
