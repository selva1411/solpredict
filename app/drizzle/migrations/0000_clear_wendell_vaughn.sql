CREATE TABLE "leaderboard_snapshots" (
	"id" serial PRIMARY KEY NOT NULL,
	"wallet" varchar(44) NOT NULL,
	"period" varchar(10),
	"rank" integer,
	"profit_sol" numeric(18, 9),
	"win_rate" numeric(5, 2),
	"pas_score" integer,
	"markets_count" integer,
	"snapshot_date" date
);
--> statement-breakpoint
CREATE TABLE "market_comments" (
	"id" serial PRIMARY KEY NOT NULL,
	"market_pubkey" varchar(44) NOT NULL,
	"author_wallet" varchar(44) NOT NULL,
	"author_username" varchar(50),
	"author_avatar" text,
	"content" text NOT NULL,
	"parent_id" integer,
	"upvotes" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "markets_cache" (
	"id" serial PRIMARY KEY NOT NULL,
	"market_pubkey" varchar(44) NOT NULL,
	"market_id" bigint NOT NULL,
	"question" text NOT NULL,
	"description" text,
	"category" varchar(20),
	"status" varchar(20) DEFAULT 'open',
	"winning_outcome" varchar(10),
	"yes_pool_sol" numeric(18, 9) DEFAULT '0',
	"no_pool_sol" numeric(18, 9) DEFAULT '0',
	"yes_supply" bigint DEFAULT 0,
	"no_supply" bigint DEFAULT 0,
	"end_ts" timestamp,
	"resolve_ts" timestamp,
	"thumbnail_url" text,
	"tags" text[],
	"view_count" integer DEFAULT 0,
	"watchlist_count" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "markets_cache_market_pubkey_unique" UNIQUE("market_pubkey")
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"wallet" varchar(44) NOT NULL,
	"type" varchar(30),
	"market_pubkey" varchar(44),
	"message" text,
	"read" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "price_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"market_pubkey" varchar(44) NOT NULL,
	"timestamp" timestamp NOT NULL,
	"yes_pct" numeric(5, 2),
	"yes_pool_sol" numeric(18, 9),
	"no_pool_sol" numeric(18, 9),
	"total_volume" numeric(18, 9)
);
--> statement-breakpoint
CREATE TABLE "trades" (
	"id" serial PRIMARY KEY NOT NULL,
	"signature" varchar(88) NOT NULL,
	"market_pubkey" varchar(44) NOT NULL,
	"trader" varchar(44) NOT NULL,
	"side" varchar(3) NOT NULL,
	"lamports_in" bigint,
	"tokens_out" bigint,
	"price_per_token" numeric(18, 9),
	"block_time" timestamp,
	"slot" bigint,
	CONSTRAINT "trades_signature_unique" UNIQUE("signature")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"wallet" varchar(44) NOT NULL,
	"username" varchar(50),
	"avatar_url" text,
	"bio" text,
	"twitter_handle" varchar(50),
	"total_wagered" numeric(18, 9) DEFAULT '0',
	"total_won" numeric(18, 9) DEFAULT '0',
	"total_profit" numeric(18, 9) DEFAULT '0',
	"markets_traded" integer DEFAULT 0,
	"win_rate" numeric(5, 2) DEFAULT '0',
	"pas_score" integer DEFAULT 50,
	"created_at" timestamp DEFAULT now(),
	"last_active" timestamp DEFAULT now(),
	CONSTRAINT "users_wallet_unique" UNIQUE("wallet")
);
--> statement-breakpoint
CREATE TABLE "watchlist" (
	"id" serial PRIMARY KEY NOT NULL,
	"wallet" varchar(44) NOT NULL,
	"market_pubkey" varchar(44) NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "watchlist_wallet_market_pubkey_unique" UNIQUE("wallet","market_pubkey")
);
