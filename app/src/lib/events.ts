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
  const sigs = await connection.getSignaturesForAddress(address, { limit });

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
  markets: Array<{ account: { marketId: anchor.BN; question: string } }>
): string {
  const match = markets.find((m) => m.account.marketId.toNumber() === marketId.toNumber());
  return match ? match.account.question : `Market #${marketId.toString()}`;
}

export type MarketStatus = "Open" | "Settled" | "Cancelled";

export interface AnchorMarketStatus {
  open?: Record<string, never>;
  settled?: Record<string, never>;
  cancelled?: Record<string, never>;
}

export function getMarketStatusString(status: AnchorMarketStatus | null | undefined): MarketStatus {
  if (!status) return "Open";
  if (status.open) return "Open";
  if (status.settled) return "Settled";
  if (status.cancelled) return "Cancelled";
  return "Open";
}
