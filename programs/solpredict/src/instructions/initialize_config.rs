use anchor_lang::prelude::*;

use crate::constants::*;
use crate::errors::SolPredictError;
use crate::state::Config;

/// Accounts for the `initialize_config` instruction.
///
/// One-time bootstrap: whoever calls this first becomes the permanent admin
/// for the whole program deployment. Anchor's `init` constraint prevents
/// double-initialization (fails if the account already exists).
#[derive(Accounts)]
pub struct InitializeConfig<'info> {
    /// The caller who will become the program admin.
    #[account(mut)]
    pub admin: Signer<'info>,

    /// Config PDA — singleton, created once.
    /// Seeds: ["config"]
    #[account(
        init,
        payer = admin,
        space = Config::LEN,
        seeds = [CONFIG_SEED],
        bump,
    )]
    pub config: Account<'info, Config>,

    pub system_program: Program<'info, System>,
}

/// Handler for `initialize_config`.
///
/// Sets the admin pubkey, fee basis points, and initializes market_count to 0.
/// Fee is validated to not exceed 10% (1000 bps).
pub fn handler(ctx: Context<InitializeConfig>, fee_bps: u16) -> Result<()> {
    // 1. Validate fee is within acceptable range (max 10%)
    require!(fee_bps <= MAX_FEE_BPS, SolPredictError::FeeTooHigh);

    // 2. Populate config fields
    let config = &mut ctx.accounts.config;
    config.admin = ctx.accounts.admin.key();
    config.fee_bps = fee_bps;
    config.market_count = 0;
    config.bump = ctx.bumps.config;

    msg!("Config initialized. Admin: {}, Fee: {} bps", config.admin, config.fee_bps);

    Ok(())
}
