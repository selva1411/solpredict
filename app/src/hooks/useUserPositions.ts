import { useEffect, useState, useCallback, useRef } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useProgram } from "./useProgram";
import { useRealtime } from "./useRealtime";
import { PublicKey } from "@solana/web3.js";

export interface UserPosition {
  publicKey: PublicKey;
  market: PublicKey;
  owner: PublicKey;
  yesAmount: number;
  noAmount: number;
  claimed: boolean;
  totalSpentLamports: number;
  bump: number;
}

export interface DbPosition {
  marketPubkey: string;
  question: string;
  category: string;
  status: string;
  yesAmount: number;
  noAmount: number;
  totalSpentLamports: number;
  yesLamports: number;
  noLamports: number;
  claimed: boolean;
}

export function useUserPositions(pollIntervalMs = 15_000) {
  const { publicKey } = useWallet();
  const { program } = useProgram();
  const [positions, setPositions] = useState<UserPosition[]>([]);
  const [dbPositions, setDbPositions] = useState<DbPosition[]>([]);
  const [loading, setLoading] = useState(true);
  const channel = publicKey ? `positions:${publicKey.toBase58()}` : undefined;
  const rt = useRealtime(channel);
  const pollingRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  const fetchPositions = useCallback(async () => {
    if (!program || !publicKey) {
      setLoading(false);
      return;
    }
    try {
      const all = await program.account.userPosition.all([
        {
          memcmp: {
            offset: 8,
            bytes: publicKey.toBase58(),
          },
        },
      ]);
      const parsed: UserPosition[] = all.map((item) => {
        const acct = item.account;
        return {
          publicKey: item.publicKey,
          market: acct.market,
          owner: acct.owner,
          yesAmount: acct.yesAmount.toNumber(),
          noAmount: acct.noAmount.toNumber(),
          claimed: acct.claimed,
          totalSpentLamports: acct.totalSpentLamports.toNumber(),
          bump: acct.bump,
        };
      });
      setPositions(parsed);
    } catch {
      setPositions([]);
    } finally {
      setLoading(false);
    }
  }, [program, publicKey]);

  const fetchDbPositions = useCallback(async () => {
    if (!publicKey) return;
    try {
      const res = await fetch(`/api/user/positions?wallet=${publicKey.toBase58()}`);
      const data = await res.json();
      if (data.positions) {
        setDbPositions(data.positions);
      }
    } catch {
      // DB unavailable - skip
    }
  }, [publicKey]);

  useEffect(() => {
    fetchPositions();
    fetchDbPositions();
  }, [fetchPositions, fetchDbPositions]);

  useEffect(() => {
    if (rt.connected) {
      if (pollingRef.current) clearInterval(pollingRef.current);
      pollingRef.current = undefined;
    } else if (!pollingRef.current) {
      pollingRef.current = setInterval(() => {
        fetchPositions();
        fetchDbPositions();
      }, pollIntervalMs);
    }
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [fetchPositions, fetchDbPositions, pollIntervalMs, rt.connected]);

  useEffect(() => {
    const unsub = rt.on("positions", () => {
      fetchPositions();
      fetchDbPositions();
    });
    return () => unsub?.();
  }, [fetchPositions, fetchDbPositions, rt]);

  const hasOnChainData = positions.length > 0;
  const mergedPositions = hasOnChainData ? positions : [];

  return {
    positions: mergedPositions,
    dbPositions,
    loading,
    refetch: fetchPositions,
    hasOnChainData,
  };
}