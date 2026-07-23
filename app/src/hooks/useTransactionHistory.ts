import { useEffect, useState, useCallback } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useConnection } from "@solana/wallet-adapter-react";


export interface TxEvent {
  signature: string;
  timestamp: number;
  type: "buy" | "sell" | "claim" | "refund" | "settle" | "other";
  marketId?: number;
  amount?: number;
  outcome?: "yes" | "no";
}

export function useTransactionHistory(limit = 20) {
  const { publicKey } = useWallet();
  const { connection } = useConnection();
  const [txs, setTxs] = useState<TxEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchHistory = useCallback(async () => {
    if (!publicKey || !connection) {
      setLoading(false);
      return;
    }
    try {
      const sigs = await connection.getSignaturesForAddress(publicKey, { limit }, "confirmed");
      const details = await Promise.all(
        sigs.map(async (sig) => {
          try {
            const tx = await connection.getParsedTransaction(sig.signature, {
              maxSupportedTransactionVersion: 0,
            });
            return parseTx(sig.signature, sig.blockTime ?? 0, tx);
          } catch {
            return null;
          }
        })
      );
      setTxs(details.filter(Boolean) as TxEvent[]);
    } catch {
      setTxs([]);
    } finally {
      setLoading(false);
    }
  }, [publicKey, connection, limit]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  return { transactions: txs, loading, refetch: fetchHistory };
}

function parseTx(
  signature: string,
  blockTime: number,
  tx: any
): TxEvent | null {
  if (!tx) return null;
  const ix = tx.transaction.message.instructions?.[0];
  if (!ix) return { signature, timestamp: blockTime, type: "other" };

  const programIx = (ix as any).programId?.toString() ?? "";
  const parsed = (ix as any).parsed;
  const data = (ix as any).data;

  if (programIx.includes("Memo") || programIx.includes("System")) {
    return { signature, timestamp: blockTime, type: "other" };
  }

  if (data) {
    const decoded = Buffer.from(data, "base64").toString("hex");
    if (decoded.includes("buy") || decoded.includes("01") && decoded.length > 10) {
      return { signature, timestamp: blockTime, type: "buy" };
    }
    if (decoded.includes("sell")) {
      return { signature, timestamp: blockTime, type: "sell" };
    }
    if (decoded.includes("claim")) {
      return { signature, timestamp: blockTime, type: "claim" };
    }
    if (decoded.includes("refund")) {
      return { signature, timestamp: blockTime, type: "refund" };
    }
  }

  return { signature, timestamp: blockTime, type: "other" };
}