import { NextRequest } from "next/server";
import { insertTrade } from "@/lib/db/store";
import { serverError, ok } from "@/lib/api-response";
import { apiHandler } from "@/lib/api-handler";
import { toError } from "@/lib/errors";
import { logAudit } from "@/lib/audit";

export const POST = apiHandler(async (req: NextRequest) => {
  const secret = process.env.HELIUS_WEBHOOK_SECRET;
  if (secret) {
    const authHeader = req.headers.get("authorization");
    if (authHeader !== `Bearer ${secret}` && authHeader !== secret) {
      return ok({ error: "Unauthorized" }, { status: 401 } as ResponseInit);
    }
  }

  const events = await req.json();
  if (!Array.isArray(events)) return ok({ ok: true, processed: 0 });

  let count = 0;
  for (const event of events) {
    const tx = event as Record<string, unknown>;
    const type = tx.type as string | undefined;
    if (type === "SWAP" || type === "TRANSFER") {
      const tokenTransfers = (tx.tokenTransfers as Array<Record<string, unknown>>) || [];
      const nativeTransfers = (tx.nativeTransfers as Array<Record<string, unknown>>) || [];

      for (const transfer of tokenTransfers) {
        const mint = String(transfer.mint ?? "");
        const userAccount = String(transfer.userAccount ?? tx.feePayer ?? "");
        const tokenAmount = Number(transfer.tokenAmount || 0);
        const nativeAmount = nativeTransfers.length > 0 ? Number((nativeTransfers[0] as Record<string, unknown>).amount || 0) / 1e9 : 0;

        await insertTrade({
          signature: String(tx.signature ?? ""),
          marketPubkey: mint,
          trader: userAccount,
          side: tokenAmount > 0 ? "YES" : "NO",
          lamportsIn: Math.floor(nativeAmount * 1e9),
          tokensOut: tokenAmount,
          pricePerToken: tokenAmount > 0 ? nativeAmount / tokenAmount : 0,
          blockTime: new Date((tx.timestamp as number || Date.now()) * 1000),
          slot: 0,
        });
        count++;
      }
    }
  }

  logAudit({
    action: "webhook:helius",
    actor: "helius",
    resource: "webhook",
    details: { processed: count },
    ip: req.headers.get("x-forwarded-for") ?? "unknown",
  });

  return ok({ ok: true, processed: count });
});

export const GET = apiHandler(async () => {
  return ok({
    status: "online",
    service: "SolPredict Helius Webhook Indexer",
    timestamp: new Date().toISOString(),
  });
});
