-- Migration 0006: Reconcile the database to app/src/lib/db/schema.ts
--
-- The schema (schema.ts) grew faster than the migration set: 14 tables and a
-- number of columns declared in schema.ts were never created by any migration.
-- This migration adds every missing table and column idempotently so a fresh
-- deployment converges to the canonical schema, and an existing database can
-- apply it safely (every statement tolerates already-existing objects).
--
-- Tables missing from migrations 0000-0005 (created below):
--   user_stats, market_outcomes, positions, orders, rewards, disputes,
--   platform_config, treasury_ledger, achievements, audit_log, comment_votes,
--   follows, indexer_cursor, treasury_withdrawals

-- =============================================================================
-- 1. markets_cache — missing columns
-- =============================================================================
ALTER TABLE "markets_cache" ADD COLUMN IF NOT EXISTS "creator" varchar(44);
ALTER TABLE "markets_cache" ADD COLUMN IF NOT EXISTS "outcome_type" varchar(20) DEFAULT 'binary';
ALTER TABLE "markets_cache" ADD COLUMN IF NOT EXISTS "resolution_source" text;
ALTER TABLE "markets_cache" ADD COLUMN IF NOT EXISTS "oracle_feed_id" varchar(66);
ALTER TABLE "markets_cache" ADD COLUMN IF NOT EXISTS "fee_collected_lamports" bigint DEFAULT 0;
ALTER TABLE "markets_cache" ADD COLUMN IF NOT EXISTS "total_payout_pool_lamports" bigint DEFAULT 0;
ALTER TABLE "markets_cache" ADD COLUMN IF NOT EXISTS "fee_bps" integer DEFAULT 200;
ALTER TABLE "markets_cache" ADD COLUMN IF NOT EXISTS "open_interest" numeric(18, 9) DEFAULT '0';
ALTER TABLE "markets_cache" ADD COLUMN IF NOT EXISTS "rent_deposit_lamports" bigint;
ALTER TABLE "markets_cache" ADD COLUMN IF NOT EXISTS "rent_reclaimed_at" timestamp;
ALTER TABLE "markets_cache" ADD COLUMN IF NOT EXISTS "created_slot" bigint;
ALTER TABLE "markets_cache" ADD COLUMN IF NOT EXISTS "settled_at" timestamp;

-- =============================================================================
-- 2. trades — missing columns
-- =============================================================================
ALTER TABLE "trades" ADD COLUMN IF NOT EXISTS "outcome_index" integer DEFAULT 0;
ALTER TABLE "trades" ADD COLUMN IF NOT EXISTS "shares" bigint;
ALTER TABLE "trades" ADD COLUMN IF NOT EXISTS "cost" bigint;
ALTER TABLE "trades" ADD COLUMN IF NOT EXISTS "avg_price_bps" integer;
ALTER TABLE "trades" ADD COLUMN IF NOT EXISTS "fee_paid_lamports" bigint DEFAULT 0;

-- =============================================================================
-- 3. users — missing columns (role / is_banned)
-- =============================================================================
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "role" varchar(20) DEFAULT 'user';
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "is_banned" boolean DEFAULT false;

-- =============================================================================
-- 4. market_proposals — missing columns
-- =============================================================================
ALTER TABLE "market_proposals" ADD COLUMN IF NOT EXISTS "reviewer" varchar(44);
ALTER TABLE "market_proposals" ADD COLUMN IF NOT EXISTS "review_note" text;
ALTER TABLE "market_proposals" ADD COLUMN IF NOT EXISTS "reviewed_at" timestamp;

-- =============================================================================
-- 5. liquidity_positions — migration 0003 dropped the old columns without
--    adding the new ones (lp_shares / deposited / fees_earned)
-- =============================================================================
ALTER TABLE "liquidity_positions" ADD COLUMN IF NOT EXISTS "lp_shares" bigint DEFAULT 0;
ALTER TABLE "liquidity_positions" ADD COLUMN IF NOT EXISTS "deposited" numeric(18, 9) DEFAULT '0';
ALTER TABLE "liquidity_positions" ADD COLUMN IF NOT EXISTS "fees_earned" numeric(18, 9) DEFAULT '0';

-- =============================================================================
-- 6. user_stats
-- =============================================================================
CREATE TABLE IF NOT EXISTS "user_stats" (
	"wallet" varchar(44) PRIMARY KEY NOT NULL,
	"total_volume" numeric(18, 9) DEFAULT '0',
	"trade_count" integer DEFAULT 0,
	"markets_traded" integer DEFAULT 0,
	"markets_resolved" integer DEFAULT 0,
	"wins" integer DEFAULT 0,
	"losses" integer DEFAULT 0,
	"win_rate_bps" integer,
	"realized_pnl" numeric(18, 9) DEFAULT '0',
	"unrealized_pnl" numeric(18, 9) DEFAULT '0',
	"roi_bps" integer,
	"best_trade" numeric(18, 9) DEFAULT '0',
	"current_streak" integer DEFAULT 0,
	"rank" integer,
	"updated_at" timestamp DEFAULT now()
);

