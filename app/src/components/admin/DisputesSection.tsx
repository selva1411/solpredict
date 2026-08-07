"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, Variants } from "framer-motion";
import { Scale, Loader2, RefreshCw } from "lucide-react";
import { adminFetch } from "@/lib/admin-client";

const cardVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" } },
};

interface DisputeRow {
  id: number;
  marketPubkey: string;
  marketQuestion: string | null;
  disputer: string;
  reason: string;
  evidence: string | null;
  status: string;
  resolution: string | null;
  resolvedBy: string | null;
  createdAt: string | null;
  resolvedAt: string | null;
}

export function DisputesSection() {
  const [disputes, setDisputes] = useState<DisputeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [resolvingId, setResolvingId] = useState<number | null>(null);

  const fetchDisputes = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminFetch("/api/admin/disputes");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setDisputes(data.disputes ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load disputes");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchDisputes(); }, [fetchDisputes]);

  const resolveDispute = async (id: number, status: "resolved" | "rejected") => {
    const resolution = window.prompt(
      `Resolution note for dispute #${id} (optional):`,
      ""
    )?.trim() ?? null;
    setResolvingId(id);
    try {
      const res = await adminFetch("/api/admin/disputes", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status, resolution: resolution || undefined }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await fetchDisputes();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to resolve dispute");
    } finally {
      setResolvingId(null);
    }
  };

  if (loading) {
    return (
      <motion.section variants={cardVariants} initial="hidden" animate="visible" className="glass-panel p-8">
        <div className="flex items-center justify-center gap-3 text-[#808495]">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-xs font-mono">Loading disputes...</span>
        </div>
      </motion.section>
    );
  }

  return (
    <motion.section variants={cardVariants} initial="hidden" animate="visible" className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2 text-[#FFB454]">
          <Scale className="w-5 h-5" />
          <h2 className="text-lg font-bold font-display uppercase tracking-wider text-[#F4F4F9]">
            Disputes ({disputes.length})
          </h2>
        </div>
        <button
          onClick={fetchDisputes}
          className="inline-flex items-center gap-2 text-xs text-[#808495] hover:text-white transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh
        </button>
      </div>

      {error && <p className="text-xs text-[#E4574A] font-mono">{error}</p>}

      {disputes.length === 0 ? (
        <div className="glass-panel p-8 text-center">
          <p className="text-sm text-[#808495]">No disputes filed yet.</p>
        </div>
      ) : (
        <div className="glass-panel overflow-hidden">
          <div className="divide-y divide-white/5">
            {disputes.map((d) => (
              <div key={d.id} className="p-4 space-y-2">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-[#F4F4F9]">#{d.id}</span>
                    <span
                      className={`text-[10px] font-mono uppercase tracking-widest px-2 py-0.5 rounded ${
                        d.status === "pending"
                          ? "bg-amber-500/10 text-[#FFB454] border border-amber-500/20"
                          : d.status === "resolved"
                          ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                          : "bg-red-500/10 text-[#E4574A] border border-red-500/20"
                      }`}
                    >
                      {d.status}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-[#808495]">
                    {d.createdAt ? new Date(d.createdAt).toLocaleString() : "—"}
                  </span>
                </div>
                <p className="text-xs text-[#FFA500] font-mono break-all">{d.marketQuestion || d.marketPubkey}</p>
                <p className="text-xs text-[#F4F4F9]">
                  <span className="text-[#808495]">Disputer:</span>{" "}
                  <span className="font-mono">{d.disputer.slice(0, 6)}...{d.disputer.slice(-4)}</span>
                </p>
                <p className="text-xs text-[#808495]">Reason: {d.reason}</p>
                {d.evidence && <p className="text-[10px] text-[#808495] italic">Evidence: {d.evidence}</p>}
                {d.resolution && (
                  <p className="text-[10px] text-emerald-400 font-mono">
                    Resolution: {d.resolution} — by {d.resolvedBy}
                  </p>
                )}
                {d.status === "pending" && (
                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={() => resolveDispute(d.id, "resolved")}
                      disabled={resolvingId === d.id}
                      className="text-[10px] py-1 px-3 rounded-md border border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10 transition-colors disabled:opacity-50"
                    >
                      Resolve
                    </button>
                    <button
                      onClick={() => resolveDispute(d.id, "rejected")}
                      disabled={resolvingId === d.id}
                      className="text-[10px] py-1 px-3 rounded-md border border-red-500/40 text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50"
                    >
                      Reject
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </motion.section>
  );
}