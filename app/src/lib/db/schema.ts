import {
  pgTable,
  serial,
  varchar,
  text,
  decimal,
  bigint,
  boolean,
  timestamp,
  integer,
  date,
  unique,
  index,
  jsonb,
} from 'drizzle-orm/pg-core';

// =============================================================================
// MARKETS — indexed mirror of on-chain Market accounts
// =============================================================================

export const marketsCache = pgTable('markets_cache', {
  id: serial('id').primaryKey(),
  marketPubkey: varchar('market_pubkey', { length: 44 }).unique().notNull(),
  marketId: bigint('market_id', { mode: 'number' }).notNull(),
  creator: varchar('creator', { length: 44 }),
  question: text('question').notNull(),
  description: text('description'),
  category: varchar('category', { length: 20 }),
  outcomeType: varchar('outcome_type', { length: 20 }).default('binary'),
  status: varchar('status', { length: 20 }).default('open'),
  winningOutcome: varchar('winning_outcome', { length: 10 }),
  resolutionSource: text('resolution_source'),
  oracleFeedId: varchar('oracle_feed_id', { length: 66 }),
  feeCollectedLamports: bigint('fee_collected_lamports', { mode: 'number' }).default(0),
  totalPayoutPoolLamports: bigint('total_payout_pool_lamports', { mode: 'number' }).default(0),
  // Real on-chain pool/supply snapshots (lamports). Written by the indexer and
  // the frontend trade sync so every page shows identical, truthful numbers.
  yesPoolLamports: bigint('yes_pool_lamports', { mode: 'number' }).default(0),
  noPoolLamports: bigint('no_pool_lamports', { mode: 'number' }).default(0),
  yesSupply: bigint('yes_supply', { mode: 'number' }).default(0),
  noSupply: bigint('no_supply', { mode: 'number' }).default(0),
  feeBps: integer('fee_bps').default(200),
  liquidityParamB: decimal('liquidity_param_b', { precision: 18, scale: 9 }),
  totalVolume: decimal('total_volume', { precision: 18, scale: 9 }).default('0'),
  openInterest: decimal('open_interest', { precision: 18, scale: 9 }).default('0'),
  rentDepositLamports: bigint('rent_deposit_lamports', { mode: 'number' }),
  rentReclaimedAt: timestamp('rent_reclaimed_at'),
  createdSlot: bigint('created_slot', { mode: 'number' }),
  endTs: timestamp('end_ts'),
  resolveTs: timestamp('resolve_ts'),
  settledAt: timestamp('settled_at'),
  thumbnailUrl: text('thumbnail_url'),
  tags: text('tags').array(),
  viewCount: integer('view_count').default(0),
  watchlistCount: integer('watchlist_count').default(0),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (t) => ({
  statusCloseIdx: index('markets_status_close_idx').on(t.status, t.endTs),
  categoryIdx: index('markets_category_idx').on(t.category),
  creatorIdx: index('markets_creator_idx').on(t.creator),
  updatedAtIdx: index('markets_updated_at_idx').on(t.updatedAt),
}));

// =============================================================================
// MARKET OUTCOMES — one row per outcome (supports multi-outcome)
// =============================================================================

export const marketOutcomes = pgTable('market_outcomes', {
  id: serial('id').primaryKey(),
  marketPubkey: varchar('market_pubkey', { length: 44 }).notNull(),
  outcomeIndex: integer('outcome_index').notNull(),
  label: varchar('label', { length: 100 }).notNull(),
  sharesOutstanding: bigint('shares_outstanding', { mode: 'number' }).default(0),
  lastPriceBps: integer('last_price_bps').default(5000),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (t) => ({
  unq: unique().on(t.marketPubkey, t.outcomeIndex),
  marketIdx: index('outcomes_market_idx').on(t.marketPubkey),
}));

// =============================================================================
// PRICE HISTORY — chart + sparkline data
// =============================================================================

export const priceHistory = pgTable('price_history', {
  id: serial('id').primaryKey(),
  marketPubkey: varchar('market_pubkey', { length: 44 }).notNull(),
  outcomeIndex: integer('outcome_index').default(0),
  timestamp: timestamp('timestamp').notNull(),
  priceBps: integer('price_bps'),
  volume: decimal('volume', { precision: 18, scale: 9 }),
}, (t) => ({
  marketTsIdx: index('price_history_market_ts_idx').on(t.marketPubkey, t.timestamp),
}));

// =============================================================================
// TRADES — every fill
// =============================================================================

export const trades = pgTable('trades', {
  id: serial('id').primaryKey(),
  signature: varchar('signature', { length: 88 }).unique().notNull(),
  marketPubkey: varchar('market_pubkey', { length: 44 }).notNull(),
  outcomeIndex: integer('outcome_index').default(0),
  trader: varchar('trader', { length: 44 }).notNull(),
  side: varchar('side', { length: 4 }).notNull(),
  shares: bigint('shares', { mode: 'number' }),
  cost: bigint('cost', { mode: 'number' }),
  avgPriceBps: integer('avg_price_bps'),
  // Legacy columns for backward compatibility
  lamportsIn: bigint('lamports_in', { mode: 'number' }),
  tokensOut: bigint('tokens_out', { mode: 'number' }),
  pricePerToken: decimal('price_per_token', { precision: 18, scale: 9 }),
  feePaidLamports: bigint('fee_paid_lamports', { mode: 'number' }).default(0),
  blockTime: timestamp('block_time'),
  slot: bigint('slot', { mode: 'number' }),
}, (t) => ({
  traderTsIdx: index('trades_trader_ts_idx').on(t.trader, t.blockTime),
  marketTsIdx: index('trades_market_ts_idx').on(t.marketPubkey, t.blockTime),
}));

// =============================================================================
// POSITIONS — derived per user per outcome
// =============================================================================

export const positions = pgTable('positions', {
  id: serial('id').primaryKey(),
  wallet: varchar('wallet', { length: 44 }).notNull(),
  marketPubkey: varchar('market_pubkey', { length: 44 }).notNull(),
  outcomeIndex: integer('outcome_index').default(0),
  shares: bigint('shares', { mode: 'number' }).default(0),
  costBasis: bigint('cost_basis', { mode: 'number' }).default(0),
  realizedPnl: bigint('realized_pnl', { mode: 'number' }).default(0),
  claimed: boolean('claimed').default(false),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (t) => ({
  unq: unique().on(t.wallet, t.marketPubkey, t.outcomeIndex),
  walletIdx: index('positions_wallet_idx').on(t.wallet),
}));

// =============================================================================
// ORDERS — CLOB order book
// =============================================================================

export const orders = pgTable('orders', {
  id: serial('id').primaryKey(),
  pubkey: varchar('pubkey', { length: 44 }).unique(),
  marketPubkey: varchar('market_pubkey', { length: 44 }).notNull(),
  outcomeIndex: integer('outcome_index').default(0),
  owner: varchar('owner', { length: 44 }).notNull(),
  side: varchar('side', { length: 4 }).notNull(),
  priceBps: integer('price_bps').notNull(),
  size: bigint('size', { mode: 'number' }).notNull(),
  filled: bigint('filled', { mode: 'number' }).default(0),
  status: varchar('status', { length: 20 }).default('open'),
  createdAt: timestamp('created_at').defaultNow(),
}, (t) => ({
  marketIdx: index('orders_market_idx').on(t.marketPubkey),
  ownerIdx: index('orders_owner_idx').on(t.owner),
}));

// =============================================================================
// LIQUIDITY POSITIONS — LP
// =============================================================================

export const liquidityPositions = pgTable('liquidity_positions', {
  id: serial('id').primaryKey(),
  wallet: varchar('wallet', { length: 44 }).notNull(),
  marketPubkey: varchar('market_pubkey', { length: 44 }).notNull(),
  lpShares: bigint('lp_shares', { mode: 'number' }).default(0),
  deposited: decimal('deposited', { precision: 18, scale: 9 }).default('0'),
  feesEarned: decimal('fees_earned', { precision: 18, scale: 9 }).default('0'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (t) => ({
  unq: unique().on(t.wallet, t.marketPubkey),
}));

// =============================================================================
// MARKET PROPOSALS — proposal lifecycle
// =============================================================================

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
  reviewer: varchar('reviewer', { length: 44 }),
  reviewNote: text('review_note'),
  rejectionReason: text('rejection_reason'),
  createdAt: timestamp('created_at').defaultNow(),
  reviewedAt: timestamp('reviewed_at'),
  resolvedAt: timestamp('resolved_at'),
}, (t) => ({
  statusIdx: index('proposals_status_idx').on(t.status),
  proposerIdx: index('proposals_proposer_idx').on(t.proposer),
}));

// =============================================================================
// DISPUTES — dispute lifecycle
// =============================================================================

export const disputes = pgTable('disputes', {
  id: serial('id').primaryKey(),
  marketPubkey: varchar('market_pubkey', { length: 44 }).notNull(),
  disputer: varchar('disputer', { length: 44 }).notNull(),
  claimedOutcome: varchar('claimed_outcome', { length: 10 }),
  reason: text('reason').notNull(),
  evidenceUrl: text('evidence_url'),
  evidence: text('evidence'),
  bondLamports: bigint('bond_lamports', { mode: 'number' }),
  status: varchar('status', { length: 20 }).default('open'),
  resolution: text('resolution'),
  resolutionNote: text('resolution_note'),
  resolver: varchar('resolver', { length: 44 }),
  resolvedBy: varchar('resolved_by', { length: 44 }),
  createdAt: timestamp('created_at').defaultNow(),
  resolvedAt: timestamp('resolved_at'),
}, (t) => ({
  marketIdx: index('disputes_market_idx').on(t.marketPubkey),
  statusIdx: index('disputes_status_idx').on(t.status),
}));

// =============================================================================
// USERS — profile + basic stats
// =============================================================================

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  wallet: varchar('wallet', { length: 44 }).unique().notNull(),
  username: varchar('username', { length: 50 }).unique(),
  avatarUrl: text('avatar_url'),
  bio: text('bio'),
  twitterHandle: varchar('twitter_handle', { length: 50 }),
  role: varchar('role', { length: 20 }).default('user'),
  isBanned: boolean('is_banned').default(false),
  createdAt: timestamp('created_at').defaultNow(),
  lastActive: timestamp('last_active').defaultNow(),
});

// =============================================================================
// USER STATS — materialized aggregates (computed from trades + positions)
// =============================================================================

export const userStats = pgTable('user_stats', {
  wallet: varchar('wallet', { length: 44 }).primaryKey(),
  totalVolume: decimal('total_volume', { precision: 18, scale: 9 }).default('0'),
  tradeCount: integer('trade_count').default(0),
  marketsTraded: integer('markets_traded').default(0),
  marketsResolved: integer('markets_resolved').default(0),
  wins: integer('wins').default(0),
  losses: integer('losses').default(0),
  winRateBps: integer('win_rate_bps'),
  realizedPnl: decimal('realized_pnl', { precision: 18, scale: 9 }).default('0'),
  unrealizedPnl: decimal('unrealized_pnl', { precision: 18, scale: 9 }).default('0'),
  roiBps: integer('roi_bps'),
  bestTrade: decimal('best_trade', { precision: 18, scale: 9 }).default('0'),
  currentStreak: integer('current_streak').default(0),
  rank: integer('rank'),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// =============================================================================
// REWARDS — claimable rewards
// =============================================================================

export const rewards = pgTable('rewards', {
  id: serial('id').primaryKey(),
  wallet: varchar('wallet', { length: 44 }).notNull(),
  epoch: integer('epoch'),
  kind: varchar('kind', { length: 20 }),
  amount: bigint('amount', { mode: 'number' }),
  status: varchar('status', { length: 20 }).default('accrued'),
  claimSignature: varchar('claim_signature', { length: 88 }),
  claimedAt: timestamp('claimed_at'),
  createdAt: timestamp('created_at').defaultNow(),
}, (t) => ({
  walletStatusIdx: index('rewards_wallet_status_idx').on(t.wallet, t.status),
}));

// =============================================================================
// TREASURY LEDGER — admin wallet audit trail
// =============================================================================

export const treasuryLedger = pgTable('treasury_ledger', {
  id: serial('id').primaryKey(),
  ts: timestamp('ts').defaultNow(),
  signature: varchar('signature', { length: 88 }),
  direction: varchar('direction', { length: 3 }).notNull(),
  kind: varchar('kind', { length: 30 }).notNull(),
  amount: bigint('amount', { mode: 'number' }).notNull(),
  mint: varchar('mint', { length: 44 }),
  marketPubkey: varchar('market_pubkey', { length: 44 }),
  actor: varchar('actor', { length: 44 }),
  note: text('note'),
  createdAt: timestamp('created_at').defaultNow(),
});

// =============================================================================
// PLATFORM CONFIG — mutable settings (single row)
// =============================================================================

export const platformConfig = pgTable('platform_config', {
  id: serial('id').primaryKey(),
  feeBps: integer('fee_bps').default(200),
  minLiquidity: bigint('min_liquidity', { mode: 'number' }).default(0),
  proposalBond: bigint('proposal_bond', { mode: 'number' }).default(0),
  disputeBond: bigint('dispute_bond', { mode: 'number' }).default(0),
  disputeWindowSecs: integer('dispute_window_secs').default(86400),
  paused: boolean('paused').default(false),
  pauseReason: text('pause_reason'),
  treasuryWallet: varchar('treasury_wallet', { length: 44 }),
  adminWallets: text('admin_wallets').array(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// =============================================================================
// NOTIFICATIONS
// =============================================================================

export const notifications = pgTable('notifications', {
  id: serial('id').primaryKey(),
  wallet: varchar('wallet', { length: 44 }).notNull(),
  type: varchar('type', { length: 30 }),
  marketPubkey: varchar('market_pubkey', { length: 44 }),
  message: text('message'),
  read: boolean('read').default(false),
  createdAt: timestamp('created_at').defaultNow(),
}, (t) => ({
  walletIdx: index('notifications_wallet_idx').on(t.wallet),
}));

// =============================================================================
// WATCHLIST
// =============================================================================

export const watchlist = pgTable('watchlist', {
  id: serial('id').primaryKey(),
  wallet: varchar('wallet', { length: 44 }).notNull(),
  marketPubkey: varchar('market_pubkey', { length: 44 }).notNull(),
  createdAt: timestamp('created_at').defaultNow(),
}, (t) => ({ unq: unique().on(t.wallet, t.marketPubkey) }));

// =============================================================================
// COMMENTS (renamed from market_comments for clarity, keeping table name)
// =============================================================================

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

// =============================================================================
// COMMENT VOTES
// =============================================================================

export const commentVotes = pgTable('comment_votes', {
  id: serial('id').primaryKey(),
  commentId: integer('comment_id').notNull(),
  wallet: varchar('wallet', { length: 44 }).notNull(),
  vote: integer('vote').default(1),
  createdAt: timestamp('created_at').defaultNow(),
}, (t) => ({
  unq: unique().on(t.commentId, t.wallet),
}));

// =============================================================================
// FOLLOWS
// =============================================================================

export const follows = pgTable('follows', {
  id: serial('id').primaryKey(),
  followerWallet: varchar('follower_wallet', { length: 44 }).notNull(),
  followedWallet: varchar('followed_wallet', { length: 44 }).notNull(),
  createdAt: timestamp('created_at').defaultNow(),
}, (t) => ({
  unq: unique().on(t.followerWallet, t.followedWallet),
  followerIdx: index('follows_follower_idx').on(t.followerWallet),
  followedIdx: index('follows_followed_idx').on(t.followedWallet),
}));

// =============================================================================
// ACHIEVEMENTS
// =============================================================================

export const achievements = pgTable('achievements', {
  id: serial('id').primaryKey(),
  wallet: varchar('wallet', { length: 44 }).notNull(),
  kind: varchar('kind', { length: 50 }).notNull(),
  name: varchar('name', { length: 100 }).notNull(),
  description: text('description'),
  awardedAt: timestamp('awarded_at').defaultNow(),
}, (t) => ({
  walletIdx: index('achievements_wallet_idx').on(t.wallet),
}));

// =============================================================================
// AUDIT LOG — immutable admin action log
// =============================================================================

export const auditLog = pgTable('audit_log', {
  id: serial('id').primaryKey(),
  action: varchar('action', { length: 100 }).notNull(),
  actor: varchar('actor', { length: 44 }).notNull(),
  resource: text('resource'),
  details: jsonb('details'),
  ip: varchar('ip', { length: 45 }),
  createdAt: timestamp('created_at').defaultNow(),
}, (t) => ({
  actorIdx: index('audit_log_actor_idx').on(t.actor),
  tsIdx: index('audit_log_ts_idx').on(t.createdAt),
}));

// =============================================================================
// INDEXER CURSOR — resumable indexer state
// =============================================================================

export const indexerCursor = pgTable('indexer_cursor', {
  id: serial('id').primaryKey(),
  lastSignature: varchar('last_signature', { length: 88 }),
  lastSlot: bigint('last_slot', { mode: 'number' }),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// =============================================================================
// LEGACY TABLES — kept for backward compatibility
// =============================================================================

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

export const treasuryWithdrawals = pgTable('treasury_withdrawals', {
  id: serial('id').primaryKey(),
  amountSol: decimal('amount_sol', { precision: 18, scale: 9 }).notNull(),
  signature: varchar('signature', { length: 88 }),
  recipient: varchar('recipient', { length: 44 }).notNull(),
  status: varchar('status', { length: 20 }).default('pending'),
  createdAt: timestamp('created_at').defaultNow(),
});
