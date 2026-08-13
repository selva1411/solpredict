import { getDb } from "@/lib/db/client";
import { logger } from "@/lib/logger";
import { revalidateTag } from "@/lib/cache-control";
import { sql } from "drizzle-orm";

const RECOMPUTE_USER_STATS_SQL = `
CREATE OR REPLACE FUNCTION recompute_user_stats(p_wallet text)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  WITH resolved AS (
    SELECT
      p.wallet,
      p.market_pubkey,
      p.outcome_index,
      p.shares,
      p.cost_basis,
      m.winning_outcome,
      (
        CASE
          WHEN LOWER(m.winning_outcome) = 'yes' AND p.outcome_index = 0 THEN true
          WHEN LOWER(m.winning_outcome) = 'no' AND p.outcome_index = 1 THEN true
          ELSE false
        END
      ) AS is_win,
      (
        CASE
          WHEN (
            CASE
              WHEN LOWER(m.winning_outcome) = 'yes' AND p.outcome_index = 0 THEN true
              WHEN LOWER(m.winning_outcome) = 'no' AND p.outcome_index = 1 THEN true
              ELSE false
            END
          ) THEN p.shares * 10 - p.cost_basis
          ELSE -p.cost_basis
        END
      ) AS pnl
    FROM positions p
    JOIN markets_cache m ON m.market_pubkey = p.market_pubkey
    WHERE p.wallet = p_wallet
      AND m.status = 'settled'
      AND m.winning_outcome IS NOT NULL
  ),
  agg AS (
    SELECT
      COUNT(*) FILTER (WHERE is_win) AS wins,
      COUNT(*) FILTER (WHERE NOT is_win) AS losses,
      COALESCE(SUM(pnl), 0) AS realized_pnl,
      COALESCE(MAX(pnl), 0) AS best_trade
    FROM resolved
  ),
  vol AS (
    SELECT
      COALESCE(SUM(ABS(lamports_in)), 0) AS total_volume,
      COUNT(*) AS trade_count,
      COUNT(DISTINCT market_pubkey) AS markets_traded
    FROM trades
    WHERE trader = p_wallet
  ),
  unreal AS (
    SELECT COALESCE(SUM(
      (p.shares * 10 * COALESCE(mo.last_price_bps, 5000) / 10000.0 - p.cost_basis) / 1e9
    ), 0) AS unrealized_pnl
    FROM positions p
    JOIN markets_cache m ON m.market_pubkey = p.market_pubkey
    LEFT JOIN market_outcomes mo
      ON mo.market_pubkey = p.market_pubkey AND mo.outcome_index = p.outcome_index
    WHERE p.wallet = p_wallet
      AND m.status = 'open'
  )
  INSERT INTO user_stats (
    wallet, wins, losses, win_rate_bps, realized_pnl, best_trade,
    total_volume, trade_count, markets_traded, markets_resolved, roi_bps, unrealized_pnl, updated_at
  )
  SELECT
    p_wallet,
    a.wins,
    a.losses,
    CASE
      WHEN (a.wins + a.losses) = 0 THEN NULL
      ELSE (a.wins * 10000) / (a.wins + a.losses)
    END,
    (a.realized_pnl::numeric / 1e9),
    (a.best_trade::numeric / 1e9),
    (v.total_volume::numeric / 1e9),
    v.trade_count,
    v.markets_traded,
    (a.wins + a.losses),
    CASE
      WHEN v.total_volume = 0 THEN NULL
      ELSE (a.realized_pnl * 10000) / v.total_volume
    END,
    u.unrealized_pnl,
    NOW()
  FROM agg a, vol v, unreal u
  ON CONFLICT (wallet) DO UPDATE SET
    wins = EXCLUDED.wins,
    losses = EXCLUDED.losses,
    win_rate_bps = EXCLUDED.win_rate_bps,
    realized_pnl = EXCLUDED.realized_pnl,
    best_trade = EXCLUDED.best_trade,
    total_volume = EXCLUDED.total_volume,
    trade_count = EXCLUDED.trade_count,
    markets_traded = EXCLUDED.markets_traded,
    markets_resolved = EXCLUDED.markets_resolved,
    roi_bps = EXCLUDED.roi_bps,
    unrealized_pnl = EXCLUDED.unrealized_pnl,
    updated_at = NOW();

  UPDATE users u
  SET last_active = NOW()
  WHERE u.wallet = p_wallet;
END;
$$;
`;

const RECOMPUTE_ALL_USER_STATS_SQL = `
CREATE OR REPLACE FUNCTION recompute_all_user_stats()
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  w RECORD;
  c INTEGER := 0;
BEGIN
  FOR w IN SELECT DISTINCT wallet FROM users LOOP
    PERFORM recompute_user_stats(w.wallet);
    c := c + 1;
  END LOOP;
  RETURN c;
END;
$$;
`;

/**
 * Install the recompute_user_stats() SQL functions into the database.
 * Idempotent (CREATE OR REPLACE). Returns true on success.
 */
export async function installUserStatsFunction(): Promise<boolean> {
  const db = getDb();
  if (!db) {
    logger.warn("[user-stats] no database; skipping function install");
    return false;
  }
  try {
    await db.execute(sql.raw(RECOMPUTE_USER_STATS_SQL));
    await db.execute(sql.raw(RECOMPUTE_ALL_USER_STATS_SQL));
    logger.info("[user-stats] recompute_user_stats() installed");
    return true;
  } catch (e) {
    logger.warn("[user-stats] failed to install function:", e);
    return false;
  }
}

/**
 * Run a recompute pass for a specific wallet or all users.
 */
export async function recomputeUserStats(targetWallet?: string): Promise<number> {
  const db = getDb();
  if (!db) {
    logger.warn("[user-stats] no database; skip");
    return 0;
  }

  try {
    await installUserStatsFunction();
    if (targetWallet) {
      await db.execute(`SELECT recompute_user_stats('${targetWallet.replace(/'/g, "''")}')`);
      logger.info(`[user-stats] recomputed user ${targetWallet}`);
      revalidateTag("leaderboard");
      return 1;
    } else {
      const result = await db.execute("SELECT recompute_all_user_stats() AS updated");
      const updated = Number((result.rows?.[0] as Record<string, unknown> | undefined)?.updated ?? 0);
      logger.info(`[user-stats] recomputed ${updated} users`);
      if (updated > 0) revalidateTag("leaderboard");
      return updated;
    }
  } catch (e) {
    logger.warn("[user-stats] recompute failed:", e);
    return 0;
  }
}