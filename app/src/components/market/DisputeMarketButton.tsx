"use client";

import { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { motion, AnimatePresence } from "framer-motion";
import { ShieldAlert, X, Gavel } from "lucide-react";
import { toast } from "sonner";
import { signUserProof, userFetch } from "@/lib/user-client";

interface DisputeMarketButtonProps {
  marketPubkey: string;
  /** Market status string — button only renders for settled markets. */
  status: string;
  settledAt?: string | null;
}

const DISPUTE_WINDOW_MS = 24 * 3600 * 1000;

/**
 * User-facing settlement dispute filing. Renders on settled markets while the
 * 24-hour dispute window is open; files against POST /api/markets/[id]/disputes
 * with a signed wallet-ownership proof.
 */
export function DisputeMarketButton({ marketPubkey, status, settledAt }: DisputeMarketButtonProps) {
  const { publicKey, signMessage } = useWallet();
  const [open, setOpen] = useState(false);
  const [claimedOutcome, setClaimedOutcome] = useState<"YES" | "NO">("YES");
  const [reason, setReason] = useState("");
  const [evidenceUrl, setEvidenceUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (status !== "Settled" && status !== "settled") return null;

  const withinWindow =
    !settledAt || Date.now() - new Date(settledAt).getTime() < DISPUTE_WINDOW_MS;

  if (!withinWindow) {
    return (
      <div className="flex items-center gap-2 label-lux">
        <ShieldAlert className="w-3.5 h-3.5 text-ash-dim" />
        Dispute window closed (24h after settlement)
      </div>
    );
  }

  const submit = async () => {
    if (reason.trim().length < 10) {
      toast.error("Explain the dispute in at least 10 characters");
      return;
    }
    setSubmitting(true);
    try {
      const auth = await signUserProof({ publicKey, signMessage }, signMessage);
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (auth) {
        headers["x-wallet"] = auth.wallet;
        headers["x-message"] = auth.message;
        headers["x-signature"] = auth.signature;
      }
      const res = await userFetch(`/api/markets/${marketPubkey}/disputes`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          claimedOutcome,
          reason: reason.trim(),
          ...(evidenceUrl.trim() ? { evidenceUrl: evidenceUrl.trim() } : {}),
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error ?? `HTTP ${res.status}`);
      }
      toast.success(data.message ?? "Dispute submitted for review");
      setOpen(false);
      setReason("");
      setEvidenceUrl("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to submit dispute");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 px-3.5 py-2 rounded border border-amber/40 bg-amber/[0.07] text-amber font-mono text-[11px] uppercase tracking-[.1em] cursor-pointer transition-all hover:bg-amber/15 hover:border-amber/70"
      >
        <Gavel className="w-3.5 h-3.5" />
        Dispute Settlement
      </button>

      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[70] bg-void/80 backdrop-blur-sm"
              onClick={() => !submitting && setOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: 24, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.98 }}
              transition={{ type: "spring", stiffness: 320, damping: 30 }}
              className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[80] w-full max-w-md surface-feature p-6"
              role="dialog"
              aria-modal="true"
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="label-lux !text-amber mb-1">Contest the outcome</div>
                  <h3 className="font-display text-[20px] font-semibold text-ivory">File a Dispute</h3>
                </div>
                <button onClick={() => !submitting && setOpen(false)} className="p-1.5 rounded hover:bg-panel-2 text-ash-dim hover:text-ivory transition-colors cursor-pointer">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {!publicKey ? (
                <p className="text-[13px] text-ash leading-relaxed py-2">
                  Connect your wallet to file a dispute. Disputes are signed by the filer.
                </p>
              ) : (
                <div className="space-y-4">
                  <div>
                    <label className="label-lux block mb-2">You believe the winner is</label>
                    <div className="grid grid-cols-2 gap-2">
                      {(["YES", "NO"] as const).map((s) => (
                        <button
                          key={s}
                          onClick={() => setClaimedOutcome(s)}
                          className={`py-2.5 rounded border font-display font-bold text-[15px] uppercase tracking-wide cursor-pointer transition-all ${
                            claimedOutcome === s
                              ? s === "YES"
                                ? "border-verdigris bg-verdigris/10 text-verdigris"
                                : "border-bordeaux bg-bordeaux/10 text-bordeaux"
                              : "border-hairline bg-panel text-ash hover:text-ivory"
                          }`}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="label-lux block mb-2">Why is the settlement wrong?</label>
                    <textarea
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      rows={3}
                      maxLength={1000}
                      placeholder="Cite the oracle print, official source, or resolution criteria…"
                      className="w-full bg-panel border border-hairline rounded px-3 py-2 text-[13px] font-mono text-ivory placeholder:text-ash-dim focus:outline-none focus:border-amber/60 resize-none"
                    />
                    <div className="text-right text-[9px] font-mono text-ash-dim mt-0.5">{reason.length}/1000</div>
                  </div>

                  <div>
                    <label className="label-lux block mb-2">Evidence URL (optional)</label>
                    <input
                      value={evidenceUrl}
                      onChange={(e) => setEvidenceUrl(e.target.value)}
                      placeholder="https://…"
                      className="w-full bg-panel border border-hairline rounded px-3 py-2 text-[13px] font-mono text-ivory placeholder:text-ash-dim focus:outline-none focus:border-amber/60"
                    />
                  </div>

                  <p className="text-[11px] text-ash-dim leading-relaxed">
                    A 0.1 SOL bond is recorded against this dispute and claims are frozen
                    pending admin review. Frivolous disputes may forfeit the bond.
                  </p>

                  <button
                    disabled={submitting || reason.trim().length < 10}
                    onClick={submit}
                    className="w-full h-11 rounded-md bg-gradient-to-r from-amber-400 to-amber-500 text-void font-mono text-[11px] uppercase tracking-[.14em] font-bold cursor-pointer transition-all hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {submitting ? "Submitting…" : "Submit Dispute"}
                  </button>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
