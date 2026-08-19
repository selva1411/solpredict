import { Connection, PublicKey } from "@solana/web3.js";
import { EventParser, Program } from "@coral-xyz/anchor";
import * as anchor from "@coral-xyz/anchor";

export interface ParsedTxEvents {
  signature: string;
  blockTime: number | null;
  slot: number;
  events: anchor.Event[];
}

export async function fetchProgramTransactions(
  connection: Connection,
  address: PublicKey,
  limit = 30
): Promise<ParsedTxEvents[]> {
  const sigs = await connection.getSignaturesForAddress(address, { limit }, "confirmed");

  const txs = await Promise.all(
    sigs.map(async (sig) => {
      try {
        return await connection.getParsedTransaction(sig.signature, {
          maxSupportedTransactionVersion: 0,
          commitment: "confirmed",
        });
      } catch {
        return null;
      }
    })
  );

  return sigs
    .map((sig, idx) => ({ sig, tx: txs[idx] }))
    .filter((pair): pair is { sig: (typeof sigs)[0]; tx: NonNullable<(typeof txs)[0]> } =>
      Boolean(pair.tx?.meta?.logMessages)
    )
    .map(({ sig, tx }) => ({
      signature: sig.signature,
      blockTime: sig.blockTime ?? null,
      slot: sig.slot,
      events: [] as anchor.Event[],
      _logs: tx!.meta!.logMessages!,
    }));
}

export function parseTransactionEvents(
  program: Program,
  txs: Array<ParsedTxEvents & { _logs?: string[] }>
): ParsedTxEvents[] {
  const eventParser = new EventParser(program.programId, program.coder);

  return txs.map((tx) => {
    const events = eventParser.parseLogs(tx._logs ?? []);
    const { _logs, ...rest } = tx;
    return { ...rest, events: [...events] };
  });
}

export function formatEventTime(blockTime: number | null | undefined): string {
  const date = blockTime ? new Date(blockTime * 1000) : new Date();
  return (
    date.toLocaleDateString() +
    " " +
    date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  );
}

export function findMarketQuestion(
  marketId: anchor.BN,
  markets: Array<{ account: { marketId?: anchor.BN | null; question: string } }>
): string {
  const id = marketId?.toNumber?.() ?? -1;
  const match = markets.find(
    (m) => m.account.marketId?.toNumber?.() === id
  );
  return match ? match.account.question : `Market #${id}`;
}

export type MarketStatus = "Open" | "Ended" | "Settled" | "Cancelled";

export interface AnchorMarketStatus {
  open?: Record<string, never>;
  settled?: Record<string, never>;
  cancelled?: Record<string, never>;
}

export function getMarketStatusString(
  status: AnchorMarketStatus | string | null | undefined,
  endTs?: number | anchor.BN | Date | null
): MarketStatus {
  if (!status) return "Open";

  const statusStr = typeof status === "string" ? status.toLowerCase() : "";
  const isSettled = statusStr === "settled" || Boolean((status as AnchorMarketStatus)?.settled);
  const isCancelled = statusStr === "cancelled" || Boolean((status as AnchorMarketStatus)?.cancelled);
  const isOpen = statusStr === "open" || statusStr === "ended" || Boolean((status as AnchorMarketStatus)?.open);

  if (isSettled) return "Settled";
  if (isCancelled) return "Cancelled";

  if (isOpen) {
    if (endTs != null) {
      const now = Math.floor(Date.now() / 1000);
      let endSecs = 0;
      if (typeof endTs === "number") endSecs = endTs;
      else if (endTs instanceof Date) endSecs = Math.floor(endTs.getTime() / 1000);
      else if (typeof endTs === "object" && endTs !== null && "toNumber" in endTs) endSecs = (endTs as anchor.BN).toNumber();

      if (endSecs > 0 && now >= endSecs) {
        return "Ended";
      }
    }
    return "Open";
  }
  return "Open";
}
