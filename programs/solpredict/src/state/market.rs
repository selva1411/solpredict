use anchor_lang::prelude::*;

use crate::constants::{MAX_DESCRIPTION_LEN, MAX_QUESTION_LEN};
use crate::utils::ReentrancyLock;

// ============================================================================
// Enums — stored as u8 on-chain, matching the spec's numbering exactly.
// ============================================================================

/// Market lifecycle status.
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace, Debug)]
#[repr(u8)]
pub enum MarketStatus {
    Open = 0,
    Settled = 1,
    Cancelled = 2,
}

/// Winning outcome after settlement.
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace, Debug)]
#[repr(u8)]
pub enum WinningOutcome {
    Unset = 0,
    Yes = 1,
    No = 2,
}

/// Price comparison direction for settlement.
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace, Debug)]
#[repr(u8)]
pub enum Comparison {
    GreaterThan = 0,
    LessThan = 1,
}

/// Market category for frontend filtering.
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace, Debug)]
#[repr(u8)]
pub enum Category {
    Crypto = 0,
    Sports = 1,
    Politics = 2,
    Tech = 3,
    Other = 4,
}

/// Side for buy_shares instruction — YES or NO.
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace, Debug)]
pub enum Side {
    Yes,
    No,
}

// ============================================================================
// Market PDA — one per market
// Seeds: ["market", market_id.to_le_bytes()]
// ============================================================================

#[account]
pub struct Market {
    /// Unique market identifier (auto-incremented from Config.market_count).
    pub market_id: u64,

    /// Market creator (== config.admin for MVP).
    pub authority: Pubkey,

    /// The prediction question (e.g. "Will SOL close above $250...?").
    /// Max 200 characters.
    pub question: String,

    /// Settlement rules / description text. Max 400 characters.
    pub description: String,

    /// Market category for frontend filtering.
    pub category: Category,

    /// Pyth oracle feed id for the asset this market tracks.
    /// Verified at settlement time against the passed-in price account.
    pub oracle_feed_id: [u8; 32],

    /// Target price for settlement comparison (in Pyth's fixed-point format).
    pub target_price: i64,

    /// Target price exponent (matches Pyth's exponent representation).
    pub target_expo: i32,

    /// How to compare oracle price vs target: GreaterThan or LessThan.
    pub comparison: Comparison,

    /// Unix timestamp when trading stops (no more buys accepted after this).
    pub end_ts: i64,

    /// Earliest unix timestamp when settlement is allowed (>= end_ts).
    pub resolve_ts: i64,

    /// Current lifecycle status: Open, Settled, or Cancelled.
    pub status: MarketStatus,

    /// Winner after settlement: Unset, Yes, or No.
    pub winning_outcome: WinningOutcome,

    /// Pubkey of the YES SPL token mint (PDA-derived).
    pub yes_mint: Pubkey,

    /// Pubkey of the NO SPL token mint (PDA-derived).
    pub no_mint: Pubkey,

    /// Total lamports deposited by YES-side buyers.
    pub yes_pool_lamports: u64,

    /// Total lamports deposited by NO-side buyers.
    pub no_pool_lamports: u64,

    /// Total YES tokens minted (in base units, i.e. shares * 10^6).
    pub yes_supply: u64,

    /// Total NO tokens minted (in base units).
    pub no_supply: u64,

    /// Computed at settlement: total_pool - fee. This is the pot winners split.
    pub total_payout_pool: u64,

    /// Fee collected at settlement (from losing pool only).
    pub fee_collected: u64,

    /// Double-withdraw guard for admin fee withdrawal.
    pub fee_withdrawn: bool,

    /// Total lamports already claimed by winners (prevents treasury over-drain).
    pub total_claimed: u64,

    /// Oracle price used for settlement (stored for transparency/auditability).
    pub settled_price: i64,

    /// Oracle exponent at settlement time.
    pub settled_expo: i32,

    /// Timestamp of settlement.
    pub settled_at: i64,

    /// Fixed price per share in lamports (set at market creation).
    pub share_price_lamports: u64,

    /// Market PDA canonical bump.
    pub bump: u8,

    /// Treasury PDA canonical bump (stored here for efficient claim/refund CPIs).
    pub treasury_bump: u8,

    /// Fee in basis points (e.g. 30 = 0.3%). Charged from the losing pool at settlement.
    pub fee_bps: u16,

    /// Reentrancy protection lock.
    pub reentrancy_lock: ReentrancyLock,
}

impl Market {
    /// Exact space calculation.
    /// 8  discriminator
    /// 8  market_id (u64)
    /// 32 authority (Pubkey)
    /// 4 + MAX_QUESTION_LEN  question (String: 4-byte length prefix + content)
    /// 4 + MAX_DESCRIPTION_LEN  description
    /// 1  category (enum u8)
    /// 32 oracle_feed_id ([u8; 32])
    /// 8  target_price (i64)
    /// 4  target_expo (i32)
    /// 1  comparison (enum u8)
    /// 8  end_ts (i64)
    /// 8  resolve_ts (i64)
    /// 1  status (enum u8)
    /// 1  winning_outcome (enum u8)
    /// 32 yes_mint (Pubkey)
    /// 32 no_mint (Pubkey)
    /// 8  yes_pool_lamports (u64)
    /// 8  no_pool_lamports (u64)
    /// 8  yes_supply (u64)
    /// 8  no_supply (u64)
    /// 8  total_payout_pool (u64)
    /// 8  fee_collected (u64)
    /// 1  fee_withdrawn (bool)
    /// 8  total_claimed (u64)
    /// 8  settled_price (i64)
    /// 4  settled_expo (i32)
    /// 8  settled_at (i64)
    /// 8  share_price_lamports (u64)
    /// 2  fee_bps (u16)
    /// 1  bump (u8)
    /// 1  treasury_bump (u8)
    /// 1  reentrancy_lock.locked (u8)
    /// 32 reentrancy_lock.locker (Pubkey)
    pub const LEN: usize = 8   // discriminator
        + 8                     // market_id
        + 32                    // authority
        + (4 + MAX_QUESTION_LEN)    // question
        + (4 + MAX_DESCRIPTION_LEN) // description
        + 1                     // category
        + 32                    // oracle_feed_id
        + 8                     // target_price
        + 4                     // target_expo
        + 1                     // comparison
        + 8                     // end_ts
        + 8                     // resolve_ts
        + 1                     // status
        + 1                     // winning_outcome
        + 32                    // yes_mint
        + 32                    // no_mint
        + 8                     // yes_pool_lamports
        + 8                     // no_pool_lamports
        + 8                     // yes_supply
        + 8                     // no_supply
        + 8                     // total_payout_pool
        + 8                     // fee_collected
        + 1                     // fee_withdrawn
        + 8                     // total_claimed
        + 8                     // settled_price
        + 4                     // settled_expo
        + 8                     // settled_at
        + 8                     // share_price_lamports
        + 2                     // fee_bps
        + 1                     // bump
        + 1                     // treasury_bump
        + 1                     // reentrancy_lock.locked
        + 32;                   // reentrancy_lock.locker
}
