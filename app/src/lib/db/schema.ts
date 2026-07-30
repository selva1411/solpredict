import { pgTable, serial, varchar, text, decimal, bigint, boolean, timestamp, integer, date, unique } from 'drizzle-orm/pg-core';

export const marketsCache = pgTable('markets_cache', {
  id: serial('id').primaryKey(),
  marketPubkey: varchar('market_pubkey', { length: 44 }).unique().notNull(),
  marketId: bigint('market_id', { mode: 'number' }).notNull(),
  question: text('question').notNull(),
  description: text('description'),
  category: varchar('category', { length: 20 }),
  status: varchar('status', { length: 20 }).default('open'),
  winningOutcome: varchar('winning_outcome', { length: 10 }),
  yesPoolSol: decimal('yes_pool_sol', { precision: 18, scale: 9 }).default('0'),
  noPoolSol: decimal('no_pool_sol', { precision: 18, scale: 9 }).default('0'),
  yesSupply: bigint('yes_supply', { mode: 'number' }).default(0),
  noSupply: bigint('no_supply', { mode: 'number' }).default(0),
  endTs: timestamp('end_ts'),
  resolveTs: timestamp('resolve_ts'),
  thumbnailUrl: text('thumbnail_url'),
  tags: text('tags').array(),
  viewCount: integer('view_count').default(0),
  watchlistCount: integer('watchlist_count').default(0),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const trades = pgTable('trades', {
  id: serial('id').primaryKey(),
  signature: varchar('signature', { length: 88 }).unique().notNull(),
  marketPubkey: varchar('market_pubkey', { length: 44 }).notNull(),
  trader: varchar('trader', { length: 44 }).notNull(),
  side: varchar('side', { length: 3 }).notNull(),
  lamportsIn: bigint('lamports_in', { mode: 'number' }),
  tokensOut: bigint('tokens_out', { mode: 'number' }),
  pricePerToken: decimal('price_per_token', { precision: 18, scale: 9 }),
  blockTime: timestamp('block_time'),
  slot: bigint('slot', { mode: 'number' }),
});

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  wallet: varchar('wallet', { length: 44 }).unique().notNull(),
  username: varchar('username', { length: 50 }),
  avatarUrl: text('avatar_url'),
  bio: text('bio'),
  twitterHandle: varchar('twitter_handle', { length: 50 }),
  totalWagered: decimal('total_wagered', { precision: 18, scale: 9 }).default('0'),
  totalWon: decimal('total_won', { precision: 18, scale: 9 }).default('0'),
  totalProfit: decimal('total_profit', { precision: 18, scale: 9 }).default('0'),
  marketsTraded: integer('markets_traded').default(0),
  winRate: decimal('win_rate', { precision: 5, scale: 2 }).default('0'),
  pasScore: integer('pas_score').default(50),
  createdAt: timestamp('created_at').defaultNow(),
  lastActive: timestamp('last_active').defaultNow(),
});

export const marketComments = pgTable('market_comments', {
  id: serial('id').primaryKey(),
  marketPubkey: varchar('market_pubkey', { length: 44 }).notNull(),
  authorWallet: varchar('author_wallet', { length: 44 }).notNull(),
  authorUsername: varchar('author_username', { length: 50 }),
  authorAvatar: text('author_avatar'),
  content: text('content').notNull(),
  parentId: integer('parent_id'),
  upvotes: integer('upvotes').default(0),
  createdAt: timestamp('created_at').defaultNow(),
});

export const priceHistory = pgTable('price_history', {
  id: serial('id').primaryKey(),
  marketPubkey: varchar('market_pubkey', { length: 44 }).notNull(),
  timestamp: timestamp('timestamp').notNull(),
  yesPct: decimal('yes_pct', { precision: 5, scale: 2 }),
  yesPoolSol: decimal('yes_pool_sol', { precision: 18, scale: 9 }),
  noPoolSol: decimal('no_pool_sol', { precision: 18, scale: 9 }),
  totalVolume: decimal('total_volume', { precision: 18, scale: 9 }),
});

