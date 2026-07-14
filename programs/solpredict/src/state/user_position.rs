use anchor_lang::prelude::*;

/// UserPosition PDA — one per user per market.
/// Seeds: ["position", market_pubkey, user_pubkey]
///
/// Token balances in the user's ATAs are the source of truth for claim
/// amounts; this PDA is a portfolio-page index AND the double-claim guard.
#[account]
pub struct UserPosition {
    /// Owner of this position.
    pub owner: Pubkey,

    /// Market this position belongs to.
    pub market: Pubkey,

    /// Number of YES shares purchased (in base units, i.e. shares * 10^6).
    pub yes_amount: u64,

    /// Number of NO shares purchased (in base units).
    pub no_amount: u64,

    /// Whether rewards/refund have been claimed. Double-claim guard.
    pub claimed: bool,

    /// Total lamports spent across all purchases in this market.
    /// Used for portfolio P&L display on the frontend.
    pub total_spent_lamports: u64,

    /// PDA canonical bump.
    pub bump: u8,
}

impl UserPosition {
    /// Exact space calculation.
    /// 8  discriminator
    /// 32 owner (Pubkey)
    /// 32 market (Pubkey)
    /// 8  yes_amount (u64)
    /// 8  no_amount (u64)
    /// 1  claimed (bool)
    /// 8  total_spent_lamports (u64)
    /// 1  bump (u8)
    pub const LEN: usize = 8 + 32 + 32 + 8 + 8 + 1 + 8 + 1;
}
