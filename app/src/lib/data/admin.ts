import { db } from '@/lib/db/client';
import { marketsCache, trades, users, marketComments, userStats, auditLog, treasuryLedger, platformConfig, marketProposals, disputes, adminSettings } from '@/lib/db/schema';
import { sql, eq, desc, and } from 'drizzle-orm';

/**
 * Admin-only aggregate queries. All admin API routes call these instead of
 * embedding SQL; the DB is the single read model.
 */

export async function getAdminDashboard() {
  if (!db) throw new Error("Database not available");

  const [
    marketStats,
    tradeStats,
    userCount,
    commentStats,
    recentMarkets,
    recentTrades,
    topTraders,
  ] = await Promise.all([
    db.select({
      total: sql<number>`COUNT(*)::int`,
      open: sql<number>`COUNT(*) FILTER (WHERE status = 'open')::int`,
      resolved: sql<number>`COUNT(*) FILTER (WHERE status = 'settled')::int`,
      totalLiquidity: sql<number>`COALESCE(SUM(CAST(total_volume AS NUMERIC)), 0)`,
    }).from(marketsCache),

    db.select({
      total: sql<number>`COUNT(*)::int`,
      volume24h: sql<number>`COALESCE(SUM(ABS(lamports_in)) FILTER (WHERE block_time > NOW() - INTERVAL '24 hours'), 0) / 1e9`,
      totalVolume: sql<number>`COALESCE(SUM(ABS(lamports_in)), 0) / 1e9`,
    }).from(trades),

    db.select({ total: sql<number>`COUNT(*)::int` }).from(users),
    db.select({ total: sql<number>`COUNT(*)::int` }).from(marketComments),

    db.select({
      marketPubkey: marketsCache.marketPubkey,
      question: marketsCache.question,
      category: marketsCache.category,
      status: marketsCache.status,
      totalVolume: marketsCache.totalVolume,
      createdAt: marketsCache.createdAt,
    }).from(marketsCache)
      .orderBy(desc(marketsCache.createdAt))
      .limit(5),

    db.select({
      id: trades.id,
      signature: trades.signature,
      marketPubkey: trades.marketPubkey,
      trader: trades.trader,
      side: trades.side,
      lamportsIn: trades.lamportsIn,
      blockTime: trades.blockTime,
    }).from(trades)
      .orderBy(desc(trades.blockTime))
      .limit(10),

    db.select({
      wallet: userStats.wallet,
      username: users.username,
      volume: userStats.totalVolume,
      pnl: userStats.realizedPnl,
      winRateBps: userStats.winRateBps,
    }).from(userStats)
      .leftJoin(users, eq(users.wallet, userStats.wallet))
      .orderBy(desc(sql`CAST(user_stats.total_volume AS NUMERIC)`))
      .limit(10),
  ]);

  const dailyVolumeResult = await db.execute(sql`
    SELECT to_char(DATE(block_time), 'YYYY-MM-DD') as date,
           COALESCE(SUM(ABS(lamports_in)), 0) / 1e9 as volume
    FROM trades
    WHERE block_time > NOW() - INTERVAL '30 days'
    GROUP BY DATE(block_time)
    ORDER BY date ASC
  `);

  const dailyVolume = (dailyVolumeResult.rows as Record<string, unknown>[]).map(r => ({
    date: String(r.date),
    volume: Number(r.volume || 0),
  }));

  const categoryBreakdown = await db.select({
    category: marketsCache.category,
    count: sql<number>`COUNT(*)::int`,
  }).from(marketsCache)
    .groupBy(marketsCache.category);

  return {
    stats: {
      markets: {
        total: marketStats[0]?.total ?? 0,
        open: marketStats[0]?.open ?? 0,
        resolved: marketStats[0]?.resolved ?? 0,
        totalLiquidity: Number(marketStats[0]?.totalLiquidity ?? 0),
      },
      trades: {
        total: tradeStats[0]?.total ?? 0,
        volume24h: Number(tradeStats[0]?.volume24h ?? 0),
        totalVolume: Number(tradeStats[0]?.totalVolume ?? 0),
      },
      users: { total: userCount[0]?.total ?? 0 },
      comments: { total: commentStats[0]?.total ?? 0 },
      recentMarkets: recentMarkets.map(m => ({
        ...m,
        totalVolume: Number(m.totalVolume ?? 0),
      })),
      recentTrades,
      topTraders: topTraders.map(t => ({
        wallet: t.wallet,
        username: t.username,
        volume: Number(t.volume ?? 0),
        pnl: Number(t.pnl ?? 0),
        winRate: t.winRateBps != null ? t.winRateBps / 100 : null,
      })),
      dailyVolume,
      categoryBreakdown,
    },
  };
}

