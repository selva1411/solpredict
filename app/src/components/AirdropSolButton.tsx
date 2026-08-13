"use client";

import React, { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { toast } from "sonner";

const AIRDROP_AMOUNT = 2_000_000_000; // 2 SOL

/**
 * Localnet-only helper: airdrops SOL to the connected wallet via the
 * /api/rpc proxy (which forwards to the local test validator's faucet).
 * Hidden on devnet/mainnet and when no wallet is connected.
 */
export function AirdropSolButton() {
  const { publicKey } = useWallet();
  const [busy, setBusy] = useState(false);

  if (process.env.NEXT_PUBLIC_CLUSTER !== "localnet" || !publicKey) return null;

  const onAirdrop = async () => {
    if (!publicKey) return;
    setBusy(true);
    try {
      const res = await fetch("/api/rpc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "requestAirdrop",
          params: [publicKey.toBase58(), AIRDROP_AMOUNT],
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || data?.error) {
        throw new Error(data?.error?.message ?? `HTTP ${res.status}`);
      }
      toast.success("Airdropped 2 SOL to your wallet!");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Airdrop failed. Is the local validator running?"
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      onClick={onAirdrop}
      disabled={busy}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-[2px] text-[10px] font-bold uppercase tracking-wider border border-verdigris/30 text-verdigris hover:bg-verdigris/10 transition-colors disabled:opacity-50 cursor-pointer"
      title="Airdrop 2 SOL from the localnet faucet"
    >
      <span aria-hidden>+</span>
      {busy ? "Sending…" : "Airdrop SOL"}
    </button>
  );
}
