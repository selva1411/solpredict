-- Migration 0004: Reintroduce REAL pool/supply snapshots on markets_cache.
--
-- Migration 0003 dropped the competing *_sol columns (yes_pool_sol etc.).
-- Those were numeric SOL values from a competing data model. These new
-- *_lamports columns are the authoritative mirror of the on-chain Market
-- account (yes_pool_lamports / no_pool_lamports / yes_supply / no_supply),
-- written by the indexer/reconciler and by the frontend trade sync
-- (buy/sell/LP). Every page (home, /markets, market detail, related markets,
-- order book) reads the SAME numbers from these columns, eliminating the
-- fabricated/flickering pool values that previously disagreed between pages.

DO $$ BEGIN
  ALTER TABLE "markets_cache" ADD COLUMN "yes_pool_lamports" bigint DEFAULT 0;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "markets_cache" ADD COLUMN "no_pool_lamports" bigint DEFAULT 0;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "markets_cache" ADD COLUMN "yes_supply" bigint DEFAULT 0;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "markets_cache" ADD COLUMN "no_supply" bigint DEFAULT 0;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;
