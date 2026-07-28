import { useEffect, useState, useCallback } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useConnection } from "@solana/wallet-adapter-react";
import type { ParsedInstruction, PartiallyDecodedInstruction, ParsedTransactionWithMeta } from "@solana/web3.js";

export interface TxEvent {
  signature: string;
  timestamp: number;
  type: "buy" | "sell" | "claim" | "refund" | "settle" | "other";
  marketId?: number;
  amount?: number;
  outcome?: "yes" | "no";
}

type ParsedIx = ParsedInstruction | PartiallyDecodedInstruction;

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
      setTxs(details.filter((t): t is TxEvent => t !== null));
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

function parseInstructionType(ix: ParsedIx): TxEvent["type"] {
  const programId = ix.programId.toString();

  if (programId.includes("Memo") || programId.includes("System")) {
    return "other";
  }

  if ("parsed" in ix && ix.parsed) {
    const p = ix.parsed as Record<string, unknown>;
    const type = p.type as string | undefined;
    if (type?.toLowerCase().includes("buy")) return "buy";
    if (type?.toLowerCase().includes("sell")) return "sell";
    if (type?.toLowerCase().includes("claim")) return "claim";
    if (type?.toLowerCase().includes("refund")) return "refund";
    if (type?.toLowerCase().includes("settle")) return "settle";
  }

  if ("data" in ix && ix.data) {
    const decoded = Buffer.from(ix.data, "base64").toString("hex");
    if (decoded.includes("buy")) return "buy";
    if (decoded.includes("sell")) return "sell";
    if (decoded.includes("claim")) return "claim";
    if (decoded.includes("refund")) return "refund";
  }

  return "other";
}

function parseTx(
  signature: string,
  blockTime: number,
  tx: ParsedTransactionWithMeta | null,
): TxEvent | null {
  if (!tx) return null;
  const ix = tx.transaction.message.instructions?.[0] as ParsedIx | undefined;
  if (!ix) return { signature, timestamp: blockTime, type: "other" };

  return { signature, timestamp: blockTime, type: parseInstructionType(ix) };
}
