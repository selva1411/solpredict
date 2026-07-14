use anchor_lang::prelude::*;

/// Config PDA — singleton account storing program-wide configuration.
/// Seeds: ["config"]
/// Created once by `initialize_config`. Anchor's `init` constraint
/// naturally rejects a second call (account already exists).
#[account]
pub struct Config {
    /// The admin pubkey — only this key can create/settle/cancel markets
    /// and withdraw fees.
    pub admin: Pubkey,

    /// Protocol fee in basis points (e.g. 200 = 2%), validated ≤ 1000 (10%).
    /// Taken from the losing pool only at settlement time.
    pub fee_bps: u16,

    /// Auto-incrementing market counter, used as each market's unique id.
    /// Also used as part of the Market PDA seed.
    pub market_count: u64,

    /// PDA canonical bump, stored on-chain for efficient re-derivation.
    pub bump: u8,
}

impl Config {
    /// Exact space calculation for Anchor `init` constraint.
    /// 8 (discriminator) + 32 (admin) + 2 (fee_bps) + 8 (market_count) + 1 (bump)
    pub const LEN: usize = 8 + 32 + 2 + 8 + 1;
}