export async function getAdminStats() {
  if (!db) throw new Error("Database not available");

  const [marketStats] = await db
    .select({
      total: sql<number>`COUNT(*)::int`,
      open: sql<number>`COUNT(*) FILTER (WHERE status = 'open')::int`,
      settled: sql<number>`COUNT(*) FILTER (WHERE status = 'settled')::int`,
      totalLiquidity: sql<number>`COALESCE(SUM(CAST(total_volume AS NUMERIC)), 0)`,
    })
    .from(marketsCache);

  const [tradeStats] = await db
    .select({
      total: sql<number>`COUNT(*)::int`,
      totalVolume: sql<number>`COALESCE(SUM(ABS(lamports_in)), 0) / 1e9`,
    })
    .from(trades);

  const [userAgg] = await db
    .select({
      total: sql<number>`COUNT(*)::int`,
      avgWinRate: sql<number>`COALESCE(AVG(win_rate_bps), 0) / 100`,
    })
    .from(userStats);

  const [commentStats] = await db
    .select({ total: sql<number>`COUNT(*)::int` })
    .from(marketComments);

  const dailyVolumeResult = await db.execute(sql`
    SELECT to_char(DATE(block_time), 'YYYY-MM-DD') as date,
           COALESCE(SUM(ABS(lamports_in)), 0) / 1e9 as volume
    FROM trades
    WHERE block_time > NOW() - INTERVAL '30 days'
    GROUP BY DATE(block_time)
    ORDER BY date ASC
  `);

  const dailyVolume = (dailyVolumeResult.rows as Record<string, unknown>[]).map(r => ({
    date: String(r.date),
    volume: Number(r.volume || 0),
  }));

  const categoryBreakdown = await db.select({
    category: marketsCache.category,
    count: sql<number>`COUNT(*)::int`,
    volume: sql<number>`COALESCE(SUM(CAST(${marketsCache.totalVolume} AS NUMERIC)), 0)`,
  }).from(marketsCache).groupBy(marketsCache.category);

  return {
    totalMarkets: marketStats?.total || 0,
    openMarkets: marketStats?.open || 0,
    settledMarkets: marketStats?.settled || 0,
    totalTrades: tradeStats?.total || 0,
    totalUsers: userAgg?.total || 0,
    totalVolume: Number(tradeStats?.totalVolume || 0),
    totalLiquidity: Number(marketStats?.totalLiquidity || 0),
    avgWinRate: Number(userAgg?.avgWinRate || 0),
    totalComments: commentStats?.total || 0,
    dailyVolume,
    categoryBreakdown,
  };
}

