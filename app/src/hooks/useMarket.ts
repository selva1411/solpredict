"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import { useProgram } from "./useProgram";
import { useRealtime } from "./useRealtime";
import { PublicKey } from "@solana/web3.js";
import { getMarketPda } from "@/lib/pda";
import { decodeMarket, type TypedMarketAccount } from "@/lib/idl/decoders";

export type { TypedMarketAccount as MarketAccount };

export function useMarket(marketId: number | null, pollIntervalMs = 10_000) {
  const { program } = useProgram();
  const [market, setMarket] = useState<{ publicKey: PublicKey; account: TypedMarketAccount } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  const fetchMarket = useCallback(async () => {
    if (!program || marketId === null) return;
    try {
      const marketPda = getMarketPda(
        new (await import("@coral-xyz/anchor")).BN(marketId),
        program.programId
      );
      const acct = await program.account.market.fetch(marketPda);
      setMarket({ publicKey: marketPda, account: decodeMarket(acct) });
      setError(null);
    } catch {
      setError("Failed to fetch market");
    } finally {
      setLoading(false);
    }
  }, [program, marketId]);

  const rt = useRealtime(marketId !== null ? `market:${marketId}` : undefined, (payload: unknown) => {
    const live = payload as { publicKey: PublicKey; account: TypedMarketAccount };
    if (live?.account) setMarket(live);
  });

  useEffect(() => {
    fetchMarket();
  }, [fetchMarket]);

  useEffect(() => {
    if (rt.connected) {
      if (pollingRef.current) clearInterval(pollingRef.current);
      pollingRef.current = undefined;
    } else if (!pollingRef.current) {
      pollingRef.current = setInterval(fetchMarket, pollIntervalMs);
    }
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [fetchMarket, pollIntervalMs, rt.connected]);

  return { market, loading, error, refetch: fetchMarket };
}