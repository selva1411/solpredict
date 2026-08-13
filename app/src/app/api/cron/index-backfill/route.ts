export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { Connection } from "@solana/web3.js";
import { getDb } from "@/lib/db/client";
import { getCursor, saveCursor, applyEvent } from "@/lib/indexer/reducer";
import { ok, serverError } from "@/lib/api-response";
import { apiHandler } from "@/lib/api-handler";
import { logger } from "@/lib/logger";

const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL ?? "https://api.devnet.solana.com";
const PROGRAM_ID = process.env.NEXT_PUBLIC_PROGRAM_ID ?? "AWbRCjgFzoe3zMqtXxRzPz7zFo8PP34RLDYmpd8LyGKG";

export const GET = apiHandler(async (req: NextRequest) => {
  if (!getDb()) return serverError("Database not available");

  try {
    const connection = new Connection(RPC_URL, "confirmed");
    const cursor = await getCursor();
    const untilSig = cursor?.lastSignature ?? undefined;

    const sigs = await connection.getSignaturesForAddress(
      new (await import("@solana/web3.js")).PublicKey(PROGRAM_ID),
      { limit: 50, until: untilSig },
    );

    if (sigs.length === 0) {
      return ok({ ok: true, processed: 0, message: "Up to date" });
    }

    let processed = 0;
    // Process oldest to newest
    const reversed = [...sigs].reverse();
    for (const s of reversed) {
      if (s.err) continue;
      try {
        const tx = await connection.getParsedTransaction(s.signature, {
          maxSupportedTransactionVersion: 0,
        });
        if (!tx || tx.meta?.err) continue;

        const logs = tx.meta?.logMessages ?? [];
        const isTrade = logs.some(l => l.includes("Swapped") || l.includes("Instruction: BuyShares") || l.includes("Instruction: SellShares"));

        if (isTrade) {
          const feePayer = tx.transaction.message.accountKeys.find(k => k.signer)?.pubkey.toBase58() ?? "";
          const postBalances = tx.meta?.postBalances ?? [];
          const preBalances = tx.meta?.preBalances ?? [];
          const solDelta = Math.abs((postBalances[0] ?? 0) - (preBalances[0] ?? 0));

          await applyEvent({
            type: "trade",
            signature: s.signature,
            marketPubkey: PROGRAM_ID, // fallback to program ID if market accounts ambiguous
            trader: feePayer,
            side: "YES",
            lamportsIn: solDelta,
            tokensOut: Math.floor(solDelta * 0.9), // approximate
            blockTime: s.blockTime ?? Math.floor(Date.now() / 1000),
            slot: s.slot,
          });
          processed++;
        }
      } catch (err) {
        logger.debug(`[index-backfill] skip tx ${s.signature}:`, err);
      }
    }

    const latest = sigs[0];
    if (latest) {
      await saveCursor(latest.signature, latest.slot);
    }

    return ok({
      ok: true,
      processed,
      latestSignature: latest?.signature,
      latestSlot: latest?.slot,
    });
  } catch (err) {
    return serverError(err);
  }
});
