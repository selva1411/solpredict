export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { Connection, PublicKey } from "@solana/web3.js";
import { assertDb } from "@/lib/db/client";
import { marketsCache, trades, treasuryLedger, platformConfig } from "@/lib/db/schema";
import { sql, desc, eq } from "drizzle-orm";
import { ok, badRequest, serverError } from "@/lib/api-response";
import { apiHandler } from "@/lib/api-handler";
import { requireAdmin } from "@/lib/admin-guard";

const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com";

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
  const offset = (page - 1) * limit;
  const kind = url.searchParams.get("kind");
  const direction = url.searchParams.get("direction");

  try {
    const db = assertDb();

    // 1. Fetch platform config for treasury wallet address
    const [config] = await db.select().from(platformConfig).limit(1);
    const treasuryAddress = config?.treasuryWallet || process.env.ADMIN_WALLET || "2zPRxYVxFDUZn6QEYU2m6bzyZcN7pCCJ4E25gc2EQcCS";

    // 2. Live on-chain balance via RPC
    let onChainBalanceLamports = 0;
    try {
      const conn = new Connection(RPC_URL, "confirmed");
      onChainBalanceLamports = await conn.getBalance(new PublicKey(treasuryAddress));
    } catch (e) {
      console.warn("[Treasury API] RPC getBalance failed:", e);
    }
    const onChainBalanceSol = onChainBalanceLamports / 1e9;

    // 3. Query full treasury_ledger table
    const ledgerWhere: any[] = [];
    if (kind) ledgerWhere.push(eq(treasuryLedger.kind, kind));
    if (direction) ledgerWhere.push(eq(treasuryLedger.direction, direction));

    const whereClause = ledgerWhere.length > 0 ? sql.join(ledgerWhere, sql` AND `) : undefined;

    const [ledgerRows, countRows, ledgerSum] = await Promise.all([
      db
        .select()
        .from(treasuryLedger)
        .where(whereClause)
        .orderBy(desc(treasuryLedger.ts))
        .limit(limit)
        .offset(offset),
      db
        .select({ count: sql<number>`COUNT(*)::int` })
        .from(treasuryLedger)
        .where(whereClause),
      db
        .select({
          totalIn: sql<string>`COALESCE(SUM(CASE WHEN direction = 'in' THEN amount ELSE 0 END), 0)::text`,
          totalOut: sql<string>`COALESCE(SUM(CASE WHEN direction = 'out' THEN amount ELSE 0 END), 0)::text`,
        })
        .from(treasuryLedger),
    ]);

    const totalLedgerInLamports = Number(ledgerSum[0]?.totalIn || 0);
    const totalLedgerOutLamports = Number(ledgerSum[0]?.totalOut || 0);
    const netLedgerLamports = totalLedgerInLamports - totalLedgerOutLamports;
    const netLedgerSol = netLedgerLamports / 1e9;

    // Reconciliation drift: difference between live on-chain balance and net ledger
    const driftSol = Math.abs(onChainBalanceSol - netLedgerSol);
    const hasDrift = driftSol > 0.001; // > 0.001 SOL drift threshold

    // 4. Market-level unwithdrawn fees
    const marketFees = await db
      .select({
        marketPubkey: marketsCache.marketPubkey,
        question: marketsCache.question,
        feeCollectedLamports: marketsCache.feeCollectedLamports,
        status: marketsCache.status,
      })
      .from(marketsCache)
      .where(sql`COALESCE(fee_collected_lamports, 0) > 0`)
      .limit(50);

    return ok({
      ok: true,
      treasuryWallet: treasuryAddress,
      balances: {
        onChainSol: Number(onChainBalanceSol.toFixed(4)),
        netLedgerSol: Number(netLedgerSol.toFixed(4)),
        totalLedgerInSol: Number((totalLedgerInLamports / 1e9).toFixed(4)),
        totalLedgerOutSol: Number((totalLedgerOutLamports / 1e9).toFixed(4)),
        driftSol: Number(driftSol.toFixed(4)),
        hasDrift,
      },
      marketFees: marketFees.map((m) => ({
        marketPubkey: m.marketPubkey,
        question: m.question,
        status: m.status,
        feeLamports: m.feeCollectedLamports ?? 0,
        feeSol: Number(((m.feeCollectedLamports ?? 0) / 1e9).toFixed(4)),
      })),
      ledger: {
        items: ledgerRows.map((r) => ({
          id: r.id,
          ts: r.ts?.toISOString() ?? new Date().toISOString(),
          signature: r.signature,
          direction: r.direction,
          kind: r.kind,
          amountLamports: r.amount,
          amountSol: Number((r.amount / 1e9).toFixed(4)),
          marketPubkey: r.marketPubkey,
          actor: r.actor,
          note: r.note,
        })),
        pagination: {
          page,
          limit,
          total: countRows[0]?.count ?? 0,
          totalPages: Math.ceil((countRows[0]?.count ?? 0) / limit),
        },
      },
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
    const db = assertDb();
    const amountLamports = Math.floor(amountSol * 1e9);

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
