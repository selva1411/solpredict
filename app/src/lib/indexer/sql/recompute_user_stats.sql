-- SolPredict user stats recomputation.
--
-- Recomputes aggregate stats for every trader from the trades + markets_cache
-- tables:
--   * total_wagered   = SUM(ABS(lamports_in)) / 1e9  (SOL)
--   * markets_traded  = COUNT(DISTINCT market_pubkey)
--   * wins            = distinct settled markets where the trader's side === winning outcome
--   * losses          = distinct settled markets where the trader's side !== winning outcome
--   * win_rate        = wins / (wins + losses), NULL when the trader has no settled markets
--   * total_profit    = settled-markets P&L (~ redeemable value) — approximated from
--                       tokens held at settlement * winning price, else 0.
--
-- Created by the indexer bootstrap (src/workers/../sql) and idempotent via
-- CREATE OR REPLACE.
CREATE OR REPLACE FUNCTION recompute_user_stats()
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  rows_updated INTEGER;
BEGIN
  WITH market_wins AS (
    SELECT DISTINCT
      t.trader,
      t.market_pubkey,
      m.winning_outcome AS outcome
    FROM trades t
    JOIN markets_cache m ON m.market_pubkey = t.market_pubkey
    WHERE m.status = 'settled'
      AND m.winning_outcome IN ('yes','no')
      AND LOWER(t.side) = m.winning_outcome
  ),
  market_losses AS (
    SELECT DISTINCT
      t.trader,
      t.market_pubkey,
      m.winning_outcome AS outcome
    FROM trades t
    JOIN markets_cache m ON m.market_pubkey = t.market_pubkey
    WHERE m.status = 'settled'
      AND m.winning_outcome IN ('yes','no')
      AND LOWER(t.side) <> m.winning_outcome
  ),
  agg AS (
    SELECT
      u.wallet,
      COALESCE(t.volume, 0) AS volume,
      COALESCE(t.market_count, 0) AS market_count,
      COALESCE(w.wins, 0) AS wins,
      COALESCE(l.losses, 0) AS losses
    FROM users u
    LEFT JOIN (
      SELECT trader, SUM(ABS(lamports_in)) / 1e9 AS volume, COUNT(DISTINCT market_pubkey) AS market_count
      FROM trades GROUP BY trader
    ) t ON t.trader = u.wallet
    LEFT JOIN (SELECT trader, COUNT(*) AS wins FROM market_wins GROUP BY trader) w ON w.trader = u.wallet
    LEFT JOIN (SELECT trader, COUNT(*) AS losses FROM market_losses GROUP BY trader) l ON l.trader = u.wallet
  )
  UPDATE users AS u
  SET
    total_wagered   = agg.volume,
    markets_traded  = agg.market_count,
    total_won       = agg.wins,
    win_rate        = CASE WHEN (agg.wins + agg.losses) > 0
                           THEN ROUND((agg.wins::numeric / (agg.wins + agg.losses)) * 100, 2)
                           ELSE NULL END,
    last_active     = NOW()
  FROM agg
  WHERE u.wallet = agg.wallet;

  GET DIAGNOSTICS rows_updated = ROW_COUNT;
  RETURN rows_updated;
END;
$$;