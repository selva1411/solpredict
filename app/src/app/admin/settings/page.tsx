'use client';

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Settings, Save, RefreshCw, AlertTriangle, Power, PowerOff } from 'lucide-react';
import { adminFetch } from '@/lib/admin-client';
import { toast } from 'sonner';
import { useProgram } from '@/hooks/useProgram';
import { useWallet } from '@solana/wallet-adapter-react';
import { getConfigPda, getEmergencyPausePda } from '@/lib/pda';
import { txAccounts, sendWithRetry } from '@/lib/anchor-utils';
import { SystemProgram } from '@solana/web3.js';

interface Setting {
  key: string;
  value: string;
  label: string;
  description: string;
  type: 'text' | 'number' | 'boolean';
}

const SETTING_METADATA: Record<string, { label: string; description: string; type: 'text' | 'number' | 'boolean' }> = {
  feeBps:            { label: 'Trading Fee (bps)', description: '200 = 2%. Platform fee on each trade.', type: 'number' },
  platformName:      { label: 'Platform Name', description: 'Display name shown in the header.', type: 'text' },
  maintenanceMode:   { label: 'Maintenance Mode', description: 'Pause all trading (true/false).', type: 'boolean' },
  maxMarketDuration: { label: 'Max Market Duration (s)', description: 'Maximum duration for new markets in seconds.', type: 'number' },
  minLiquiditySol:   { label: 'Min Liquidity (SOL)', description: 'Minimum liquidity required to create a market.', type: 'number' },
  resolutionDelaySec:{ label: 'Resolution Delay (s)', description: 'Delay after endTs before market can be resolved.', type: 'number' },
  disputePeriodSec:  { label: 'Dispute Period (s)', description: 'Time window for users to dispute a resolution.', type: 'number' },
  adminWallet:       { label: 'Admin Wallet', description: 'Authorized admin wallet address.', type: 'text' },
  minMarketDuration: { label: 'Min Market Duration (s)', description: 'Minimum duration for new markets in seconds.', type: 'number' },
  twitterShareEnabled:{ label: 'Twitter Share Enabled', description: 'Allow tweet-to-share of outcomes.', type: 'boolean' },
};