export const notifications = pgTable('notifications', {
  id: serial('id').primaryKey(),
  wallet: varchar('wallet', { length: 44 }).notNull(),
  type: varchar('type', { length: 30 }),
  marketPubkey: varchar('market_pubkey', { length: 44 }),
  message: text('message'),
  read: boolean('read').default(false),
  createdAt: timestamp('created_at').defaultNow(),
});

export const watchlist = pgTable('watchlist', {
  id: serial('id').primaryKey(),
  wallet: varchar('wallet', { length: 44 }).notNull(),
  marketPubkey: varchar('market_pubkey', { length: 44 }).notNull(),
  createdAt: timestamp('created_at').defaultNow(),
}, (t) => ({ unq: unique().on(t.wallet, t.marketPubkey) }));

export const marketProposals = pgTable('market_proposals', {
  id: serial('id').primaryKey(),
  proposalPubkey: varchar('proposal_pubkey', { length: 44 }).unique().notNull(),
  proposer: varchar('proposer', { length: 44 }).notNull(),
  question: text('question').notNull(),
  description: text('description'),
  category: varchar('category', { length: 20 }),
  oracleFeedId: varchar('oracle_feed_id', { length: 66 }),
  targetPrice: decimal('target_price', { precision: 20, scale: 8 }),
  endTs: timestamp('end_ts'),
  resolveTs: timestamp('resolve_ts'),
  bondLamports: bigint('bond_lamports', { mode: 'number' }),
  status: varchar('status', { length: 20 }).default('pending'),
  approvedMarketPubkey: varchar('approved_market_pubkey', { length: 44 }),
  rejectionReason: text('rejection_reason'),
  createdAt: timestamp('created_at').defaultNow(),
  resolvedAt: timestamp('resolved_at'),
});

export const priceAlerts = pgTable('price_alerts', {
  id: serial('id').primaryKey(),
  wallet: varchar('wallet', { length: 44 }).notNull(),
  marketPubkey: varchar('market_pubkey', { length: 44 }).notNull(),
  targetPrice: decimal('target_price', { precision: 20, scale: 8 }).notNull(),
  comparison: varchar('comparison', { length: 10 }).default('above'),
  triggered: boolean('triggered').default(false),
  triggeredAt: timestamp('triggered_at'),
  active: boolean('active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
});

export const leaderboardSnapshots = pgTable('leaderboard_snapshots', {
  id: serial('id').primaryKey(),
  wallet: varchar('wallet', { length: 44 }).notNull(),
  period: varchar('period', { length: 10 }),
  rank: integer('rank'),
  profitSol: decimal('profit_sol', { precision: 18, scale: 9 }),
  winRate: decimal('win_rate', { precision: 5, scale: 2 }),
  pasScore: integer('pas_score'),
  marketsCount: integer('markets_count'),
  snapshotDate: date('snapshot_date'),
});

export const liquidityPositions = pgTable('liquidity_positions', {
  id: serial('id').primaryKey(),
  wallet: varchar('wallet', { length: 44 }).notNull(),
  marketPubkey: varchar('market_pubkey', { length: 44 }).notNull(),
  amountSol: decimal('amount_sol', { precision: 18, scale: 9 }).default('0'),
  yesPoolSol: decimal('yes_pool_sol', { precision: 18, scale: 9 }).default('0'),
  noPoolSol: decimal('no_pool_sol', { precision: 18, scale: 9 }).default('0'),
  lpTokens: bigint('lp_tokens', { mode: 'number' }).default(0),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (t) => ({ unq: unique().on(t.wallet, t.marketPubkey) }));

export const lpPoolStats = pgTable('lp_pool_stats', {
  id: serial('id').primaryKey(),
  marketPubkey: varchar('market_pubkey', { length: 44 }).unique().notNull(),
  totalLiquiditySol: decimal('total_liquidity_sol', { precision: 18, scale: 9 }).default('0'),
  totalLpTokens: bigint('total_lp_tokens', { mode: 'number' }).default(0),
  feeEarnedSol: decimal('fee_earned_sol', { precision: 18, scale: 9 }).default('0'),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const adminSettings = pgTable('admin_settings', {
  key: varchar('key', { length: 50 }).primaryKey(),
  value: text('value').notNull(),
  updatedBy: varchar('updated_by', { length: 44 }),
  updatedAt: timestamp('updated_at').defaultNow(),
});

