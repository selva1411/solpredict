-- Migration 0005: performance indexes
-- Warm-query latency on Neon is dominated by seq scans on small tables
-- (455ms for 148 rows on trades). These indexes make the hot read paths
-- (market detail, user positions, leaderboard, activity) use index scans.

CREATE INDEX IF NOT EXISTS idx_trades_market_pubkey ON trades (market_pubkey);
CREATE INDEX IF NOT EXISTS idx_trades_trader ON trades (trader);
CREATE INDEX IF NOT EXISTS idx_trades_block_time ON trades (block_time DESC);

CREATE INDEX IF NOT EXISTS idx_positions_wallet ON positions (wallet);
CREATE INDEX IF NOT EXISTS idx_positions_market ON positions (market_pubkey);

CREATE INDEX IF NOT EXISTS idx_market_comments_market ON market_comments (market_pubkey);
CREATE INDEX IF NOT EXISTS idx_market_comments_created ON market_comments (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_price_history_market ON price_history (market_pubkey);
CREATE INDEX IF NOT EXISTS idx_price_history_time ON price_history (timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_markets_cache_status ON markets_cache (status);
CREATE INDEX IF NOT EXISTS idx_markets_cache_end_ts ON markets_cache (end_ts);

CREATE INDEX IF NOT EXISTS idx_market_outcomes_market ON market_outcomes (market_pubkey);

CREATE INDEX IF NOT EXISTS idx_liquidity_positions_wallet ON liquidity_positions (wallet);