-- =============================================================================
-- 7. market_outcomes
-- =============================================================================
CREATE TABLE IF NOT EXISTS "market_outcomes" (
	"id" serial PRIMARY KEY NOT NULL,
	"market_pubkey" varchar(44) NOT NULL,
	"outcome_index" integer NOT NULL,
	"label" varchar(100) NOT NULL,
	"shares_outstanding" bigint DEFAULT 0,
	"last_price_bps" integer DEFAULT 5000,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "market_outcomes_market_pubkey_outcome_index_unique" UNIQUE("market_pubkey","outcome_index")
);

-- =============================================================================
-- 8. positions
-- =============================================================================
CREATE TABLE IF NOT EXISTS "positions" (
	"id" serial PRIMARY KEY NOT NULL,
	"wallet" varchar(44) NOT NULL,
	"market_pubkey" varchar(44) NOT NULL,
	"outcome_index" integer DEFAULT 0,
	"shares" bigint DEFAULT 0,
	"cost_basis" bigint DEFAULT 0,
	"realized_pnl" bigint DEFAULT 0,
	"claimed" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "positions_wallet_market_pubkey_outcome_index_unique" UNIQUE("wallet","market_pubkey","outcome_index")
);

-- =============================================================================
-- 9. orders (CLOB order book mirror)
-- =============================================================================
CREATE TABLE IF NOT EXISTS "orders" (
	"id" serial PRIMARY KEY NOT NULL,
	"pubkey" varchar(44),
	"market_pubkey" varchar(44) NOT NULL,
	"outcome_index" integer DEFAULT 0,
	"owner" varchar(44) NOT NULL,
	"side" varchar(4) NOT NULL,
	"price_bps" integer NOT NULL,
	"size" bigint NOT NULL,
	"filled" bigint DEFAULT 0,
	"status" varchar(20) DEFAULT 'open',
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "orders_pubkey_unique" UNIQUE("pubkey")
);

-- =============================================================================
-- 10. rewards
-- =============================================================================
CREATE TABLE IF NOT EXISTS "rewards" (
	"id" serial PRIMARY KEY NOT NULL,
	"wallet" varchar(44) NOT NULL,
	"epoch" integer,
	"kind" varchar(20),
	"amount" bigint,
	"status" varchar(20) DEFAULT 'accrued',
	"claim_signature" varchar(88),
	"claimed_at" timestamp,
	"created_at" timestamp DEFAULT now()
);

-- =============================================================================
-- 11. disputes
-- =============================================================================
CREATE TABLE IF NOT EXISTS "disputes" (
	"id" serial PRIMARY KEY NOT NULL,
	"market_pubkey" varchar(44) NOT NULL,
	"disputer" varchar(44) NOT NULL,
	"claimed_outcome" varchar(10),
	"reason" text NOT NULL,
	"evidence_url" text,
	"evidence" text,
	"bond_lamports" bigint,
	"status" varchar(20) DEFAULT 'open',
	"resolution" text,
	"resolution_note" text,
	"resolver" varchar(44),
	"resolved_by" varchar(44),
	"created_at" timestamp DEFAULT now(),
	"resolved_at" timestamp
);

-- =============================================================================
-- 12. platform_config (single mutable row, id=1)
-- =============================================================================
CREATE TABLE IF NOT EXISTS "platform_config" (
	"id" serial PRIMARY KEY NOT NULL,
	"fee_bps" integer DEFAULT 200,
	"min_liquidity" bigint DEFAULT 0,
	"proposal_bond" bigint DEFAULT 0,
	"dispute_bond" bigint DEFAULT 0,
	"dispute_window_secs" integer DEFAULT 86400,
	"paused" boolean DEFAULT false,
	"pause_reason" text,
	"treasury_wallet" varchar(44),
	"admin_wallets" text[],
	"updated_at" timestamp DEFAULT now()
);

-- =============================================================================
-- 13. treasury_ledger
-- =============================================================================
CREATE TABLE IF NOT EXISTS "treasury_ledger" (
	"id" serial PRIMARY KEY NOT NULL,
	"ts" timestamp DEFAULT now(),
	"signature" varchar(88),
	"direction" varchar(3) NOT NULL,
	"kind" varchar(30) NOT NULL,
	"amount" bigint NOT NULL,
	"mint" varchar(44),
	"market_pubkey" varchar(44),
	"actor" varchar(44),
	"note" text,
	"created_at" timestamp DEFAULT now()
);

