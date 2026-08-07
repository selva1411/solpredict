"use client";

import React, { useEffect, useState } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell,
} from "recharts";
import { adminFetch } from "@/lib/admin-client";

interface DailyVolumePoint {
  date: string;
  volume: number;
}

interface CategoryRow {
  category: string | null;
  count: number;
  volume: number;
}

interface StatsResponse {
  ok?: boolean;
  charts?: {
    dailyVolume?: DailyVolumePoint[];
    categoryBreakdown?: CategoryRow[];
  };
}

const COLORS = ["#FFA500", "#8b5cf6", "#f59e0b", "#ef4444", "#22c55e", "#f472b6", "#38bdf8", "#a3e635"];

export function AdminCharts() {
  const [data, setData] = useState<StatsResponse | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    adminFetch("/api/admin/stats")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((json: StatsResponse) => {
        if (!cancelled) setData(json);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => { cancelled = true; };
  }, []);

  const dailyVolume = data?.charts?.dailyVolume ?? [];
  const categoryBreakdown = data?.charts?.categoryBreakdown ?? [];

  if (error) {
    return (
      <div className="rounded-2xl bg-white/5 border border-white/10 p-6 text-xs text-[#808495]">
        Unable to load chart data.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="rounded-2xl bg-white/5 border border-white/10 p-5">
        <h3 className="text-xs font-bold uppercase tracking-wider font-display text-[#ffd89c] mb-4">
          Volume Trend (30 Days)
        </h3>
        {dailyVolume.length === 0 ? (
          <p className="text-xs text-[#808495] py-10 text-center">No trading volume in the last 30 days.</p>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={dailyVolume}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
              <XAxis dataKey="date" stroke="#808495" fontSize={10} tickFormatter={(v: string) => v.slice(5)} />
              <YAxis stroke="#808495" fontSize={10} tickFormatter={(v: number) => v.toFixed(1)} />
              <Tooltip
                contentStyle={{ background: "#1A1C22", border: "1px solid rgba(255,255,255,0.15)", borderRadius: "12px", fontSize: 12 }}
                labelFormatter={(l) => `Date: ${String(l)}`}
                formatter={(value) => [`${Number(value).toFixed(2)} SOL`, "Volume"]}
              />
              <Line type="monotone" dataKey="volume" stroke="#FFA500" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="rounded-2xl bg-white/5 border border-white/10 p-5">
        <h3 className="text-xs font-bold uppercase tracking-wider font-display text-[#ffd89c] mb-4">
          Category Breakdown
        </h3>
        {categoryBreakdown.length === 0 ? (
          <p className="text-xs text-[#808495] py-10 text-center">No markets cached yet.</p>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie
                data={categoryBreakdown}
                dataKey="volume"
                nameKey="category"
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={4}
              >
                {categoryBreakdown.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ background: "#1A1C22", border: "1px solid rgba(255,255,255,0.15)", borderRadius: "12px", fontSize: 12 }}
                formatter={(value, name) => [`${Number(value).toFixed(2)} SOL`, String(name)]}
              />
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
