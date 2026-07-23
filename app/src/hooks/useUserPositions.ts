import { useEffect, useState, useCallback } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useProgram } from "./useProgram";
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
      const parsed = all.map((item: any) => ({
        publicKey: item.publicKey as PublicKey,
        market: (item.account as any).market as PublicKey,
        owner: (item.account as any).owner as PublicKey,
        yesAmount: (item.account as any).yesAmount.toNumber(),
        noAmount: (item.account as any).noAmount.toNumber(),
        claimed: (item.account as any).claimed,
        totalSpentLamports: (item.account as any).totalSpentLamports.toNumber(),
        bump: (item.account as any).bump,
      }));
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
    const interval = setInterval(() => {
      fetchPositions();
      fetchDbPositions();
    }, pollIntervalMs);
    return () => clearInterval(interval);
  }, [fetchPositions, fetchDbPositions, pollIntervalMs]);

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