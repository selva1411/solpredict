'use client';

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Settings, Save, RefreshCw, AlertTriangle } from 'lucide-react';
import { adminFetch } from '@/lib/admin-client';
import { toast } from 'sonner';

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
};

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<Setting[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

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
        <Settings className="w-5 h-5 text-cyan-400" />
        <h2 className="text-xl font-bold text-white">Platform Settings</h2>
      </div>

      <div className="rounded-2xl bg-amber-500/10 border border-amber-500/20 p-4 flex items-start gap-3">
        <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-amber-300">
          Changes take effect immediately. Fee changes apply to new trades only.
        </p>
      </div>

      <div className="space-y-4">
        {settings.map((setting, i) => (
          <motion.div
            key={setting.key}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }}
            className="rounded-2xl bg-[#0A0B12] border border-white/[0.06] p-5"
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
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs hover:bg-cyan-500/20 transition-colors disabled:opacity-50 flex-shrink-0"
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
