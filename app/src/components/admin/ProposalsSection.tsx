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
  /**
   * Full on-chain approve (approve_market tx + optional add_liquidity seed +
   * DB record). Called with the proposal and the liquidity amounts the admin
   * entered at approval time (0/0 = skip seeding). Falls back to DB-only if
   * not provided.
   */
  onApprove?: (proposal: Proposal, liquidity?: { yesSol: number; noSol: number }) => Promise<void>;
  /** Full on-chain reject (reject_market tx: closes proposal + slashes bond, then DB record). */
  onReject?: (proposal: Proposal) => Promise<void>;
}

export function ProposalsSection({ onApprove, onReject }: ProposalsSectionProps) {
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [approvalProposal, setApprovalProposal] = useState<Proposal | null>(null);
  const [yesLiquidity, setYesLiquidity] = useState("2.5");
  const [noLiquidity, setNoLiquidity] = useState("2.5");
  const [saving, setSaving] = useState(false);

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
        // Ask for initial liquidity AT approval time — a fresh market starts
        // with empty pools, so it has nothing for traders to buy into.
        setApprovalProposal(proposal);
        setYesLiquidity("2.5");
        setNoLiquidity("2.5");
        return;
      }
      if (action === "reject" && onReject && proposal) {
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

  async function confirmApproval(yesSol: number, noSol: number) {
    if (!approvalProposal || !onApprove) return;
    setSaving(true);
    try {
      await onApprove(approvalProposal, { yesSol, noSol });
      setProposals((prev) => prev.filter((p) => p.id !== approvalProposal.id));
      setApprovalProposal(null);
    } catch (err) {
      console.error("Proposal approval failed:", err);
      toast.error(err instanceof Error ? err.message : "Approval failed — the market may be partially created on-chain.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSeed() {
    const yesSol = parseFloat(yesLiquidity) || 0;
    const noSol = parseFloat(noLiquidity) || 0;
    if (yesSol <= 0 && noSol <= 0) {
      toast.error("Enter initial liquidity for at least one side (or use 'Approve without liquidity').");
      return;
    }
    await confirmApproval(yesSol, noSol);
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
                      : "bg-gold/10 text-gold"
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

      {/* Approve + seed-liquidity modal — asked at approval time */}
      {approvalProposal && onApprove && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => !saving && setApprovalProposal(null)}
          />
          <motion.div
            variants={cardVariants}
            initial="hidden"
            animate="visible"
            className="relative w-full max-w-md border border-gold/25 bg-obsidian p-6 shadow-2xl"
          >
            <h3 className="text-[16px] font-bold font-display uppercase tracking-wider text-ivory">
              Approve &amp; seed liquidity
            </h3>
            <p className="mt-2 text-[13px] text-ivory/90 leading-snug">
              &ldquo;{approvalProposal.question}&rdquo;
            </p>
            <p className="mt-3 text-[11px] text-ash leading-relaxed">
              Approving only creates the market with{' '}
              <span className="text-ivory">empty pools</span> — there is nothing
              for traders to buy into. Fund the YES and NO sides now so the
              market is tradable as soon as it launches.
            </p>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <label className="block space-y-1.5">
                <span className="text-[10px] uppercase tracking-wider text-ash font-mono">YES pool (SOL)</span>
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  value={yesLiquidity}
                  onChange={(e) => setYesLiquidity(e.target.value)}
                  disabled={saving}
                  className="w-full bg-black/40 border border-hairline px-3 py-2 text-sm text-verdigris font-mono focus:outline-none focus:border-verdigris/50 disabled:opacity-50"
                />
              </label>
              <label className="block space-y-1.5">
                <span className="text-[10px] uppercase tracking-wider text-ash font-mono">NO pool (SOL)</span>
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  value={noLiquidity}
                  onChange={(e) => setNoLiquidity(e.target.value)}
                  disabled={saving}
                  className="w-full bg-black/40 border border-hairline px-3 py-2 text-sm text-bordeaux font-mono focus:outline-none focus:border-verdigris/50 disabled:opacity-50"
                />
              </label>
            </div>
            <p className="mt-2 text-[10px] text-ash font-mono">
              Seeds both pools from your admin wallet via add_liquidity (1:1 LP tokens minted).
            </p>

            <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => confirmApproval(0, 0)}
                disabled={saving}
                className="px-3 py-1.5 text-[11px] font-mono text-ash border border-hairline hover:text-ivory hover:border-gold/40 transition-all disabled:opacity-40"
              >
                Approve without liquidity
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setApprovalProposal(null)}
                  disabled={saving}
                  className="px-3 py-1.5 text-[11px] font-mono text-ash border border-hairline hover:text-ivory transition-all disabled:opacity-40"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSeed}
                  disabled={saving}
                  className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-[2px] bg-verdigris/15 text-verdigris border border-verdigris/30 hover:bg-verdigris/25 transition-all disabled:opacity-50 cursor-pointer"
                >
                  {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  {saving ? "Approving…" : "Approve & Seed"}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </motion.section>
  );
}
