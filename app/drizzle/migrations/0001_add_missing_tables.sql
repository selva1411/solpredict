-- Migration: Add missing tables for LP, admin settings, proposals, and price alerts
-- These tables are defined in schema.ts but were never created in the database

CREATE TABLE IF NOT EXISTS "liquidity_positions" (
	"id" serial PRIMARY KEY NOT NULL,
	"wallet" varchar(44) NOT NULL,
	"market_pubkey" varchar(44) NOT NULL,
	"amount_sol" numeric(18, 9) DEFAULT '0',
	"yes_pool_sol" numeric(18, 9) DEFAULT '0',
	"no_pool_sol" numeric(18, 9) DEFAULT '0',
	"lp_tokens" bigint DEFAULT 0,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "liquidity_positions_wallet_market_pubkey_unique" UNIQUE("wallet","market_pubkey")
);

CREATE TABLE IF NOT EXISTS "lp_pool_stats" (
	"id" serial PRIMARY KEY NOT NULL,
	"market_pubkey" varchar(44) NOT NULL,
	"total_liquidity_sol" numeric(18, 9) DEFAULT '0',
	"total_lp_tokens" bigint DEFAULT 0,
	"fee_earned_sol" numeric(18, 9) DEFAULT '0',
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "lp_pool_stats_market_pubkey_unique" UNIQUE("market_pubkey")
);

CREATE TABLE IF NOT EXISTS "admin_settings" (
	"key" varchar(50) PRIMARY KEY NOT NULL,
	"value" text NOT NULL,
	"updated_by" varchar(44),
	"updated_at" timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "market_proposals" (
	"id" serial PRIMARY KEY NOT NULL,
	"proposal_pubkey" varchar(44) NOT NULL,
	"proposer" varchar(44) NOT NULL,
	"question" text NOT NULL,
	"description" text,
	"category" varchar(20),
	"oracle_feed_id" varchar(66),
	"target_price" numeric(20, 8),
	"end_ts" timestamp,
	"resolve_ts" timestamp,
	"bond_lamports" bigint,
	"status" varchar(20) DEFAULT 'pending',
	"approved_market_pubkey" varchar(44),
	"rejection_reason" text,
	"created_at" timestamp DEFAULT now(),
	"resolved_at" timestamp,
	CONSTRAINT "market_proposals_proposal_pubkey_unique" UNIQUE("proposal_pubkey")
);

CREATE TABLE IF NOT EXISTS "price_alerts" (
	"id" serial PRIMARY KEY NOT NULL,
	"wallet" varchar(44) NOT NULL,
	"market_pubkey" varchar(44) NOT NULL,
	"target_price" numeric(20, 8) NOT NULL,
	"comparison" varchar(10) DEFAULT 'above',
	"triggered" boolean DEFAULT false,
	"triggered_at" timestamp,
	"active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now()
);
