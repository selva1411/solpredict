"use client";

import React, { useState, useCallback } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import * as anchor from "@coral-xyz/anchor";
import { useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";

import { useProgram } from "@/hooks/useProgram";
import { GlassPanel } from "@/components/GlassPanel";
import { getConfigPda, getProposalPda, getProposalVaultPda } from "@/lib/pda";
import { buildSignSendConfirm } from "@/lib/anchor-utils";
import { signUserProof, userFetch } from "@/lib/user-client";
import { fadeInUp, staggerContainer } from "@/lib/motion-variants";
import { lamportsToSol, solToLamports } from "@/lib/format";
import { normalizeOracleFeedId, isOracleCategory, PYTH_FEED_REGISTRY } from "@/lib/pyth-feeds";
import type { PythFeedEntry } from "@/lib/pyth-feeds";

const ORACLE_FEED_CATEGORY: Record<PythFeedEntry["category"], number> = {
  Crypto: 0,
  Tech: 3,
  Other: 4,
};

const PROPOSAL_BOND_SOL = 0.1;
const CATEGORIES = [
  { value: 0, label: "Crypto" },
  { value: 1, label: "Sports" },
  { value: 2, label: "Politics" },
  { value: 3, label: "Tech" },
  { value: 4, label: "Other" },
];
const COMPARISONS = [
  { value: 0, label: "Greater Than (>" },
  { value: 1, label: "Less Than (<" },
];
const DEFAULT_FEED_ID = "ef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d";

export default function CreateProposalPage() {
  const router = useRouter();
  const { program, connection } = useProgram();
  const { publicKey, signMessage } = useWallet();

  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [question, setQuestion] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState(0);
  const [oracleFeedId, setOracleFeedId] = useState(DEFAULT_FEED_ID);
  const [targetPrice, setTargetPrice] = useState("");
  const [targetExpo, setTargetExpo] = useState("-8");
  const [comparison, setComparison] = useState(0);
  const [selectedFeed, setSelectedFeed] = useState("SOL/USD");
  const [customFeed, setCustomFeed] = useState(false);
  const [endDate, setEndDate] = useState("");
  const [endTime, setEndTime] = useState("");
  const [resolveDate, setResolveDate] = useState("");
  const [resolveTime, setResolveTime] = useState("");
  const [sharePriceLamports, setSharePriceLamports] = useState("0.001");

  const feedIdBytes = (hex: string): number[] => {
    const cleaned = hex.replace(/^0x/i, "");
    const bytes: number[] = [];
    for (let i = 0; i < 32 && i * 2 + 1 < cleaned.length; i++) {
      bytes.push(parseInt(cleaned.substring(i * 2, i * 2 + 2), 16));
    }
    while (bytes.length < 32) bytes.push(0);
    return bytes;
  };

  const oracleCategory = isOracleCategory(category);
  const steps = oracleCategory
    ? ["Details", "Timing", "Oracle", "Review"]
    : ["Details", "Timing", "Review"];
  const availableFeeds = Object.values(PYTH_FEED_REGISTRY).filter(
    (f) => ORACLE_FEED_CATEGORY[f.category] === category
  );

  const handleCategoryChange = (v: number) => {
    setCategory(v);
    if (!isOracleCategory(v)) return;
    const feeds = Object.values(PYTH_FEED_REGISTRY).filter(
      (f) => ORACLE_FEED_CATEGORY[f.category] === v
    );
    const first = feeds[0] ?? { symbol: "SOL/USD", feedIdHex: DEFAULT_FEED_ID, expo: -8 };
    setSelectedFeed(first.symbol);
    setOracleFeedId(first.feedIdHex.replace(/^0x/i, ""));
    setTargetExpo(String(first.expo));
  };

  const handleFeedChange = (symbol: string) => {
    setSelectedFeed(symbol);
    const entry = PYTH_FEED_REGISTRY[symbol];
    if (!entry) return;
    setOracleFeedId(entry.feedIdHex.replace(/^0x/i, ""));
    setTargetExpo(String(entry.expo));
  };

  const handleSubmit = useCallback(async () => {
    if (!program || !publicKey) { toast.error("Connect your wallet first"); return; }
    setSubmitting(true);
    try {
      const configPda = getConfigPda(program.programId);
      const config = await program.account.config.fetch(configPda);
      const proposalId = config.marketCount as anchor.BN;
      const proposalPda = getProposalPda(proposalId, program.programId);
      const vaultPda = getProposalVaultPda(proposalId, program.programId);
      const endTimestamp = Math.floor(new Date(`${endDate}T${endTime}:00`).getTime() / 1000);
      const resolveTimestamp = Math.floor(new Date(`${resolveDate}T${resolveTime}:00`).getTime() / 1000);
      const sharePrice = solToLamports(parseFloat(sharePriceLamports));
      if (endTimestamp <= Math.floor(Date.now() / 1000) + 3600) { toast.error("End time must be at least 1 hour in the future"); setSubmitting(false); return; }
      if (resolveTimestamp < endTimestamp) { toast.error("Resolution time must be after end time"); setSubmitting(false); return; }
      const finalFeedHex = oracleCategory ? oracleFeedId : "0".repeat(64);
      const feedIdArr = feedIdBytes(finalFeedHex);
      const expo = Number(targetExpo);
      if (!Number.isInteger(expo)) { toast.error("Invalid exponent (must be an integer)"); setSubmitting(false); return; }
      // Send-first (build + sign + sendRawTransaction returns the signature
      // immediately, then confirmation runs in the background). Anchor's `.rpc()`
      // would block up to 30s waiting for confirmation and throw
      // `TransactionExpiredTimeoutError` even when the tx landed.
      const tx = await buildSignSendConfirm(
        program,
        program.methods
          .proposeMarket(question, description, category, feedIdArr, new anchor.BN(targetPrice), expo, comparison, new anchor.BN(endTimestamp), new anchor.BN(resolveTimestamp), new anchor.BN(sharePrice))
          .accounts({ proposer: publicKey, config: configPda, proposal: proposalPda, proposalVault: vaultPda, systemProgram: anchor.web3.SystemProgram.programId } as Record<string, unknown>)
      );
      toast.success("Market proposed on-chain!");
      // Record the proposal in the DB so it appears in the admin's proposal
      // review queue. The server verifies the on-chain tx + wallet proof before
      // inserting — so wait for confirmation first.
      try {
        await connection.confirmTransaction(tx, "confirmed");
        const proof = await signUserProof(
          { publicKey, signMessage },
          signMessage,
        );
        if (!proof) throw new Error("Wallet does not support message signing");
        const res = await userFetch("/api/markets/propose", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            question,
            description,
            category: CATEGORIES[category]?.label ?? "Other",
            closeTs: endTimestamp,
            // Send the canonical 64-char hex (strip 0x / default to zeros) so
            // the API's strict validation never rejects a landed on-chain tx.
            oracleFeedId: normalizeOracleFeedId(finalFeedHex) ?? "0".repeat(64),
            signature: tx,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          console.warn("Proposal recorded on-chain but DB record failed:", data);
          toast.info("Proposal is on-chain. The DB record will be retried — please contact an admin if it does not appear.");
        } else {
          toast.success("Market proposed successfully!");
        }
      } catch (err) {
        console.warn("Proposal DB sync failed (on-chain tx succeeded):", err);
        toast.info("Proposal is on-chain, but the DB record failed to sync.");
      }
      router.push(`/discover`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Transaction failed";
      toast.error(msg);
    } finally { setSubmitting(false); }
  }, [program, publicKey, question, description, category, oracleCategory, targetPrice, targetExpo, comparison, oracleFeedId, endDate, endTime, resolveDate, resolveTime, sharePriceLamports, router]);

  const canAdvance = (s: number): boolean => {
    switch (s) {
      case 0: return question.length >= 10;
      case 1: return endDate !== "" && endTime !== "" && resolveDate !== "" && resolveTime !== "";
      case 2: return oracleCategory ? targetPrice !== "" : true;
      default: return true;
    }
  };

  return (
    <main className="mx-auto w-full max-w-[1240px] px-6 py-14">
      <div className="max-w-2xl mx-auto">
        <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="space-y-8">
          <motion.div variants={fadeInUp}>
            <h1 className="font-display text-[26px] font-semibold mb-2">
              <span className="text-ivory">Propose a Market</span>
            </h1>
            <p className="text-ash">
              Submit a prediction market proposal. If approved, a market will be created.
            </p>
            <p className="text-[13px] text-verdigris mt-1">
              {PROPOSAL_BOND_SOL} SOL bond required (refunded if approved, slashed if rejected)
            </p>
          </motion.div>

          <div className="flex gap-2">
            {steps.map((label, i) => (
              <button key={label} onClick={() => i <= step && setStep(i)}
                className={`flex-1 py-2 text-[13px] font-medium rounded-[2px] transition-colors ${
                  i === step ? "bg-gold/20 text-gold border border-gold/30"
                    : i < step ? "bg-verdigris/10 text-verdigris"
                    : "bg-panel-2 text-ash"
                }`}>
                {label}
              </button>
            ))}
          </div>

          <div className="surface p-6 space-y-5">
            {step === 0 && (
              <motion.div variants={fadeInUp} className="space-y-4">
                <div>
                  <label className="block text-[13px] font-medium text-ivory mb-1">Question *</label>
                  <input value={question} onChange={(e) => setQuestion(e.target.value)}
                    placeholder='e.g. "Will SOL close above $250 by Dec 31, 2026?"'
                    className="w-full bg-panel border border-hairline rounded-[2px] px-4 py-3 text-ivory focus:outline-none focus:border-gold"
                    maxLength={200} />
                  <span className="text-xs text-ash mt-1">{question.length}/200</span>
                </div>
                <div>
                  <label className="block text-[13px] font-medium text-ivory mb-1">Description</label>
                  <textarea value={description} onChange={(e) => setDescription(e.target.value)}
                    placeholder="Settlement rules, sources, and additional context..."
                    className="w-full bg-panel border border-hairline rounded-[2px] px-4 py-3 text-ivory focus:outline-none focus:border-gold min-h-[100px]"
                    maxLength={400} />
                  <span className="text-xs text-ash mt-1">{description.length}/400</span>
                </div>
                <div>
                  <label className="block text-[13px] font-medium text-ivory mb-1">Category</label>
                  <select value={category} onChange={(e) => handleCategoryChange(parseInt(e.target.value))}
                    className="w-full bg-panel border border-hairline rounded-[2px] px-4 py-3 text-ivory focus:outline-none focus:border-gold">
                    {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                  {!oracleCategory && (
                    <p className="text-xs text-ash mt-1">Sports &amp; Politics markets are resolved by an admin based on your settlement rules — no oracle needed.</p>
                  )}
                </div>
                <div>
                  <label className="block text-[13px] font-medium text-ivory mb-1">Share Price (SOL) *</label>
                  <input type="number" step="0.001" min="0.001" value={sharePriceLamports}
                    onChange={(e) => setSharePriceLamports(e.target.value)}
                    className="w-full bg-panel border border-hairline rounded-[2px] px-4 py-3 text-ivory focus:outline-none focus:border-gold" />
                  <p className="text-xs text-ash mt-1">Face value of each share. Minimum 0.001 SOL.</p>
                </div>
              </motion.div>
            )}

            {step === 1 && (
              <motion.div variants={fadeInUp} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="block text-[13px] font-medium text-ivory mb-1">End Date *</label>
                    <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
                      className="w-full bg-panel border border-hairline rounded-[2px] px-4 py-3 text-ivory focus:outline-none focus:border-gold" /></div>
                  <div><label className="block text-[13px] font-medium text-ivory mb-1">End Time *</label>
                    <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)}
                      className="w-full bg-panel border border-hairline rounded-[2px] px-4 py-3 text-ivory focus:outline-none focus:border-gold" /></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="block text-[13px] font-medium text-ivory mb-1">Resolution Date *</label>
                    <input type="date" value={resolveDate} onChange={(e) => setResolveDate(e.target.value)}
                      className="w-full bg-panel border border-hairline rounded-[2px] px-4 py-3 text-ivory focus:outline-none focus:border-gold" /></div>
                  <div><label className="block text-[13px] font-medium text-ivory mb-1">Resolution Time *</label>
                    <input type="time" value={resolveTime} onChange={(e) => setResolveTime(e.target.value)}
                      className="w-full bg-panel border border-hairline rounded-[2px] px-4 py-3 text-ivory focus:outline-none focus:border-gold" /></div>
                </div>
                <p className="text-xs text-ash">Trading stops at end time. Resolution happens after end time.</p>
              </motion.div>
            )}

            {step === 2 && oracleCategory && (
              <motion.div variants={fadeInUp} className="space-y-4">
                <div>
                  <label className="block text-[13px] font-medium text-ivory mb-1">Asset / Oracle Feed *</label>
                  <select value={selectedFeed} onChange={(e) => handleFeedChange(e.target.value)}
                    className="w-full bg-panel border border-hairline rounded-[2px] px-4 py-3 text-ivory focus:outline-none focus:border-gold">
                    {availableFeeds.map((f) => (
                      <option key={f.symbol} value={f.symbol}>{f.label} ({f.symbol})</option>
                    ))}
                  </select>
                  <p className="text-xs text-ash mt-1">
                    The Pyth price feed, feed ID and exponent are filled in automatically for the selected asset.
                  </p>
                  {!customFeed && oracleCategory && (
                    <p className="text-xs text-verdigris mt-1">
                      Selected feed: 0x{oracleFeedId.slice(0, 12)}…
                    </p>
                  )}
                </div>
                <label className="flex items-center gap-2 text-[13px] text-ash cursor-pointer">
                  <input type="checkbox" checked={customFeed} onChange={(e) => setCustomFeed(e.target.checked)}
                    className="accent-gold" />
                  Use a custom feed ID not listed above
                </label>
                {customFeed && (
                  <div>
                    <label className="block text-[13px] font-medium text-ivory mb-1">Pyth Oracle Feed ID</label>
                    <input value={oracleFeedId} onChange={(e) => setOracleFeedId(e.target.value)}
                      placeholder="64-char hex feed ID"
                      className="w-full bg-panel border border-hairline rounded-[2px] px-4 py-3 text-ivory font-mono text-xs focus:outline-none focus:border-gold" />
                    <p className="text-xs text-ash mt-1">Raw Pyth price feed ID for assets outside the registry.</p>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="block text-[13px] font-medium text-ivory mb-1">Target Price *</label>
                    <input type="number" value={targetPrice} onChange={(e) => setTargetPrice(e.target.value)}
                      placeholder="e.g. 25000000000"
                      className="w-full bg-panel border border-hairline rounded-[2px] px-4 py-3 text-ivory focus:outline-none focus:border-gold" /></div>
                  <div><label className="block text-[13px] font-medium text-ivory mb-1">Exponent</label>
                    <input type="number" value={targetExpo} onChange={(e) => setTargetExpo(e.target.value)}
                      className="w-full bg-panel border border-hairline rounded-[2px] px-4 py-3 text-ivory focus:outline-none focus:border-gold" />
                    <p className="text-xs text-ash mt-1">Pyth exponent (filled in automatically per asset)</p></div>
                </div>
                <p className="text-xs text-ash">Target Price is the comparator in feed units: price × 10^exponent. E.g. SOL at $250 → 25000000000.</p>
                <div>
                  <label className="block text-[13px] font-medium text-ivory mb-1">Comparison *</label>
                  <select value={comparison} onChange={(e) => setComparison(parseInt(e.target.value))}
                    className="w-full bg-panel border border-hairline rounded-[2px] px-4 py-3 text-ivory focus:outline-none focus:border-gold">
                    {COMPARISONS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </div>
              </motion.div>
            )}

            {step === steps.length - 1 && (
              <motion.div variants={fadeInUp} className="space-y-4">
                <h3 className="font-display text-[21px] font-bold text-gold">Review Your Proposal</h3>
                <div className="space-y-2 text-[13px]">
                  <Row label="Question" value={question} />
                  <Row label="Category" value={CATEGORIES[category]?.label ?? "Other"} />
                  <Row label="Share Price" value={`${sharePriceLamports} SOL`} />
                  <Row label="End Time" value={`${endDate} ${endTime}`} />
                  <Row label="Resolution" value={`${resolveDate} ${resolveTime}`} />
                  {oracleCategory ? (
                    <>
                      <Row label="Oracle Feed" value={`${selectedFeed} (0x${oracleFeedId.slice(0, 12)}…)`} />
                      <Row label="Target Price" value={targetPrice} />
                      <Row label="Comparison" value={COMPARISONS[comparison]?.label ?? ">"} />
                    </>
                  ) : (
                    <Row label="Oracle Feed" value="N/A — resolved by admin" />
                  )}
                </div>
                <div className="bg-gold/10 border border-gold/20 rounded-[2px] p-4">
                  <p className="text-[13px] text-gold">
                    <strong>Bond required:</strong> {PROPOSAL_BOND_SOL} SOL will be held in escrow
                    until the proposal is approved or rejected by the admin.
                  </p>
                </div>
                {!publicKey && (
                  <div className="bg-bordeaux/10 border border-bordeaux/20 rounded-[2px] p-4">
                    <p className="text-[13px] text-bordeaux">Connect your wallet to submit.</p>
                  </div>
                )}
                <button onClick={handleSubmit} disabled={submitting || !publicKey}
                  className={`btn-royale w-full text-[13px] ${(submitting || !publicKey) ? "opacity-50 cursor-not-allowed" : ""}`}>
                  {submitting ? "Submitting..." : `Submit Proposal (${PROPOSAL_BOND_SOL} SOL bond)`}
                </button>
              </motion.div>
            )}

            <div className="flex justify-between pt-4 border-t border-hairline">
              <button onClick={() => setStep(Math.max(0, step - 1))} disabled={step === 0}
                className="btn-outline-royale text-xs disabled:opacity-30">
                Back
              </button>
              {step < steps.length - 1 && (
                <button onClick={() => setStep(step + 1)} disabled={!canAdvance(step)}
                  className="btn-royale text-xs disabled:opacity-30">
                  Next
                </button>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </main>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between py-1">
      <span className="text-ash">{label}</span>
      <span className="text-ivory text-right max-w-[60%] truncate">{value}</span>
    </div>
  );
}