-- =============================================================================
-- 14. achievements
-- =============================================================================
CREATE TABLE IF NOT EXISTS "achievements" (
	"id" serial PRIMARY KEY NOT NULL,
	"wallet" varchar(44) NOT NULL,
	"kind" varchar(50) NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text,
	"awarded_at" timestamp DEFAULT now()
);

-- =============================================================================
-- 15. audit_log
-- =============================================================================
CREATE TABLE IF NOT EXISTS "audit_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"action" varchar(100) NOT NULL,
	"actor" varchar(44) NOT NULL,
	"resource" text,
	"details" jsonb,
	"ip" varchar(45),
	"created_at" timestamp DEFAULT now()
);

-- =============================================================================
-- 16. comment_votes
-- =============================================================================
CREATE TABLE IF NOT EXISTS "comment_votes" (
	"id" serial PRIMARY KEY NOT NULL,
	"comment_id" integer NOT NULL,
	"wallet" varchar(44) NOT NULL,
	"vote" integer DEFAULT 1,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "comment_votes_comment_id_wallet_unique" UNIQUE("comment_id","wallet")
);

-- =============================================================================
-- 17. follows
-- =============================================================================
CREATE TABLE IF NOT EXISTS "follows" (
	"id" serial PRIMARY KEY NOT NULL,
	"follower_wallet" varchar(44) NOT NULL,
	"followed_wallet" varchar(44) NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "follows_follower_wallet_followed_wallet_unique" UNIQUE("follower_wallet","followed_wallet")
);

-- =============================================================================
-- 18. indexer_cursor
-- =============================================================================
CREATE TABLE IF NOT EXISTS "indexer_cursor" (
	"id" serial PRIMARY KEY NOT NULL,
	"last_signature" varchar(88),
	"last_slot" bigint,
	"updated_at" timestamp DEFAULT now()
);

-- =============================================================================
-- 19. treasury_withdrawals
-- =============================================================================
CREATE TABLE IF NOT EXISTS "treasury_withdrawals" (
	"id" serial PRIMARY KEY NOT NULL,
	"amount_sol" numeric(18, 9) NOT NULL,
	"signature" varchar(88),
	"recipient" varchar(44) NOT NULL,
	"status" varchar(20) DEFAULT 'pending',
	"created_at" timestamp DEFAULT now()
);

-- =============================================================================
-- 20. Indexes declared in schema.ts for the new tables
-- =============================================================================
CREATE INDEX IF NOT EXISTS "outcomes_market_idx" ON "market_outcomes" ("market_pubkey");
CREATE INDEX IF NOT EXISTS "positions_wallet_idx" ON "positions" ("wallet");
CREATE INDEX IF NOT EXISTS "orders_market_idx" ON "orders" ("market_pubkey");
CREATE INDEX IF NOT EXISTS "orders_owner_idx" ON "orders" ("owner");
CREATE INDEX IF NOT EXISTS "rewards_wallet_status_idx" ON "rewards" ("wallet","status");
CREATE INDEX IF NOT EXISTS "disputes_market_idx" ON "disputes" ("market_pubkey");
CREATE INDEX IF NOT EXISTS "disputes_status_idx" ON "disputes" ("status");
CREATE INDEX IF NOT EXISTS "achievements_wallet_idx" ON "achievements" ("wallet");
CREATE INDEX IF NOT EXISTS "audit_log_actor_idx" ON "audit_log" ("actor");
CREATE INDEX IF NOT EXISTS "audit_log_ts_idx" ON "audit_log" ("created_at");
CREATE INDEX IF NOT EXISTS "follows_follower_idx" ON "follows" ("follower_wallet");
CREATE INDEX IF NOT EXISTS "follows_followed_idx" ON "follows" ("followed_wallet");
CREATE INDEX IF NOT EXISTS "proposals_status_idx" ON "market_proposals" ("status");
CREATE INDEX IF NOT EXISTS "proposals_proposer_idx" ON "market_proposals" ("proposer");
CREATE INDEX IF NOT EXISTS "notifications_wallet_idx" ON "notifications" ("wallet");
CREATE INDEX IF NOT EXISTS "markets_status_close_idx" ON "markets_cache" ("status","end_ts");
CREATE INDEX IF NOT EXISTS "markets_category_idx" ON "markets_cache" ("category");
CREATE INDEX IF NOT EXISTS "markets_creator_idx" ON "markets_cache" ("creator");
CREATE INDEX IF NOT EXISTS "markets_updated_at_idx" ON "markets_cache" ("updated_at");
CREATE INDEX IF NOT EXISTS "trades_trader_ts_idx" ON "trades" ("trader","block_time");
CREATE INDEX IF NOT EXISTS "trades_market_ts_idx" ON "trades" ("market_pubkey","block_time");
CREATE INDEX IF NOT EXISTS "price_history_market_ts_idx" ON "price_history" ("market_pubkey","timestamp");
