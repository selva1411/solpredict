-- Migration 0002: Install recompute_user_stats functions
-- These SQL functions were defined in code but never installed in the database.
-- The user_stats table exists but is empty because these functions never ran.

-- Per-wallet recompute: joins positions + trades + markets_cache to derive
-- wins, losses, win_rate_bps, realized_pnl, volume, etc.
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
          ) THEN p.shares - p.cost_basis
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
      COALESCE(SUM(lamports_in), 0) AS total_volume,
      COUNT(*) AS trade_count,
      COUNT(DISTINCT market_pubkey) AS markets_traded
    FROM trades
    WHERE trader = p_wallet
  )
  INSERT INTO user_stats (
    wallet, wins, losses, win_rate_bps, realized_pnl, best_trade,
    total_volume, trade_count, markets_traded, markets_resolved, roi_bps, updated_at
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
    NOW()
  FROM agg a, vol v
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
    updated_at = NOW();
END;
$$;

-- Batch recompute for all users
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
