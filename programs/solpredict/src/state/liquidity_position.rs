use anchor_lang::prelude::*;

/// Liquidity Provider position for a single market.
/// Tracks how much liquidity an LP has deposited.
#[account]
pub struct LiquidityPosition {
    /// LP wallet address
    pub owner: Pubkey,
    /// Market this LP position belongs to
    pub market: Pubkey,
    /// Amount of LP tokens minted (representing share of the pool)
    pub lp_tokens: u64,
    /// Total YES tokens deposited
    pub yes_deposited: u64,
    /// Total NO tokens deposited
    pub no_deposited: u64,
    /// Total lamports deposited as liquidity
    pub total_lamports_deposited: u64,
    /// Unix timestamp when position was created
    pub created_at: i64,
    /// Unix timestamp of last liquidity modification
    pub updated_at: i64,
    /// PDA bump
    pub bump: u8,
}

impl LiquidityPosition {
    pub const LEN: usize = 8   // discriminator
        + 32                    // owner
        + 32                    // market
        + 8                     // lp_tokens
        + 8                     // yes_deposited
        + 8                     // no_deposited
        + 8                     // total_lamports_deposited
        + 8                     // created_at
        + 8                     // updated_at
        + 1;                    // bump
}

/// Emergency pause state — singleton account.
/// When paused, all non-admin trading is halted.
#[account]
pub struct EmergencyPause {
    /// Whether the program is paused
    pub paused: bool,
    /// Admin who paused (for audit trail)
    pub paused_by: Pubkey,
    /// Timestamp of pause
    pub paused_at: i64,
    /// Multisig addresses that can unpause
    pub guardians: [Pubkey; 3],
    /// Number of guardian confirmations required to unpause
    pub required_confirmations: u8,
    /// Current guardian confirmations count
    pub confirmations: u8,
    /// PDA bump
    pub bump: u8,
}

impl EmergencyPause {
    pub const LEN: usize = 8    // discriminator
        + 1                     // paused
        + 32                    // paused_by
        + 8                     // paused_at
        + (32 * 3)              // guardians
        + 1                     // required_confirmations
        + 1                     // confirmations
        + 1;                    // bump
}