export default function AdminSettingsPage() {
  const { program, wallet } = useProgram();
  const { publicKey } = useWallet();
  const [settings, setSettings] = useState<Setting[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [paused, setPaused] = useState(false);
  const [pauseLoading, setPauseLoading] = useState(false);

  useEffect(() => {
    adminFetch('/api/admin/settings')
      .then(r => r.ok ? r.json() : Promise.reject())
      .then((data) => {
        const raw: Record<string, string> = data.settings || {};
        const list = Object.entries(raw).map(([key, value]) => ({
          key,
          value,
          label: SETTING_METADATA[key]?.label || key,
          description: SETTING_METADATA[key]?.description || '',
          type: SETTING_METADATA[key]?.type || 'text',
        }));
        setSettings(list);
      })
      .catch(() => toast.error('Failed to load settings'))
      .finally(() => setLoading(false));
  }, []);

  // Surface on-chain emergency pause state (separate from DB maintenanceMode)
  useEffect(() => {
    if (!program) return;
    let cancelled = false;
    (async () => {
      try {
        const emergencyPda = getEmergencyPausePda(program.programId);
        const accounts = (program.account as unknown as { emergencyPause: { fetch(pda: ReturnType<typeof getEmergencyPausePda>): Promise<{ paused: boolean }> } });
        const acc = await accounts.emergencyPause.fetch(emergencyPda).catch(() => null);
        if (!cancelled) setPaused(!!acc?.paused);
      } catch {
        if (!cancelled) setPaused(false);
      }
    })();
    return () => { cancelled = true; };
  }, [program]);

  const handleEmergencyPause = async (pause: boolean) => {
    if (!program || !publicKey) { toast.error('Connect an admin wallet first'); return; }
    setPauseLoading(true);
    try {
      const configPda = getConfigPda(program.programId);
      const emergencyPda = getEmergencyPausePda(program.programId);
      const method = pause ? program.methods.emergencyPause() : program.methods.emergencyUnpause([]);
      const builder = method.accounts(txAccounts({
        admin: publicKey,
        config: configPda,
        emergencyPause: emergencyPda,
        systemProgram: SystemProgram.programId,
      }));
      await sendWithRetry(builder);
      setPaused(pause);
      toast.success(pause ? 'Emergency pause activated on-chain' : 'Program unpaused on-chain');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Pause/unpause failed');
    } finally {
      setPauseLoading(false);
    }
  };

  const saveSetting = async (key: string, value: string) => {
    setSaving(key);
    try {
      const res = await adminFetch('/api/admin/settings', {
        method: 'POST',
        body: JSON.stringify({ key, value }),
      });
      if (res.ok) {
        toast.success(`${key} updated`);
      } else {
        toast.error('Failed to save');
      }
    } catch {
      toast.error('Network error');
    } finally {
      setSaving(null);
    }
  };

  const updateValue = (key: string, newValue: string) => {
    setSettings(prev => prev.map(s => s.key === key ? { ...s, value: newValue } : s));
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="h-20 rounded-2xl bg-white/[0.03] border border-white/[0.06] animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <Settings className="w-5 h-5 text-amber-400" />
        <h2 className="text-xl font-bold text-white">Platform Settings</h2>
      </div>

      <div className="rounded-2xl bg-amber-500/10 border border-amber-500/20 p-4 flex items-start gap-3">
        <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-amber-300">
          Changes take effect immediately. Fee changes apply to new trades only.
        </p>
      </div>

      <div className={`rounded-2xl border p-5 ${
        paused
          ? "bg-red-500/10 border-red-500/30"
          : "bg-[#1A1C22] border-white/[0.06]"
      }`}>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Power className={`w-4 h-4 ${paused ? "text-red-400" : "text-gray-500"}`} />
              <label className="text-sm font-semibold text-white block">On-Chain Emergency Pause</label>
              {paused && (
                <span className="text-[10px] font-mono uppercase tracking-widest text-red-400 bg-red-500/10 border border-red-500/30 rounded px-1.5 py-0.5">
                  PAUSED
                </span>
              )}
            </div>
            <p className="text-xs text-gray-600 mb-3">
              Halts all non-admin trading on-chain. This is separate from the DB-only maintenanceMode flag above.
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => handleEmergencyPause(true)}
              disabled={pauseLoading || paused}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs hover:bg-red-500/20 transition-colors disabled:opacity-50"
            >
              <Power className="w-3.5 h-3.5" />
              Pause Program
            </button>
            <button
              onClick={() => handleEmergencyPause(false)}
              disabled={pauseLoading || !paused}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-green-500/10 border border-green-500/30 text-green-400 text-xs hover:bg-green-500/20 transition-colors disabled:opacity-50"
            >
              <PowerOff className="w-3.5 h-3.5" />
              Unpause
            </button>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {settings.map((setting, i) => (
          <motion.div
            key={setting.key}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }}
            className="rounded-2xl bg-[#1A1C22] border border-white/[0.06] p-5"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <label className="text-sm font-semibold text-white block mb-1">
                  {setting.label}
                </label>
                {setting.description && (
                  <p className="text-xs text-gray-600 mb-3">{setting.description}</p>
                )}
                {setting.type === 'boolean' ? (
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => updateValue(setting.key, 'true')}
                      className={`px-3 py-1.5 text-xs rounded-lg border transition-all ${
                        setting.value === 'true'
                          ? 'bg-green-500/20 border-green-500/40 text-green-400'
                          : 'bg-white/[0.03] border-white/[0.08] text-gray-500'
                      }`}
                    >
                      true
                    </button>
                    <button
                      onClick={() => updateValue(setting.key, 'false')}
                      className={`px-3 py-1.5 text-xs rounded-lg border transition-all ${
                        setting.value === 'false'
                          ? 'bg-red-500/20 border-red-500/40 text-red-400'
                          : 'bg-white/[0.03] border-white/[0.08] text-gray-500'
                      }`}
                    >
                      false
                    </button>
                  </div>
                ) : (
                  <input
                    type={setting.type === 'number' ? 'number' : 'text'}
                    value={setting.value}
                    onChange={e => updateValue(setting.key, e.target.value)}
                    className="input-glass text-sm"
                  />
                )}
              </div>
              <button
                onClick={() => saveSetting(setting.key, setting.value)}
                disabled={saving === setting.key}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs hover:bg-amber-500/20 transition-colors disabled:opacity-50 flex-shrink-0"
              >
                {saving === setting.key ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Save className="w-3.5 h-3.5" />
                )}
                Save
              </button>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
