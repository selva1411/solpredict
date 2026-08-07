-- Migration 0003: Schema Collapse (RC-1 + RC-4)
--
-- RC-1: Remove legacy pool columns from markets_cache.
-- market_outcomes.last_price_bps is now the ONLY source of per-outcome prices.
-- yesPoolSol/noPoolSol/yesSupply/noSupply were a competing data model.
--
-- RC-4: Remove legacy stat columns from users.
-- user_stats is now the ONLY source of stats.
-- users holds identity only (wallet, username, bio, avatar, role, banned).

-- RC-1: Drop legacy pool columns from markets_cache
ALTER TABLE "markets_cache" DROP COLUMN IF EXISTS "yes_pool_sol";
ALTER TABLE "markets_cache" DROP COLUMN IF EXISTS "no_pool_sol";
ALTER TABLE "markets_cache" DROP COLUMN IF EXISTS "yes_supply";
ALTER TABLE "markets_cache" DROP COLUMN IF EXISTS "no_supply";

-- RC-4: Drop legacy stat columns from users
ALTER TABLE "users" DROP COLUMN IF EXISTS "total_wagered";
ALTER TABLE "users" DROP COLUMN IF EXISTS "total_won";
ALTER TABLE "users" DROP COLUMN IF EXISTS "total_profit";
ALTER TABLE "users" DROP COLUMN IF EXISTS "win_rate";
ALTER TABLE "users" DROP COLUMN IF EXISTS "pas_score";
ALTER TABLE "users" DROP COLUMN IF EXISTS "markets_traded";

-- Drop legacy columns from price_history
ALTER TABLE "price_history" DROP COLUMN IF EXISTS "yes_pct";
ALTER TABLE "price_history" DROP COLUMN IF EXISTS "yes_pool_sol";
ALTER TABLE "price_history" DROP COLUMN IF EXISTS "no_pool_sol";

-- Drop legacy columns from liquidity_positions
ALTER TABLE "liquidity_positions" DROP COLUMN IF EXISTS "amount_sol";
ALTER TABLE "liquidity_positions" DROP COLUMN IF EXISTS "yes_pool_sol";
ALTER TABLE "liquidity_positions" DROP COLUMN IF EXISTS "no_pool_sol";
ALTER TABLE "liquidity_positions" DROP COLUMN IF EXISTS "lp_tokens";

-- Ensure markets_cache has liquidity_param_b for LMSR
DO $$ BEGIN
  ALTER TABLE "markets_cache" ADD COLUMN "liquidity_param_b" numeric(18, 9) DEFAULT '100.0';
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Ensure market_outcomes has updated_at for tracking
DO $$ BEGIN
  ALTER TABLE "market_outcomes" ADD COLUMN "updated_at" timestamp DEFAULT now();
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Add username uniqueness constraint to users (for profile)
DO $$ BEGIN
  ALTER TABLE "users" ADD CONSTRAINT "users_username_unique" UNIQUE ("username");
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
