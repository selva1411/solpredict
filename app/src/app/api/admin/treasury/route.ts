export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { Connection, PublicKey } from "@solana/web3.js";
import { getTreasuryOverview } from "@/lib/data/admin";
import { db } from "@/lib/db/client";
import { treasuryLedger } from "@/lib/db/schema";
import { ok, badRequest, serverError } from "@/lib/api-response";
import { apiHandler } from "@/lib/api-handler";
import { ENV } from "@/lib/env";
import { requireAdmin } from "@/lib/admin-guard";

const RPC_URL = ENV.serverRpcUrl;

/**
 * GET /api/admin/treasury
 *
 * Full treasury page data per spec §3.6:
 * - Live on-chain SOL balance of treasury wallet via RPC
 * - Full treasury_ledger history (paginated, filterable)
 * - Accrued-but-unwithdrawn fees per market
 * - Reconciliation strip: on-chain balance vs sum(ledger) with drift detection
 */
export const GET = apiHandler(async (req: NextRequest) => {
  const guard = await requireAdmin(req);
  if (!guard.ok) return guard.response;

  const url = new URL(req.url);
  const page = Math.max(1, Number(url.searchParams.get("page") || 1));
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit") || 20)));
  const kind = url.searchParams.get("kind") ?? undefined;
  const direction = (url.searchParams.get("direction") as 'in' | 'out' | null) ?? undefined;

  try {
    const overview = await getTreasuryOverview({ page, limit, kind, direction });

    // No configured treasury wallet — nothing to reconcile against on-chain.
    // Never fall back to a hardcoded address (see audit A7/D-series: committed
    // credentials and fabricated treasury addresses).
    if (!overview.treasuryWallet) {
      return ok({
        ok: true,
        treasuryWallet: null,
        balances: null,
        marketFees: overview.marketFees,
        ledger: overview.ledger,
        note: "No treasury wallet configured (set platform_config.treasury_wallet or ADMIN_WALLET)",
      });
    }

    // Live on-chain balance via RPC
    let onChainBalanceLamports: number | null = null;
    try {
      const conn = new Connection(RPC_URL, "confirmed");
      onChainBalanceLamports = await conn.getBalance(new PublicKey(overview.treasuryWallet));
    } catch (e) {
      console.warn("[Treasury API] RPC getBalance failed:", e);
    }
    const onChainBalanceSol = (onChainBalanceLamports ?? 0) / 1e9;

    const { totalInLamports, totalOutLamports, netLedgerSol } = overview.ledgerTotals;
    const netLedgerLamports = totalInLamports - totalOutLamports;

    // Reconciliation drift: difference between live on-chain balance and net ledger
    const driftSol = Math.abs(onChainBalanceSol - netLedgerSol);
    const hasDrift = driftSol > 0.001; // > 0.001 SOL drift threshold

    return ok({
      ok: true,
      treasuryWallet: overview.treasuryWallet,
      balances: {
        onChainSol: Number(onChainBalanceSol.toFixed(4)),
        onChainAvailable: onChainBalanceLamports !== null,
        netLedgerSol: Number(netLedgerSol.toFixed(4)),
        totalLedgerInSol: Number((totalInLamports / 1e9).toFixed(4)),
        totalLedgerOutSol: Number((totalOutLamports / 1e9).toFixed(4)),
        driftSol: Number(driftSol.toFixed(4)),
        hasDrift,
      },
      marketFees: overview.marketFees,
      ledger: overview.ledger,
    });
  } catch (err) {
    return serverError(err);
  }
});

/**
 * POST /api/admin/treasury
 *
 * Records a withdrawal transaction in the treasury_ledger.
 */
export const POST = apiHandler(async (req: NextRequest) => {
  const guard = await requireAdmin(req);
  if (!guard.ok) return guard.response;

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return badRequest("Invalid JSON body");

  const { amountSol, signature, recipient, kind, note, marketPubkey } = body as {
    amountSol?: number;
    signature?: string;
    recipient?: string;
    kind?: string;
    note?: string;
    marketPubkey?: string;
  };

  if (!amountSol || amountSol <= 0) return badRequest("Valid amountSol required");

  try {
    const amountLamports = Math.floor(amountSol * 1e9);
    if (!db) return serverError("Database not available");

    const [row] = await db
      .insert(treasuryLedger)
      .values({
        signature: signature ?? null,
        direction: "out",
        kind: kind || "withdrawal",
        amount: amountLamports,
        marketPubkey: marketPubkey ?? null,
        actor: recipient ?? guard.identity.wallet,
        note: note || `Admin fee withdrawal of ${amountSol} SOL`,
      })
      .returning();

    return ok({ ok: true, ledgerItem: row }, { status: 201 });
  } catch (err) {
    return serverError(err);
  }
});
