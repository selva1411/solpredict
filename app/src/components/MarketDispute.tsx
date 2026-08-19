"use client";

import { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { toast } from "sonner";
import { AlertTriangle, Loader2, ChevronDown } from "lucide-react";
import { signUserProof, userFetch } from "@/lib/user-client";
const Loader = Loader2;

export function MarketDispute({
  marketPubkey,
  status,
}: {
  marketPubkey: string;
  status: string;
}) {
  const { publicKey, connected, signMessage } = useWallet();
  const [open, setOpen] = useState(false);
  const [outcome, setOutcome] = useState<"YES" | "NO">("YES");
  const [reason, setReason] = useState("");
  const [evidence, setEvidence] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (status !== "Settled") return null;

  const submit = async () => {
    if (!connected || !publicKey) {
      toast.error("Please connect your wallet to file a dispute.");
      return;
    }
    if (!reason.trim()) {
      toast.error("Please describe the reason for your dispute.");
      return;
    }
    setSubmitting(true);
    try {
      const auth = await signUserProof({ publicKey, signMessage }, signMessage);
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "x-wallet": publicKey.toBase58(),
      };
      if (auth) {
        headers["x-message"] = auth.message;
        headers["x-signature"] = auth.signature;
      }
      const res = await userFetch(`/api/markets/${marketPubkey}/disputes`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          claimedOutcome: outcome,
          reason,
          evidenceUrl: evidence || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data?.error || data?.message || "Failed to file dispute");
      }
      toast.success("Dispute filed. An admin will review it.");
      setOpen(false);
      setReason("");
      setEvidence("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to file dispute");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="glass-panel p-6 space-y-4 border-l-2 border-l-amber-500/60">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold uppercase tracking-wider font-display text-ash flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-400" />
          <span>Disagree with this resolution?</span>
        </h3>
        <button
          onClick={() => setOpen(!open)}
          className="px-3 py-1.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider bg-amber-500/10 border border-amber-500/40 text-amber-300 hover:bg-amber-500/20 transition-colors inline-flex items-center gap-1 cursor-pointer"
        >
          {open ? "Close" : "File a dispute"}
          <ChevronDown className={`w-3 h-3 transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
      </div>

      {open && (
        <div className="space-y-3 pt-1 text-xs font-mono">
          <div>
            <label className="text-[10px] uppercase tracking-wider text-ash mb-1.5 block">
              I believe the winning side should be
            </label>
            <div className="flex gap-2">
              {(["YES", "NO"] as const).map((o) => (
                <button
                  key={o}
                  onClick={() => setOutcome(o)}
                  className={`px-3 py-1.5 rounded-[2px] border font-bold transition-colors cursor-pointer ${
                    outcome === o
                      ? o === "NO"
                        ? "border-bordeaux bg-bordeaux/15 text-bordeaux"
                        : "border-verdigris bg-verdigris/15 text-verdigris"
                      : "border-[rgba(165,168,184,0.3)] text-ash hover:text-ivory"
                  }`}
                >
                  {o}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[10px] uppercase tracking-wider text-ash mb-1.5 block">
              Reason *
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              placeholder="Explain why this resolution is incorrect (oracle issue, wrong feed, etc.)"
              className="w-full bg-panel border border-hairline rounded-[2px] px-3 py-2 text-ivory placeholder-ash/50 focus:outline-none focus:border-amber-500/60 resize-none"
            />
          </div>

          <div>
            <label className="text-[10px] uppercase tracking-wider text-ash mb-1.5 block">
              Evidence / links (optional)
            </label>
            <input
              value={evidence}
              onChange={(e) => setEvidence(e.target.value)}
              placeholder="URL to a price chart, tweet, or other supporting reference"
              className="w-full bg-panel border border-hairline rounded-[2px] px-3 py-2 text-ivory placeholder-ash/50 focus:outline-none focus:border-amber-500/60"
            />
          </div>

          {!connected && (
            <p className="text-bordeaux text-[10px]">Connect a wallet to submit your dispute.</p>
          )}

          <button
            onClick={submit}
            disabled={submitting || !connected}
            className="w-full py-2 rounded-[2px] bg-amber-500 hover:bg-amber-400 text-black font-bold text-[11px] uppercase tracking-wider transition-colors disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2 cursor-pointer"
          >
            {submitting && <Loader className="w-3 h-3 animate-spin" />}
            Submit dispute for review
          </button>
        </div>
      )}
    </div>
  );
}