export async function getAuditLog(page = 1, limit = 50) {
  if (!db) throw new Error("Database not available");
  const offset = (Math.max(1, page) - 1) * Math.min(100, Math.max(1, limit));

  const [rows, countRows] = await Promise.all([
    db.select().from(auditLog).orderBy(desc(auditLog.createdAt)).limit(limit).offset(offset),
    db.select({ count: sql<number>`COUNT(*)::int` }).from(auditLog),
  ]);

  const total = countRows[0]?.count ?? 0;
  return {
    logs: rows.map((r) => ({
      id: r.id,
      action: r.action,
      actor: r.actor,
      resource: r.resource,
      details: r.details,
      ip: r.ip,
      createdAt: r.createdAt?.toISOString() ?? new Date().toISOString(),
    })),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

export async function getAdminUsers() {
  if (!db) throw new Error("Database not available");

  const rows = await db
    .select({
      wallet: users.wallet,
      username: users.username,
      avatarUrl: users.avatarUrl,
      bio: users.bio,
      twitterHandle: users.twitterHandle,
      role: users.role,
      isBanned: users.isBanned,
      createdAt: users.createdAt,
      lastActive: users.lastActive,
      totalVolume: userStats.totalVolume,
      realizedPnl: userStats.realizedPnl,
      winRateBps: userStats.winRateBps,
      marketsTraded: userStats.marketsTraded,
    })
    .from(users)
    .leftJoin(userStats, eq(userStats.wallet, users.wallet))
    .orderBy(desc(sql`CAST(COALESCE(${userStats.totalVolume}, '0') AS NUMERIC)`))
    .limit(100);

  return rows.map(u => ({
    wallet: u.wallet,
    username: u.username,
    avatarUrl: u.avatarUrl,
    bio: u.bio,
    twitterHandle: u.twitterHandle,
    role: u.role,
    isBanned: u.isBanned,
    totalWagered: Number(u.totalVolume || 0),
    totalProfit: Number(u.realizedPnl || 0),
    winRate: u.winRateBps != null ? u.winRateBps / 100 : 0,
    marketsTraded: u.marketsTraded || 0,
    lastActive: u.lastActive,
    createdAt: u.createdAt,
  }));
}

export interface TreasuryQuery {
  page: number;
  limit: number;
  kind?: string;
  direction?: 'in' | 'out';
}

/** Set global paused state in platform_config (upsert single row). */
export async function setPlatformPaused(paused: boolean, pauseReason: string | null) {
  if (!db) throw new Error("Database not available");
  const existing = await db.select().from(platformConfig).limit(1);
  if (existing.length === 0) {
    await db.insert(platformConfig).values({ paused, pauseReason });
  } else {
    await db
      .update(platformConfig)
      .set({ paused, pauseReason, updatedAt: new Date() })
      .where(eq(platformConfig.id, existing[0].id));
  }
}

/** Set a single market's status (used by per-market emergency pause/unpause). */
export async function setMarketStatus(marketPubkey: string, status: string) {
  if (!db) throw new Error("Database not available");
  await db
    .update(marketsCache)
    .set({ status, updatedAt: new Date() })
    .where(eq(marketsCache.marketPubkey, marketPubkey));
}

export interface ProposalReviewInput {
  idOrPubkey: string;
  status: 'approved' | 'rejected';
  reviewer: string;
  note: string;
}

/** Approve or reject a pending market proposal. */
export async function reviewProposal(input: ProposalReviewInput) {
  if (!db) throw new Error("Database not available");
  const id = Number(input.idOrPubkey);

  let proposal;
  if (!Number.isNaN(id)) {
    [proposal] = await db.select().from(marketProposals).where(eq(marketProposals.id, id)).limit(1);
  } else {
    [proposal] = await db.select().from(marketProposals).where(eq(marketProposals.proposalPubkey, input.idOrPubkey)).limit(1);
  }
  if (!proposal) return null;
  if (proposal.status !== 'pending') return { error: `Proposal is already ${proposal.status}` };

  const [updated] = await db
    .update(marketProposals)
    .set({
      status: input.status,
      reviewer: input.reviewer,
      reviewNote: input.note,
      rejectionReason: input.status === 'rejected' ? input.note : null,
      reviewedAt: new Date(),
    })
    .where(eq(marketProposals.id, proposal.id))
    .returning();

  return { proposal: updated };
}

export interface DisputeResolution {
  disputeId: number;
  action: 'upheld' | 'rejected';
  winningOutcome?: string;
  note: string;
  resolver: string;
}

/**
 * Resolve a settlement dispute. Upheld: refund bond + update market outcome.
 * Rejected: forfeit bond to treasury. Both restore market status to settled.
 */
export async function resolveDisputeAdmin(input: DisputeResolution) {
  if (!db) throw new Error("Database not available");

  const [dispute] = await db
    .select()
    .from(disputes)
    .where(eq(disputes.id, input.disputeId))
    .limit(1);
  if (!dispute) return null;
  if (dispute.status !== 'open' && dispute.status !== 'pending') {
    return { error: `Dispute is already ${dispute.status}` };
  }

  const resolutionNote = input.note || `Dispute ${input.action} by admin`;
  const bondLamports = dispute.bondLamports ?? 100_000_000; // 0.1 SOL

  await db
    .update(disputes)
    .set({
      status: input.action === 'upheld' ? 'upheld' : 'rejected',
      resolution: resolutionNote,
      resolutionNote,
      resolver: input.resolver,
      resolvedBy: input.resolver,
      resolvedAt: new Date(),
    })
    .where(eq(disputes.id, input.disputeId));

  if (input.action === 'upheld') {
    const finalOutcome = (input.winningOutcome || dispute.claimedOutcome || 'YES').toLowerCase();
    await db
      .update(marketsCache)
      .set({ status: 'settled', winningOutcome: finalOutcome, updatedAt: new Date() })
      .where(eq(marketsCache.marketPubkey, dispute.marketPubkey));

    await db.insert(treasuryLedger).values({
      direction: 'out',
      kind: 'bond_forfeit', // refund to disputer
      amount: bondLamports,
      marketPubkey: dispute.marketPubkey,
      actor: dispute.disputer,
      note: `Dispute upheld: bond refunded + reward issued for market ${dispute.marketPubkey}`,
    });

    return { action: 'upheld', winningOutcome: finalOutcome };
  }

  await db
    .update(marketsCache)
    .set({ status: 'settled', updatedAt: new Date() })
    .where(eq(marketsCache.marketPubkey, dispute.marketPubkey));

  await db.insert(treasuryLedger).values({
    direction: 'in',
    kind: 'bond_forfeit',
    amount: bondLamports,
    marketPubkey: dispute.marketPubkey,
    actor: dispute.disputer,
    note: `Dispute rejected: bond forfeited to treasury for market ${dispute.marketPubkey}`,
  });

  return { action: 'rejected' };
}

export async function getAdminSettings() {
  if (!db) throw new Error("Database not available");
  const rows = await db.select().from(adminSettings);
  const settingsMap: Record<string, string> = {};
  rows.forEach(r => { settingsMap[r.key] = r.value; });

  return {
    settings: settingsMap,
    structured: {
      feeBps: Number(settingsMap.feeBps || 200),
      adminWallet: settingsMap.adminWallet || process.env.ADMIN_WALLET || '',
      platformName: settingsMap.platformName || 'SOLPredict',
      maintenanceMode: settingsMap.maintenanceMode === 'true',
      maxMarketDuration: Number(settingsMap.maxMarketDuration || 2592000),
      minMarketDuration: Number(settingsMap.minMarketDuration || 300),
    },
  };
}

/** Upsert one adminSettings key/value pair. */
export async function upsertAdminSetting(key: string, value: string, updatedBy: string) {
  if (!db) throw new Error("Database not available");
  const existing = await db.select().from(adminSettings).where(eq(adminSettings.key, key)).limit(1);
  if (existing.length > 0) {
    await db.update(adminSettings).set({ value, updatedBy, updatedAt: new Date() }).where(eq(adminSettings.key, key));
  } else {
    await db.insert(adminSettings).values({ key, value, updatedBy, updatedAt: new Date() });
  }
}

export async function logAuditEntry(action: string, actor: string, resource: string, details: unknown, ip: string) {
  if (!db) throw new Error("Database not available");
  await db.insert(auditLog).values({ action, actor, resource, details, ip });
}

export async function getTreasuryOverview(query: TreasuryQuery) {
  if (!db) throw new Error("Database not available");
  const { page, limit, kind, direction } = query;
  const offset = (page - 1) * limit;

  const [config] = await db.select().from(platformConfig).limit(1);
  const treasuryAddress = config?.treasuryWallet || process.env.ADMIN_WALLET || '';

  const conditions = [];
  if (kind) conditions.push(eq(treasuryLedger.kind, kind));
  if (direction) conditions.push(eq(treasuryLedger.direction, direction));
  const whereClause = conditions.length > 0 ? sql.join(conditions, sql` AND `) : undefined;

  const [ledgerRows, countRows, ledgerSum] = await Promise.all([
    db.select().from(treasuryLedger).where(whereClause).orderBy(desc(treasuryLedger.ts)).limit(limit).offset(offset),
    db.select({ count: sql<number>`COUNT(*)::int` }).from(treasuryLedger).where(whereClause),
    db.select({
      totalIn: sql<string>`COALESCE(SUM(CASE WHEN direction = 'in' THEN amount ELSE 0 END), 0)::text`,
      totalOut: sql<string>`COALESCE(SUM(CASE WHEN direction = 'out' THEN amount ELSE 0 END), 0)::text`,
    }).from(treasuryLedger),
  ]);

  const totalLedgerInLamports = Number(ledgerSum[0]?.totalIn || 0);
  const totalLedgerOutLamports = Number(ledgerSum[0]?.totalOut || 0);

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

  return {
    treasuryWallet: treasuryAddress,
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
    ledgerTotals: {
      totalInLamports: totalLedgerInLamports,
      totalOutLamports: totalLedgerOutLamports,
      netLedgerSol: (totalLedgerInLamports - totalLedgerOutLamports) / 1e9,
    },
    marketFees: marketFees.map((m) => ({
      marketPubkey: m.marketPubkey,
      question: m.question,
      status: m.status,
      feeLamports: m.feeCollectedLamports ?? 0,
      feeSol: Number(((m.feeCollectedLamports ?? 0) / 1e9).toFixed(4)),
    })),
  };
}
