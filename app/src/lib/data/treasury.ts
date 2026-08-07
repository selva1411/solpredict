import { db } from '@/lib/db/client';
import { treasuryLedger, marketsCache } from '@/lib/db/schema';
import { desc, eq, sql } from 'drizzle-orm';

export interface TreasuryLedgerFilters {
  kind?: string;
  direction?: 'in' | 'out';
  limit?: number;
}

export async function getLedger(filters: TreasuryLedgerFilters = {}) {
  if (!db) return [];

  const { kind, direction, limit = 50 } = filters;
  const conditions = [];

  if (kind) conditions.push(eq(treasuryLedger.kind, kind));
  if (direction) conditions.push(eq(treasuryLedger.direction, direction));

  const where = conditions.length > 0 ? sql.join(conditions, sql` AND `) : undefined;

  return db
    .select()
    .from(treasuryLedger)
    .where(where)
    .orderBy(desc(treasuryLedger.createdAt))
    .limit(limit);
}

export async function getUnwithdrawnFees() {
  if (!db) return { totalFeeLamports: 0, perMarket: [] };

  const rows = await db
    .select({
      marketPubkey: marketsCache.marketPubkey,
      question: marketsCache.question,
      feeCollectedLamports: marketsCache.feeCollectedLamports,
    })
    .from(marketsCache)
    .where(sql`${marketsCache.feeCollectedLamports} > 0`);

  const totalFeeLamports = rows.reduce((sum, r) => sum + (r.feeCollectedLamports ?? 0), 0);

  return {
    totalFeeLamports,
    totalFeeSol: totalFeeLamports / 1e9,
    perMarket: rows.map(r => ({
      marketPubkey: r.marketPubkey,
      question: r.question,
      feeLamports: r.feeCollectedLamports ?? 0,
      feeSol: (r.feeCollectedLamports ?? 0) / 1e9,
    })),
  };
}

export async function reconcileTreasury(onChainBalanceLamports: number) {
  if (!db) return { onChainSol: 0, ledgerSol: 0, driftSol: 0, hasDrift: false };

  const [ledgerSum] = await db.select({
    netIn: sql<string>`
      COALESCE(SUM(CASE WHEN ${treasuryLedger.direction} = 'in' THEN ${treasuryLedger.amount} ELSE -${treasuryLedger.amount} END), 0)
    `,
  }).from(treasuryLedger);

  const ledgerLamports = Number(ledgerSum?.netIn ?? 0);
  const driftLamports = onChainBalanceLamports - ledgerLamports;

  return {
    onChainSol: onChainBalanceLamports / 1e9,
    ledgerSol: ledgerLamports / 1e9,
    driftSol: driftLamports / 1e9,
    hasDrift: Math.abs(driftLamports) > 1e6, // > 0.001 SOL drift threshold
  };
}
