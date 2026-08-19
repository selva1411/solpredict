"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, Variants } from "framer-motion";
import { Check, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { adminFetch } from "@/lib/admin-client";

const cardVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" } },
};

interface Proposal {
  id: string;
  creator: string;
  proposalPubkey: string;
  question: string;
  description: string;
  category: string;
  createdAt: string;
  status: "pending" | "approved" | "rejected";
}

interface ProposalsSectionProps {
  /** Full on-chain approve (approve_market tx + DB record). Falls back to DB-only if not provided. */
  onApprove?: (proposal: Proposal) => Promise<void>;
  /** Full on-chain reject (reject_market tx: closes proposal + slashes bond, then DB record). */
  onReject?: (proposal: Proposal) => Promise<void>;
}

export function ProposalsSection({ onApprove, onReject }: ProposalsSectionProps) {
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchProposals = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminFetch("/api/admin/proposals");
      if (!res.ok) {
        if (res.status === 401) {
          setError("Unauthorized – admin access required.");
          return;
        }
        throw new Error(`HTTP ${res.status}`);
      }
      const data = await res.json();
      setProposals(Array.isArray(data) ? data : (data.proposals ?? []));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load proposals");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProposals();
  }, [fetchProposals]);

  async function handleAction(id: string, action: "approve" | "reject") {
    setActionLoading(id);
    try {
      const proposal = proposals.find((p) => p.id === id);
      if (action === "approve" && onApprove && proposal) {
        await onApprove(proposal);
      } else if (action === "reject" && onReject && proposal) {
        await onReject(proposal);
      } else {
        const res = await adminFetch(`/api/admin/proposals`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, action }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
      }
      setProposals((prev) => prev.filter((p) => p.id !== id));
    } catch (err) {
      console.error("Proposal action failed:", err);
      toast.error(err instanceof Error ? err.message : "Proposal action failed");
    } finally {
      setActionLoading(null);
    }
  }

  if (loading) {
    return (
      <motion.section variants={cardVariants} initial="hidden" animate="visible" className="glass-panel p-8">
        <div className="flex items-center justify-center gap-3 text-ash">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-xs font-mono">Loading proposals...</span>
        </div>
      </motion.section>
    );
  }

  if (error) {
    return (
      <motion.section variants={cardVariants} initial="hidden" animate="visible" className="glass-panel p-8">
        <p className="text-xs text-bordeaux font-mono">{error}</p>
      </motion.section>
    );
  }

  if (proposals.length === 0) {
    return (
      <motion.section variants={cardVariants} initial="hidden" animate="visible" className="glass-panel p-8 text-center">
        <p className="text-[13px] text-ash">No proposals yet.</p>
      </motion.section>
    );
  }

  return (
    <motion.section variants={cardVariants} initial="hidden" animate="visible" className="space-y-4">
      <h2 className="text-[21px] font-bold font-display uppercase tracking-wider text-ivory">Market Proposals</h2>
      <div className="divide-y divide-hairline">
        {proposals.map((proposal) => (
          <div key={proposal.id} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1 min-w-0">
              <div className="text-[13px] font-bold text-ivory truncate">{proposal.question}</div>
              <div className="text-[10px] text-ash font-mono flex flex-wrap items-center gap-2">
                <span>by {proposal.creator.slice(0, 8)}...{proposal.creator.slice(-4)}</span>
                <span className="text-gold">|</span>
                <span>{proposal.category}</span>
                <span
                  className={`px-1.5 py-0.5 rounded text-[9px] uppercase tracking-wider ${
                    proposal.status === "approved"
                      ? "bg-verdigris/10 text-verdigris"
                      : proposal.status === "rejected"
                      ? "bg-bordeaux/10 text-bordeaux"
                      : "bg-amber-500/10 text-amber-400"
                  }`}
                >
                  {proposal.status}
                </span>
              </div>
            </div>
            {proposal.status === "pending" && (
              <div className="flex items-center gap-2 shrink-0">
                <button
                  disabled={actionLoading !== null}
                  onClick={() => handleAction(proposal.id, "approve")}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-[2px] bg-verdigris/10 text-verdigris border border-verdigris/20 hover:bg-verdigris/20 transition-all cursor-pointer disabled:opacity-50"
                >
                  {actionLoading === proposal.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                  Approve
                </button>
                <button
                  disabled={actionLoading !== null}
                  onClick={() => handleAction(proposal.id, "reject")}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-[2px] bg-bordeaux/10 text-bordeaux border border-bordeaux/20 hover:bg-bordeaux/20 transition-all cursor-pointer disabled:opacity-50"
                >
                  {actionLoading === proposal.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <X className="w-3 h-3" />}
                  Reject
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </motion.section>
  );
}
